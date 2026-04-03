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

  const days = [{ k: 'monday', l: 'LUN' }, { k: 'tuesday', l: 'MAR' }, { k: 'wednesday', l: 'MER' }, { k: 'thursday', l: 'GIO' }, { k: 'friday', l: 'VEN' }, { k: 'saturday', l: 'SAB' }, { k: 'sunday', l: 'DOM' }]

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) { setUser(user); loadData(user.id); } 
      else { router.push('/') }
    }
    init()
  }, [week, activeDay])

  async function loadData(userId: string) {
    setLoading(true); setLogs({});
    const { data: wData } = await supabase.from('workouts').select('*').eq('client_id', userId).eq('week_number', Number(week)).eq('day', activeDay).maybeSingle()
    setWorkout(wData)
    const { data: lData } = await supabase.from('client_logs').select('*').eq('client_id', userId).eq('week_number', Number(week)).eq('day', activeDay)
    const map: any = {}; lData?.forEach(l => { map[l.section] = l }); setLogs(map); setLoading(false)
  }

  async function saveFeedback(section: string, notes: string, videoUrl?: string) {
    if (!user) return
    await supabase.from('client_logs').upsert({ client_id: user.id, week_number: Number(week), day: activeDay, section, notes: notes || '', video_url: videoUrl || logs[section]?.video_url || null }, { onConflict: 'client_id,week_number,day,section' })
    loadData(user.id)
  }

  async function handleVideoUpload(section: string, file: File) {
    try {
      setUploadingSection(section)
      const fileName = `${user.id}/${Date.now()}-${section}.${file.name.split('.').pop()}`
      const { error: upErr } = await supabase.storage.from('videos').upload(fileName, file)
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('videos').getPublicUrl(fileName)
      await saveFeedback(section, logs[section]?.notes || '', publicUrl)
    } catch (err: any) { alert(err.message) } finally { setUploadingSection(null) }
  }

  async function deleteVideo(section: string) {
    if (!user || !logs[section]?.video_url || !confirm("Eliminare il video?")) return
    try {
      setUploadingSection(section)
      const fileName = `${user.id}/${logs[section].video_url.split('/').pop()}`
      await supabase.storage.from('videos').remove([fileName])
      await saveFeedback(section, logs[section]?.notes || '', "") // Rimuove URL dal DB
    } catch (err: any) { alert(err.message) } finally { setUploadingSection(null) }
  }

  return (
    <div className="min-h-screen bg-black text-white pb-32 font-sans">
      <div className="bg-zinc-900 border-b-2 border-red-600 p-4 sticky top-0 z-50 text-center font-black italic uppercase text-lg">REDTAIL CLIENT</div>
      <div className="flex justify-center gap-10 p-4 bg-zinc-900 border-b border-zinc-800">
        <button onClick={() => setWeek(w => Math.max(1, w - 1))} className="text-red-500 text-2xl font-bold">‹</button>
        <div className="text-center"><span className="block text-[10px] text-zinc-500 uppercase font-black">Week</span><span className="text-xl font-black text-red-500 italic">{week}</span></div>
        <button onClick={() => setWeek(w => w + 1)} className="text-red-500 text-2xl font-bold">›</button>
      </div>
      <div className="flex gap-1 p-2 bg-zinc-900 overflow-x-auto no-scrollbar border-b border-white/5">
        {days.map(d => (
          <button key={d.k} onClick={() => setActiveDay(d.k)} className={`flex-1 min-w-[55px] py-3 rounded-xl font-black text-[10px] border ${activeDay === d.k ? 'bg-red-600 border-red-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}>{d.l}</button>
        ))}
      </div>
      <div className="p-4 space-y-8 max-w-xl mx-auto">
        {loading ? <p className="text-center text-zinc-500 font-black italic animate-pulse py-10 uppercase">Syncing...</p> : 
         workout ? ['mobility', 'strength', 'wod'].map((s) => workout[s] && (
          <div key={s} className="bg-zinc-900 rounded-3xl border border-zinc-800 p-6 space-y-4">
            <label className="text-red-500 font-black uppercase text-[11px] flex items-center gap-2"><div className="w-1.5 h-4 bg-red-600 rounded-full" />{s}</label>
            <div className="bg-black/50 border border-zinc-800 p-4 rounded-2xl whitespace-pre-wrap text-sm leading-relaxed">{workout[s]}</div>
            <textarea value={logs[s]?.notes || ''} onChange={(e) => setLogs({...logs, [s]: {...logs[s], notes: e.target.value}})} onBlur={(e) => saveFeedback(s, e.target.value)} placeholder="Feedback..." className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-xs outline-none focus:border-green-600 min-h-[80px]" />
            <div className="flex gap-2">
               <input type="file" accept="video/*" id={`v-${s}`} className="hidden" onChange={(e) => e.target.files?.[0] && handleVideoUpload(s, e.target.files[0])} />
               <label htmlFor={`v-${s}`} className={`flex-1 flex items-center justify-center p-3 rounded-xl border border-zinc-800 text-[10px] font-black uppercase cursor-pointer ${logs[s]?.video_url ? 'bg-green-600/10 border-green-600 text-green-500' : 'bg-zinc-800 text-zinc-400'}`}>
                 {uploadingSection === s ? 'Wait...' : logs[s]?.video_url ? '✅ Video OK' : '📤 Upload'}
               </label>
               {logs[s]?.video_url && <button onClick={() => deleteVideo(s)} className="bg-red-600/10 border border-red-600 text-red-500 p-3 rounded-xl">✖</button>}
            </div>
          </div>
        )) : <div className="text-center py-20 text-zinc-600 font-black uppercase italic border border-dashed border-zinc-800 rounded-3xl">Rest Day</div>}
      </div>
    </div>
  )
}