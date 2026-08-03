import { jsPDF } from 'jspdf'
import {
  findExerciseNameInText,
  normalizeExerciseName,
  type DayKey,
  type ScoreType,
} from './community'

export type PdfPrValue = {
  value: number
  unit: string
  updatedAt?: string | null
}

export type ExportSectionKey = 'mobility' | 'strength' | 'wod'

export type WorkoutExportDay = {
  week: number
  day: DayKey
  hasWorkout: boolean
  sections: Partial<Record<ExportSectionKey, string>>
  coachNotes: Partial<Record<ExportSectionKey, string>>
  feedback: Partial<Record<ExportSectionKey, string>>
  scoreType: ScoreType | null
  scoreLabel: string | null
  scoreDisplay: string | null
  scoreNote: string | null
}

const SECTION_ORDER: ExportSectionKey[] = ['mobility', 'strength', 'wod']

const SECTION_LABELS: Record<ExportSectionKey, string> = {
  mobility: 'Mobility',
  strength: 'Strength',
  wod: 'WOD',
}

export const DAY_LABELS_IT: Record<DayKey, string> = {
  monday: 'Lunedi',
  tuesday: 'Martedi',
  wednesday: 'Mercoledi',
  thursday: 'Giovedi',
  friday: 'Venerdi',
  saturday: 'Sabato',
  sunday: 'Domenica',
}

/**
 * Estrae sezioni/coach-notes/score da una riga grezza `workouts` (usata quando
 * si esportano piu' giorni e i dati non sono gia' stati normalizzati dallo state della pagina).
 */
export function parseWorkoutRowForExport(
  workoutRow: Record<string, unknown> | null | undefined
): {
  sections: Partial<Record<ExportSectionKey, string>>
  coachNotes: Partial<Record<ExportSectionKey, string>>
  scoreType: ScoreType | null
  scoreLabel: string | null
} {
  const sections: Partial<Record<ExportSectionKey, string>> = {}
  const coachNotes: Partial<Record<ExportSectionKey, string>> = {}

  if (!workoutRow) {
    return { sections, coachNotes, scoreType: null, scoreLabel: null }
  }

  let parsedCoachNotes: Record<string, unknown> = {}
  try {
    const raw = workoutRow.coach_notes
    parsedCoachNotes =
      typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw as Record<string, unknown>) || {}
  } catch {
    parsedCoachNotes = {}
  }

  const scoreType = (parsedCoachNotes.wod_score_type as ScoreType) || null
  const scoreLabel = (parsedCoachNotes.wod_score_label as string) || null

  let legacyWodText: string | null = null
  const rawWod = workoutRow.wod
  if (typeof rawWod === 'string' && rawWod.trim().startsWith('{')) {
    try {
      const legacyConfig = JSON.parse(rawWod) as { description?: string }
      legacyWodText = legacyConfig.description || null
    } catch {
      legacyWodText = null
    }
  }

  for (const key of SECTION_ORDER) {
    if (key === 'wod') {
      const value =
        legacyWodText ||
        (typeof rawWod === 'string' && !rawWod.trim().startsWith('{') ? rawWod : '')
      if (value) sections.wod = value
    } else {
      const value = workoutRow[key]
      if (value) sections[key] = String(value)
    }

    const note = parsedCoachNotes?.[key]
    if (note) coachNotes[key] = String(note)
  }

  return { sections, coachNotes, scoreType, scoreLabel }
}

function calcLoad(
  exerciseName: string,
  percentage: number,
  prValues: Record<string, PdfPrValue>
): { weight: number; unit: string } | null {
  const pr = prValues[normalizeExerciseName(exerciseName)]

  if (!pr) {
    return null
  }

  return {
    weight: Math.round(pr.value * (percentage / 100) * 10) / 10,
    unit: pr.unit || 'kg',
  }
}

/**
 * Riproduce, in testo semplice, il calcolo dei carichi che la pagina client
 * mostra accanto alle percentuali (es. "80%" -> "80% (100kg)"), basandosi sui
 * massimali dell'atleta. Mantiene invariato il resto del testo.
 */
function annotateLoads(
  text: string,
  prValues: Record<string, PdfPrValue>
): string {
  if (!text) {
    return text
  }

  const percentagePattern =
    /((?:\d+\s*(?:r|x)?\s*@\s*)?(\d{1,3}(?:[.,]\d+)?(?:\s*[-–]\s*\d{1,3}(?:[.,]\d+)?)*?)\s*%)/gi
  const hasSectionBreak = (segment: string) =>
    /^[ \t]*-(?:[ \t]*-)+[ \t]*$/m.test(segment)
  const parsePercentageSequence = (rawValue: string) =>
    rawValue
      .split(/[-–]/g)
      .map((part) => Number(part.replace(',', '.').trim()))
      .filter((value) => !Number.isNaN(value))

  let result = ''
  let lastIndex = 0
  let currentExercise: string | null = null
  let currentExerciseEnd = 0
  let match: RegExpExecArray | null

  percentagePattern.lastIndex = 0

  while ((match = percentagePattern.exec(text)) !== null) {
    const [rawMatch, , rawPercentageSequence] = match
    const start = match.index
    const end = start + rawMatch.length
    const percentages = parsePercentageSequence(rawPercentageSequence)

    result += text.slice(lastIndex, start)

    const surroundingText = text.slice(Math.max(0, start - 50), start)
    const freshExerciseName =
      findExerciseNameInText(surroundingText) || findExerciseNameInText(rawMatch)
    const canReuseCurrentExercise =
      currentExercise && !hasSectionBreak(text.slice(currentExerciseEnd, start))
    const exerciseName: string | null =
      freshExerciseName || (canReuseCurrentExercise ? currentExercise : null)

    if (freshExerciseName) {
      currentExercise = freshExerciseName
    }

    if (exerciseName) {
      currentExerciseEnd = end
    }

    const loads = exerciseName
      ? percentages
          .map((percentage) => calcLoad(exerciseName, percentage, prValues))
          .filter((load): load is { weight: number; unit: string } => Boolean(load))
      : []

    const loadDisplay = loads.length
      ? loads.map((load) => `${load.weight}${load.unit}`).join(', ')
      : null

    result += loadDisplay ? `${rawMatch} (${loadDisplay})` : rawMatch
    lastIndex = end
  }

  result += text.slice(lastIndex)

  return result
}

function addWrappedText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  pageHeight: number,
  bottomMargin: number
): number {
  const lines = doc.splitTextToSize(text, maxWidth) as string[]
  let cursorY = y

  for (const line of lines) {
    if (cursorY > pageHeight - bottomMargin) {
      doc.addPage()
      cursorY = 20
    }
    doc.text(line, x, cursorY)
    cursorY += lineHeight
  }

  return cursorY
}

type FontStyle = 'normal' | 'bold' | 'italic'

type TextPiece = {
  text: string
  fontSize: number
  style: FontStyle
  lineHeight: number
  color: [number, number, number]
  gapAfter: number
}

const TOP_MARGIN = 20

export function generateWorkoutPdf(
  days: WorkoutExportDay[],
  fileName: string,
  prValues: Record<string, PdfPrValue> = {}
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageHeight = doc.internal.pageSize.getHeight()
  const pageWidth = doc.internal.pageSize.getWidth()
  const marginX = 15
  const maxWidth = pageWidth - marginX * 2
  const bottomMargin = 20
  const usableHeight = pageHeight - TOP_MARGIN - bottomMargin

  const countLines = (piece: TextPiece): number => {
    doc.setFont('helvetica', piece.style)
    doc.setFontSize(piece.fontSize)
    return (doc.splitTextToSize(piece.text, maxWidth) as string[]).length
  }

  const measureBlock = (pieces: TextPiece[]): number =>
    pieces.reduce(
      (total, piece) => total + countLines(piece) * piece.lineHeight + piece.gapAfter,
      0
    )

  days.forEach((dayData, index) => {
    if (index > 0) {
      doc.addPage()
    }

    let y = TOP_MARGIN

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.setTextColor(220, 38, 38)
    doc.text('REDTAIL', marginX, y)
    y += 10

    doc.setFontSize(16)
    doc.setTextColor(20, 20, 20)
    doc.text(`Settimana ${dayData.week} - ${DAY_LABELS_IT[dayData.day]}`, marginX, y)
    y += 7

    doc.setDrawColor(220, 38, 38)
    doc.setLineWidth(0.5)
    doc.line(marginX, y, pageWidth - marginX, y)
    y += 9

    if (!dayData.hasWorkout) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(14)
      doc.setTextColor(120, 120, 120)
      doc.text('Rest day', marginX, y)
      return
    }

    for (const key of SECTION_ORDER) {
      const content = dayData.sections[key]
      const hasContent = !!content

      if (!hasContent && key !== 'wod') {
        continue
      }

      const pieces: TextPiece[] = [
        {
          text: SECTION_LABELS[key].toUpperCase(),
          fontSize: 15,
          style: 'bold',
          lineHeight: 8,
          color: [220, 38, 38],
          gapAfter: 0,
        },
      ]

      if (content) {
        pieces.push({
          text: annotateLoads(content, prValues),
          fontSize: 13,
          style: 'normal',
          lineHeight: 6,
          color: [20, 20, 20],
          gapAfter: 3,
        })
      }

      const coachNote = dayData.coachNotes[key]
      if (coachNote) {
        pieces.push({
          text: `Nota del coach: ${annotateLoads(coachNote, prValues)}`,
          fontSize: 12,
          style: 'italic',
          lineHeight: 5.5,
          color: [150, 110, 0],
          gapAfter: 3,
        })
      }

      if (key === 'wod' && dayData.scoreType) {
        pieces.push({
          text: `Score (${dayData.scoreLabel || dayData.scoreType}): ${
            dayData.scoreDisplay || '-'
          }`,
          fontSize: 12,
          style: 'bold',
          lineHeight: 5.5,
          color: [20, 20, 20],
          gapAfter: dayData.scoreNote ? 0 : 3,
        })

        if (dayData.scoreNote) {
          pieces.push({
            text: `Note score: ${dayData.scoreNote}`,
            fontSize: 12,
            style: 'normal',
            lineHeight: 5.5,
            color: [20, 20, 20],
            gapAfter: 3,
          })
        }
      }

      const feedback = dayData.feedback[key]
      if (feedback) {
        pieces.push({
          text: `Il tuo feedback: ${feedback}`,
          fontSize: 12,
          style: 'normal',
          lineHeight: 5.5,
          color: [0, 120, 60],
          gapAfter: 3,
        })
      }

      // Mantieni la sezione tutta sulla stessa pagina: se il blocco non entra
      // nello spazio rimasto ma starebbe in una pagina intera, spostalo tutto
      // alla pagina successiva. Se e' piu' lungo di una pagina intera (raro),
      // lascia che scorra normalmente su piu' pagine.
      const blockHeight = measureBlock(pieces) + 4

      if (y + blockHeight > pageHeight - bottomMargin && blockHeight <= usableHeight) {
        doc.addPage()
        y = TOP_MARGIN
      }

      for (const piece of pieces) {
        doc.setFont('helvetica', piece.style)
        doc.setFontSize(piece.fontSize)
        doc.setTextColor(piece.color[0], piece.color[1], piece.color[2])
        y = addWrappedText(
          doc,
          piece.text,
          marginX,
          y,
          maxWidth,
          piece.lineHeight,
          pageHeight,
          bottomMargin
        )
        y += piece.gapAfter
      }

      y += 4
    }
  })

  doc.save(fileName)
}
