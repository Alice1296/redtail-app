'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Image from 'next/image'

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
    
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}/${section}_${Date.now()}.${fileExt}`
    
    const { data: upload, error } = await supabase.storage.from('videos').upload(fileName, file)
    
    if (error) {
      alert("Errore upload: assicurati che il bucket 'videos' sia PUBLIC")
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
    <div className="min-h-screen bg-black text-white font-sans pb-20">
      
      {/* HEADER BRANDIZZATO */}
      <div className="sticky top-0 z-50 bg-zinc-900/90 backdrop-blur-md border-b-2 border-red-600 p-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Redtail Logo" width={35} height={35} className="object-contain" />
          <div>
            <h1 className="font-black italic text-lg text-red-500 uppercase tracking-tighter leading-none">
              Redtail
            </h1>
            <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-zinc-500 leading-none">
              Program
            </span>
          </div>
        </div>
        <button 
          onClick={() => supabase.auth.signOut().then(() => window.location.href='/')} 
          className="bg-zinc-800 hover:bg-red-900/30 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase text-zinc-400 border border-zinc-700 transition-all"
        >
          Esci
        </button>
      </div>

      {/* SELETTORE SETTIMANA */}
      <div className="flex items-center justify-center gap-10 p-4 bg-zinc-900 border-b border-zinc-800">
        <button onClick={() => setWeek(w => Math.max(1, w - 1))} className="text-red-500 text-2xl hover:scale-125 transition-transform">‹</button>
        <div className="text-center">
          <span className="block font-black uppercase tracking-widest text-xs">Settimana</span>
          <span className="text-xl font-black italic text-red-500">{week}</span>
        </div>
        <button onClick={() => setWeek(w => w + 1)} className="text-red-500 text-2xl hover:scale-125 transition-transform">›</button>
      </div>

      {/* SELETTORE GIORNI */}
      <div className="flex gap-2 p-3 bg-zinc-900 overflow-x-auto no-scrollbar">
        {days.map(d => (
          <button key={d.k} onClick={() => setActiveDay(d.k)}
            className={`flex-1 min-w-[45px] py-3 rounded-xl font-black text-[10px] transition-all border
              ${activeDay === d.k 
                ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/20' 
                : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}>
            {d.l}
          </button>
        ))}
      </div>

      {/* CORPO ALLENAMENTO */}
      <div className="max-w-xl mx-auto p-4 space-y-6">
        {!workout ? (
          <div className="text-center py-32">
            <div className="inline-block p-6 rounded-full bg-zinc-900 mb-4 opacity-20">
              <Image src="/logo.png" alt="Logo" width={60} height={60} className="grayscale" />
            </div>
            <p className="font-black uppercase italic text-zinc-700 tracking-widest">Rest Day</p>
          </div>
        ) : (
          ['mobility', 'strength', 'wod'].map(section => (
            <div key={section} className="bg-zinc-900 rounded-3xl border border-zinc-800 p-6 space-y-4 shadow-2xl">
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
                <div className="w-1.5 h-4 bg-red-600 rounded-full"></div>
                <p className="text-[11px] font-black text-red-500 uppercase tracking-[0.2em]">{section}</p>
              </div>
              
              <p className="font-bold text-lg leading-tight whitespace-pre-wrap text-zinc-100 italic">
                {workout[section] || '---'}
              </p>
              
              <div className="space-y-4 pt-4 border-t border-zinc-800/50">
                <textarea
                  className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-sm outline-none focus:border-red-600 transition-all h-24 placeholder:text-zinc-700"
                  placeholder="Inserisci i tuoi risultati (kg, rpe, round...)"
                  defaultValue={logs[section]?.notes || ''}
                  onBlur={e => saveLog(section, e.target.value)}
                />
                
                <div className="flex flex-col gap-3">
                  <input type="file" accept="video/*" className="hidden"
                    ref={el => { fileRef.current[section] = el }}
                    onChange={e => e.target.files?.[0] && uploadVideo(section, e.target.files[0])}
                  />
                  
                  {logs[section]?.video_url ? (
                    <div className="space-y-3">
                      <video src={logs[section].video_url} controls className="w-full rounded-2xl border-2 border-zinc-800" />
                      <button 
                        onClick={() => fileRef.current[section]?.click()}
                        className="w-full bg-zinc-800 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-colors"
                      >
                        {uploading === section ? 'Caricamento...' : 'Sostituisci Video'}
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => fileRef.current[section]?.click()}
                      className="w-full bg-white text-black py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      {uploading === section ? 'Caricamento...' : (
                        <>
                          <span>Carica Video</span>
                          <span className="text-lg">⊕</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* FEEDBACK SALVATAGGIO */}
      {saved && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white text-black px-8 py-3 rounded-full font-black uppercase text-[10px] tracking-widest shadow-2xl z-[100] animate-in fade-in zoom-in slide-in-from-bottom-4 duration-300">
          ✓ Log Aggiornato
        </div>
      )}
    </div>
  )
}