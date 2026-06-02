-- WHITEOUT SURVIVAL — Battle Predictor
-- PostgreSQL Schema Migration v1
-- Run on Supabase or any PostgreSQL instance

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── USERS ─────────────────────────────────────────────────────────────────────
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username    VARCHAR(64) UNIQUE NOT NULL,
    email       VARCHAR(255) UNIQUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ
);

-- ── PRESETS ───────────────────────────────────────────────────────────────────
CREATE TABLE presets (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    is_active   BOOLEAN DEFAULT FALSE,
    stats       JSONB NOT NULL,
    -- stats shape: {
    --   infantry: {atk, atk_pct, def, def_pct, hp, hp_pct, leth, leth_pct},
    --   lancer:   {...},
    --   marksman: {...}
    -- }
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ
);

CREATE INDEX idx_presets_user_id ON presets(user_id);

-- ── ENEMY SCOUTS ──────────────────────────────────────────────────────────────
CREATE TABLE enemy_scouts (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label       VARCHAR(100),
    stats       JSONB NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scouts_user_id ON enemy_scouts(user_id);

-- ── PREDICTIONS ───────────────────────────────────────────────────────────────
CREATE TABLE predictions (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id               UUID NOT NULL REFERENCES users(id),
    preset_id             UUID REFERENCES presets(id),
    enemy_scout_id        UUID REFERENCES enemy_scouts(id),

    user_stats_snapshot   JSONB NOT NULL,
    enemy_stats_snapshot  JSONB NOT NULL,

    win_probability       FLOAT NOT NULL,
    predicted_winner      VARCHAR(10) NOT NULL CHECK (predicted_winner IN ('user', 'enemy')),
    rounds_fought         INTEGER,
    user_losses_pct       JSONB,
    enemy_losses_pct      JSONB,
    biggest_advantage     VARCHAR(50),
    biggest_weakness      VARCHAR(50),
    recommended_formation JSONB,

    created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_predictions_user_id ON predictions(user_id);
CREATE INDEX idx_predictions_created_at ON predictions(created_at DESC);

-- ── BATTLE REPORTS ────────────────────────────────────────────────────────────
CREATE TABLE battle_reports (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id),
    prediction_id   UUID REFERENCES predictions(id),
    actual_winner   VARCHAR(10) NOT NULL CHECK (actual_winner IN ('user', 'enemy')),
    user_losses_actual JSONB,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── FEEDBACK LOGS ─────────────────────────────────────────────────────────────
CREATE TABLE feedback_logs (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                     UUID NOT NULL REFERENCES users(id),
    prediction_id               UUID NOT NULL REFERENCES predictions(id),

    predicted_winner            VARCHAR(10) NOT NULL,
    actual_winner               VARCHAR(10) NOT NULL,
    win_probability_at_prediction FLOAT NOT NULL,
    correct                     BOOLEAN NOT NULL GENERATED ALWAYS AS (predicted_winner = actual_winner) STORED,
    loss_accuracy_rating        SMALLINT CHECK (loss_accuracy_rating BETWEEN 1 AND 5),

    created_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feedback_user_id ON feedback_logs(user_id);
CREATE INDEX idx_feedback_correct ON feedback_logs(correct);

-- ── ACCURACY VIEW ─────────────────────────────────────────────────────────────
CREATE VIEW model_accuracy AS
SELECT
    COUNT(*)                                        AS total_predictions,
    SUM(CASE WHEN correct THEN 1 ELSE 0 END)        AS correct_predictions,
    ROUND(AVG(CASE WHEN correct THEN 1.0 ELSE 0 END) * 100, 1) AS accuracy_pct,
    MIN(created_at)                                 AS first_feedback,
    MAX(created_at)                                 AS last_feedback
FROM feedback_logs;

-- ── ACCURACY BY WIN PCT BUCKET ────────────────────────────────────────────────
CREATE VIEW accuracy_by_confidence AS
SELECT
    CASE
        WHEN win_probability_at_prediction < 40 THEN 'Low (<40%)'
        WHEN win_probability_at_prediction < 60 THEN 'Even (40–60%)'
        WHEN win_probability_at_prediction < 75 THEN 'Moderate (60–75%)'
        ELSE 'High (>75%)'
    END AS confidence_band,
    COUNT(*) AS total,
    ROUND(AVG(CASE WHEN correct THEN 1.0 ELSE 0 END) * 100, 1) AS accuracy_pct
FROM feedback_logs
GROUP BY confidence_band
ORDER BY confidence_band;
