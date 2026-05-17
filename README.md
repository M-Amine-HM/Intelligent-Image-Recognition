# Intelligent Image Recognition

A full-stack image classification app built with FastAPI and a React (Vite) frontend. The backend loads a Hugging Face ViT model locally and returns top-5 predictions for uploaded images.

## Features
- FastAPI backend with a /classify endpoint for image uploads
- Hugging Face Transformers ViT model inference
- React UI (Vite) for quick local development

## Project Structure
```
backend/   # FastAPI API
frontend/  # React (Vite) client
```

## How It Runs (Local vs Hugging Face API)
- Local inference: the FastAPI server runs the model locally using the Transformers library.
- Hugging Face usage: the first run may download model weights from Hugging Face if not cached. If you use a private model, set `HF_TOKEN`.
- No hosted inference API calls are required for normal operation.

## Setup

### Backend
1. Create and activate a Python environment.
2. Install dependencies:
   ```
   pip install -r backend/requirements.txt
   ```
3. (Optional) Create a .env file in backend/ and set environment variables:
   ```
   HF_MODEL=google/vit-base-patch16-224
   HF_TOKEN=your_hf_token
   ```
4. Run the API from the repository root:
   ```
   uvicorn app.main:app --reload --app-dir backend
   ```

### Frontend
1. Install dependencies:
   ```
   cd frontend
   npm install
   ```
2. Start the dev server:
   ```
   npm run dev
   ```

## API
- GET /health
- POST /classify
  - Form field: file (image)
  - Response: top-5 predictions with label and score

## Environment Variables
- `HF_MODEL`: Hugging Face model ID to load (default: `google/vit-base-patch16-224`).
- `HF_TOKEN`: Hugging Face access token (required only for private models).

## Notes
- The backend enables CORS for http://localhost:5173.
- Do not commit your .env file or HF token.
