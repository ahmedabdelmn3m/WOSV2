"""
WHITEOUT SURVIVAL — Feedback API Router
Stores battle outcome feedback for model calibration.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime

router = APIRouter()

# In-memory store for MVP (replace with DB in production)
feedback_store = []


class FeedbackCreate(BaseModel):
    prediction_id: str
    predicted_winner: str
    actual_winner: str
    win_probability_at_prediction: float
    loss_accuracy_rating: Optional[int] = None


@router.post("/")
def submit_feedback(fb: FeedbackCreate):
    """
    Submit post-battle feedback.
    Records predicted vs actual outcome for model calibration.
    """
    correct = fb.predicted_winner == fb.actual_winner
    entry = {
        "id": str(uuid.uuid4()),
        "prediction_id": fb.prediction_id,
        "predicted_winner": fb.predicted_winner,
        "actual_winner": fb.actual_winner,
        "win_probability_at_prediction": fb.win_probability_at_prediction,
        "correct": correct,
        "loss_accuracy_rating": fb.loss_accuracy_rating,
        "created_at": datetime.utcnow().isoformat(),
    }
    feedback_store.append(entry)
    return {"id": entry["id"], "correct": correct, "message": "Feedback recorded"}


@router.get("/stats")
def feedback_stats():
    """Aggregate stats for model calibration dashboard."""
    if not feedback_store:
        return {"total": 0, "correct": 0, "accuracy": None}
    correct = sum(1 for f in feedback_store if f["correct"])
    return {
        "total": len(feedback_store),
        "correct": correct,
        "accuracy": round(correct / len(feedback_store) * 100, 1),
        "recent": feedback_store[-10:]
    }
