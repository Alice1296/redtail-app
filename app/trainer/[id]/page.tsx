'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useParams, useRouter } from 'next/navigation'

export default function TrainerPage() {
  const { id } = useParams()
  const router = useRouter()
  const [week, setWeek] = useState(1)
  const [activeDay, setActiveDay] = useState('monday')
  const [form, setForm] = useState({ mobility: '', strength: '', wod: '', coach_notes: '' })
  const [logs, setLogs] = useState<any>({})
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  const days = [
    { k: 'monday', l: 'LUN' }, { k: 'tuesday', l: 'MAR' }, { k: 'wednesday', l: 'MER' },
    { k: 'thursday', l: 'GIO' }, { k: 'friday', l: 'VEN' }, { k: 'saturday', l: 'SAB' }, { k: 'sunday', l: 'DOM' }
  ]

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) router.push('/')
    }
    checkUser()
  }, [])

  useEffect(() => {
    if (id) {
      setLogs({}) // Reset video per evitare scambi
      loadWorkout()
      loadLogs()
    }
  }, [id, week, activeDay])

  async function loadWorkout() {
    setForm({ mobility: '', strength: '', wod: '', coach_notes: '' })
    const { data } = await supabase.from('workouts').select('*')
      .eq('client_id', id).eq('week_number', Number(week)).eq('day', activeDay).maybeSingle()
    if (data) setForm({ mobility: data.mobility || '', strength: data.strength || '', wod: data.wod || '', coach_notes: data.coach_notes || '' })
  }

  async function loadLogs() {
    const { data } = await supabase.from('client_logs').select('*')
      .eq('client_id', id)
      .eq('week_number', Number(week))
      .eq('day', activeDay)
    
    const map: any = {}
    data?.forEach(l => { map[l.section] = l })
    setLogs(map)
  }

  async function saveWorkout() {
    setLoading(true)
    const { error } = await supabase.from('workouts').upsert({ 
      client_id: id, 
      week_number: Number(week), 
      day: activeDay, 
      ...form 
    }, { onConflict: 'client_id,week_number,day' })
    
    if (!error) { 
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      <div className="bg-zinc-900 border-b-2 border-red-600 p-4 sticky top-0 z-50 text-center font-black italic uppercase text-red-500 text-lg">REDTAIL COACH</div>
      
      <div className="flex justify-center items-center gap-10 p-4 bg-zinc-900 border-b border-zinc-800">
        <button onClick={() => setWeek(w => Math.max(1, w - 1))} className="text-red-500 text-2xl font-bold">‹</button>
        <div className="text-center">
          <span className="block text-[10px] text-zinc-500 uppercase font-black">Settimana</span>
          <span className="text-xl font-black text-red-500 italic">{week}</span>
        </div>
        <button onClick={() => setWeek(w => w + 1)} className="text-red-500 text-2xl font-bold">›</button>
      </div>

      <div className="flex gap-2 p-3 bg-zinc-900 overflow-x-auto sticky top-[68px] z-40 no-scrollbar border-b border-white/5">
        {days.map(d => (
          <button key={d.k} onClick={() => setActiveDay(d.k)} className={`flex-1 min-w-[60px] py-3 rounded-xl font-black text-[10px] border transition-all ${activeDay === d.k ? 'bg-red-600 border-red-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}>{d.l}</button>
        ))}
      </div>

      <div className="p-4 space-y-8 max-w-xl mx-auto">
        {['mobility', 'strength', 'wod'].map((s) => (
          <div key={s} className="bg-zinc-900 rounded-3xl border border-zinc-800 p-6 space-y-4 shadow-xl">
            <label className="text-red-500 font-black uppercase text-[11px] tracking-widest flex items-center gap-2">
              <div className="w-1.5 h-4 bg-red-600 rounded-full" />{s}
            </label>
            <textarea 
              value={(form as any)[s]} 
              onChange={e => setForm({ ...form, [s]: e.target.value })} 
              className="w-full bg-black border border-zinc-800 p-4 rounded-2xl h-32 text-sm outline-none focus:border-red-600 transition-all shadow-inner" 
            />
            
            {logs[s] && (
              <div className="bg-zinc-800/60 border-l-4 border-green-500 p-4 mt-2 rounded-r-2xl space-y-3">
                <p className="text-[10px] font-black text-green-500 uppercase italic">Feedback Atleta</p>
                {logs[s].notes && <p className="text-sm italic text-zinc-200">"{logs[s].notes}"</p>}
                {logs[s].video_url && (
                  <div className="rounded-xl overflow-hidden border border-zinc-700 aspect-video bg-black shadow-2xl">
                    <video src={logs[s].video_url} controls className="w-full h-full object-contain" />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-black/90 backdrop-blur-md border-t border-zinc-800 z-[60]">
          <button onClick={saveWorkout} disabled={loading} className="w-full max-w-xl mx-auto block bg-red-600 p-4 rounded-2xl font-black uppercase italic tracking-widest shadow-xl shadow-red-600/40 active:scale-95 transition-all">
            {loading ? 'Salvataggio...' : saved ? '✓ Inviato' : 'Salva Programma'}
          </button>
        </div>
      </div>
    </div>
  )
}