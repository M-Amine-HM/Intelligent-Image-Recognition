# intelligent Image Recognition

A full-stack image classification app built with FastAPI and a React (Vite) frontend. The backend loads a Hugging Face ViT model and returns top-5 predictions for uploaded images.

## Features
- FastAPI backend with a /classify endpoint for image uploads
- Hugging Face Transformers ViT model inference
- React UI (Vite) for quick local development

## Project Structure
```
backend/   # FastAPI API
frontend/  # React (Vite) client
```

## Setup

### Backend
1. Create and activate a Python environment.
2. Install dependencies:
   ```
   pip install -r backend/requirements.txt
   ```
3. (Optional) Create a .env file in backend/ and set:
   ```
   HF_MODEL=google/vit-base-patch16-224
   HF_TOKEN=your_hf_token
   ```
4. Run the API:
   ```
   uvicorn app.main:app --reload
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

## Notes
- The backend enables CORS for http://localhost:5173.
- Do not commit your .env file or HF token.
