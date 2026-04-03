'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function ClientPage() {
  const [user, setUser] = useState<any>(null)
  
  // Navigazione
  const [week, setWeek] = useState(1)
  const [activeDay, setActiveDay] = useState('monday')

  // Dati
  const [workout, setWorkout] = useState<any>(null)
  const [logs, setLogs] = useState<any>({}) // Feedback già inviati
  
  // UI
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  const days = [
    { k: 'monday', l: 'LUN' }, { k: 'tuesday', l: 'MAR' },
    { k: 'wednesday', l: 'MER' }, { k: 'thursday', l: 'GIO' },
    { k: 'friday', l: 'VEN' }, { k: 'saturday', l: 'SAB' },
    { k: 'sunday', l: 'DOM' }
  ]

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser(user)
        loadData(user.id)
      }
    }
    init()
  }, [week, activeDay])

  async function loadData(userId: string) {
    setLoading(true)
    
    // 1. Carica l'allenamento assegnato dal coach
    const { data: wData } = await supabase
      .from('workouts')
      .select('*')
      .eq('client_id', userId)
      .eq('week_number', week)
      .eq('day', activeDay)
      .maybeSingle()
    
    setWorkout(wData)

    // 2. Carica i feedback (logs) già salvati per questo giorno
    const { data: lData } = await supabase
      .from('client_logs')
      .select('*')
      .eq('client_id', userId)
      .eq('week_number', week)
      .eq('day', activeDay)

    const map: any = {}
    lData?.forEach(l => { map[l.section] = l })
    setLogs(map)
    
    setLoading(false)
  }

  // Funzione per salvare note o video
  async function saveFeedback(section: string, notes: string, videoUrl?: string) {
    if (!user) return

    const { error } = await supabase
      .from('client_logs')
      .upsert({
        client_id: user.id,
        week_number: week,
        day: activeDay,
        section: section,
        notes: notes,
        video_url: videoUrl || logs[section]?.video_url || null
      }, { onConflict: 'client_id,week_number,day,section' })

    if (!error) {
      loadData(user.id) // Ricarica per aggiornare la UI
    }
  }

  // Funzione per caricare il video su Storage
  async function handleVideoUpload(section: string, file: File) {
    try {
      setUploading(true)
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${fileExt}`
      const filePath = fileName // Salviamo direttamente nel bucket

      // CORREZIONE: Uso del bucket "videos"
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(filePath)

      await saveFeedback(section, logs[section]?.notes || '', publicUrl)
    } catch (err: any) {
      alert("Errore caricamento: " + err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-32">
      {/* HEADER */}
      <div className="bg-zinc-900 border-b-2 border-red-600 p-4 sticky top-0 z-50">
        <h1 className="font-black italic text-xl text-white uppercase tracking-tighter text-center">
          My Training
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
      <div className="flex gap-2 p-3 bg-zinc-900 overflow-x-auto no-scrollbar sticky top-[68px] z-40">
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

      <div className="p-4 space-y-8 max-w-xl mx-auto">
        {loading ? (
          <p className="text-center text-zinc-500 animate-pulse mt-10 font-black uppercase italic">Caricamento...</p>
        ) : workout ? (
          ['mobility', 'strength', 'wod'].map((section) => (
            workout[section] && (
              <div key={section} className="bg-zinc-900 rounded-3xl border border-zinc-800 p-6 space-y-4 shadow-2xl">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-red-600 rounded-full"></div>
                  <label className="text-red-500 font-black uppercase text-[11px] tracking-widest">{section}</label>
                </div>
                
                {/* PROGRAMMA DEL COACH */}
                <div className="bg-black/50 border border-zinc-800 p-4 rounded-2xl text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap font-medium">
                  {workout[section]}
                </div>

                {/* AREA FEEDBACK ATLETA */}
                <div className="pt-4 border-t border-zinc-800/50 space-y-4">
                   <p className="text-[10px] font-black text-green-500 uppercase tracking-widest">Il tuo feedback</p>
                   
                   <textarea
                    value={logs[section]?.notes || ''}
                    onChange={(e) => setLogs({...logs, [section]: {...logs[section], notes: e.target.value}})}
                    onBlur={(e) => saveFeedback(section, e.target.value)}
                    placeholder="Com'è andata? Note, chili, sensazioni..."
                    className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-xs outline-none focus:border-green-600 transition-all min-h-[80px]"
                   />

                   <div className="flex gap-2">
                      <input 
                        type="file" 
                        accept="video/*" 
                        id={`video-${section}`} 
                        className="hidden" 
                        onChange={(e) => e.target.files?.[0] && handleVideoUpload(section, e.target.files[0])}
                      />
                      <label 
                        htmlFor={`video-${section}`}
                        className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border border-zinc-800 text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all ${
                          logs[section]?.video_url ? 'bg-green-600/10 border-green-600 text-green-500' : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {uploading ? 'Caricamento...' : logs[section]?.video_url ? '✅ Video Caricato' : '📤 Carica Video'}
                      </label>
                   </div>
                </div>
              </div>
            )
          ))
        ) : (
          <div className="text-center py-20 bg-zinc-900/50 rounded-3xl border border-dashed border-zinc-800">
            <p className="text-zinc-600 font-black uppercase italic tracking-widest text-sm">Rest Day</p>
            <p className="text-zinc-800 text-[10px] mt-2 uppercase tracking-tighter">Nessun allenamento assegnato dal coach</p>
          </div>
        )}
      </div>
    </div>
  )
}