import os
from io import BytesIO
from datetime import datetime, timedelta, timezone
from typing import Any

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
import torch
from PIL import Image
from transformers import AutoImageProcessor, AutoModelForImageClassification

load_dotenv()

DEFAULT_MODEL = "google/vit-base-patch16-224"
DEFAULT_TOKEN_EXPIRE_MIN = 30
ALGORITHM = "HS256"

users_db: dict[str, dict] = {}
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

app = FastAPI(title="ViT Image Classifier")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def load_model() -> None:
    model_name = os.getenv("HF_MODEL", DEFAULT_MODEL)
    hf_token = os.getenv("HF_TOKEN")

    app.state.processor = AutoImageProcessor.from_pretrained(
        model_name,
        token=hf_token if hf_token else None,
    )
    app.state.model = AutoModelForImageClassification.from_pretrained(
        model_name,
        token=hf_token if hf_token else None,
    )
    app.state.model.eval()


class AuthRequest(BaseModel):
    username: str
    password: str


def create_token(data: dict[str, Any]) -> str:
    secret_key = os.getenv("SECRET_KEY")
    if not secret_key:
        raise HTTPException(status_code=500, detail="Server not configured.")

    expire_minutes = int(
        os.getenv("TOKEN_EXPIRE_MIN", DEFAULT_TOKEN_EXPIRE_MIN))
    expire = datetime.now(timezone.utc) + timedelta(minutes=expire_minutes)
    to_encode = data.copy()
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, secret_key, algorithm=ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    secret_key = os.getenv("SECRET_KEY")
    if not secret_key:
        raise HTTPException(status_code=500, detail="Server not configured.")

    try:
        return jwt.decode(token, secret_key, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid token.") from exc


def require_jwt(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token.")

    token = authorization.split(" ", 1)[1].strip()
    payload = decode_token(token)
    username = payload.get("sub")
    if not username or username not in users_db:
        raise HTTPException(status_code=401, detail="Invalid token.")

    return payload


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok"}


@app.post("/auth/register")
def register_user(payload: AuthRequest) -> dict:
    username = payload.username.strip()
    if not username or not payload.password:
        raise HTTPException(
            status_code=400, detail="Username and password required.")
    if username in users_db:
        raise HTTPException(status_code=409, detail="User already exists.")

    users_db[username] = {
        "hashed_password": pwd_context.hash(payload.password),
        "attempts_remaining": 3,
    }
    return {"username": username}


@app.post("/auth/login")
def login_user(payload: AuthRequest) -> dict:
    username = payload.username.strip()
    user = users_db.get(username)
    if not user or not pwd_context.verify(payload.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials.")

    token = create_token({"sub": username})
    return {"access_token": token, "token_type": "bearer"}


@app.get("/me")
def get_me(payload: dict = Depends(require_jwt)) -> dict:
    username = payload.get("sub")
    user = users_db.get(username, {})
    return {
        "username": username,
        "attempts_remaining": user.get("attempts_remaining", 0),
    }


@app.post("/classify")
async def classify_image(
    file: UploadFile = File(...),
    payload: dict = Depends(require_jwt),
) -> dict:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400, detail="Please upload an image file.")

    username = payload.get("sub")
    user = users_db.get(username)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token.")
    if user.get("attempts_remaining", 0) <= 0:
        raise HTTPException(status_code=403, detail="No attempts remaining.")

    image_bytes = await file.read()
    try:
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
    except Exception as exc:
        raise HTTPException(
            status_code=400, detail="Invalid image file.") from exc

    try:
        inputs_np = app.state.processor(
            images=[image],
            return_tensors="np",
            padding=True,
        )
        inputs = {
            "pixel_values": torch.from_numpy(inputs_np["pixel_values"]),
        }
        with torch.no_grad():
            outputs = app.state.model(**inputs)
            probs = torch.softmax(outputs.logits, dim=-1)[0]

        top_scores, top_indices = torch.topk(probs, k=5)
        id_to_label = app.state.model.config.id2label
        top = [
            {
                "label": id_to_label.get(int(idx), str(int(idx))),
                "score": float(score),
            }
            for score, idx in zip(top_scores, top_indices)
        ]
    except Exception as exc:
        raise HTTPException(
            status_code=502, detail="Classification failed.") from exc

    user["attempts_remaining"] = max(user["attempts_remaining"] - 1, 0)

    return {"predictions": top}
