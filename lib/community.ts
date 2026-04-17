export const DAYS = [
  { key: 'monday', label: 'LUN' },
  { key: 'tuesday', label: 'MAR' },
  { key: 'wednesday', label: 'MER' },
  { key: 'thursday', label: 'GIO' },
  { key: 'friday', label: 'VEN' },
  { key: 'saturday', label: 'SAB' },
  { key: 'sunday', label: 'DOM' },
] as const

export type DayKey = (typeof DAYS)[number]['key']

export const SCORE_TYPE_OPTIONS = [
  { value: 'time', label: 'Time' },
  { value: 'reps', label: 'Reps' },
  { value: 'load', label: 'Load' },
] as const

export type ScoreType = (typeof SCORE_TYPE_OPTIONS)[number]['value']

export const DEFAULT_MAX_LIFTS = [
  'Deadlift',
  'Bench Press',
  'Back Squat',
  'Front Squat',
  'Power Snatch',
  'Squat Snatch',
  'Clean and Jerk',
  'Strict Press',
  'Jerk',
  'Power Clean',
  'Hang Clean',
  'Hang Snatch',
  'Push Press',
  'Thruster',
]

export function getScorePlaceholder(scoreType: ScoreType) {
  if (scoreType === 'time') {
    return 'Es. 12:34'
  }

  if (scoreType === 'load') {
    return 'Es. 85'
  }

  return 'Es. 210'
}

export function parseScoreValue(
  scoreType: ScoreType,
  rawValue: string
): number | null {
  const value = rawValue.trim()

  if (!value) {
    return null
  }

  if (scoreType === 'time') {
    const parts = value.split(':').map((part) => Number(part))

    if (
      parts.length < 2 ||
      parts.length > 3 ||
      parts.some((part) => Number.isNaN(part) || part < 0)
    ) {
      return null
    }

    if (parts.length === 2) {
      return parts[0] * 60 + parts[1]
    }

    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }

  const parsed = Number(value.replace(',', '.'))

  if (Number.isNaN(parsed)) {
    return null
  }

  return parsed
}

export function formatAthleteName(profile?: {
  first_name?: string | null
  last_name?: string | null
  email?: string | null
}) {
  if (profile?.first_name && profile?.last_name) {
    return `${profile.first_name} ${profile.last_name}`
  }

  return profile?.email?.split('@')[0] || 'Atleta anonimo'
}
