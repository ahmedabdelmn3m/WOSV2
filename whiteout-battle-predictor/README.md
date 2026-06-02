# ⚔ Whiteout Survival — Battle Predictor MVP

> Round-based battle simulation + reverse optimization engine for Whiteout Survival.

---

## 🚀 Quick Start (Docker — Recommended)

```bash
git clone <your-repo>
cd whiteout-battle-predictor
docker-compose up --build
```

- Frontend: http://localhost:3000
- API: http://localhost:8000
- API Docs: http://localhost:8000/docs

---

## 🏗 Architecture

```
whiteout-battle-predictor/
├── frontend/               # Next.js 14 App Router
│   └── src/
│       ├── lib/
│       │   └── combatEngine.ts     ← Client-side engine (instant results)
│       ├── components/
│       │   ├── BattleSimulator.tsx
│       │   ├── StatEditor.tsx
│       │   ├── OptimizerPanel.tsx
│       │   ├── PresetManager.tsx
│       │   └── FeedbackForm.tsx
│       └── app/
│           ├── page.tsx            ← Main dashboard
│           ├── presets/page.tsx
│           └── history/page.tsx
│
├── backend/                # FastAPI
│   └── app/
│       ├── main.py                 ← FastAPI app + CORS
│       ├── core/
│       │   └── combat_engine.py   ← 🔑 Core engine (formulas isolated here)
│       ├── api/
│       │   ├── battles.py         ← /api/battles/simulate & /optimize
│       │   ├── presets.py         ← /api/presets CRUD
│       │   ├── feedback.py        ← /api/feedback
│       │   └── users.py           ← /api/users
│       ├── models/
│       │   └── database.py        ← SQLAlchemy models
│       └── schemas/
│           └── battle.py          ← Pydantic schemas
│
├── docs/
│   └── schema.sql                 ← PostgreSQL migration
│
└── docker-compose.yml
```

---

## ⚔ Combat Engine — Core Formulas

All formulas live **only** in `backend/app/core/combat_engine.py` and `frontend/src/lib/combatEngine.ts`. Never in UI or API controllers.

### Damage Formula
```
DAMAGE = (Attack × (1 + Attack%) × Lethality × (1 + Lethality%)) / 100
```

### Defense Formula
```
DEFENSE = (Defense × (1 + Defense%) × Health × (1 + Health%)) / 100
```

### Type Advantage Matrix
```
Infantry → beats → Lancer    (+15% damage)
Lancer   → beats → Marksman  (+15% damage)
Marksman → beats → Infantry  (+15% damage)
```

### Win Probability
Calculated after full round simulation:
```
raw_ratio = (user_dmg + user_def) / (enemy_dmg + enemy_def)
win_pct = 50 + (raw_ratio - 1) × 40 + (user_hp_remaining - enemy_hp_remaining) × 0.3
clamped to [3%, 97%]
```

---

## 📊 API Endpoints

### POST /api/battles/simulate
Runs round-based battle simulation.

**Request:**
```json
{
  "user_stats": {
    "infantry":  {"atk": 2800, "atk_pct": 35, "def": 3200, "def_pct": 30, "hp": 4500, "hp_pct": 40, "leth": 2200, "leth_pct": 25},
    "lancer":    {"atk": 3200, "atk_pct": 30, ...},
    "marksman":  {"atk": 3600, "atk_pct": 40, ...}
  },
  "enemy_stats": { ... }
}
```

**Response:**
```json
{
  "prediction_id": "uuid",
  "win_probability": 67.5,
  "predicted_winner": "user",
  "rounds_fought": 12,
  "user_losses_pct": {"infantry": 23, "lancer": 18, "marksman": 31},
  "enemy_losses_pct": {"infantry": 54, "lancer": 61, "marksman": 47},
  "biggest_advantage": "Infantry ATK",
  "biggest_weakness": "Marksman DEF",
  "recommended_formation": {"infantry": 35, "lancer": 28, "marksman": 37}
}
```

### POST /api/battles/optimize
Reverse optimizer — finds stat upgrades needed for target win%.

### POST /api/presets/
Create a stat preset.

### GET /api/presets/{user_id}
Get all presets for a user.

### POST /api/feedback/
Submit post-battle accuracy feedback.

### GET /api/feedback/stats
Aggregate accuracy stats for model calibration.

---

## 🗄 Database

Run `docs/schema.sql` against your PostgreSQL instance (or Supabase).

Includes views for:
- Overall model accuracy
- Accuracy by confidence band (for calibration)

---

## ☁ Deployment

### Option A — Vercel + Supabase (Recommended for MVP)

1. Push frontend to Vercel
2. Create Supabase project → run `docs/schema.sql`
3. Set env vars:
   ```
   NEXT_PUBLIC_API_URL=https://your-api.railway.app
   DATABASE_URL=postgresql://...supabase...
   ```
4. Deploy backend to Railway or Render

### Option B — Docker (Self-hosted)
```bash
docker-compose up --build -d
```

---

## 🎯 MVP Success Criteria

| Metric | Target | Status |
|--------|--------|--------|
| Concurrent users | 20+ | ✅ Stateless API |
| Prediction latency | <2s | ✅ Client-side engine |
| Feedback collection | Yes | ✅ /api/feedback |
| Reverse optimizer | Yes | ✅ /api/battles/optimize |
| Perceived accuracy | 60–80% | 🔄 Calibrate with feedback |

---

## 🔮 Post-MVP Roadmap

1. **Model Calibration** — Use feedback_logs to tune win probability formula
2. **OCR Scout Input** — Auto-extract stats from screenshots
3. **Hero System** — Layer hero buffs on top of troop stats
4. **Rally Calculator** — Multi-player rally optimization
5. **ML Win Predictor** — Train on 1000+ feedback entries
