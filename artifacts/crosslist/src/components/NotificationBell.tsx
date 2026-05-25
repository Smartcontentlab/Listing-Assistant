import { useState } from "react";
import { Bell } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

const TYPE_COLORS = {
  sold: "text-violet-600 bg-violet-100",
  offer: "text-amber-600 bg-amber-100",
  info: "text-blue-600 bg-blue-100",
};

export function NotificationBell() {
  const { notifications, unread, markAllRead, markRead } = useNotifications();
  const [open, setOpen] = useState(false);

  function handleOpen(v: boolean) {
    setOpen(v);
    if (!v) markAllRead();
  }

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button className="relative h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted/60 transition-colors">
          <Bell className="h-4 w-4 text-muted-foreground" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-[9px] font-black text-white flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-sm font-semibold">Notifications</p>
          {notifications.length > 0 && (
            <button onClick={markAllRead} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center px-4">
              <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
              <p className="text-xs text-muted-foreground mt-1">Sales and offers will appear here</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => markRead(n.id)}
                className={`flex items-start gap-3 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-muted/30 cursor-pointer transition-colors ${!n.read ? "bg-primary/3" : ""}`}
              >
                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${TYPE_COLORS[n.type]}`}>
                  {n.type === "sold" ? "$" : n.type === "offer" ? "%" : "i"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${!n.read ? "text-foreground" : "text-muted-foreground"}`}>{n.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{n.body}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">{new Date(n.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                {!n.read && <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />}
              </div>
            ))
          )}
        </div>
        <div className="px-4 py-2 border-t border-border">
          <p className="text-[10px] text-muted-foreground text-center">
            CrossList checks for activity every minute. For real-time offers, check your platform apps directly.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
