import { Bell, Check, CheckCheck, Trash2, Info, AlertTriangle, CheckCircle } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { formatRelativeTime } from "@/lib/utils-format";

const typeIcons: Record<string, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle,
};

const typeColors: Record<string, string> = {
  info: "text-accent",
  warning: "text-yellow-500",
  success: "text-primary",
};

export function NotificationCenter({ collapsed = false }: { collapsed?: boolean }) {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          className="w-full justify-start gap-2 text-muted-foreground relative"
        >
          <Bell className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Notifications</span>}
          {unreadCount > 0 && (
            <Badge className="absolute top-0 right-0 h-4 min-w-4 px-1 text-[10px] bg-destructive text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80 sm:w-96">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>Notifications</span>
            <div className="flex gap-1">
              {unreadCount > 0 && (
                <Button variant="ghost" size="icon" onClick={markAllAsRead} className="h-7 w-7" title="Mark all read">
                  <CheckCheck className="h-3.5 w-3.5" />
                </Button>
              )}
              {notifications.length > 0 && (
                <Button variant="ghost" size="icon" onClick={clearAll} className="h-7 w-7 text-muted-foreground hover:text-destructive" title="Clear all">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-6rem)] mt-4">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="space-y-2 pr-2">
              {notifications.map((n) => {
                const Icon = typeIcons[n.type] ?? Info;
                const color = typeColors[n.type] ?? "text-muted-foreground";
                return (
                  <div
                    key={n.id}
                    className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                      n.read ? "border-border bg-card/50 opacity-70" : "border-primary/20 bg-card"
                    }`}
                    onClick={() => !n.read && markAsRead(n.id)}
                  >
                    <div className="flex items-start gap-2">
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${color}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate">{n.title}</p>
                          {!n.read && (
                            <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                          {formatRelativeTime(n.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
