'use client'

import { useState, useEffect } from 'react'

// ── TYPES ─────────────────────────────────────────────────────────────────────

type TroopKey = 'infantry' | 'lancer' | 'marksman'

interface TroopStats {
  atk: number; atkPct: number
  def: number; defPct: number
  hp: number;  hpPct: number
  leth: number; lethPct: number
}

interface ArmyStats {
  infantry: TroopStats
  lancer: TroopStats
  marksman: TroopStats
}

interface BattleResult {
  winProbability: number
  winner: 'user' | 'enemy'
  roundsFought: number
  userLossesPct: Record<TroopKey, number>
  enemyLossesPct: Record<TroopKey, number>
  biggestAdvantage: string
  biggestWeakness: string
  recommendedFormation: Record<TroopKey, number>
  userDamageScore: number
  enemyDamageScore: number
  userDefenseScore: number
  enemyDefenseScore: number
}

interface Preset {
  id: string; name: string
  stats: ArmyStats; createdAt: number
}

interface FeedbackEntry {
  id: string; predictionId: string
  predictedWinner: string; actualWinner: string
  winProbability: number; correct: boolean; timestamp: number
}

// ── COMBAT ENGINE ─────────────────────────────────────────────────────────────

function calcDamage(atk: number, atkPct: number, leth: number, lethPct: number): number {
  return (atk * (1 + atkPct / 100) * leth * (1 + lethPct / 100)) / 100
}

function calcDefense(def: number, defPct: number, hp: number, hpPct: number): number {
  return (def * (1 + defPct / 100) * hp * (1 + hpPct / 100)) / 100
}

function effectiveDmg(raw: number, defense: number): number {
  return Math.max(0, raw - defense * 0.3)
}

// Infantry beats Lancer | Lancer beats Marksman | Marksman beats Infantry
const TYPE_ADV: Record<TroopKey, TroopKey> = {
  infantry: 'lancer',
  lancer: 'marksman',
  marksman: 'infantry',
}

const TROOP_KEYS: TroopKey[] = ['infantry', 'lancer', 'marksman']

function pickTarget(preferred: TroopKey, alive: TroopKey[]): TroopKey {
  return alive.indexOf(preferred) !== -1 ? preferred : alive[0]
}

function simulateBattle(user: ArmyStats, enemy: ArmyStats): BattleResult {
  const uDmg: Record<TroopKey, number> = {
    infantry: calcDamage(user.infantry.atk, user.infantry.atkPct, user.infantry.leth, user.infantry.lethPct),
    lancer:   calcDamage(user.lancer.atk,   user.lancer.atkPct,   user.lancer.leth,   user.lancer.lethPct),
    marksman: calcDamage(user.marksman.atk,  user.marksman.atkPct,  user.marksman.leth,  user.marksman.lethPct),
  }
  const eDmg: Record<TroopKey, number> = {
    infantry: calcDamage(enemy.infantry.atk, enemy.infantry.atkPct, enemy.infantry.leth, enemy.infantry.lethPct),
    lancer:   calcDamage(enemy.lancer.atk,   enemy.lancer.atkPct,   enemy.lancer.leth,   enemy.lancer.lethPct),
    marksman: calcDamage(enemy.marksman.atk,  enemy.marksman.atkPct,  enemy.marksman.leth,  enemy.marksman.lethPct),
  }
  const uDef: Record<TroopKey, number> = {
    infantry: calcDefense(user.infantry.def, user.infantry.defPct, user.infantry.hp, user.infantry.hpPct),
    lancer:   calcDefense(user.lancer.def,   user.lancer.defPct,   user.lancer.hp,   user.lancer.hpPct),
    marksman: calcDefense(user.marksman.def,  user.marksman.defPct,  user.marksman.hp,  user.marksman.hpPct),
  }
  const eDef: Record<TroopKey, number> = {
    infantry: calcDefense(enemy.infantry.def, enemy.infantry.defPct, enemy.infantry.hp, enemy.infantry.hpPct),
    lancer:   calcDefense(enemy.lancer.def,   enemy.lancer.defPct,   enemy.lancer.hp,   enemy.lancer.hpPct),
    marksman: calcDefense(enemy.marksman.def,  enemy.marksman.defPct,  enemy.marksman.hp,  enemy.marksman.hpPct),
  }

  const uHP: Record<TroopKey, number> = { infantry: 100, lancer: 100, marksman: 100 }
  const eHP: Record<TroopKey, number> = { infantry: 100, lancer: 100, marksman: 100 }
  let round = 0

  while (round < 20) {
    round++
    const uAlive = TROOP_KEYS.filter(t => uHP[t] > 0)
    const eAlive = TROOP_KEYS.filter(t => eHP[t] > 0)
    if (!uAlive.length || !eAlive.length) break

    uAlive.forEach(t => {
      const live = eAlive.filter(x => eHP[x] > 0)
      if (!live.length) return
      const tgt = pickTarget(TYPE_ADV[t], live)
      let d = effectiveDmg(uDmg[t], eDef[tgt])
      if (tgt === TYPE_ADV[t]) d *= 1.15
      eHP[tgt] = Math.max(0, eHP[tgt] - (d * 0.8) / round)
    })

    eAlive.forEach(t => {
      const live = uAlive.filter(x => uHP[x] > 0)
      if (!live.length) return
      const tgt = pickTarget(TYPE_ADV[t], live)
      let d = effectiveDmg(eDmg[t], uDef[tgt])
      if (tgt === TYPE_ADV[t]) d *= 1.15
      uHP[tgt] = Math.max(0, uHP[tgt] - (d * 0.8) / round)
    })
  }

  const uDT = uDmg.infantry + uDmg.lancer + uDmg.marksman
  const eDT = eDmg.infantry + eDmg.lancer + eDmg.marksman
  const uDF = uDef.infantry + uDef.lancer + uDef.marksman
  const eDF = eDef.infantry + eDef.lancer + eDef.marksman
  const ratio = (uDT + uDF) / Math.max(eDT + eDF, 0.001)
  const uAvg = (uHP.infantry + uHP.lancer + uHP.marksman) / 3
  const eAvg = (eHP.infantry + eHP.lancer + eHP.marksman) / 3
  const win = Math.min(97, Math.max(3, Math.round(50 + (ratio - 1) * 40 + (uAvg - eAvg) * 0.3)))

  // Strength analysis
  const statKeys = ['atk', 'def', 'hp', 'leth'] as const
  const statLabels: Record<string, string> = { atk: 'ATK', def: 'DEF', hp: 'HP', leth: 'LETH' }
  const troopLabels: Record<TroopKey, string> = { infantry: 'Infantry', lancer: 'Lancer', marksman: 'Marksman' }
  let bigAdv = '', advD = -Infinity, bigWeak = '', weakD = Infinity

  TROOP_KEYS.forEach(t => {
    statKeys.forEach(s => {
      const pKey = (s + 'Pct') as keyof TroopStats
      const uv = user[t][s] * (1 + user[t][pKey] / 100)
      const ev = enemy[t][s] * (1 + enemy[t][pKey] / 100)
      const d = uv - ev
      const n = `${troopLabels[t]} ${statLabels[s]}`
      if (d > advD) { advD = d; bigAdv = n }
      if (d < weakD) { weakD = d; bigWeak = n }
    })
  })

  const tot = TROOP_KEYS.reduce((a, t) => a + uDmg[t] + uDef[t], 0) || 1
  const form: Record<TroopKey, number> = {
    infantry: Math.round((uDmg.infantry + uDef.infantry) / tot * 100),
    lancer:   Math.round((uDmg.lancer   + uDef.lancer)   / tot * 100),
    marksman: Math.round((uDmg.marksman  + uDef.marksman)  / tot * 100),
  }
  form.marksman += 100 - (form.infantry + form.lancer + form.marksman)

  return {
    winProbability: win,
    winner: win >= 50 ? 'user' : 'enemy',
    roundsFought: round,
    userLossesPct: {
      infantry: Math.round(Math.max(0, 100 - uHP.infantry)),
      lancer:   Math.round(Math.max(0, 100 - uHP.lancer)),
      marksman: Math.round(Math.max(0, 100 - uHP.marksman)),
    },
    enemyLossesPct: {
      infantry: Math.round(Math.max(0, 100 - eHP.infantry)),
      lancer:   Math.round(Math.max(0, 100 - eHP.lancer)),
      marksman: Math.round(Math.max(0, 100 - eHP.marksman)),
    },
    biggestAdvantage: bigAdv,
    biggestWeakness: bigWeak,
    recommendedFormation: form,
    userDamageScore: uDT,
    enemyDamageScore: eDT,
    userDefenseScore: uDF,
    enemyDefenseScore: eDF,
  }
}

function reverseOptimize(user: ArmyStats, enemy: ArmyStats, targets = [75, 85, 95]) {
  const cur = simulateBattle(user, enemy).winProbability
  return targets.map(pct => {
    if (cur >= pct) return { targetPct: pct, achieved: true, current: cur, upgrades: [] as any[] }
    const upgrades: { troop: string; stat: string; boost: number; efficiency: number; label: string }[] = []
    const stats = [
      { key: 'atk', step: 200, label: 'Attack' },
      { key: 'leth', step: 200, label: 'Lethality' },
      { key: 'def', step: 300, label: 'Defense' },
      { key: 'hp', step: 300, label: 'Health' },
    ]
    const tl: Record<TroopKey, string> = { infantry: 'Infantry', lancer: 'Lancer', marksman: 'Marksman' }

    TROOP_KEYS.forEach(t => {
      stats.forEach(({ key, step, label }) => {
        let boost = 0, reached = false
        while (boost < 10000 && !reached) {
          boost += step
          const test: ArmyStats = JSON.parse(JSON.stringify(user))
          ;(test[t] as Record<string, number>)[key] += boost
          if (simulateBattle(test, enemy).winProbability >= pct) reached = true
        }
        if (reached) upgrades.push({
          troop: tl[t], stat: label, boost,
          efficiency: (pct - cur) / boost * 1000,
          label: `+${boost.toLocaleString()} ${tl[t]} ${label}`,
        })
      })
    })
    upgrades.sort((a, b) => b.efficiency - a.efficiency)
    return { targetPct: pct, achieved: false, current: cur, upgrades: upgrades.slice(0, 6) }
  })
}

// ── DEFAULTS ──────────────────────────────────────────────────────────────────

const mkArmy = (m = 1): ArmyStats => ({
  infantry: { atk: Math.round(2800*m), atkPct: 35, def: Math.round(3200*m), defPct: 30, hp: Math.round(4500*m), hpPct: 40, leth: Math.round(2200*m), lethPct: 25 },
  lancer:   { atk: Math.round(3200*m), atkPct: 30, def: Math.round(2800*m), defPct: 35, hp: Math.round(4000*m), hpPct: 35, leth: Math.round(2600*m), lethPct: 30 },
  marksman: { atk: Math.round(3600*m), atkPct: 40, def: Math.round(2200*m), defPct: 25, hp: Math.round(3500*m), hpPct: 30, leth: Math.round(3000*m), lethPct: 35 },
})

const STORAGE_KEY = 'whiteout_mvp_v1'

function loadData() {
  if (typeof window === 'undefined') return null
  try {
    const d = localStorage.getItem(STORAGE_KEY)
    if (d) return JSON.parse(d)
  } catch { /* ignore */ }
  return null
}

function saveData(d: unknown) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)) } catch { /* ignore */ }
}

// ── STAT EDITOR ───────────────────────────────────────────────────────────────

const FIELDS = [
  { key: 'atk', label: 'ATK' }, { key: 'atkPct', label: 'ATK%' },
  { key: 'def', label: 'DEF' }, { key: 'defPct', label: 'DEF%' },
  { key: 'hp',  label: 'HP'  }, { key: 'hpPct',  label: 'HP%'  },
  { key: 'leth',label: 'LETH'}, { key: 'lethPct',label: 'LETH%'},
]

const TROOPS: { key: TroopKey; label: string; color: string }[] = [
  { key: 'infantry', label: 'Infantry', color: '#4dd9f0' },
  { key: 'lancer',   label: 'Lancer',   color: '#f06840' },
  { key: 'marksman', label: 'Marksman', color: '#f0b840' },
]

function StatEditor({ stats, onChange }: {
  stats: ArmyStats
  onChange: (t: TroopKey, k: string, v: number) => void
}) {
  return (
    <div>
      {TROOPS.map(t => (
        <div key={t.key} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, marginBottom: 10 }}>
          <div style={{ fontWeight: 700, letterSpacing: 2, fontSize: 12, textTransform: 'uppercase', color: t.color, marginBottom: 10 }}>{t.label}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
            {FIELDS.map(f => (
              <div key={f.key}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>{f.label}</div>
                <input
                  type="number"
                  value={(stats[t.key] as Record<string, number>)[f.key]}
                  onChange={e => onChange(t.key, f.key, Number(e.target.value))}
                  style={{ width: '100%', background: 'var(--bg-deep)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: 13, padding: '6px 8px', borderRadius: 5, outline: 'none' }}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────

export default function Home() {
  const [tab, setTab] = useState('battle')
  const [presets, setPresets] = useState<Preset[]>([{ id: 'p1', name: 'My Base', stats: mkArmy(), createdAt: Date.now() }])
  const [activeId, setActiveId] = useState('p1')
  const [enemyStats, setEnemyStats] = useState<ArmyStats>(mkArmy(1.05))
  const [result, setResult] = useState<BattleResult | null>(null)
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([])
  const [feedbackMode, setFeedbackMode] = useState<string | null>(null)
  const [actualWinner, setActualWinner] = useState('')
  const [feedbackDone, setFeedbackDone] = useState(false)
  const [optimizer, setOptimizer] = useState<ReturnType<typeof reverseOptimize> | null>(null)
  const [newName, setNewName] = useState('')
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const d = loadData()
    if (d) {
      if (d.presets)     setPresets(d.presets)
      if (d.activeId)    setActiveId(d.activeId)
      if (d.enemyStats)  setEnemyStats(d.enemyStats)
      if (d.feedback)    setFeedback(d.feedback)
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    saveData({ presets, activeId, enemyStats, feedback })
  }, [presets, activeId, enemyStats, feedback, hydrated])

  const active = presets.find(p => p.id === activeId) ?? presets[0]

  function updateUser(troop: TroopKey, key: string, val: number) {
    setPresets(ps => ps.map(p => p.id !== activeId ? p : {
      ...p, stats: { ...p.stats, [troop]: { ...p.stats[troop], [key]: val } }
    }))
    setResult(null); setOptimizer(null)
  }

  function updateEnemy(troop: TroopKey, key: string, val: number) {
    setEnemyStats(s => ({ ...s, [troop]: { ...s[troop], [key]: val } }))
    setResult(null); setOptimizer(null)
  }

  function runSim() {
    const r = simulateBattle(active.stats, enemyStats)
    setResult(r); setFeedbackMode(null); setFeedbackDone(false); setOptimizer(null)
  }

  function runOptimizer() {
    setOptimizer(reverseOptimize(active.stats, enemyStats))
  }

  function submitFeedback() {
    if (!result) return
    const correct = feedbackMode === 'yes'
    setFeedback(f => [...f, {
      id: 'fb' + Date.now(), predictionId: 'pred' + Date.now(),
      predictedWinner: result.winner,
      actualWinner: correct ? result.winner : actualWinner,
      winProbability: result.winProbability,
      correct, timestamp: Date.now(),
    }])
    setFeedbackDone(true)
  }

  function createPreset() {
    if (!newName.trim()) return
    const p: Preset = { id: 'p' + Date.now(), name: newName.trim(), stats: mkArmy(), createdAt: Date.now() }
    setPresets(ps => [...ps, p]); setActiveId(p.id); setNewName('')
  }

  function deletePreset(id: string) {
    if (presets.length <= 1) return
    const rem = presets.filter(p => p.id !== id)
    setPresets(rem); setActiveId(rem[0].id)
  }

  const barColor = result
    ? result.winProbability >= 65 ? '#40d090' : result.winProbability >= 45 ? '#f0b840' : '#f04040'
    : '#4dd9f0'
  const accuracy = feedback.length ? Math.round(feedback.filter(f => f.correct).length / feedback.length * 100) : null

  const navStyle = (t: string): React.CSSProperties => ({
    flex: 1, padding: '8px 4px',
    background: tab === t ? 'var(--bg-card)' : 'transparent',
    border: tab === t ? '1px solid var(--border-bright)' : '1px solid transparent',
    color: tab === t ? 'var(--accent-ice)' : 'var(--text-muted)',
    borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600,
    letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  })

  const panel: React.CSSProperties = { background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }
  const card:  React.CSSProperties = { background: 'var(--bg-card)',  border: '1px solid var(--border)', borderRadius: 8,  padding: 12 }

  const btn = (color: 'ice'|'fire'|'gold'|'ghost' = 'ice'): React.CSSProperties => ({
    padding: '9px 18px', border: color === 'ghost' ? '1px solid var(--border-bright)' : 'none',
    borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11,
    fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase',
    background: color==='ice'?'var(--accent-ice)':color==='fire'?'var(--accent-fire)':color==='gold'?'var(--accent-gold)':'var(--bg-card)',
    color: color === 'ghost' ? 'var(--text-primary)' : '#0a0e1a',
  })

  return (
    <main style={{ maxWidth: 1000, margin: '0 auto', padding: 16 }}>

      {/* HEADER */}
      <div style={{ textAlign: 'center', padding: '20px 0 16px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
        <h1 style={{ fontWeight: 900, fontSize: 24, letterSpacing: 4, color: 'var(--accent-ice)', textTransform: 'uppercase' }}>⚔ Whiteout Survival</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 11, letterSpacing: 2, marginTop: 4, textTransform: 'uppercase' }}>Battle Predictor — MVP v1.0</p>
      </div>

      {/* STATUS BAR */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', fontSize: 12 }}>
        <span style={{ color: 'var(--text-muted)' }}>Active:</span>
        <span style={{ background: 'rgba(77,217,240,.12)', color: 'var(--accent-ice)', border: '1px solid rgba(77,217,240,.25)', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>
          {active?.name}
        </span>
        {accuracy !== null && (
          <span style={{ marginLeft: 'auto', color: 'var(--text-dim)', fontSize: 11 }}>
            Accuracy: <span style={{ color: 'var(--accent-gold)' }}>{accuracy}%</span> ({feedback.length} battles)
          </span>
        )}
      </div>

      {/* NAV */}
      <nav style={{ display: 'flex', gap: 4, background: 'var(--bg-dark)', padding: 4, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 16 }}>
        {[{ k: 'battle', i: '⚔', l: 'Battle' }, { k: 'enemy', i: '👁', l: 'Scout' }, { k: 'presets', i: '📋', l: 'Presets' }, { k: 'history', i: '📊', l: 'History' }].map(t => (
          <button key={t.k} style={navStyle(t.k)} onClick={() => setTab(t.k)}>{t.i} {t.l}</button>
        ))}
      </nav>

      {/* ── BATTLE TAB ── */}
      {tab === 'battle' && (
        <div style={panel}>
          <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: 2, color: 'var(--accent-ice)', textTransform: 'uppercase', marginBottom: 16 }}>⚔ Battle Simulator</div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {presets.map(p => (
              <button key={p.id} style={{ ...btn(p.id === activeId ? 'ice' : 'ghost'), fontSize: 10, padding: '5px 12px' }}
                onClick={() => { setActiveId(p.id); setResult(null) }}>{p.name}</button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <button style={btn('fire')} onClick={runSim}>⚡ Run Battle Simulation</button>
            {result && <button style={btn('gold')} onClick={runOptimizer}>◈ What Do I Need to Win?</button>}
          </div>

          {!result && (
            <div style={{ background: 'var(--bg-dark)', border: '1px dashed var(--border)', borderRadius: 8, padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
              Configure scout data in the Scout tab, then run simulation.
            </div>
          )}

          {result && (
            <div style={{ background: 'var(--bg-dark)', border: '1px solid var(--accent-ice)', borderRadius: 10, padding: 20 }}>

              {/* WIN % */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 2, textTransform: 'uppercase' }}>Win Probability</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 40, fontWeight: 900, color: barColor, lineHeight: 1.1 }}>{result.winProbability}%</div>
                  <div style={{ height: 8, background: 'var(--bg-deep)', borderRadius: 4, overflow: 'hidden', margin: '6px 0', width: 200, border: '1px solid var(--border)' }}>
                    <div style={{ height: '100%', width: `${result.winProbability}%`, background: barColor, borderRadius: 4, transition: 'width .8s' }} />
                  </div>
                </div>
                <span style={{
                  padding: '4px 12px', borderRadius: 4, fontSize: 12, fontWeight: 700, letterSpacing: 1,
                  background: result.winner === 'user' ? 'rgba(64,208,144,.15)' : 'rgba(240,64,64,.15)',
                  color: result.winner === 'user' ? 'var(--accent-green)' : 'var(--accent-red)',
                  border: `1px solid ${result.winner === 'user' ? 'rgba(64,208,144,.3)' : 'rgba(240,64,64,.3)'}`,
                }}>
                  {result.winner === 'user' ? '⚔ PREDICTED WIN' : '💀 PREDICTED LOSS'}
                </span>
              </div>

              {/* SCORES */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div style={card}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Rounds Fought</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 24, fontWeight: 700, color: 'var(--accent-ice)' }}>{result.roundsFought}</div>
                </div>
                <div style={card}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Strength Index</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: 'var(--accent-green)' }}>{Math.round(result.userDamageScore + result.userDefenseScore)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Enemy: <span style={{ color: 'var(--accent-fire)' }}>{Math.round(result.enemyDamageScore + result.enemyDefenseScore)}</span></div>
                </div>
              </div>

              {/* LOSSES */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Expected Losses</div>
                {TROOPS.map(t => (
                  <div key={t.key} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                        <span style={{ color: t.color, fontWeight: 600 }}>{t.label}</span>
                        <span style={{ fontFamily: 'monospace', color: 'var(--accent-ice)' }}>{result.userLossesPct[t.key]}% loss</span>
                      </div>
                      <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${100 - result.userLossesPct[t.key]}%`, background: t.color, borderRadius: 3 }} />
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                        <span style={{ color: 'var(--text-muted)' }}>Enemy {t.label}</span>
                        <span style={{ fontFamily: 'monospace', color: 'var(--accent-fire)' }}>{result.enemyLossesPct[t.key]}% loss</span>
                      </div>
                      <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${100 - result.enemyLossesPct[t.key]}%`, background: 'var(--accent-fire)', borderRadius: 3 }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ADVANTAGE / WEAKNESS */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div style={card}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Biggest Advantage</div>
                  <span style={{ background: 'rgba(64,208,144,.15)', color: 'var(--accent-green)', border: '1px solid rgba(64,208,144,.3)', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{result.biggestAdvantage}</span>
                </div>
                <div style={card}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Biggest Weakness</div>
                  <span style={{ background: 'rgba(240,64,64,.15)', color: 'var(--accent-red)', border: '1px solid rgba(240,64,64,.3)', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{result.biggestWeakness}</span>
                </div>
              </div>

              {/* FORMATION */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Recommended Formation</div>
                <div style={{ display: 'flex', height: 28, borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${result.recommendedFormation.infantry}%`, background: 'rgba(77,217,240,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--accent-ice)' }}>INF {result.recommendedFormation.infantry}%</div>
                  <div style={{ width: `${result.recommendedFormation.lancer}%`,   background: 'rgba(240,104,64,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--accent-fire)' }}>LAN {result.recommendedFormation.lancer}%</div>
                  <div style={{ width: `${result.recommendedFormation.marksman}%`, background: 'rgba(240,184,64,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--accent-gold)' }}>MRK {result.recommendedFormation.marksman}%</div>
                </div>
              </div>

              {/* FEEDBACK */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Battle Feedback</div>
                {!feedbackDone ? (
                  <>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>After the battle, did this prediction match reality?</div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      {['yes', 'no'].map(opt => (
                        <div key={opt} onClick={() => setFeedbackMode(opt)} style={{
                          flex: 1, padding: 12, borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                          border: `2px solid ${feedbackMode === opt ? (opt === 'yes' ? 'var(--accent-green)' : 'var(--accent-red)') : 'var(--border)'}`,
                          background: feedbackMode === opt ? (opt === 'yes' ? 'rgba(64,208,144,.08)' : 'rgba(240,64,64,.08)') : 'var(--bg-card)',
                        }}>
                          <div style={{ fontSize: 18, marginBottom: 4 }}>{opt === 'yes' ? '✓' : '✗'}</div>
                          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>{opt === 'yes' ? 'YES, CORRECT' : 'NO, WRONG'}</div>
                        </div>
                      ))}
                    </div>
                    {feedbackMode === 'no' && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 4 }}>Who actually won?</div>
                        <select value={actualWinner} onChange={e => setActualWinner(e.target.value)}
                          style={{ background: 'var(--bg-dark)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 12, padding: '7px 10px', borderRadius: 5, outline: 'none', minWidth: 180 }}>
                          <option value="">Select winner...</option>
                          <option value="user">I Won</option>
                          <option value="enemy">Enemy Won</option>
                        </select>
                      </div>
                    )}
                    {feedbackMode && <button style={btn('ghost')} onClick={submitFeedback}>Submit Feedback</button>}
                  </>
                ) : (
                  <div style={{ background: 'rgba(240,184,64,.08)', border: '1px solid rgba(240,184,64,.25)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--accent-gold)' }}>
                    ✓ Feedback recorded. Thank you for helping improve the model.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* OPTIMIZER */}
          {optimizer && (
            <div style={{ ...panel, marginTop: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: 2, color: 'var(--accent-ice)', textTransform: 'uppercase', marginBottom: 16 }}>◈ Reverse Optimizer</div>
              {optimizer.map(r => (
                <div key={r.targetPct} style={{ background: 'var(--bg-card)', borderLeft: `3px solid ${r.targetPct === 75 ? 'var(--accent-gold)' : r.targetPct === 85 ? 'var(--accent-ice)' : 'var(--accent-green)'}`, border: '1px solid var(--border)', borderRadius: 8, padding: 14, marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: r.targetPct === 75 ? 'var(--accent-gold)' : r.targetPct === 85 ? 'var(--accent-ice)' : 'var(--accent-green)' }}>{r.targetPct}% Win Chance</span>
                    {r.achieved
                      ? <span style={{ fontSize: 10, color: 'var(--accent-green)', fontWeight: 700 }}>✓ Already Achieved</span>
                      : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Current: {r.current}%</span>}
                  </div>
                  {!r.achieved && r.upgrades.map((u, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                      <span style={{ color: 'var(--text-muted)', marginRight: 8 }}>#{i + 1}</span>
                      <span style={{ flex: 1 }}>{u.label}</span>
                      <span style={{ fontFamily: 'monospace', color: 'var(--accent-green)', fontWeight: 700 }}>+{u.efficiency.toFixed(1)} eff</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SCOUT TAB ── */}
      {tab === 'enemy' && (
        <div style={panel}>
          <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: 2, color: 'var(--accent-ice)', textTransform: 'uppercase', marginBottom: 16 }}>👁 Enemy Scout Input</div>
          <div style={{ background: 'rgba(240,184,64,.08)', border: '1px solid rgba(240,184,64,.25)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--accent-gold)', marginBottom: 14 }}>
            Enter enemy stats from your scout report manually.
          </div>
          <StatEditor stats={enemyStats} onChange={updateEnemy} />
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button style={btn('fire')} onClick={() => { setTab('battle'); runSim() }}>⚡ Save & Run Simulation</button>
            <button style={{ ...btn('ghost'), fontSize: 10 }} onClick={() => setEnemyStats(mkArmy(1.05))}>Reset</button>
          </div>
        </div>
      )}

      {/* ── PRESETS TAB ── */}
      {tab === 'presets' && (
        <div>
          <div style={panel}>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: 2, color: 'var(--accent-ice)', textTransform: 'uppercase', marginBottom: 16 }}>📋 My Presets</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input type="text" placeholder="New preset name..." value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createPreset()}
                style={{ flex: 1, background: 'var(--bg-dark)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 13, padding: '8px 10px', borderRadius: 5, outline: 'none' }} />
              <button style={btn('ice')} onClick={createPreset}>+ Create</button>
            </div>
            {presets.map(p => (
              <div key={p.id} onClick={() => setActiveId(p.id)} style={{
                background: 'var(--bg-card)', border: `1px solid ${p.id === activeId ? 'var(--accent-ice)' : 'var(--border)'}`,
                borderRadius: 8, padding: 14, marginBottom: 8, cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {p.name}
                    {p.id === activeId && <span style={{ fontSize: 9, color: 'var(--accent-ice)', marginLeft: 6, border: '1px solid var(--accent-ice)', padding: '1px 5px', borderRadius: 3 }}>ACTIVE</span>}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>
                    INF ATK: {p.stats.infantry.atk.toLocaleString()} | LAN DEF: {p.stats.lancer.def.toLocaleString()} | MRK HP: {p.stats.marksman.hp.toLocaleString()}
                  </div>
                </div>
                {presets.length > 1 && (
                  <button onClick={e => { e.stopPropagation(); deletePreset(p.id) }}
                    style={{ background: 'none', border: '1px solid rgba(240,64,64,.3)', color: 'var(--accent-red)', padding: '4px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 10 }}>
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <div style={{ ...panel, marginTop: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: 2, color: 'var(--accent-ice)', textTransform: 'uppercase', marginBottom: 16 }}>✏ Edit: {active?.name}</div>
            <StatEditor stats={active.stats} onChange={updateUser} />
          </div>
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {tab === 'history' && (
        <div style={panel}>
          <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: 2, color: 'var(--accent-ice)', textTransform: 'uppercase', marginBottom: 16 }}>📊 Feedback History</div>
          {accuracy !== null && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Total Battles', val: feedback.length, color: 'var(--accent-ice)' },
                { label: 'Model Accuracy', val: `${accuracy}%`, color: accuracy >= 70 ? 'var(--accent-green)' : accuracy >= 50 ? 'var(--accent-gold)' : 'var(--accent-red)' },
                { label: 'Correct Calls', val: feedback.filter(f => f.correct).length, color: 'var(--accent-green)' },
              ].map(m => (
                <div key={m.label} style={card}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 700, color: m.color }}>{m.val}</div>
                </div>
              ))}
            </div>
          )}
          {feedback.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 32, fontSize: 12 }}>No feedback yet. Run some battles and submit results!</div>
          )}
          {[...feedback].reverse().map(f => (
            <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--bg-card)', borderRadius: 6, marginBottom: 6 }}>
              <div>
                <span style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                  background: f.correct ? 'rgba(64,208,144,.15)' : 'rgba(240,64,64,.15)',
                  color: f.correct ? 'var(--accent-green)' : 'var(--accent-red)',
                  border: `1px solid ${f.correct ? 'rgba(64,208,144,.3)' : 'rgba(240,64,64,.3)'}`,
                }}>
                  {f.correct ? '✓ Correct' : '✗ Wrong'}
                </span>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'monospace', marginTop: 3 }}>
                  Predicted: {f.predictedWinner} @ {f.winProbability}% | Actual: {f.actualWinner}
                </div>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{new Date(f.timestamp).toLocaleDateString()}</div>
            </div>
          ))}
          {feedback.length > 0 && (
            <button style={{ ...btn('ghost'), marginTop: 12, color: 'var(--accent-red)', border: '1px solid rgba(240,64,64,.3)', fontSize: 10 }}
              onClick={() => setFeedback([])}>
              Clear History
            </button>
          )}
        </div>
      )}

      <div style={{ textAlign: 'center', padding: '20px 0 8px', fontSize: 10, color: 'var(--text-dim)', letterSpacing: 2, textTransform: 'uppercase' }}>
        Whiteout Survival Battle Predictor MVP v1.0
      </div>
    </main>
  )
}
