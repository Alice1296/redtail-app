'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import {
  DAYS,
  getScorePlaceholder,
  parseScoreValue,
  type DayKey,
  type ScoreType,
} from '@/lib/community'

type WorkoutRow = {
  wod?: string | null
  wod_score_type?: ScoreType | null
  wod_score_label?: string | null
  coach_notes?: string | null
  [key: string]: unknown
}

type ScoreEntry = {
  score_type: ScoreType
  score_display: string
  note: string | null
}

type SessionUser = {
  id: string
}

type ClientLog = {
  notes: string | null
  video_urls?: string[] | null
}

export default function ClientPage() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [week, setWeek] = useState(1)
  const [activeDay, setActiveDay] = useState<DayKey>('monday')
  const [workout, setWorkout] = useState<WorkoutRow | null>(null)
  const [logs, setLogs] = useState<Record<string, ClientLog>>({})
  const [scoreDisplay, setScoreDisplay] = useState('')
  const [scoreNote, setScoreNote] = useState('')
  const [scoreSavedMessage, setScoreSavedMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [scoreLoading, setScoreLoading] = useState(false)
  const [uploadingSection, setUploadingSection] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        setUser(user)
        loadData(user.id)
        loadUnreadNotifications(user.id)
      } else {
        router.push('/')
      }
    }

    init()
  }, [week, activeDay])

  async function loadUnreadNotifications(userId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('client_id', userId)
      .eq('read', false)

    if (!error && data) {
      setUnreadCount(data.length)
    }
  }

  async function loadData(userId: string) {
    setLoading(true)
    setLogs({})
    setScoreSavedMessage('')

    const { data: workoutData } = await supabase
      .from('workouts')
      .select('*')
      .eq('client_id', userId)
      .eq('week_number', Number(week))
      .eq('day', activeDay)
      .maybeSingle()

    if (workoutData) {
      let coachNotes: Record<string, string | null> = {}

      try {
        coachNotes =
          typeof workoutData.coach_notes === 'string'
            ? JSON.parse(workoutData.coach_notes || '{}')
            : workoutData.coach_notes || {}
      } catch {}

      setWorkout({
        ...workoutData,
        wod_score_type: coachNotes.wod_score_type || null,
        wod_score_label: coachNotes.wod_score_label || null,
      })
    } else {
      setWorkout(null)
    }

    const { data: logData } = await supabase
      .from('client_logs')
      .select('*')
      .eq('client_id', userId)
      .eq('week_number', Number(week))
      .eq('day', activeDay)

    const logMap: Record<string, ClientLog> = {}
    logData?.forEach((log) => {
      logMap[log.section] = log
    })
    setLogs(logMap)

    const { data: scoreData } = await supabase
      .from('workout_scores')
      .select('score_type, score_display, note')
      .eq('client_id', userId)
      .eq('week_number', Number(week))
      .eq('day', activeDay)
      .maybeSingle()

    const typedScore = scoreData as ScoreEntry | null
    setScoreDisplay(typedScore?.score_display || '')
    setScoreNote(typedScore?.note || '')
    setLoading(false)
  }

  async function saveFeedback(section: string, notes: string, videoUrls?: string[]) {
    if (!user) return

    const currentVideos = logs[section]?.video_urls || []
    const finalVideos = videoUrls !== undefined ? videoUrls : currentVideos

    await supabase.from('client_logs').upsert(
      {
        client_id: user.id,
        week_number: Number(week),
        day: activeDay,
        section,
        notes: notes || '',
        video_urls: finalVideos.length > 0 ? finalVideos : null,
      },
      { onConflict: 'client_id,week_number,day,section' }
    )

    loadData(user.id)
  }

  async function saveScore() {
    if (!user || !workout?.wod_score_type) {
      return
    }

    const parsedValue = parseScoreValue(workout.wod_score_type, scoreDisplay)

    if (parsedValue === null) {
      alert('Inserisci un punteggio valido per questo formato')
      return
    }

    try {
      setScoreLoading(true)

      const { error } = await supabase.from('workout_scores').upsert(
        {
          client_id: user.id,
          week_number: Number(week),
          day: activeDay,
          score_type: workout.wod_score_type,
          score_value: parsedValue,
          score_display: scoreDisplay.trim(),
          note: scoreNote.trim() || null,
        },
        { onConflict: 'client_id,week_number,day' }
      )

      if (error) {
        throw error
      }

      setScoreSavedMessage('Score aggiornato sulla leaderboard')
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Errore salvataggio score')
    } finally {
      setScoreLoading(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  async function handleVideoUpload(section: string, file: File) {
    if (!user) {
      return
    }

    try {
      setUploadingSection(section)
      const fileName = `${user.id}/${Date.now()}-${section}.${file.name.split('.').pop()}`
      const { error: upErr } = await supabase.storage.from('videos').upload(fileName, file)
      if (upErr) throw upErr
      const {
        data: { publicUrl },
      } = supabase.storage.from('videos').getPublicUrl(fileName)
      const currentVideos = logs[section]?.video_urls || []
      await saveFeedback(section, logs[section]?.notes || '', [
        ...currentVideos,
        publicUrl,
      ])
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Errore upload video')
    } finally {
      setUploadingSection(null)
    }
  }

  async function deleteVideo(section: string, videoUrl: string) {
    if (!user || !confirm('Eliminare il video?')) return

    try {
      setUploadingSection(section)
      const storagePath = videoUrl.split('/storage/v1/object/public/videos/')[1]

      if (storagePath) {
        const apiRes = await fetch('/api/delete-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: storagePath }),
        })

        const apiData = await apiRes.json()

        if (!apiRes.ok) {
          alert(`Errore: ${apiData.error}`)
        }
      }

      const currentVideos = logs[section]?.video_urls || []
      const updatedVideos = currentVideos.filter((value: string) => value !== videoUrl)
      await saveFeedback(section, logs[section]?.notes || '', updatedVideos)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Errore eliminazione video')
    } finally {
      setUploadingSection(null)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white pb-32 font-sans">
      <div className="bg-zinc-900 border-b-2 border-red-600 p-4 sticky top-0 z-50 flex items-center justify-between">
        <button
          onClick={() => router.push('/client/notifications')}
          className="relative flex items-center gap-1 text-zinc-400 hover:text-red-500 transition-all"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>

        <div className="text-center flex-1 font-black italic uppercase text-lg">
          Redtail Client
        </div>
        <button
          onClick={handleLogout}
          className="ml-4 bg-red-600/10 border border-red-600 text-red-500 px-3 py-1 rounded-lg text-[10px] font-black uppercase hover:bg-red-600/20 transition-all active:scale-95"
        >
          Logout
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 p-4 bg-zinc-900 border-b border-zinc-800">
        <button
          onClick={() => router.push('/community')}
          className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest hover:border-red-600 hover:text-red-400 transition-all"
        >
          Community
        </button>
        <button
          onClick={() => router.push('/client/maxes')}
          className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest hover:border-red-600 hover:text-red-400 transition-all"
        >
          Massimali
        </button>
      </div>

      <div className="flex justify-center gap-10 p-4 bg-zinc-900 border-b border-zinc-800">
        <button
          onClick={() => setWeek((value) => Math.max(1, value - 1))}
          className="text-red-500 text-2xl font-bold"
        >
          {'<'}
        </button>
        <div className="text-center">
          <span className="block text-[10px] text-zinc-500 uppercase font-black">
            Week
          </span>
          <span className="text-xl font-black text-red-500 italic">{week}</span>
        </div>
        <button
          onClick={() => setWeek((value) => value + 1)}
          className="text-red-500 text-2xl font-bold"
        >
          {'>'}
        </button>
      </div>

      <div className="flex gap-1 p-2 bg-zinc-900 overflow-x-auto no-scrollbar border-b border-white/5">
        {DAYS.map((day) => (
          <button
            key={day.key}
            onClick={() => setActiveDay(day.key)}
            className={`flex-1 min-w-[55px] py-3 rounded-xl font-black text-[10px] border ${
              activeDay === day.key
                ? 'bg-red-600 border-red-500 text-white'
                : 'bg-zinc-800 border-zinc-700 text-zinc-500'
            }`}
          >
            {day.label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-8 max-w-xl mx-auto">
        {loading ? (
          <p className="text-center text-zinc-500 font-black italic animate-pulse py-10 uppercase">
            Syncing...
          </p>
        ) : workout ? (
          <>
            {['mobility', 'strength', 'wod'].map(
              (section) =>
                workout[section] && (
                  <div
                    key={section}
                    className="bg-zinc-900 rounded-3xl border border-zinc-800 p-6 space-y-4"
                  >
                    <label className="text-red-500 font-black uppercase text-[11px] flex items-center gap-2">
                      <div className="w-1.5 h-4 bg-red-600 rounded-full" />
                      {section}
                    </label>
                    <div className="bg-black/50 border border-zinc-800 p-4 rounded-2xl whitespace-pre-wrap text-sm leading-relaxed">
                      {String(workout[section] ?? '')}
                    </div>

                    {section === 'wod' && workout.wod_score_type && (
                      <div className="bg-red-600/5 border border-red-600/30 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-red-400">
                              Score del giorno
                            </p>
                            <p className="text-xs text-zinc-400">
                              {workout.wod_score_label || `Formato score: ${workout.wod_score_type}`}
                            </p>
                          </div>
                          <button
                            onClick={() => router.push('/community')}
                            className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-[10px] font-black uppercase hover:border-red-600 hover:text-red-400 transition-all"
                          >
                            Leaderboard
                          </button>
                        </div>

                        <input
                          value={scoreDisplay}
                          onChange={(event) => setScoreDisplay(event.target.value)}
                          placeholder={getScorePlaceholder(workout.wod_score_type)}
                          className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-sm outline-none focus:border-red-600 text-zinc-100 placeholder:text-zinc-600"
                        />

                        <textarea
                          value={scoreNote}
                          onChange={(event) => setScoreNote(event.target.value)}
                          placeholder="Note sul tuo score, sensazioni o strategia..."
                          className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-xs outline-none focus:border-red-600 min-h-[80px]"
                        />

                        <button
                          onClick={saveScore}
                          disabled={scoreLoading}
                          className="w-full bg-red-600 p-4 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-red-700 transition-all disabled:opacity-50"
                        >
                          {scoreLoading ? 'Salvataggio...' : 'Submit score'}
                        </button>

                        {scoreSavedMessage && (
                          <p className="text-center text-[11px] font-black uppercase text-green-400">
                            {scoreSavedMessage}
                          </p>
                        )}
                      </div>
                    )}

                    {workout.coach_notes &&
                      (() => {
                        try {
                          const coachNotes =
                            typeof workout.coach_notes === 'string'
                              ? JSON.parse(workout.coach_notes)
                              : workout.coach_notes
                          const sectionNote = coachNotes?.[section]

                          if (sectionNote) {
                            return (
                              <div className="bg-yellow-900/20 border border-yellow-700/50 p-3 rounded-lg">
                                <p className="text-[10px] font-black text-yellow-500 uppercase mb-2">
                                  Nota del coach
                                </p>
                                <p className="text-sm text-yellow-100/80 italic">
                                  {sectionNote}
                                </p>
                              </div>
                            )
                          }
                        } catch {}

                        return null
                      })()}

                    <textarea
                      value={logs[section]?.notes || ''}
                      onChange={(event) =>
                        setLogs({
                          ...logs,
                          [section]: {
                            ...logs[section],
                            notes: event.target.value,
                          },
                        })
                      }
                      onBlur={(event) => saveFeedback(section, event.target.value)}
                      placeholder="Feedback..."
                      className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-xs outline-none focus:border-green-600 min-h-[80px]"
                    />

                    <div className="flex gap-2">
                      <input
                        type="file"
                        accept="video/*"
                        id={`v-${section}`}
                        className="hidden"
                        onChange={(event) =>
                          event.target.files?.[0] &&
                          handleVideoUpload(section, event.target.files[0])
                        }
                      />
                      <label
                        htmlFor={`v-${section}`}
                        className={`flex-1 flex items-center justify-center p-3 rounded-xl border border-zinc-800 text-[10px] font-black uppercase cursor-pointer ${
                          (logs[section]?.video_urls?.length || 0) > 0
                            ? 'bg-green-600/10 border-green-600 text-green-500'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {uploadingSection === section
                          ? 'Wait...'
                          : (logs[section]?.video_urls?.length || 0) > 0
                            ? `${logs[section]?.video_urls?.length || 0} video`
                            : 'Upload'}
                      </label>
                    </div>

                    {(logs[section]?.video_urls?.length || 0) > 0 && (
                      <div className="space-y-2 bg-black/30 p-4 rounded-xl border border-zinc-800">
                        <p className="text-[10px] font-black uppercase text-zinc-400">
                          Video caricati:
                        </p>
                        {logs[section]?.video_urls?.map((videoUrl: string, index: number) => (
                          <div
                            key={index}
                            className="flex items-center justify-between bg-zinc-900 p-3 rounded-lg border border-zinc-800"
                          >
                            <a
                              href={videoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-blue-400 underline truncate flex-1"
                            >
                              Video {index + 1}
                            </a>
                            <button
                              onClick={() => deleteVideo(section, videoUrl)}
                              className="ml-2 bg-red-600/10 border border-red-600 text-red-500 px-2 py-1 rounded text-[10px] font-bold hover:bg-red-600/20"
                            >
                              Elimina
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
            )}
          </>
        ) : (
          <div className="text-center py-20 text-zinc-600 font-black uppercase italic border border-dashed border-zinc-800 rounded-3xl">
            Rest day
          </div>
        )}
      </div>
    </div>
  )
}
