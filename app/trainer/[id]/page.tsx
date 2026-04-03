'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useParams } from 'next/navigation'

export default function TrainerPage() {
  const { id } = useParams()

  const [week, setWeek] = useState(1)
  const [activeDay, setActiveDay] = useState('monday')

  const [form, setForm] = useState({
    mobility: '',
    strength: '',
    wod: '',
    coach_notes: ''
  })

  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [logs, setLogs] = useState<any>({}) // Cambiato in oggetto per mappare le sezioni

  const days = [
    { k: 'monday', l: 'LUN' }, { k: 'tuesday', l: 'MAR' },
    { k: 'wednesday', l: 'MER' }, { k: 'thursday', l: 'GIO' },
    { k: 'friday', l: 'VEN' }, { k: 'saturday', l: 'SAB' },
    { k: 'sunday', l: 'DOM' }
  ]

  useEffect(() => {
    if (id) {
      loadWorkout()
      loadLogs()
    }
  }, [id, week, activeDay])

  async function loadWorkout() {
    setForm({ mobility: '', strength: '', wod: '', coach_notes: '' })
    const { data } = await supabase
      .from('workouts')
      .select('*')
      .eq('client_id', id)
      .eq('week_number', week)
      .eq('day', activeDay)
      .maybeSingle()

    if (data) {
      setForm({
        mobility: data.mobility || '',
        strength: data.strength || '',
        wod: data.wod || '',
        coach_notes: data.coach_notes || ''
      })
    }
  }

  async function loadLogs() {
    // Carichiamo i log del cliente per questo specifico atleta
    const { data } = await supabase
      .from('client_logs')
      .select('*')
      .eq('client_id', id)
    
    const map: any = {}
    data?.forEach(l => {
      map[l.section] = l
    })
    setLogs(map)
  }

  async function saveWorkout() {
    setLoading(true)
    const { data: existing } = await supabase
      .from('workouts')
      .select('id')
      .eq('client_id', id)
      .eq('week_number', week)
      .eq('day', activeDay)
      .maybeSingle()

    if (existing) {
      await supabase.from('workouts').update(form).eq('id', existing.id)
    } else {
      await supabase.from('workouts').insert([{
        client_id: id,
        week_number: week,
        day: activeDay,
        ...form
      }])
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <div className="bg-zinc-900 border-b-2 border-red-600 p-4">
        <h1 className="font-black italic text-xl text-red-500 uppercase">Programmazione</h1>
      </div>

      <div className="flex justify-center gap-6 p-4 bg-zinc-900">
        <button onClick={() => setWeek(w => Math.max(1, w - 1))} className="text-red-500 font-bold">‹</button>
        <span className="font-bold uppercase tracking-tighter">Settimana {week}</span>
        <button onClick={() => setWeek(w => w + 1)} className="text-red-500 font-bold">›</button>
      </div>

      <div className="flex gap-2 p-3 bg-zinc-900 overflow-x-auto">
        {days.map(d => (
          <button
            key={d.k}
            onClick={() => setActiveDay(d.k)}
            className={`flex-1 min-w-[50px] py-2 rounded font-black text-xs ${
              activeDay === d.k ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-500'
            }`}
          >
            {d.l}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-8 max-w-xl mx-auto pb-20">
        {['mobility', 'strength', 'wod'].map((section) => (
          <div key={section} className="space-y-2">
            <label className="text-red-500 font-black uppercase text-xs tracking-widest">{section}</label>
            <textarea
              value={(form as any)[section]}
              onChange={e => setForm({ ...form, [section]: e.target.value })}
              placeholder={`Scrivi ${section}...`}
              className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-lg h-32 outline-none focus:border-red-600 transition-all"
            />
            
            {/* VISUALIZZAZIONE LOG CLIENTE */}
            {logs[section] && (
              <div className="bg-zinc-800/50 border-l-4 border-green-500 p-3 mt-2 rounded-r-lg">
                <p className="text-[10px] font-black text-green-500 uppercase mb-1">Feedback Atleta</p>
                <p className="text-sm text-zinc-300 italic mb-2">"{logs[section].notes}"</p>
                {logs[section].video_url && (
                  <video src={logs[section].video_url} controls className="w-full rounded border border-zinc-700" />
                )}
              </div>
            )}
          </div>
        ))}

        <button
          onClick={saveWorkout}
          className="w-full bg-red-600 p-4 rounded-xl font-black uppercase italic tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
        >
          {loading ? 'Salvataggio...' : saved ? '✓ Salvato' : 'Salva Programma'}
        </button>
      </div>
    </div>
  )
}