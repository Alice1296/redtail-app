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

  async function saveFeedback(section: string, notes: string, videoUrls?: string[]) {
    if (!user) return
    const currentVideos = logs[section]?.video_urls || []
    const finalVideos = videoUrls !== undefined ? videoUrls : currentVideos
    await supabase.from('client_logs').upsert({ client_id: user.id, week_number: Number(week), day: activeDay, section, notes: notes || '', video_urls: finalVideos.length > 0 ? finalVideos : null }, { onConflict: 'client_id,week_number,day,section' })
    loadData(user.id)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  async function handleVideoUpload(section: string, file: File) {
    try {
      setUploadingSection(section)
      const fileName = `${user.id}/${Date.now()}-${section}.${file.name.split('.').pop()}`
      const { error: upErr } = await supabase.storage.from('videos').upload(fileName, file)
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('videos').getPublicUrl(fileName)
      const currentVideos = logs[section]?.video_urls || []
      await saveFeedback(section, logs[section]?.notes || '', [...currentVideos, publicUrl])
    } catch (err: any) { alert(err.message) } finally { setUploadingSection(null) }
  }

  async function deleteVideo(section: string, videoUrl: string) {
    if (!user || !confirm("Eliminare il video?")) return
    try {
      setUploadingSection(section)
      console.log('🔍 URL completo:', videoUrl)
      
      // Estrai il percorso relativo dal bucket
      const storagePath = videoUrl.split('/storage/v1/object/public/videos/')[1]
      console.log('🔍 Percorso estratto:', storagePath)
      
      if (storagePath) {
        console.log('🗑️ Tentando eliminazione con percorso:', storagePath)
        
        // Usa l'API route (server-side con service role key)
        const apiRes = await fetch('/api/delete-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: storagePath })
        })
        
        const apiData = await apiRes.json()
        console.log('📦 Risposta API:', apiData)
        
        if (!apiRes.ok) {
          console.error('❌ Errore eliminazione file:', apiData.error)
          alert('Errore: ' + apiData.error)
        } else {
          console.log('✅ File eliminato dal bucket:', storagePath)
        }
      } else {
        console.warn('⚠️ Impossibile estrarre il percorso del file da:', videoUrl)
      }
      
      // Rimuovi l'URL dall'array nel database
      const currentVideos = logs[section]?.video_urls || []
      const updatedVideos = currentVideos.filter((v: string) => v !== videoUrl)
      await saveFeedback(section, logs[section]?.notes || '', updatedVideos)
    } catch (err: any) { 
      console.error('❌ Errore catch:', err)
      alert(err.message) 
    } finally { 
      setUploadingSection(null) 
    }
  }

  return (
    <div className="min-h-screen bg-black text-white pb-32 font-sans">
      <div className="bg-zinc-900 border-b-2 border-red-600 p-4 sticky top-0 z-50 flex items-center justify-between">
        <div className="text-center flex-1 font-black italic uppercase text-lg">REDTAIL CLIENT</div>
        <button
          onClick={handleLogout}
          className="ml-4 bg-red-600/10 border border-red-600 text-red-500 px-3 py-1 rounded-lg text-[10px] font-black uppercase hover:bg-red-600/20 transition-all active:scale-95"
        >
          Logout
        </button>
      </div>
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
            
            {/* NOTE COACH */}
            {workout.coach_notes && (
              (() => {
                try {
                  const coachNotes = typeof workout.coach_notes === 'string' ? JSON.parse(workout.coach_notes) : workout.coach_notes
                  const sectionNote = coachNotes?.[s]
                  if (sectionNote) {
                    return (
                      <div className="bg-yellow-900/20 border border-yellow-700/50 p-3 rounded-lg">
                        <p className="text-[10px] font-black text-yellow-500 uppercase mb-2">📝 Nota del Coach</p>
                        <p className="text-sm text-yellow-100/80 italic">{sectionNote}</p>
                      </div>
                    )
                  }
                } catch (e) {}
                return null
              })()
            )}

            <textarea value={logs[s]?.notes || ''} onChange={(e) => setLogs({...logs, [s]: {...logs[s], notes: e.target.value}})} onBlur={(e) => saveFeedback(s, e.target.value)} placeholder="Feedback..." className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-xs outline-none focus:border-green-600 min-h-[80px]" />
            <div className="flex gap-2">
               <input type="file" accept="video/*" id={`v-${s}`} className="hidden" onChange={(e) => e.target.files?.[0] && handleVideoUpload(s, e.target.files[0])} />
               <label htmlFor={`v-${s}`} className={`flex-1 flex items-center justify-center p-3 rounded-xl border border-zinc-800 text-[10px] font-black uppercase cursor-pointer ${logs[s]?.video_urls?.length > 0 ? 'bg-green-600/10 border-green-600 text-green-500' : 'bg-zinc-800 text-zinc-400'}`}>
                 {uploadingSection === s ? 'Wait...' : logs[s]?.video_urls?.length > 0 ? `✅ ${logs[s].video_urls.length} Video${logs[s].video_urls.length > 1 ? 's' : ''}` : '📤 Upload'}
               </label>
            </div>
            {logs[s]?.video_urls && logs[s].video_urls.length > 0 && (
              <div className="space-y-2 bg-black/30 p-4 rounded-xl border border-zinc-800">
                <p className="text-[10px] font-black uppercase text-zinc-400">Video caricati:</p>
                {logs[s].video_urls.map((videoUrl: string, idx: number) => (
                  <div key={idx} className="flex items-center justify-between bg-zinc-900 p-3 rounded-lg border border-zinc-800">
                    <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 underline truncate flex-1">Video {idx + 1}</a>
                    <button onClick={() => deleteVideo(s, videoUrl)} className="ml-2 bg-red-600/10 border border-red-600 text-red-500 px-2 py-1 rounded text-[10px] font-bold hover:bg-red-600/20">✖ Elimina</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )) : <div className="text-center py-20 text-zinc-600 font-black uppercase italic border border-dashed border-zinc-800 rounded-3xl">Rest Day</div>}
      </div>
    </div>
  )
}