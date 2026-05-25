import { useState, useEffect, useRef } from "react";

export interface AppNotification {
  id: string;
  type: "sold" | "offer" | "info";
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  listingId?: number;
}

const POLL_INTERVAL = 60_000; // 1 minute

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [lastChecked, setLastChecked] = useState<string>(new Date().toISOString());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchActivity() {
    try {
      const resp = await fetch(`/api/activity?since=${encodeURIComponent(lastChecked)}`);
      if (!resp.ok) return;
      const data = await resp.json();
      if (data.notifications?.length) {
        setNotifications((prev) => {
          const existingIds = new Set(prev.map((n) => n.id));
          const newOnes = data.notifications.filter((n: AppNotification) => !existingIds.has(n.id));
          return [...newOnes, ...prev].slice(0, 50);
        });
        setLastChecked(new Date().toISOString());
      }
    } catch {
      // silent — don't disrupt the UI if polling fails
    }
  }

  useEffect(() => {
    fetchActivity();
    intervalRef.current = setInterval(fetchActivity, POLL_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  }

  const unread = notifications.filter((n) => !n.read).length;

  return { notifications, unread, markAllRead, markRead, refetch: fetchActivity };
}
