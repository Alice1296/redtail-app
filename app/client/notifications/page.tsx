'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { isCommunityNotification } from '@/lib/communityNotifications'

type NotificationRow = {
  id: string
  message: string
  read: boolean
  created_at: string
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    checkUserAndLoad()
  }, [])

  async function checkUserAndLoad() {
    try {
      setLoading(true)

      // Verifica se l'utente è loggato
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }

      // Carica le notifiche
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setNotifications((data || []).filter((notification) => !isCommunityNotification(notification.message)))
    } catch (err: unknown) {
      console.error('Errore:', err instanceof Error ? err.message : err)
    } finally {
      setLoading(false)
    }
  }

  async function markAsRead(notificationId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)

    if (!error) {
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      )
    }
  }

  async function deleteNotification(notificationId: string) {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)

    if (!error) {
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-red-500 font-black uppercase italic animate-pulse">Caricamento notifiche...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 font-sans">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 border-b-2 border-red-600 pb-2">
          <button
            onClick={() => router.push('/client')}
            className="flex items-center gap-1 text-zinc-400 hover:text-white transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
            <span className="text-[10px] font-black uppercase tracking-widest">Indietro</span>
          </button>

          <h1 className="text-3xl font-black text-red-600 uppercase italic tracking-tighter">
            Notifiche
          </h1>

          <button
            onClick={handleLogout}
            className="bg-red-600/10 border border-red-600 text-red-500 px-3 py-1 rounded-lg text-[10px] font-black uppercase hover:bg-red-600/20 transition-all active:scale-95"
          >
            Logout
          </button>
        </div>

        {/* Lista notifiche */}
        <div className="space-y-4">
          {notifications.length > 0 ? (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`border rounded-2xl p-5 transition-all ${
                  notif.read
                    ? 'bg-zinc-900/50 border-zinc-800'
                    : 'bg-red-600/5 border-red-600/50 shadow-lg shadow-red-600/10'
                }`}
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-black text-lg uppercase italic text-red-500">
                        {notif.message}
                      </p>
                      {!notif.read && (
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 font-mono">
                      {new Date(notif.created_at).toLocaleString('it-IT')}
                    </p>
                  </div>

                  {/* Pulsanti azioni */}
                  <div className="flex gap-2">
                    {!notif.read && (
                      <button
                        onClick={() => markAsRead(notif.id)}
                        className="bg-green-600/10 border border-green-600 text-green-500 px-3 py-1 rounded-lg text-[10px] font-black uppercase hover:bg-green-600/20 transition-all active:scale-95"
                        title="Segna come letta"
                      >
                        ✓
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(notif.id)}
                      className="bg-red-600/10 border border-red-600 text-red-500 px-3 py-1 rounded-lg text-[10px] font-black uppercase hover:bg-red-600/20 transition-all active:scale-95"
                      title="Elimina"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20 border border-dashed border-zinc-800 rounded-3xl">
              <p className="text-zinc-600 font-black uppercase italic">Nessuna notifica</p>
              <p className="text-[10px] text-zinc-700 mt-2">Le notifiche appariranno qui quando il trainer aggiorna il tuo programma</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
