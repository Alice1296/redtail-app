'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function ClientPage() {
  const [user, setUser] = useState<any>(null)
  const [week, setWeek] = useState(1)
  const [activeDay, setActiveDay] = useState('monday')
  const [workout, setWorkout] = useState<any>(null)
  const [logs, setLogs] = useState<any>({}) 
  const [loading, setLoading] = useState(true)
  const [uploadingSection, setUploadingSection] = useState<string | null>(null)
  const router = useRouter()

  const days = [
    { k: 'monday', l: 'LUN' }, { k: 'tuesday', l: 'MAR' }, { k: 'wednesday', l: 'MER' },
    { k: 'thursday', l: 'GIO' }, { k: 'friday', l: 'VEN' }, { k: 'saturday', l: 'SAB' }, { k: 'sunday', l: 'DOM' }
  ]

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) { 
        setUser(user)
        loadData(user.id) 
      } else {
        router.push('/')
      }
    }
    init()
  }, [week, activeDay])

  async function loadData(userId: string) {
    setLoading(true)
    setLogs({})
    
    const { data: wData } = await supabase.from('workouts').select('*')
      .eq('client_id', userId).eq('week_number', Number(week)).eq('day', activeDay).maybeSingle()
    setWorkout(wData)

    const { data: lData } = await supabase.from('client_logs').select('*')
      .eq('client_id', userId).eq('week_number', Number(week)).eq('day', activeDay)

    const map: any = {}
    lData?.forEach(l => { map[l.section] = l })
    setLogs(map)
    setLoading(false)
  }

  async function saveFeedback(section: string, notes: string, videoUrl?: string) {
    if (!user) return
    const { error } = await supabase.from('client_logs').upsert({
      client_id: user.id,
      week_number: Number(week),
      day: activeDay,
      section: section,
      notes: notes || '',
      video_url: videoUrl || logs[section]?.video_url || null
    }, { onConflict: 'client_id,week_number,day,section' })

    if (!error) loadData(user.id)
  }

  async function handleVideoUpload(section: string, file: File) {
    if (!user) return
    try {
      setUploadingSection(section)
      // Cartella specifica per utente: ID_UTENTE/timestamp-sezione.ext
      const fileName = `${user.id}/${Date.now()}-${section}.${file.name.split('.').pop()}`
      
      const { error: upErr } = await supabase.storage.from('videos').upload(fileName, file)
      if (upErr) throw upErr
      
      const { data: { publicUrl } } = supabase.storage.from('videos').getPublicUrl(fileName)
      await saveFeedback(section, logs[section]?.notes || '', publicUrl)
    } catch (err: any) { alert("Upload fallito: " + err.message) } 
    finally { setUploadingSection(null) }
  }

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      <div className="bg-zinc-900 border-b-2 border-red-600 p-4 sticky top-0 z-50 text-center font-black italic uppercase text-lg italic tracking-tighter">REDTAIL CLIENT</div>
      
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
          <button key={d.k} onClick={() => setActiveDay(d.k)} className={`flex-1 min-w-[60px] py-3 rounded-xl font-black text-[10px] border transition-all ${activeDay === d.k ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/20' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}>{d.l}</button>
        ))}
      </div>

      <div className="p-4 space-y-8 max-w-xl mx-auto">
        {loading ? <p className="text-center animate-pulse text-zinc-500 font-black italic uppercase mt-10 tracking-widest">Sincronizzazione...</p> : 
         workout ? ['mobility', 'strength', 'wod'].map((s) => workout[s] && (
          <div key={s} className="bg-zinc-900 rounded-3xl border border-zinc-800 p-6 space-y-4 shadow-2xl">
            <label className="text-red-500 font-black uppercase text-[11px] flex items-center gap-2"><div className="w-1.5 h-4 bg-red-600 rounded-full" />{s}</label>
            <div className="bg-black/50 border border-zinc-800 p-4 rounded-2xl whitespace-pre-wrap leading-relaxed text-zinc-200 text-sm">{workout[s]}</div>
            
            <div className="pt-4 border-t border-zinc-800/50 space-y-4">
               <textarea 
                  value={logs[s]?.notes || ''} 
                  onChange={(e) => setLogs({...logs, [s]: {...logs[s], notes: e.target.value}})} 
                  onBlur={(e) => saveFeedback(s, e.target.value)} 
                  placeholder="Note, kg, sensazioni..." 
                  className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-xs outline-none focus:border-green-600 min-h-[80px]" 
               />
               <input type="file" accept="video/*" id={`v-${s}`} className="hidden" onChange={(e) => e.target.files?.[0] && handleVideoUpload(s, e.target.files[0])} />
               <label htmlFor={`v-${s}`} className={`w-full flex items-center justify-center p-3 rounded-xl border border-zinc-800 text-[10px] font-black uppercase cursor-pointer transition-all ${logs[s]?.video_url ? 'bg-green-600/10 border-green-600 text-green-500' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>
                 {uploadingSection === s ? 'Caricamento...' : logs[s]?.video_url ? '✅ Video Caricato' : '📤 Carica Video'}
               </label>
            </div>
          </div>
        )) : <div className="text-center py-20 text-zinc-600 font-black uppercase italic tracking-widest border border-dashed border-zinc-800 rounded-3xl text-sm">Giorno di Riposo</div>}
      </div>
    </div>
  )
}