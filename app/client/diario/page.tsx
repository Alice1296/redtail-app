'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import {
  buildHistories,
  formatKg,
  type ExerciseHistory,
} from '@/lib/trainingLog'
import { DAYS } from '@/lib/community'

const DAY_LABEL = new Map(DAYS.map((d) => [d.key as string, d.label]))

function ProgressChart({ history }: { history: ExerciseHistory }) {
  const W = 320
  const H = 168
  const L = 38
  const R = 306
  const T = 16
  const B = 132

  const points = history.points
  const loads = points.map((p) => p.load)
  const min = Math.min(...loads)
  const max = Math.max(...loads)
  const pad = (max - min) * 0.35 + 2.5
  const lo = min - pad
  const hi = max + pad === lo ? lo + 1 : max + pad

  const x = (i: number) =>
    points.length <= 1 ? (L + R) / 2 : L + (R - L) * (i / (points.length - 1))
  const y = (val: number) => B - (B - T) * ((val - lo) / (hi - lo))

  const coords = points.map((p, i) => [x(i), y(p.load)] as const)
  const line = coords.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(' ')
  const area = `${coords[0]?.[0].toFixed(1) ?? L},${B} ${line} ${coords[coords.length - 1]?.[0].toFixed(1) ?? R},${B}`

  const gridVals = [lo + (hi - lo) * 0.15, (lo + hi) / 2, hi - (hi - lo) * 0.15]
  const last = coords[coords.length - 1]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Andamento ${history.exercise}`} className="w-full h-auto">
      <defs>
        <linearGradient id="diario-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ef4444" stopOpacity="0.28" />
          <stop offset="1" stopColor="#ef4444" stopOpacity="0" />
        </linearGradient>
      </defs>
      {gridVals.map((val, i) => {
        const yy = y(val)
        return (
          <g key={i}>
            <line x1={L} y1={yy} x2={R} y2={yy} stroke="#232326" strokeWidth="1" />
            <text x={L - 6} y={yy + 3} textAnchor="end" fontSize="9" fill="#52525b" fontWeight="700">
              {formatKg(Math.round(val * 2) / 2)}
            </text>
          </g>
        )
      })}
      {points.length > 1 && <polygon points={area} fill="url(#diario-fill)" />}
      {points.length > 1 && (
        <polyline
          points={line}
          fill="none"
          stroke="#ef4444"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {coords.map(([px, py], i) => {
        const isLast = i === coords.length - 1
        return (
          <circle
            key={i}
            cx={px}
            cy={py}
            r={isLast ? 4.6 : 3}
            fill={isLast ? '#ef4444' : '#0a0a0b'}
            stroke="#ef4444"
            strokeWidth="2"
          />
        )
      })}
      {points.map((p, i) => (
        <text key={i} x={x(i)} y={152} textAnchor="middle" fontSize="8.5" fill="#52525b" fontWeight="800">
          W{p.week}
        </text>
      ))}
      {last && (
        <>
          <rect x={Math.min(last[0] - 3, 268)} y={last[1] - 20} width="40" height="16" rx="4" fill="#ef4444" />
          <text x={Math.min(last[0] + 17, 288)} y={last[1] - 8.5} textAnchor="middle" fontSize="9.5" fill="#fff" fontWeight="900">
            {formatKg(history.last)}
          </text>
        </>
      )}
    </svg>
  )
}

export default function ClientDiarioPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [histories, setHistories] = useState<ExerciseHistory[]>([])
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/')
        return
      }

      const { data } = await supabase
        .from('client_logs')
        .select('section, notes, week_number, day, created_at')
        .eq('client_id', user.id)
        .like('section', 'diario:%')

      const built = buildHistories((data || []) as never[])
      setHistories(built)
      setSelected(built[0]?.exercise ?? null)
      setLoading(false)
    }

    load()
  }, [router])

  const active = useMemo(
    () => histories.find((h) => h.exercise === selected) || null,
    [histories, selected]
  )

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-black text-white pb-24 font-sans">
      <div className="bg-zinc-900 border-b-2 border-red-600 p-4 sticky top-0 z-50 flex items-center justify-between">
        <button
          onClick={() => router.push('/client')}
          className="flex items-center gap-1 text-zinc-400 hover:text-white transition-all active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span className="text-[10px] font-black uppercase tracking-widest mt-0.5">Giorno</span>
        </button>
        <div className="text-center flex-1">
          <div className="font-black italic uppercase text-red-500 text-sm tracking-tighter">Progressi</div>
          <div className="text-[9px] text-zinc-500 uppercase tracking-widest font-black">Diario carichi</div>
        </div>
        <button
          onClick={handleLogout}
          className="bg-red-600/10 border border-red-600 text-red-500 px-3 py-1 rounded-lg text-[10px] font-black uppercase hover:bg-red-600/20 transition-all active:scale-95"
        >
          Logout
        </button>
      </div>

      <div className="p-4 max-w-xl mx-auto space-y-5 mt-2">
        {loading ? (
          <p className="text-center text-zinc-500 text-xs font-black uppercase animate-pulse py-20">
            Caricamento diario...
          </p>
        ) : histories.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <p className="text-zinc-500 text-xs font-black uppercase">Diario ancora vuoto</p>
            <p className="text-zinc-600 text-[11px] font-semibold max-w-xs mx-auto leading-relaxed">
              Registra i carichi dal tasto <span className="text-red-400">Diario</span> in fondo al
              giorno di allenamento: qui vedrai i tuoi progressi.
            </p>
            <button
              onClick={() => router.push('/client')}
              className="mt-2 inline-block rounded-xl border border-red-600 bg-red-600/10 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-red-400 active:scale-95 transition-all"
            >
              Vai all&apos;allenamento
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2 flex-wrap">
              {histories.map((h) => (
                <button
                  key={h.exercise}
                  onClick={() => setSelected(h.exercise)}
                  className={`text-[11px] font-black px-3 py-2 rounded-full border transition-all ${
                    selected === h.exercise
                      ? 'bg-red-600 border-red-500 text-white'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-red-600/60'
                  }`}
                >
                  {h.exercise}
                </button>
              ))}
            </div>

            {active && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3">
                    <div className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Ultimo</div>
                    <div className="text-xl font-black tabular-nums mt-1">
                      {formatKg(active.last)}
                      <span className="text-[10px] text-zinc-500"> kg</span>
                    </div>
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3">
                    <div className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Δ vs prec.</div>
                    <div
                      className={`text-xl font-black tabular-nums mt-1 ${
                        active.delta != null && active.delta > 0
                          ? 'text-green-400'
                          : active.delta != null && active.delta < 0
                            ? 'text-red-400'
                            : 'text-zinc-400'
                      }`}
                    >
                      {active.delta == null
                        ? '—'
                        : `${active.delta > 0 ? '+' : ''}${formatKg(active.delta)}`}
                      {active.deltaPct != null && active.delta !== 0 && (
                        <span className="text-[10px]"> ({active.deltaPct > 0 ? '+' : ''}{active.deltaPct}%)</span>
                      )}
                    </div>
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3">
                    <div className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Record</div>
                    <div className="text-xl font-black tabular-nums mt-1">🏆 {formatKg(active.best)}</div>
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="font-black text-sm">{active.exercise}</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">kg · per settimana</span>
                  </div>
                  <ProgressChart history={active} />
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Storico</div>
                  {[...active.points].reverse().map((p, i, arr) => {
                    const older = arr[i + 1]
                    const diff = older ? Math.round((p.load - older.load) * 10) / 10 : null
                    return (
                      <div
                        key={`${p.week}-${p.day}-${i}`}
                        className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5"
                      >
                        <span className="text-[11px] font-bold text-zinc-400 tabular-nums">
                          W{p.week} · {DAY_LABEL.get(p.day) || p.day}
                        </span>
                        <span className="text-[13px] font-black tabular-nums">
                          {formatKg(p.load)} kg
                          {p.reps != null && (
                            <span className="text-[10px] text-zinc-500 font-semibold"> × {p.reps}</span>
                          )}
                        </span>
                        <span
                          className={`text-[10px] font-black tabular-nums ${
                            diff != null && diff > 0
                              ? 'text-green-400'
                              : diff != null && diff < 0
                                ? 'text-red-400'
                                : 'text-zinc-600'
                          }`}
                        >
                          {diff == null ? '—' : diff === 0 ? '=' : `${diff > 0 ? '+' : ''}${formatKg(diff)}`}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
