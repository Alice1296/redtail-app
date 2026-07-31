import { jsPDF } from 'jspdf'
import type { DayKey, ScoreType } from './community'

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

export function generateWorkoutPdf(days: WorkoutExportDay[], fileName: string) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageHeight = doc.internal.pageSize.getHeight()
  const pageWidth = doc.internal.pageSize.getWidth()
  const marginX = 15
  const maxWidth = pageWidth - marginX * 2
  const bottomMargin = 20

  days.forEach((dayData, index) => {
    if (index > 0) {
      doc.addPage()
    }

    let y = 20

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(220, 38, 38)
    doc.text('REDTAIL', marginX, y)
    y += 9

    doc.setFontSize(13)
    doc.setTextColor(20, 20, 20)
    doc.text(`Settimana ${dayData.week} - ${DAY_LABELS_IT[dayData.day]}`, marginX, y)
    y += 6

    doc.setDrawColor(220, 38, 38)
    doc.setLineWidth(0.5)
    doc.line(marginX, y, pageWidth - marginX, y)
    y += 9

    if (!dayData.hasWorkout) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(12)
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

      if (y > pageHeight - bottomMargin - 10) {
        doc.addPage()
        y = 20
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(220, 38, 38)
      doc.text(SECTION_LABELS[key].toUpperCase(), marginX, y)
      y += 7

      if (content) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10.5)
        doc.setTextColor(20, 20, 20)
        y = addWrappedText(doc, content, marginX, y, maxWidth, 5, pageHeight, bottomMargin)
        y += 3
      }

      const coachNote = dayData.coachNotes[key]
      if (coachNote) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(9.5)
        doc.setTextColor(150, 110, 0)
        y = addWrappedText(
          doc,
          `Nota del coach: ${coachNote}`,
          marginX,
          y,
          maxWidth,
          5,
          pageHeight,
          bottomMargin
        )
        y += 3
      }

      if (key === 'wod' && dayData.scoreType) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9.5)
        doc.setTextColor(20, 20, 20)
        const scoreLine = `Score (${dayData.scoreLabel || dayData.scoreType}): ${
          dayData.scoreDisplay || '-'
        }`
        y = addWrappedText(doc, scoreLine, marginX, y, maxWidth, 5, pageHeight, bottomMargin)

        if (dayData.scoreNote) {
          doc.setFont('helvetica', 'normal')
          y = addWrappedText(
            doc,
            `Note score: ${dayData.scoreNote}`,
            marginX,
            y,
            maxWidth,
            5,
            pageHeight,
            bottomMargin
          )
        }
        y += 3
      }

      const feedback = dayData.feedback[key]
      if (feedback) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9.5)
        doc.setTextColor(0, 120, 60)
        y = addWrappedText(
          doc,
          `Il tuo feedback: ${feedback}`,
          marginX,
          y,
          maxWidth,
          5,
          pageHeight,
          bottomMargin
        )
        y += 3
      }

      y += 4
    }
  })

  doc.save(fileName)
}
