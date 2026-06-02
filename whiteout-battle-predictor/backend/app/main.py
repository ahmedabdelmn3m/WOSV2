"""
WHITEOUT SURVIVAL — Battle Predictor
FastAPI Backend — main.py
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import battles, presets, feedback, users

app = FastAPI(
    title="Whiteout Battle Predictor API",
    description="Battle simulation and reverse optimization engine for Whiteout Survival",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # Restrict to your domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(presets.router, prefix="/api/presets", tags=["presets"])
app.include_router(battles.router, prefix="/api/battles", tags=["battles"])
app.include_router(feedback.router, prefix="/api/feedback", tags=["feedback"])

@app.get("/")
def health():
    return {"status": "online", "version": "1.0.0"}
