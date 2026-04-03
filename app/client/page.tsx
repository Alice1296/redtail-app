'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function ClientPage() {
  const [user, setUser] = useState<any>(null)
  const [week, setWeek] = useState(1)
  const [activeDay, setActiveDay] = useState('monday')
  const [workout, setWorkout] = useState<any>(null)
  const [logs, setLogs] = useState<any>({})
  const [uploading, setUploading] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const fileRef = useRef<any>({})

  const days = [
    { k: 'monday', l: 'LUN' }, { k: 'tuesday', l: 'MAR' },
    { k: 'wednesday', l: 'MER' }, { k: 'thursday', l: 'GIO' },
    { k: 'friday', l: 'VEN' }, { k: 'saturday', l: 'SAB' },
    { k: 'sunday', l: 'DOM' }
  ]

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser(data.user)
      else window.location.href = '/'
    })
  }, [])

  useEffect(() => { if (user) { loadWorkout(); loadLogs() } }, [user, week, activeDay])

  async function loadWorkout() {
    const { data } = await supabase.from('workouts').select('*')
      .eq('client_id', user.id).eq('week_number', week).eq('day', activeDay).maybeSingle()
    setWorkout(data)
  }

  async function loadLogs() {
    const { data } = await supabase.from('client_logs').select('*')
      .eq('client_id', user.id)
    
    const map: any = {}
    data?.forEach(l => { map[l.section] = l })
    setLogs(map)
  }

  async function saveLog(section: string, notes: string) {
    if (!user) return
    const existing = logs[section]
    
    if (existing) {
      await supabase.from('client_logs').update({ notes }).eq('id', existing.id)
    } else {
      await supabase.from('client_logs').insert([{ 
        client_id: user.id, 
        workout_id: workout?.id || null, 
        section, 
        notes 
      }])
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    loadLogs()
  }

  async function uploadVideo(section: string, file: File) {
    if (!user) return
    setUploading(section)
    
    // Pulizia nome file
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}/${section}_${Date.now()}.${fileExt}`
    
    const { data: upload, error } = await supabase.storage.from('videos').upload(fileName, file)
    
    if (error) {
      alert("Errore upload: assicurati di aver creato il bucket 'videos' su Supabase come PUBLIC")
      setUploading(null)
      return
    }

    const { data: url } = supabase.storage.from('videos').getPublicUrl(fileName)
    const existing = logs[section]
    
    if (existing) {
      await supabase.from('client_logs').update({ video_url: url.publicUrl }).eq('id', existing.id)
    } else {
      await supabase.from('client_logs').insert([{ 
        client_id: user.id, 
        workout_id: workout?.id || null, 
        section, 
        video_url: url.publicUrl 
      }])
    }
    
    loadLogs()
    setUploading(null)
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-10">
      <div className="sticky top-0 z-50 bg-zinc-900 border-b-2 border-red-600 p-4 flex justify-between items-center">
        <h1 className="font-black italic text-xl text-red-500 uppercase tracking-tighter">Redtail</h1>
        <button onClick={() => supabase.auth.signOut().then(() => window.location.href='/')} className="text-zinc-500 text-xs font-bold uppercase">Esci</button>
      </div>

      <div className="flex items-center justify-center gap-8 p-4 bg-zinc-900 border-b border-zinc-800">
        <button onClick={() => setWeek(w => Math.max(1, w - 1))} className="text-red-500 text-2xl">‹</button>
        <span className="font-black uppercase tracking-widest text-sm">Settimana {week}</span>
        <button onClick={() => setWeek(w => w + 1)} className="text-red-500 text-2xl">›</button>
      </div>

      <div className="flex gap-2 p-3 bg-zinc-900 overflow-x-auto">
        {days.map(d => (
          <button key={d.k} onClick={() => setActiveDay(d.k)}
            className={`flex-1 min-w-[45px] py-3 rounded-lg font-black text-[10px] transition-all
              ${activeDay === d.k ? 'bg-red-600 text-white shadow-lg shadow-red-600/30' : 'bg-zinc-800 text-zinc-500'}`}>
            {d.l}
          </button>
        ))}
      </div>

      <div className="max-w-xl mx-auto p-4 space-y-6">
        {!workout ? (
          <div className="text-center py-20 opacity-20">
            <p className="font-black uppercase italic">Rest Day</p>
          </div>
        ) : (
          ['mobility', 'strength', 'wod'].map(section => (
            <div key={section} className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5 space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">{section}</p>
              </div>
              
              <p className="font-bold text-lg leading-tight whitespace-pre-wrap text-zinc-100">{workout[section] || '---'}</p>
              
              <div className="space-y-3 pt-2">
                <textarea
                  className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-sm outline-none focus:border-red-500 transition-all h-20"
                  placeholder="Annota i tuoi carichi o round..."
                  defaultValue={logs[section]?.notes || ''}
                  onBlur={e => saveLog(section, e.target.value)}
                />
                
                <div className="flex items-center gap-3">
                  <input type="file" accept="video/*" className="hidden"
                    ref={el => { fileRef.current[section] = el }}
                    onChange={e => e.target.files?.[0] && uploadVideo(section, e.target.files[0])}
                  />
                  <button 
                    onClick={() => fileRef.current[section]?.click()}
                    className="flex-1 bg-zinc-800 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border border-zinc-700 active:scale-95 transition-transform"
                  >
                    {uploading === section ? 'Caricamento...' : logs[section]?.video_url ? 'Aggiorna Video' : 'Carica Video'}
                  </button>
                </div>

                {logs[section]?.video_url && (
                  <video src={logs[section].video_url} controls className="w-full rounded-xl border-2 border-zinc-800" />
                )}
              </div>
            </div>
          ))
        )}
      </div>
      {saved && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-green-500 text-black px-6 py-2 rounded-full font-black uppercase text-xs animate-bounce">
          ✓ Dati salvati
        </div>
      )}
    </div>
  )
}