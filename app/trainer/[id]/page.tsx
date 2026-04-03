'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useParams } from 'next/navigation'

export default function TrainerPage() {
  const { id } = useParams()
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
    if (id) { loadWorkout(); loadLogs(); }
  }, [id, week, activeDay])

  async function loadWorkout() {
    setForm({ mobility: '', strength: '', wod: '', coach_notes: '' })
    const { data } = await supabase.from('workouts').select('*').eq('client_id', id).eq('week_number', week).eq('day', activeDay).maybeSingle()
    if (data) setForm({ mobility: data.mobility || '', strength: data.strength || '', wod: data.wod || '', coach_notes: data.coach_notes || '' })
  }

  async function loadLogs() {
    const { data } = await supabase.from('client_logs').select('*').eq('client_id', id).eq('week_number', week).eq('day', activeDay)
    const map: any = {}
    data?.forEach(l => { map[l.section] = l })
    setLogs(map)
  }

  async function saveWorkout() {
    setLoading(true)
    await supabase.from('workouts').upsert({ client_id: id, week_number: week, day: activeDay, ...form }, { onConflict: 'client_id,week_number,day' })
    setSaved(true); setTimeout(() => setSaved(false), 2000); setLoading(false)
  }

  async function deleteVideo(section: string, videoUrl: string) {
    if (!confirm("Eliminare il video?")) return
    const fileName = videoUrl.split('/videos/').pop()
    if (fileName) await supabase.storage.from('videos').remove([fileName])
    await supabase.from('client_logs').update({ video_url: null }).eq('client_id', id).eq('week_number', week).eq('day', activeDay).eq('section', section)
    loadLogs()
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-32">
      <div className="bg-zinc-900 border-b-2 border-red-600 p-4 sticky top-0 z-50 text-center">
        <h1 className="font-black italic text-xl text-red-500 uppercase tracking-tighter">Pannello Coach</h1>
      </div>
      <div className="flex justify-center items-center gap-10 p-4 bg-zinc-900 border-b border-zinc-800">
        <button onClick={() => setWeek(w => Math.max(1, w - 1))} className="text-red-500 text-2xl font-bold">‹</button>
        <div className="text-center">
          <span className="block text-[10px] font-black uppercase text-zinc-500 tracking-widest">Week</span>
          <span className="text-xl font-black italic text-red-500">{week}</span>
        </div>
        <button onClick={() => setWeek(w => w + 1)} className="text-red-500 text-2xl font-bold">›</button>
      </div>
      <div className="flex gap-2 p-3 bg-zinc-900 overflow-x-auto no-scrollbar sticky top-[68px] z-40">
        {days.map(d => (
          <button key={d.k} onClick={() => setActiveDay(d.k)} className={`flex-1 min-w-[50px] py-3 rounded-xl font-black text-[10px] border ${activeDay === d.k ? 'bg-red-600 border-red-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}>{d.l}</button>
        ))}
      </div>
      <div className="p-4 space-y-8 max-w-xl mx-auto">
        {['mobility', 'strength', 'wod'].map((section) => (
          <div key={section} className="bg-zinc-900 rounded-3xl border border-zinc-800 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-4 bg-red-600 rounded-full"></div>
              <label className="text-red-500 font-black uppercase text-[11px] tracking-widest">{section}</label>
            </div>
            <textarea value={(form as any)[section]} onChange={e => setForm({ ...form, [section]: e.target.value })} placeholder={`Esercizi per ${section}...`} className="w-full bg-black border border-zinc-800 p-4 rounded-2xl h-32 outline-none focus:border-red-600 text-sm" />
            {logs[section] && (
              <div className="bg-zinc-800/60 border-l-4 border-green-500 p-4 mt-2 rounded-r-2xl space-y-3">
                <p className="text-[10px] font-black text-green-500 uppercase tracking-widest">Feedback Atleta</p>
                {logs[section].notes && <p className="text-sm text-zinc-200 italic">"{logs[section].notes}"</p>}
                {logs[section].video_url && (
                  <div className="space-y-2">
                    <div className="rounded-xl overflow-hidden border border-zinc-700 bg-black aspect-video"><video src={logs[section].video_url} controls className="w-full h-full" /></div>
                    <button onClick={() => deleteVideo(section, logs[section].video_url)} className="text-[9px] font-black text-red-500 uppercase tracking-widest">🗑️ Elimina Video</button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-black/90 backdrop-blur-md border-t border-zinc-800 z-[100]">
          <button onClick={saveWorkout} disabled={loading} className="w-full max-w-xl mx-auto block bg-red-600 p-4 rounded-2xl font-black uppercase italic tracking-widest shadow-xl shadow-red-600/40 active:scale-95 disabled:opacity-50">
            {loading ? 'Salvataggio...' : saved ? '✓ Salvato' : 'Salva Programma'}
          </button>
        </div>
      </div>
    </div>
  )
}