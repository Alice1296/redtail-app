'use client'

import { useState } from 'react'
import {
  formatTimerDuration,
  parseWorkoutText,
  workoutTextToWodConfig,
  type WodConfig,
  type WorkoutParseResult,
} from '@/lib/community'

type WorkoutParserProps = {
  initialText?: string
  onApply: (config: WodConfig) => void
  onClose?: () => void
}

export function WorkoutParser({
  initialText = '',
  onApply,
  onClose,
}: WorkoutParserProps) {
  const [inputText, setInputText] = useState('')
  const [parseResult, setParseResult] = useState<WorkoutParseResult | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  function analyzeText(text: string) {
    setInputText(text)
    setParseResult(text.trim() ? parseWorkoutText(text) : null)
  }

  function openParser() {
    setIsExpanded(true)
    analyzeText(initialText)
  }

  function closeParser() {
    setIsExpanded(false)
    setInputText('')
    setParseResult(null)
    onClose?.()
  }

  function handleApply() {
    if (!inputText.trim() || !parseResult?.isValid) {
      return
    }

    onApply(workoutTextToWodConfig(inputText))
    closeParser()
  }

  function confidenceColor(confidence: number) {
    if (confidence >= 0.7) return 'text-green-400'
    if (confidence >= 0.4) return 'text-yellow-400'
    return 'text-red-400'
  }

  function confidenceLabel(confidence: number) {
    if (confidence >= 0.7) return 'Alta'
    if (confidence >= 0.4) return 'Media'
    return 'Bassa'
  }

  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={openParser}
        className="w-full rounded-xl border border-blue-600/40 bg-blue-600/10 p-3 text-[10px] font-black uppercase tracking-wide text-blue-400 transition-all hover:bg-blue-600/20"
      >
        Riconosci timer dal testo
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-400">
              Workout Parser
            </p>
            <h2 className="mt-1 text-xl font-black uppercase text-white">
              Riconoscimento automatico timer
            </h2>
          </div>
          <button
            type="button"
            onClick={closeParser}
            aria-label="Chiudi parser"
            className="rounded-xl border border-zinc-700 bg-black px-3 py-2 text-sm font-black text-zinc-400 transition-all hover:text-white"
          >
            X
          </button>
        </div>

        <div className="space-y-3">
          <label className="block text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500">
            Testo workout
          </label>
          <textarea
            value={inputText}
            onChange={(event) => analyzeText(event.target.value)}
            placeholder={`Amrap 6'
30 Du
5 Hang Power Clean @ 65/45 Kg
3 BOTB
2' Rest
Amrap 6'
3 BOTB
5 STOH @ 65/45 Kg
30 Du`}
            className="h-44 w-full resize-none rounded-2xl border border-zinc-800 bg-black/60 p-4 font-mono text-sm text-zinc-200 outline-none transition-all placeholder:text-zinc-600 focus:border-blue-600"
          />
        </div>

        {parseResult && (
          <div className="space-y-4 rounded-2xl border border-zinc-800 bg-black/35 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500">
                  Analisi
                </p>
                <p className="mt-1 text-sm font-bold text-zinc-300">
                  {parseResult.detectedMode} · {parseResult.blocks.length} blocchi
                </p>
              </div>
              <span
                className={`text-[10px] font-black uppercase tracking-wide ${confidenceColor(
                  parseResult.confidence
                )}`}
              >
                Affidabilita {confidenceLabel(parseResult.confidence)} (
                {Math.round(parseResult.confidence * 100)}%)
              </span>
            </div>

            {parseResult.totalDurationSeconds !== null && (
              <div className="rounded-xl border border-green-600/40 bg-green-600/10 p-3">
                <p className="text-[10px] font-black uppercase tracking-wide text-green-400">
                  Durata totale
                </p>
                <p className="mt-1 text-xl font-black text-green-300">
                  {formatTimerDuration(parseResult.totalDurationSeconds)}
                </p>
              </div>
            )}

            {parseResult.blocks.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500">
                  Blocchi riconosciuti
                </p>
                <div className="max-h-44 space-y-2 overflow-y-auto">
                  {parseResult.blocks.map((block, index) => (
                    <div
                      key={`${block.type}-${index}-${block.rawText}`}
                      className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] font-black uppercase tracking-wide text-blue-400">
                          {block.type}
                        </span>
                        {block.duration && (
                          <span className="font-mono text-xs font-bold text-zinc-300">
                            {formatTimerDuration(block.duration)}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 break-words text-xs font-bold text-zinc-300">
                        {block.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {parseResult.warnings.length > 0 && (
              <div className="space-y-1 rounded-xl border border-yellow-600/40 bg-yellow-600/10 p-3">
                <p className="text-[10px] font-black uppercase tracking-wide text-yellow-400">
                  Attenzione
                </p>
                {parseResult.warnings.map((warning) => (
                  <p key={warning} className="text-xs font-bold text-yellow-200">
                    {warning}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={closeParser}
            className="flex-1 rounded-2xl border border-zinc-700 bg-zinc-900 p-3 text-[10px] font-black uppercase tracking-wide text-zinc-300 transition-all hover:bg-zinc-800"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!inputText.trim() || !parseResult?.isValid}
            className="flex-1 rounded-2xl bg-blue-600 p-3 text-[10px] font-black uppercase tracking-wide text-white transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Applica al timer
          </button>
        </div>
      </div>
    </div>
  )
}
