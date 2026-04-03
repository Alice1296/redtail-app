'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useParams } from 'next/navigation'

export default function TrainerPage() {
  const { id } = useParams()

  // Stati per la navigazione
  const [week, setWeek] = useState(1)
  const [activeDay, setActiveDay] = useState('monday')

  // Stati per il programma (quello che scrive il coach)
  const [form, setForm] = useState({
    mobility: '',
    strength: '',
    wod: '',
    coach_notes: ''
  })

  // Stati per i log dell'atleta (quello che riceve il coach)
  const [logs, setLogs] = useState<any>({})
  
  // Stati di UI
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  const days = [
    { k: 'monday', l: 'LUN' }, { k: 'tuesday', l: 'MAR' },
    { k: 'wednesday', l: 'MER' }, { k: 'thursday', l: 'GIO' },
    { k: 'friday', l: 'VEN' }, { k: 'saturday', l: 'SAB' },
    { k: 'sunday', l: 'DOM' }
  ]

  // Effetto: Ricarica tutto quando cambiano atleta, settimana o giorno
  useEffect(() => {
    if (id) {
      loadWorkout()
      loadLogs()
    }
  }, [id, week, activeDay])

  // Carica il programma scritto dal coach
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

  // Carica i feedback lasciati dall'atleta
  async function loadLogs() {
    setLogs({}) // Reset per evitare di vedere feedback del giorno precedente
    const { data } = await supabase
      .from('client_logs')
      .select('*')
      .eq('client_id', id)
      .eq('week_number', week)
      .eq('day', activeDay)
    
    const map: any = {}
    data?.forEach(l => {
      // Chiave univoca identica a quella usata nel Client
      const key = `${l.day}-${l.week_number}-${l.section}`
      map[key] = l
    })
    setLogs(map)
  }

  // Salva il programma nel database
  async function saveWorkout() {
    setLoading(true)
    const { data: existing } = await supabase
      .from('workouts')
      .select('id')
      .eq('client_id', id)
      .eq('week_number', week)
      .eq('day', activeDay)
      .maybeSingle()

    const payload = {
      client_id: id,
      week_number: week,
      day: activeDay,
      ...form
    }

    if (existing) {
      await supabase.from('workouts').update(form).eq('id', existing.id)
    } else {
      await supabase.from('workouts').insert([payload])
    }
    
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-32">
      {/* HEADER */}
      <div className="bg-zinc-900 border-b-2 border-red-600 p-4 sticky top-0 z-50">
        <h1 className="font-black italic text-xl text-red-500 uppercase tracking-tighter text-center">
          Pannello Coach
        </h1>
      </div>

      {/* SELETTORE SETTIMANA */}
      <div className="flex justify-center items-center gap-10 p-4 bg-zinc-900 border-b border-zinc-800">
        <button onClick={() => setWeek(w => Math.max(1, w - 1))} className="text-red-500 text-2xl font-bold">‹</button>
        <div className="text-center">
          <span className="block text-[10px] font-black uppercase text-zinc-500 tracking-widest leading-none">Settimana</span>
          <span className="text-xl font-black italic text-red-500 leading-none">{week}</span>
        </div>
        <button onClick={() => setWeek(w => w + 1)} className="text-red-500 text-2xl font-bold">›</button>
      </div>

      {/* SELETTORE GIORNI */}
      <div className="flex gap-2 p-3 bg-zinc-900 overflow-x-auto no-scrollbar shadow-inner sticky top-[68px] z-40">
        {days.map(d => (
          <button
            key={d.k}
            onClick={() => setActiveDay(d.k)}
            className={`flex-1 min-w-[50px] py-3 rounded-xl font-black text-[10px] transition-all border ${
              activeDay === d.k 
              ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/20' 
              : 'bg-zinc-800 border-zinc-700 text-zinc-500'
            }`}
          >
            {d.l}
          </button>
        ))}
      </div>

      {/* FORM PROGRAMMAZIONE + LOG ATLETA */}
      <div className="p-4 space-y-8 max-w-xl mx-auto">
        {['mobility', 'strength', 'wod'].map((section) => {
          const logKey = `${activeDay}-${week}-${section}`;
          const athleteLog = logs[logKey];
          
          return (
            <div key={section} className="bg-zinc-900 rounded-3xl border border-zinc-800 p-6 space-y-4 shadow-2xl">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-4 bg-red-600 rounded-full"></div>
                <label className="text-red-500 font-black uppercase text-[11px] tracking-widest">{section}</label>
              </div>
              
              <textarea
                value={(form as any)[section]}
                onChange={e => setForm({ ...form, [section]: e.target.value })}
                placeholder={`Inserisci esercizi e istruzioni per ${section}...`}
                className="w-full bg-black border border-zinc-800 p-4 rounded-2xl h-32 outline-none focus:border-red-600 transition-all text-sm placeholder:text-zinc-800 leading-relaxed"
              />
              
              {/* BOX FEEDBACK ATLETA */}
              {athleteLog && (
                <div className="bg-zinc-800/60 border-l-4 border-green-500 p-4 mt-2 rounded-r-2xl space-y-3 animate-in fade-in slide-in-from-left-2 duration-300">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] font-black text-green-500 uppercase tracking-widest">Feedback Atleta</p>
                  </div>
                  
                  {athleteLog.notes && (
                    <p className="text-sm text-zinc-200 italic leading-relaxed">
                      "{athleteLog.notes}"
                    </p>
                  )}
                  
                  {athleteLog.video_url && (
                    <div className="rounded-xl overflow-hidden border border-zinc-700 shadow-xl bg-black aspect-video relative group">
                      <video 
                        src={athleteLog.video_url} 
                        controls 
                        className="w-full h-full" 
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* SALVATAGGIO FISSO IN BASSO */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-black/90 backdrop-blur-md border-t border-zinc-800 z-[100]">
           <button
            onClick={saveWorkout}
            disabled={loading}
            className="w-full max-w-xl mx-auto block bg-red-600 p-4 rounded-2xl font-black uppercase italic tracking-widest hover:bg-red-700 transition-all shadow-xl shadow-red-600/40 active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Salvataggio...' : saved ? '✓ Programma Salvato' : 'Salva Programma'}
          </button>
        </div>
      </div>
    </div>
  )
}