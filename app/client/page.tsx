'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function ClientPage() {
  const [user, setUser] = useState<any>(null)
  const [week, setWeek] = useState(1)
  const [activeDay, setActiveDay] = useState('monday')
  const [workout, setWorkout] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const days = [
    { k: 'monday', l: 'LUN' }, { k: 'tuesday', l: 'MAR' },
    { k: 'wednesday', l: 'MER' }, { k: 'thursday', l: 'GIO' },
    { k: 'friday', l: 'VEN' }, { k: 'saturday', l: 'SAB' },
    { k: 'sunday', l: 'DOM' }
  ]

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser(user)
        loadWorkout(user.id)
      }
    }
    getUser()
  }, [week, activeDay])

  async function loadWorkout(userId: string) {
    setLoading(true)
    const { data } = await supabase
      .from('workouts')
      .select('*')
      .eq('client_id', userId)
      .eq('week_number', week)
      .eq('day', activeDay)
      .maybeSingle()
    
    setWorkout(data)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-20">
      {/* HEADER ATLETA */}
      <div className="bg-zinc-900 border-b-2 border-red-600 p-6 sticky top-0 z-50">
        <p className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.3em] text-center mb-1">Workout Area</p>
        <h1 className="font-black italic text-2xl text-white uppercase tracking-tighter text-center">Il Tuo Programma</h1>
      </div>

      {/* SELETTORE SETTIMANA */}
      <div className="flex justify-center items-center gap-10 p-4 bg-zinc-900 border-b border-zinc-800">
        <button onClick={() => setWeek(w => Math.max(1, w - 1))} className="text-red-500 text-2xl font-bold">‹</button>
        <div className="text-center">
          <span className="block text-[10px] font-black uppercase text-zinc-500 tracking-widest">Settimana</span>
          <span className="text-xl font-black italic text-red-500 leading-none">{week}</span>
        </div>
        <button onClick={() => setWeek(w => w + 1)} className="text-red-500 text-2xl font-bold">›</button>
      </div>

      {/* SELETTORE GIORNI */}
      <div className="flex gap-2 p-3 bg-zinc-900 overflow-x-auto no-scrollbar shadow-inner">
        {days.map(d => (
          <button
            key={d.k}
            onClick={() => setActiveDay(d.k)}
            className={`flex-1 min-w-[50px] py-3 rounded-xl font-black text-[10px] transition-all border ${
              activeDay === d.k 
              ? 'bg-red-600 border-red-500 text-white shadow-lg' 
              : 'bg-zinc-800 border-zinc-700 text-zinc-500'
            }`}
          >
            {d.l}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-6 max-w-xl mx-auto">
        {loading ? (
          <p className="text-center text-zinc-500 animate-pulse mt-10 uppercase font-black italic">Caricamento...</p>
        ) : workout ? (
          ['mobility', 'strength', 'wod'].map((section) => (
            workout[section] && (
              <div key={section} className="bg-zinc-900 rounded-3xl border border-zinc-800 p-6 space-y-4 shadow-2xl">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-red-600 rounded-full"></div>
                  <label className="text-red-500 font-black uppercase text-[11px] tracking-widest">{section}</label>
                </div>
                <div className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed bg-black/40 p-4 rounded-xl border border-zinc-800/50">
                  {workout[section]}
                </div>
              </div>
            )
          ))
        ) : (
          <div className="text-center py-20 bg-zinc-900/50 rounded-3xl border border-dashed border-zinc-800">
            <p className="text-zinc-600 font-black uppercase italic tracking-widest text-sm">Nessun allenamento assegnato</p>
            <p className="text-zinc-800 text-xs mt-2 uppercase">Riposo o contatta il coach</p>
          </div>
        )}
      </div>
    </div>
  )
}