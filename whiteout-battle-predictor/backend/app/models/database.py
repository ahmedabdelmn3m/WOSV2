"""
WHITEOUT SURVIVAL — SQLAlchemy Database Models
Database: PostgreSQL via Supabase
"""

from sqlalchemy import Column, String, Float, Boolean, Integer, DateTime, JSON, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

Base = declarative_base()


def gen_id():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_id)
    username = Column(String(64), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    presets = relationship("Preset", back_populates="user", cascade="all, delete-orphan")
    predictions = relationship("Prediction", back_populates="user")
    feedback_logs = relationship("FeedbackLog", back_populates="user")


class Preset(Base):
    """User's saved stat configuration (12 stats × 3 troop types)."""
    __tablename__ = "presets"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=False)

    # Stats stored as JSON: {infantry: {atk, atk_pct, def, def_pct, hp, hp_pct, leth, leth_pct}, ...}
    stats = Column(JSON, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="presets")
    predictions = relationship("Prediction", back_populates="preset")


class EnemyScout(Base):
    """Saved enemy scout report."""
    __tablename__ = "enemy_scouts"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    label = Column(String(100), nullable=True)  # Optional label e.g. "Player X"
    stats = Column(JSON, nullable=False)         # Same structure as preset stats
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    predictions = relationship("Prediction", back_populates="enemy_scout")


class Prediction(Base):
    """Stored output of a battle simulation."""
    __tablename__ = "predictions"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    preset_id = Column(String, ForeignKey("presets.id"), nullable=True)
    enemy_scout_id = Column(String, ForeignKey("enemy_scouts.id"), nullable=True)

    # Snapshot of inputs at prediction time
    user_stats_snapshot = Column(JSON, nullable=False)
    enemy_stats_snapshot = Column(JSON, nullable=False)

    # Simulation outputs
    win_probability = Column(Float, nullable=False)
    predicted_winner = Column(String(10), nullable=False)   # "user" | "enemy"
    rounds_fought = Column(Integer)
    user_losses_pct = Column(JSON)
    enemy_losses_pct = Column(JSON)
    biggest_advantage = Column(String(50))
    biggest_weakness = Column(String(50))
    recommended_formation = Column(JSON)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="predictions")
    preset = relationship("Preset", back_populates="predictions")
    enemy_scout = relationship("EnemyScout", back_populates="predictions")
    feedback = relationship("FeedbackLog", back_populates="prediction", uselist=False)


class BattleReport(Base):
    """Post-battle report submitted by user."""
    __tablename__ = "battle_reports"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    prediction_id = Column(String, ForeignKey("predictions.id"), nullable=True)
    actual_winner = Column(String(10), nullable=False)    # "user" | "enemy"
    user_losses_actual = Column(JSON, nullable=True)      # Optional actual losses
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class FeedbackLog(Base):
    """Prediction feedback for model calibration."""
    __tablename__ = "feedback_logs"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    prediction_id = Column(String, ForeignKey("predictions.id"), nullable=False)

    predicted_winner = Column(String(10), nullable=False)
    actual_winner = Column(String(10), nullable=False)
    win_probability_at_prediction = Column(Float, nullable=False)
    correct = Column(Boolean, nullable=False)
    loss_accuracy_rating = Column(Integer, nullable=True)  # 1–5 optional

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="feedback_logs")
    prediction = relationship("Prediction", back_populates="feedback")
