'use client';

import { useEffect, useState, useRef } from 'react';
import { Bell } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { formatDateTime } from '@/lib/utils';

interface AppNotification {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

/**
 * §6.14 — Notifications internes (ex: auto-pointage refusé pour
 * abonnement expiré). Interrogation périodique simple plutôt qu'un
 * flux temps réel — largement suffisant pour ce volume d'événements,
 * sans nécessiter d'infrastructure supplémentaire (websocket...).
 */
export function NotificationBell() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = async () => {
    try {
      const res = await apiClient.get<{ count: number }>('/notifications/me/unread-count');
      setUnreadCount(res.count);
    } catch {
      // Silencieux — un compteur qui ne se met pas à jour une fois n'est pas bloquant.
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpen = async () => {
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      try {
        const data = await apiClient.get<AppNotification[]>('/notifications/me');
        setNotifications(data);
      } catch {
        setNotifications([]);
      }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiClient.patch('/notifications/me/read-all');
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })));
    } catch {
      // Réessayable au prochain clic — pas d'action bloquante nécessaire ici.
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleOpen}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink-500 hover:bg-ink-100"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-ink-100 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <p className="text-sm font-semibold text-ink-900">Notifications</p>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs font-medium text-primary-600 hover:underline">
                Tout marquer comme lu
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-400">Aucune notification</p>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className={`border-b border-ink-50 px-4 py-3 ${!n.readAt ? 'bg-primary-50/40' : ''}`}>
                  <p className="text-sm font-medium text-ink-900">{n.title}</p>
                  <p className="mt-0.5 text-xs text-ink-600">{n.body}</p>
                  <p className="mt-1 text-[11px] text-ink-400">{formatDateTime(n.createdAt)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
