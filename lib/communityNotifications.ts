import type { ScoreType } from '@/lib/community'

export type CommunityScorePayload = {
  kind: 'community_score'
  day: string
  scoreType: ScoreType
  scoreValue: number
  scoreDisplay: string
  note: string | null
}

export type CommunityReactionPayload = {
  kind: 'community_reaction'
  day: string
  scoreId: string
}

export type CommunityCommentPayload = {
  kind: 'community_comment'
  day: string
  scoreId: string
  comment: string
}

export type ClientMaxPayload = {
  kind: 'client_max'
  liftName: string
  value: number
  unit: string
}

export type CommunityPayload =
  | CommunityScorePayload
  | CommunityReactionPayload
  | CommunityCommentPayload
  | ClientMaxPayload

export type NotificationRow = {
  id: string
  client_id: string
  trainer_id: string | null
  week_number: number
  message: string
  created_at: string
  updated_at?: string | null
  read?: boolean
}

export function serializeCommunityPayload(payload: CommunityPayload) {
  return JSON.stringify(payload)
}

export function parseCommunityPayload(message: string): CommunityPayload | null {
  try {
    const parsed = JSON.parse(message) as Partial<CommunityPayload>

    if (!parsed || typeof parsed !== 'object' || typeof parsed.kind !== 'string') {
      return null
    }

    if (
      parsed.kind === 'community_score' &&
      typeof parsed.day === 'string' &&
      typeof parsed.scoreType === 'string' &&
      typeof parsed.scoreValue === 'number' &&
      typeof parsed.scoreDisplay === 'string'
    ) {
      return {
        kind: parsed.kind,
        day: parsed.day,
        scoreType: parsed.scoreType,
        scoreValue: parsed.scoreValue,
        scoreDisplay: parsed.scoreDisplay,
        note: typeof parsed.note === 'string' ? parsed.note : null,
      }
    }

    if (
      parsed.kind === 'community_reaction' &&
      typeof parsed.day === 'string' &&
      typeof parsed.scoreId === 'string'
    ) {
      return {
        kind: parsed.kind,
        day: parsed.day,
        scoreId: parsed.scoreId,
      }
    }

    if (
      parsed.kind === 'community_comment' &&
      typeof parsed.day === 'string' &&
      typeof parsed.scoreId === 'string' &&
      typeof parsed.comment === 'string'
    ) {
      return {
        kind: parsed.kind,
        day: parsed.day,
        scoreId: parsed.scoreId,
        comment: parsed.comment,
      }
    }

    if (
      parsed.kind === 'client_max' &&
      typeof parsed.liftName === 'string' &&
      typeof parsed.value === 'number' &&
      typeof parsed.unit === 'string'
    ) {
      return {
        kind: parsed.kind,
        liftName: parsed.liftName,
        value: parsed.value,
        unit: parsed.unit,
      }
    }
  } catch {}

  return null
}

export function isCommunityNotification(message: string) {
  return parseCommunityPayload(message) !== null
}
