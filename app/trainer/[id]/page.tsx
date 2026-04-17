'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useParams, useRouter } from 'next/navigation'

type WorkoutForm = {
  mobility: string
  strength: string
  wod: string
  coach_notes_mobility: string
  coach_notes_strength: string
  coach_notes_wod: string
}

type ClientLog = {
  section: string
  notes: string | null
  video_url?: string | null
  video_urls?: string[] | null
}

const DAYS = [
  { k: 'monday', l: 'LUN' },
  { k: 'tuesday', l: 'MAR' },
  { k: 'wednesday', l: 'MER' },
  { k: 'thursday', l: 'GIO' },
  { k: 'friday', l: 'VEN' },
  { k: 'saturday', l: 'SAB' },
  { k: 'sunday', l: 'DOM' },
]

const EMPTY_FORM: WorkoutForm = {
  mobility: '',
  strength: '',
  wod: '',
  coach_notes_mobility: '',
  coach_notes_strength: '',
  coach_notes_wod: '',
}

export default function TrainerPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()
  const [week, setWeek] = useState(1)
  const [activeDay, setActiveDay] = useState('monday')
  const [clientName, setClientName] = useState('')
  const [form, setForm] = useState<WorkoutForm>(EMPTY_FORM)
  const [logs, setLogs] = useState<Record<string, ClientLog>>({})
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/')
      }
    }

    checkUser()
  }, [router])

  useEffect(() => {
    async function loadPageData() {
      if (!id) {
        return
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('id', id)
        .maybeSingle()

      const fullName =
        profileData?.first_name && profileData?.last_name
          ? `${profileData.first_name} ${profileData.last_name}`
          : profileData?.email || 'Cliente'

      setClientName(fullName)
      setLogs({})
      setForm(EMPTY_FORM)

      const { data: workoutData } = await supabase
        .from('workouts')
        .select('*')
        .eq('client_id', id)
        .eq('week_number', Number(week))
        .eq('day', activeDay)
        .maybeSingle()

      if (workoutData) {
        const coachNotes =
          typeof workoutData.coach_notes === 'string'
            ? JSON.parse(workoutData.coach_notes || '{}')
            : workoutData.coach_notes || {}

        setForm({
          mobility: workoutData.mobility || '',
          strength: workoutData.strength || '',
          wod: workoutData.wod || '',
          coach_notes_mobility: coachNotes.mobility || '',
          coach_notes_strength: coachNotes.strength || '',
          coach_notes_wod: coachNotes.wod || '',
        })
      }

      const { data: logData } = await supabase
        .from('client_logs')
        .select('*')
        .eq('client_id', id)
        .eq('week_number', Number(week))
        .eq('day', activeDay)

      const map: Record<string, ClientLog> = {}

      ;((logData || []) as ClientLog[]).forEach((log) => {
        map[log.section] = log
      })

      setLogs(map)
    }

    loadPageData()
  }, [id, week, activeDay])

  async function saveWorkout() {
    setLoading(true)

    const payload = {
      client_id: id,
      week_number: Number(week),
      day: activeDay,
      mobility: form.mobility,
      strength: form.strength,
      wod: form.wod,
      coach_notes: JSON.stringify({
        mobility: form.coach_notes_mobility,
        strength: form.coach_notes_strength,
        wod: form.coach_notes_wod,
      }),
    }

    const { error } = await supabase
      .from('workouts')
      .upsert(payload, { onConflict: 'client_id,week_number,day' })

    if (!error) {
      setSaved(true)
      setSaveMessage('Programma salvato')

      setTimeout(() => {
        setSaved(false)
        setSaveMessage('')
      }, 3000)
    }

    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-black text-white pb-32 font-sans">
      <div className="bg-zinc-900 border-b-2 border-red-600 p-4 sticky top-0 z-50 flex items-center justify-between">
        <button
          onClick={() => router.push('/trainer')}
          className="flex items-center gap-1 text-zinc-400 hover:text-white transition-all active:scale-95"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span className="text-[10px] font-black uppercase tracking-widest mt-0.5">
            Atleti
          </span>
        </button>

        <div className="text-center flex-1">
          <div className="font-black italic uppercase text-red-500 text-sm tracking-tighter">
            {clientName}
          </div>
          <div className="text-[9px] text-zinc-500 uppercase tracking-widest font-black">
            Redtail Coach
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="bg-red-600/10 border border-red-600 text-red-500 px-3 py-1 rounded-lg text-[10px] font-black uppercase hover:bg-red-600/20 transition-all active:scale-95"
        >
          Logout
        </button>
      </div>

      <div className="flex justify-center items-center gap-10 p-4 bg-zinc-900 border-b border-zinc-800">
        <button
          onClick={() => setWeek((value) => Math.max(1, value - 1))}
          className="text-red-500 text-2xl font-bold p-2 active:scale-125 transition-transform"
        >
          {'<'}
        </button>
        <div className="text-center">
          <span className="block text-[10px] text-zinc-500 uppercase font-black tracking-widest">
            Settimana
          </span>
          <span className="text-xl font-black text-red-500 italic">{week}</span>
        </div>
        <button
          onClick={() => setWeek((value) => value + 1)}
          className="text-red-500 text-2xl font-bold p-2 active:scale-125 transition-transform"
        >
          {'>'}
        </button>
      </div>

      <div className="flex gap-2 p-3 bg-zinc-900 overflow-x-auto sticky top-[68px] z-40 no-scrollbar border-b border-white/5">
        {DAYS.map((day) => (
          <button
            key={day.k}
            onClick={() => setActiveDay(day.k)}
            className={`flex-1 min-w-[65px] py-3 rounded-xl font-black text-[10px] border transition-all ${
              activeDay === day.k
                ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/20'
                : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-500'
            }`}
          >
            {day.l}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-8 max-w-xl mx-auto mt-4">
        {['mobility', 'strength', 'wod'].map((section) => (
          <div
            key={section}
            className="bg-zinc-900 rounded-3xl border border-zinc-800 p-6 space-y-4 shadow-2xl"
          >
            <label className="text-red-500 font-black uppercase text-[11px] tracking-widest flex items-center gap-2">
              <div className="w-1.5 h-4 bg-red-600 rounded-full" />
              {section}
            </label>

            <textarea
              value={form[section as keyof Pick<WorkoutForm, 'mobility' | 'strength' | 'wod'>]}
              onChange={(event) =>
                setForm((current) => ({ ...current, [section]: event.target.value }))
              }
              placeholder={`Scrivi il programma ${section}...`}
              className="w-full bg-black border border-zinc-800 p-4 rounded-2xl h-40 text-sm outline-none focus:border-red-600 transition-all shadow-inner text-zinc-200 placeholder:text-zinc-700"
            />

            {logs[section] && (
              <div className="bg-zinc-800/60 border-l-4 border-green-500 p-4 mt-2 rounded-r-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <p className="text-[10px] font-black text-green-500 uppercase italic">
                    Feedback atleta
                  </p>
                </div>

                {logs[section].notes && (
                  <p className="text-sm italic text-zinc-200 bg-black/30 p-3 rounded-lg border border-white/5">
                    &quot;{logs[section].notes}&quot;
                  </p>
                )}

                {Array.isArray(logs[section].video_urls) &&
                  logs[section].video_urls.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-green-400 uppercase italic">
                        Video caricati ({logs[section].video_urls.length})
                      </p>

                      {logs[section].video_urls.map((videoUrl, index) => (
                        <div
                          key={index}
                          className="rounded-xl overflow-hidden border border-zinc-700 bg-black shadow-2xl"
                        >
                          <div className="flex items-center justify-between bg-zinc-900 p-3">
                            <span className="text-[10px] font-bold text-zinc-300">
                              Video {index + 1}
                            </span>
                            <a
                              href={videoUrl}
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-blue-600 text-white px-2 py-1 rounded text-[10px] font-bold hover:bg-blue-700 transition-all active:scale-95"
                            >
                              Scarica
                            </a>
                          </div>
                          <video
                            src={videoUrl}
                            controls
                            className="w-full aspect-video object-contain"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                {logs[section].video_url &&
                  (!logs[section].video_urls ||
                    logs[section].video_urls.length === 0) && (
                    <div className="rounded-xl overflow-hidden border border-zinc-700 bg-black shadow-2xl">
                      <div className="flex items-center justify-between bg-zinc-900 p-3">
                        <span className="text-[10px] font-bold text-zinc-300">
                          Video
                        </span>
                        <a
                          href={logs[section].video_url}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-blue-600 text-white px-2 py-1 rounded text-[10px] font-bold hover:bg-blue-700 transition-all active:scale-95"
                        >
                          Scarica
                        </a>
                      </div>
                      <video
                        src={logs[section].video_url}
                        controls
                        className="w-full aspect-video object-contain"
                      />
                    </div>
                  )}
              </div>
            )}

            <div className="bg-yellow-900/20 border border-yellow-700/50 p-4 rounded-xl space-y-2">
              <label className="text-yellow-500 font-black uppercase text-[10px] tracking-widest flex items-center gap-2">
                <div className="w-1.5 h-2 bg-yellow-500 rounded-full" />
                Note coach
              </label>
              <textarea
                value={form[`coach_notes_${section}` as keyof WorkoutForm]}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    [`coach_notes_${section}`]: event.target.value,
                  }))
                }
                placeholder={`Note per l'atleta su ${section}...`}
                className="w-full bg-black border border-yellow-700/30 p-3 rounded-lg h-24 text-xs outline-none focus:border-yellow-500 transition-all shadow-inner text-zinc-200 placeholder:text-zinc-600"
              />
            </div>
          </div>
        ))}

        <div className="space-y-2">
          <button
            onClick={saveWorkout}
            disabled={loading}
            className="w-full max-w-xl mx-auto block bg-red-600 p-4 rounded-2xl font-black uppercase italic tracking-widest shadow-xl shadow-red-600/40 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? 'Salvataggio...' : saved ? 'Programma inviato' : 'Salva programma'}
          </button>

          {saved && saveMessage && (
            <p className="text-center text-xs font-black text-green-400 animate-pulse">
              {saveMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
