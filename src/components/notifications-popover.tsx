"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Bell, Check, Info, AlertCircle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { formatDistanceToNow } from "date-fns"
import { useRouter } from "next/navigation"

type Notification = {
  id: string
  title: string
  message: string
  type: string
  link: string | null
  is_read: boolean
  created_at: string
}

export function NotificationsPopover() {
  const supabase = createClient()
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchNotifications = async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20)

    if (data) {
      setNotifications(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchNotifications()

    // Subscribe to realtime notifications
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      
      const channel = supabase
        .channel('public:notifications')
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications',
          filter: `profile_id=eq.${user.id}`
        }, payload => {
          setNotifications(prev => [payload.new as Notification, ...prev])
        })
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    })
  }, [])

  const unreadCount = notifications.filter(n => !n.is_read).length

  const markAsRead = async (id: string) => {
    const n = notifications.find(x => x.id === id)
    if (!n) return

    // Optimistically update UI
    setNotifications(prev => prev.map(x => x.id === id ? { ...x, is_read: true } : x))
    
    await supabase.from("notifications").update({ is_read: true }).eq("id", id)

    if (n.link) {
      setOpen(false)
      router.push(n.link)
    }
  }

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(x => ({ ...x, is_read: true })))
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from("notifications").update({ is_read: true }).eq("profile_id", user.id).eq("is_read", false)
    }
  }

  const getIcon = (type: string) => {
    switch(type) {
      case 'alert': return <AlertCircle className="h-5 w-5 text-red-500" />
      case 'success': return <CheckCircle2 className="h-5 w-5 text-green-500" />
      default: return <Info className="h-5 w-5 text-blue-500" />
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="ghost" size="icon-sm" className="relative text-muted-foreground hover:text-foreground" />}>
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 md:w-96 p-0 border-border/50 bg-background/95 backdrop-blur-xl rounded-2xl shadow-lg mr-4 sm:mr-6" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm">Notifications</h4>
            {unreadCount > 0 && (
              <span className="bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-auto p-0 text-xs text-muted-foreground hover:text-primary">
              Mark all as read
            </Button>
          )}
        </div>
        
        <div className="max-h-[350px] overflow-y-auto align-top flex flex-col">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center">
              <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">You have no notifications</p>
            </div>
          ) : (
            notifications.map(notification => (
              <div 
                key={notification.id}
                onClick={() => markAsRead(notification.id)}
                className={`p-4 border-b border-border/50 last:border-0 hover:bg-muted/50 transition-colors flex gap-3 cursor-pointer ${notification.is_read ? 'opacity-70' : 'bg-primary/5'}`}
              >
                <div className="shrink-0 mt-0.5">
                  {getIcon(notification.type)}
                </div>
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-medium leading-tight ${notification.is_read ? 'text-foreground/80' : 'text-foreground'}`}>
                      {notification.title}
                    </p>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {notification.message}
                  </p>
                </div>
                {!notification.is_read && (
                  <div className="shrink-0 mt-1.5">
                    <span className="block h-2 w-2 rounded-full bg-primary" />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
