import os
import re
import platform
from collections import Counter

import uvicorn
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel

SERVICE_NAME = os.getenv("SERVICE_NAME", "python-analyzer")
PORT = int(os.getenv("APP_PORT", "8000"))

app = FastAPI(title=SERVICE_NAME, version="1.0.0")

STOPWORDS = {
    "the", "a", "an", "and", "or", "of", "to", "in", "is", "it",
    "this", "that", "for", "on", "with", "as", "are", "be", "was",
}


class AnalyzeRequest(BaseModel):
    text: str


@app.get("/health")
def health():
    return {"status": "ok", "service": SERVICE_NAME}


@app.get("/info")
def info():
    return {
        "service": SERVICE_NAME,
        "runtime": "python",
        "pythonVersion": platform.python_version(),
        "platform": platform.system(),
    }


@app.post("/analyze")
def analyze(payload: AnalyzeRequest):
    text = payload.text or ""
    if len(text) > 20000:
        return JSONResponse(status_code=400, content={"error": "text too long (max 20000 chars)"})

    words = re.findall(r"[A-Za-z0-9']+", text.lower())
    meaningful = [w for w in words if w not in STOPWORDS]
    top = Counter(meaningful).most_common(5)

    return {
        "characters": len(text),
        "charactersNoSpaces": len(re.sub(r"\s", "", text)),
        "words": len(words),
        "uniqueWords": len(set(words)),
        "sentences": len([s for s in re.split(r"[.!?]+", text) if s.strip()]),
        "topWords": [{"word": w, "count": c} for w, c in top],
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)
