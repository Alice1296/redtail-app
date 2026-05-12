'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { DEFAULT_MAX_LIFTS } from '@/lib/community'

type MaxRow = {
  value: number
  unit: string
  updatedAt?: string | null
}

export default function ClientMaxesPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})

  useEffect(() => {
    async function loadPage() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/')
        return
      }

      setUserId(user.id)

      const {
        data: { session },
      } = await supabase.auth.getSession()
      const authHeaders = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : undefined

      const response = await fetch('/api/maxes', {
        headers: authHeaders,
      })
      const payload = await response.json()

      if (response.ok) {
        const nextValues: Record<string, string> = {}
        Object.entries((payload.values || {}) as Record<string, MaxRow>).forEach(
          ([liftName, row]) => {
            nextValues[liftName] = String(row.value)
          }
        )
        setValues(nextValues)
      }

      setLoading(false)
    }

    loadPage()
  }, [router])

  async function saveMaxes() {
    if (!userId) {
      return
    }

    try {
      setSaving(true)
      setMessage('')

      const {
        data: { session },
      } = await supabase.auth.getSession()
      const authHeaders: Record<string, string> = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {}

      const response = await fetch('/api/maxes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          entries: DEFAULT_MAX_LIFTS.filter((lift) => values[lift]?.trim()).map(
            (lift) => ({
              liftName: lift,
              value: Number(values[lift].replace(',', '.')),
              unit: 'kg',
            })
          ),
        }),
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || 'Errore salvataggio massimali')
      }

      setMessage('Massimali aggiornati')
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Errore salvataggio massimali')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 font-sans">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b-2 border-red-600 pb-4">
          <button
            onClick={() => router.push('/client')}
            className="text-zinc-400 hover:text-white text-sm font-black uppercase"
          >
            {'<'} Workout
          </button>
          <h1 className="text-3xl font-black text-red-600 uppercase italic tracking-tighter">
            I miei Massimali
          </h1>
          <button
            onClick={() => router.push('/community')}
            className="text-zinc-400 hover:text-white text-sm font-black uppercase"
          >
            Community
          </button>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-xs text-zinc-400">
          Usa i nomi standard qui sotto: sono gli stessi che la scheda usa per
          calcolare automaticamente i carichi dalle percentuali.
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {DEFAULT_MAX_LIFTS.map((lift) => (
            <div
              key={lift}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3"
            >
              <p className="text-red-500 font-black uppercase text-sm">{lift}</p>
              <div className="flex items-center gap-3">
                <input
                  value={values[lift] || ''}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [lift]: event.target.value,
                    }))
                  }
                  placeholder="kg"
                  className="w-full bg-black border border-zinc-800 p-3 rounded-xl outline-none focus:border-red-600"
                />
                <span className="text-xs font-black uppercase text-zinc-500">kg</span>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={saveMaxes}
          disabled={loading || saving}
          className="w-full bg-red-600 p-4 rounded-2xl font-black uppercase italic tracking-widest hover:bg-red-700 transition-all disabled:opacity-50"
        >
          {saving ? 'Salvataggio...' : 'Salva massimali'}
        </button>

        {message && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-center text-sm text-zinc-200">
            {message}
          </div>
        )}
      </div>
    </div>
  )
}
