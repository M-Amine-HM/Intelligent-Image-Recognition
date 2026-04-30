import os
from io import BytesIO

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import torch
from PIL import Image
from transformers import AutoImageProcessor, AutoModelForImageClassification

load_dotenv()

DEFAULT_MODEL = "google/vit-base-patch16-224"

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


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok"}


@app.post("/classify")
async def classify_image(file: UploadFile = File(...)) -> dict:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400, detail="Please upload an image file.")

    image_bytes = await file.read()
    try:
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
    except Exception as exc:
        raise HTTPException(
            status_code=400, detail="Invalid image file.") from exc

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

    return {"predictions": top}
