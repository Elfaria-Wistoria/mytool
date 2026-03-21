"use client"

import { useEffect, useState, useCallback } from "react"
import { CheckCircle2, Circle, Instagram, Youtube, Twitter, Video, Loader2, Clock, Wallet, Kanban, Bug, BookOpen, ArrowRight } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/types"
import Link from "next/link"
import { Button } from "@/components/ui/button"

type Account = Tables<"accounts">
type Task = Tables<"daily_tasks"> & {
  accounts: { handle: string; platform: string } | null
}
type ScheduleTask = Tables<"schedule_tasks">
type BugReport = Tables<"bug_reports">
type JournalEntry = Tables<"journal_entries">

const platformMeta: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  Instagram: { icon: Instagram, color: "text-pink-500",    bg: "bg-pink-50 dark:bg-pink-950/40" },
  TikTok:    { icon: Video,      color: "text-foreground",  bg: "bg-secondary" },
  YouTube:   { icon: Youtube,    color: "text-red-500",    bg: "bg-red-50 dark:bg-red-950/40" },
  X:         { icon: Twitter,    color: "text-sky-500",    bg: "bg-sky-50 dark:bg-sky-950/40" },
}

const today = new Date().toISOString().slice(0, 10)

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 18) return "Good afternoon"
  return "Good evening"
}

export default function Dashboard() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  
  const [profile, setProfile] = useState<{ display_name: string } | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [totalBalance, setTotalBalance] = useState<number>(0)
  const [scheduleTasks, setScheduleTasks] = useState<ScheduleTask[]>([])
  const [activeBugs, setActiveBugs] = useState<number>(0)
  const [latestJournal, setLatestJournal] = useState<JournalEntry | null>(null)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const [profileRes, accountsRes, tasksRes, walletsRes, scheduleRes, bugsRes, journalRes] = await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", user.id).single(),
      supabase.from("accounts").select("*").eq("profile_id", user.id).order("created_at"),
      supabase.from("daily_tasks")
        .select("*, accounts!inner(handle, platform, profile_id)")
        .eq("date", today)
        .order("created_at"),
      supabase.from("wallets").select("balance"),
      supabase.from("schedule_tasks").select("*").neq("status", "done").order("created_at", { ascending: false }).limit(5),
      supabase.from("bug_reports").select("id").neq("status", "done"),
      supabase.from("journal_entries").select("*").order("created_at", { ascending: false }).limit(1),
    ])

    setProfile(profileRes.data)
    setAccounts(accountsRes.data ?? [])
    setTasks((tasksRes.data as Task[]) ?? [])
    
    const balances = walletsRes.data?.reduce((acc, curr) => acc + (curr.balance || 0), 0) || 0
    setTotalBalance(balances)

    setScheduleTasks(scheduleRes.data ?? [])
    setActiveBugs(bugsRes.data?.length ?? 0)
    setLatestJournal(journalRes.data?.[0] ?? null)
    
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const completed = tasks.filter(t => t.status === "completed").length
  const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0

  const stats = [
    { label: "Content Today",  value: `${progress}%`,            sub: `${completed}/${tasks.length} posts done`, accent: "text-emerald-500", icon: Video },
    { label: "Total Balance", value: `Rp ${totalBalance.toLocaleString("id-ID")}`, sub: "across all wallets", accent: "text-blue-500", icon: Wallet },
    { label: "Pending Tasks",   value: String(scheduleTasks.length), sub: "in schedule queue",  accent: "text-amber-500", icon: Kanban },
    { label: "Active Bugs",    value: String(activeBugs),          sub: "needs resolving",        accent: "text-rose-500", icon: Bug },
  ]

  const firstName = profile?.display_name?.split(" ")[0] ?? "there"

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Heading */}
      <div className="space-y-1 animate-heading">
        <h1 className="text-2xl font-semibold tracking-tight">{greeting()}, {firstName} 👋</h1>
        <p className="text-sm text-muted-foreground">
          Here's your comprehensive overview for today — {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s, i) => {
              const Icon = s.icon
              return (
                <div key={s.label} className="apple-card px-4 py-4 space-y-3 relative overflow-hidden group animate-stagger-item" style={{ '--i': i } as React.CSSProperties}>
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">{s.label}</p>
                    <Icon className={`h-4 w-4 opacity-50 ${s.accent}`} />
                  </div>
                  <div className="space-y-1">
                    <p className={`text-2xl sm:text-3xl font-bold tracking-tight stat-value ${s.accent || "text-foreground"} line-clamp-1`}>{s.value}</p>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">{s.sub}</p>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            
            {/* Left Column */}
            <div className="space-y-5">
              {/* Today's content list */}
              <div className="apple-card flex flex-col h-[380px]">
                <div className="p-5 border-b border-border/40 shrink-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-[15px] font-semibold text-foreground">Content Planner</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">Today's posting across platforms</p>
                    </div>
                    <span className="text-[13px] font-semibold tabular-nums text-emerald-500">{progress}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mt-4">
                    <div className="h-full rounded-full bg-emerald-500 transition-all duration-700 ease-out" style={{ width: `${progress}%` }} />
                  </div>
                </div>
                
                <div className="p-2 overflow-y-auto flex-1">
                  {tasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center gap-1.5 opacity-60">
                      <Clock className="h-8 w-8 text-muted-foreground mb-1" />
                      <p className="text-sm font-medium text-foreground">No tasks for today</p>
                      <Link href="/planner" className="text-xs text-primary hover:underline">Go set up Planner →</Link>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {tasks.map((task) => {
                        const platform = task.accounts?.platform ?? "TikTok"
                        const meta = platformMeta[platform] ?? { icon: Video, color: "text-foreground", bg: "bg-secondary" }
                        const Icon = meta.icon
                        const isDone = task.status === "completed"
                        return (
                          <div key={task.id} className={`flex items-center gap-3 rounded-[12px] px-3 py-2.5 transition-colors ${isDone ? "opacity-60" : "hover:bg-muted/60"}`}>
                            <div className={`flex h-9 w-9 items-center justify-center rounded-[10px] shrink-0 ${meta.bg}`}>
                              <Icon className={`h-4 w-4 ${meta.color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-[13px] font-medium leading-none ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                {task.accounts?.handle ?? "Unknown"} • {task.content}
                              </p>
                              <p className="text-[11px] text-muted-foreground mt-1.5">{task.scheduled_time ?? "No time set"}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {isDone
                                ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                : <Circle className="h-4 w-4 text-muted-foreground/30" />
                              }
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-5 flex flex-col">
              {/* Upcoming Schedule */}
              <div className="apple-card p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-border/40 pb-4">
                  <div>
                    <h2 className="text-[15px] font-semibold text-foreground">Upcoming Schedule</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Top pending tasks in pipeline</p>
                  </div>
                  <Link href="/schedule">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
                
                {scheduleTasks.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground opacity-60">
                    Your schedule is clear.
                  </div>
                ) : (
                  <div className="space-y-3 pt-1">
                    {scheduleTasks.map((st) => (
                      <div key={st.id} className="flex items-start gap-3 group">
                        <div className="mt-0.5"><Circle className="h-4 w-4 text-amber-500/50" /></div>
                        <div>
                          <p className="text-[14px] font-medium text-foreground">{st.title}</p>
                          {st.due_date && <p className="text-[11px] text-muted-foreground mt-0.5">Due: {new Date(st.due_date).toLocaleDateString()}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Latest Journal */}
              <div className="apple-card p-5 flex-1 flex flex-col min-h-[160px]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-primary">
                    <BookOpen className="h-4 w-4" />
                    <h2 className="text-[14px] font-semibold uppercase tracking-wider">Latest Journal</h2>
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {latestJournal ? new Date(latestJournal.created_at).toLocaleDateString() : 'No entries'}
                  </span>
                </div>
                
                <div className="flex-1 bg-muted/40 rounded-[12px] p-4 text-sm text-muted-foreground relative">
                  {latestJournal ? (
                    <div className="line-clamp-3 leading-relaxed">
                      <span className="font-semibold text-foreground mr-2">{latestJournal.title}</span>
                      {latestJournal.content}
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center opacity-60">
                      <p>You haven't written anything yet.</p>
                      <Link href="/journaling" className="text-xs text-primary font-medium hover:underline mt-1">Write your thoughts →</Link>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  )
}
