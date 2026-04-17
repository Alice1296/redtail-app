'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import {
  DAYS,
  formatAthleteName,
  type DayKey,
  type ScoreType,
} from '@/lib/community'

type ScoreRow = {
  id: string
  client_id: string
  week_number: number
  day: string
  score_type: ScoreType
  score_value: number
  score_display: string
  note: string | null
  created_at: string
}

type ReactionRow = {
  id: string
  score_id: string
  user_id: string
}

type CommentRow = {
  id: string
  score_id: string
  author_id: string
  comment: string
  created_at: string
}

type ProfileRow = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  role?: string | null
}

export default function CommunityPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [week, setWeek] = useState(1)
  const [activeDay, setActiveDay] = useState<DayKey>('monday')
  const [scores, setScores] = useState<ScoreRow[]>([])
  const [reactions, setReactions] = useState<ReactionRow[]>([])
  const [comments, setComments] = useState<CommentRow[]>([])
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({})
  const [workoutScoreLabel, setWorkoutScoreLabel] = useState('')
  const [loading, setLoading] = useState(true)
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})

  const loadCommunity = async () => {
    setLoading(true)

    const { data: scoreData } = await supabase
      .from('workout_scores')
      .select('*')
      .eq('week_number', Number(week))
      .eq('day', activeDay)

    const nextScores = ((scoreData || []) as ScoreRow[]).sort((left, right) => {
      const activeScoreType = left.score_type || right.score_type

      if (activeScoreType === 'time') {
        return Number(left.score_value) - Number(right.score_value)
      }

      return Number(right.score_value) - Number(left.score_value)
    })

    setScores(nextScores)

    const { data: workoutData } = await supabase
      .from('workouts')
      .select('coach_notes')
      .eq('week_number', Number(week))
      .eq('day', activeDay)
      .limit(1)
      .maybeSingle()

    let coachNotes: Record<string, string | null> = {}

    try {
      coachNotes =
        typeof workoutData?.coach_notes === 'string'
          ? JSON.parse(workoutData.coach_notes || '{}')
          : workoutData?.coach_notes || {}
    } catch {}

    setWorkoutScoreLabel(coachNotes.wod_score_label || '')

    const scoreIds = nextScores.map((score) => score.id)
    const athleteIds = nextScores.map((score) => score.client_id)

    if (scoreIds.length === 0) {
      setReactions([])
      setComments([])
      setProfiles({})
      setLoading(false)
      return
    }

    const [{ data: reactionData }, { data: commentData }] = await Promise.all([
      supabase.from('score_reactions').select('*').in('score_id', scoreIds),
      supabase
        .from('score_comments')
        .select('*')
        .in('score_id', scoreIds)
        .order('created_at', { ascending: true }),
    ])

    const typedReactions = (reactionData || []) as ReactionRow[]
    const typedComments = (commentData || []) as CommentRow[]

    setReactions(typedReactions)
    setComments(typedComments)

    const profileIds = Array.from(
      new Set([
        ...athleteIds,
        ...typedReactions.map((reaction) => reaction.user_id),
        ...typedComments.map((comment) => comment.author_id),
      ])
    )

    if (profileIds.length > 0) {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, role')
        .in('id', profileIds)

      const profileMap: Record<string, ProfileRow> = {}

      ;((profileRows || []) as ProfileRow[]).forEach((profile) => {
        profileMap[profile.id] = profile
      })

      setProfiles(profileMap)
    }

    setLoading(false)
  }

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/')
        return
      }

      setUserId(user.id)

      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      setRole(profileData?.role || null)
      await loadCommunity()
    }

    init()
  }, [router, week, activeDay])

  useEffect(() => {
    const interval = window.setInterval(() => {
      loadCommunity()
    }, 15000)

    return () => window.clearInterval(interval)
  }, [week, activeDay])

  async function toggleReaction(scoreId: string) {
    if (!userId) return

    const existingReaction = reactions.find(
      (reaction) => reaction.score_id === scoreId && reaction.user_id === userId
    )

    if (existingReaction) {
      await supabase.from('score_reactions').delete().eq('id', existingReaction.id)
    } else {
      await supabase.from('score_reactions').insert({
        score_id: scoreId,
        user_id: userId,
      })
    }

    await loadCommunity()
  }

  async function addComment(scoreId: string) {
    if (!userId || !commentDrafts[scoreId]?.trim()) return

    await supabase.from('score_comments').insert({
      score_id: scoreId,
      author_id: userId,
      comment: commentDrafts[scoreId].trim(),
    })

    setCommentDrafts((current) => ({
      ...current,
      [scoreId]: '',
    }))

    await loadCommunity()
  }

  const reactionCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    reactions.forEach((reaction) => {
      counts[reaction.score_id] = (counts[reaction.score_id] || 0) + 1
    })
    return counts
  }, [reactions])

  const commentsByScore = useMemo(() => {
    const grouped: Record<string, CommentRow[]> = {}
    comments.forEach((comment) => {
      if (!grouped[comment.score_id]) {
        grouped[comment.score_id] = []
      }
      grouped[comment.score_id].push(comment)
    })
    return grouped
  }, [comments])

  return (
    <div className="min-h-screen bg-black text-white p-6 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b-2 border-red-600 pb-4 gap-4">
          <button
            onClick={() => router.push(role === 'trainer' ? '/trainer' : '/client')}
            className="text-zinc-400 hover:text-white text-sm font-black uppercase"
          >
            {'<'} Indietro
          </button>
          <div className="text-center">
            <h1 className="text-3xl font-black text-red-600 uppercase italic tracking-tighter">
              Community
            </h1>
            <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">
              leaderboard, fist bump e commenti
            </p>
          </div>
          {role === 'trainer' ? (
            <div className="w-[72px]" />
          ) : (
            <button
              onClick={() => router.push('/client/maxes')}
              className="text-zinc-400 hover:text-white text-sm font-black uppercase"
            >
              Massimali
            </button>
          )}
        </div>

        <div className="flex justify-center gap-10 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
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

        <div className="flex gap-2 overflow-x-auto">
          {DAYS.map((day) => (
            <button
              key={day.key}
              onClick={() => setActiveDay(day.key)}
              className={`flex-1 min-w-[65px] py-3 rounded-xl font-black text-[10px] border ${
                activeDay === day.key
                  ? 'bg-red-600 border-red-500 text-white'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-500'
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>

        {workoutScoreLabel && (
          <div className="rounded-2xl border border-red-600/40 bg-red-600/5 p-4 text-sm text-zinc-100">
            Score del giorno: {workoutScoreLabel}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-zinc-500 font-black uppercase italic">
            Caricamento classifica...
          </div>
        ) : scores.length > 0 ? (
          <div className="space-y-4">
            {scores.map((score, index) => {
              const userReacted = reactions.some(
                (reaction) =>
                  reaction.score_id === score.id && reaction.user_id === userId
              )

              return (
                <div
                  key={score.id}
                  className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 space-y-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        #{index + 1}
                      </p>
                      <h2 className="text-xl font-black uppercase italic text-red-500">
                        {formatAthleteName(profiles[score.client_id])}
                      </h2>
                      <p className="text-sm text-zinc-300 mt-1">
                        {score.score_display}
                      </p>
                      {score.note && (
                        <p className="text-xs text-zinc-400 mt-2 italic">
                          {score.note}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => toggleReaction(score.id)}
                      className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase border transition-all ${
                        userReacted
                          ? 'bg-red-600 border-red-500 text-white'
                          : 'bg-black border-zinc-700 text-zinc-400 hover:border-red-600 hover:text-red-400'
                      }`}
                    >
                      Fist bump {reactionCounts[score.id] || 0}
                    </button>
                  </div>

                  <div className="space-y-2">
                    {(commentsByScore[score.id] || []).map((comment) => (
                      <div
                        key={comment.id}
                        className="rounded-xl border border-zinc-800 bg-black/40 p-3"
                      >
                        <p className="text-[10px] font-black uppercase text-zinc-500 mb-1">
                          {formatAthleteName(profiles[comment.author_id])}
                        </p>
                        <p className="text-sm text-zinc-200">{comment.comment}</p>
                      </div>
                    ))}

                    <div className="flex gap-2">
                      <input
                        value={commentDrafts[score.id] || ''}
                        onChange={(event) =>
                          setCommentDrafts((current) => ({
                            ...current,
                            [score.id]: event.target.value,
                          }))
                        }
                        placeholder="Lascia un fist bump scritto..."
                        className="flex-1 bg-black border border-zinc-800 p-3 rounded-xl text-sm outline-none focus:border-red-600"
                      />
                      <button
                        onClick={() => addComment(score.id)}
                        className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 text-[10px] font-black uppercase hover:border-red-600 hover:text-red-400 transition-all"
                      >
                        Invia
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-zinc-800 p-12 text-center text-zinc-500 font-black uppercase italic">
            Nessuno score inserito per questo giorno
          </div>
        )}
      </div>
    </div>
  )
}
