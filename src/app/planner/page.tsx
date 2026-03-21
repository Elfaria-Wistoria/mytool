"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Instagram, Youtube, Twitter, Video, AtSign,
  Loader2, Plus, Trash2, RefreshCw, LayoutTemplate, Check
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog"

type Account = Tables<"accounts"> & {
  profiles?: { display_name: string; avatar_url: string | null } | null
}
type Task = Tables<"daily_tasks"> & {
  completed_by?: string | null
  accounts: { 
    handle: string; 
    platform: string; 
    profile_id: string;
    profiles?: { display_name: string; avatar_url: string | null } | null;
  } | null
  completer?: { display_name: string; avatar_url: string | null } | null
}
type Template = Tables<"task_templates"> & {
  accounts: { 
    handle: string; 
    platform: string;
    profiles?: { display_name: string; avatar_url: string | null } | null;
  } | null
}

const platformMeta: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  Instagram: { icon: Instagram, color: "text-pink-500",    bg: "bg-pink-50 dark:bg-pink-950/40" },
  TikTok:    { icon: Video,      color: "text-foreground",  bg: "bg-secondary" },
  YouTube:   { icon: Youtube,    color: "text-red-500",    bg: "bg-red-50 dark:bg-red-950/40" },
  X:         { icon: Twitter,    color: "text-sky-500",    bg: "bg-sky-50 dark:bg-sky-950/40" },
  Threads:   { icon: AtSign,     color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-950/40" },
}

const today = new Date().toISOString().slice(0, 10)

type Tab = "today" | "templates"

export default function PlannerPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>("today")
  const [tasks, setTasks] = useState<Task[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  // Dialog states
  const [taskOpen, setTaskOpen] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [taskSaving, setTaskSaving] = useState(false)
  const [templateSaving, setTemplateSaving] = useState(false)
  const [taskForm, setTaskForm] = useState({ account_id: "", content: "", scheduled_time: "" })
  const [templateForm, setTemplateForm] = useState({ account_id: "", content: "", scheduled_time: "" })

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const [tasksRes, templatesRes, accountsRes] = await Promise.all([
      supabase
        .from("daily_tasks")
        .select("*, accounts!inner(handle, platform, profile_id, profiles(display_name, avatar_url)), completer:profiles!completed_by(display_name, avatar_url)")
        .eq("date", today)
        .order("created_at"),
      supabase
        .from("task_templates")
        .select("*, accounts(handle, platform, profiles(display_name, avatar_url))")
        .order("created_at"),
      supabase.from("accounts").select("*, profiles(display_name, avatar_url)").order("created_at"),
    ])

    setTasks((tasksRes.data as any as Task[]) ?? [])
    setTemplates((templatesRes.data as any as Template[]) ?? [])
    setAccounts(accountsRes.data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  // Generate today's tasks from templates (skip already-existing ones)
  const generateFromTemplates = async () => {
    if (!templates.length) return
    setGenerating(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setGenerating(false); return }

    // Check which ones we already have for today so we don't duplicate
    const existing = new Set(tasks.map(t => `${t.account_id}-${t.content}`))

    // Insert only templates that haven't been generated yet today
    const inserts = templates
      .filter(t => !existing.has(`${t.account_id}-${t.content}`))
      .map(t => ({
        account_id: t.account_id,
        content: t.content,
        scheduled_time: t.scheduled_time,
        date: today,
        status: "pending",
      }))

    if (inserts.length > 0) {
      const { error } = await supabase.from("daily_tasks").insert(inserts)
      if (!error) await load()
    }
    
    setGenerating(false)
  }

  // Toggle task status
  const toggle = async (task: Task) => {
    setToggling(task.id)
    const newStatus = task.status === "pending" ? "completed" : "pending"
    
    // get current user id
    const { data: { user } } = await supabase.auth.getUser()
    const currentUserId = user?.id

    const updates: any = { status: newStatus }
    if (newStatus === "completed" && currentUserId) {
      updates.completed_by = currentUserId
    } else {
      updates.completed_by = null
    }

    const { error } = await supabase
      .from("daily_tasks").update(updates).eq("id", task.id)
      
    if (!error) {
      setTasks(prev => prev.map(t => {
        if (t.id === task.id) {
          return {
            ...t,
            status: newStatus,
            completed_by: updates.completed_by,
            completer: newStatus === "completed" && user 
              ? { display_name: user.user_metadata?.display_name || 'You', avatar_url: user.user_metadata?.avatar_url } as any 
              : null
          }
        }
        return t
      }))
    }
    setToggling(null)
  }

  // Add a one-off task for today
  const addTask = async () => {
    if (!taskForm.account_id || !taskForm.content.trim()) return
    setTaskSaving(true)
    const { data, error } = await supabase
      .from("daily_tasks")
      .insert({ account_id: taskForm.account_id, content: taskForm.content.trim(), scheduled_time: taskForm.scheduled_time || null, date: today, status: "pending" })
      .select("*, accounts(handle, platform, profile_id, profiles(display_name, avatar_url)), completer:profiles!completed_by(display_name, avatar_url)").single()
    if (!error && data) { setTasks(prev => [...prev, data as any as Task]); setTaskOpen(false); setTaskForm({ account_id: "", content: "", scheduled_time: "" }) }
    setTaskSaving(false)
  }

  // Add a template
  const addTemplate = async () => {
    if (!templateForm.account_id || !templateForm.content.trim()) return
    setTemplateSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setTemplateSaving(false); return }
    const { data, error } = await supabase
      .from("task_templates")
      .insert({ profile_id: user.id, account_id: templateForm.account_id, content: templateForm.content.trim(), scheduled_time: templateForm.scheduled_time || null })
      .select("*, accounts(handle, platform, profiles(display_name, avatar_url))").single()
    if (!error && data) { setTemplates(prev => [...prev, data as any as Template]); setTemplateOpen(false); setTemplateForm({ account_id: "", content: "", scheduled_time: "" }) }
    setTemplateSaving(false)
  }

  // Delete a template
  const deleteTemplate = async (id: string) => {
    const { error } = await supabase.from("task_templates").delete().eq("id", id)
    if (!error) setTemplates(prev => prev.filter(t => t.id !== id))
  }

  // Delete a one-off task
  const deleteTask = async (id: string) => {
    const { error } = await supabase.from("daily_tasks").delete().eq("id", id)
    if (!error) setTasks(prev => prev.filter(t => t.id !== id))
  }

  const completed = tasks.filter(t => t.status === "completed").length
  const total = tasks.length
  const progress = total ? Math.round((completed / total) * 100) : 0

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Heading */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Content Planner</h1>
        <p className="text-sm text-muted-foreground">Track your daily tasks and manage recurring templates.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border/50">
        {(["today", "templates"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-[13px] font-medium capitalize transition-colors border-b-2 -mb-px
              ${tab === t ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t === "today" ? "Today" : "Templates"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : tab === "today" ? (
        <>
          {/* Progress bar */}
          <div className="apple-card px-5 py-4 flex items-center gap-5">
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">Today's Progress</span>
                <span className="font-semibold text-foreground tabular-nums">{completed} / {total} done</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-foreground transition-all duration-700 ease-out" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums min-w-[3ch] text-right">
              {progress}<span className="text-base font-normal text-muted-foreground">%</span>
            </span>
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-2">
            {templates.length > 0 && (
              <Button
                variant="outline"
                onClick={generateFromTemplates}
                disabled={generating}
                className="rounded-[10px] gap-1.5 text-[13px]"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Generate from Templates
              </Button>
            )}
            <div className="flex-1" />
            <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
              <DialogTrigger render={<Button className="rounded-[10px] shadow-sm" disabled={accounts.length === 0} />}>
                <Plus className="h-4 w-4 mr-1.5" />
                Add Task
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Task for Today</DialogTitle>
                  <DialogDescription>A one-off task that won't repeat tomorrow.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Account</Label>
                    <Select value={taskForm.account_id} onValueChange={val => setTaskForm(f => ({ ...f, account_id: val ?? "" }))}>
                      <SelectTrigger className="rounded-[10px]"><SelectValue placeholder="Select an account…" /></SelectTrigger>
                      <SelectContent>
                        {accounts.map(a => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.handle} · {a.platform} {a.profiles ? `(${a.profiles.display_name})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="task-content" className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Content</Label>
                    <Input id="task-content" placeholder="e.g. Post: 5 productivity tips" value={taskForm.content} onChange={e => setTaskForm(f => ({ ...f, content: e.target.value }))} className="rounded-[10px]" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="task-time" className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Time <span className="normal-case opacity-50">(optional)</span></Label>
                    <Input id="task-time" placeholder="e.g. 3:00 PM" value={taskForm.scheduled_time} onChange={e => setTaskForm(f => ({ ...f, scheduled_time: e.target.value }))} className="rounded-[10px]" />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={addTask} disabled={taskSaving || !taskForm.account_id || !taskForm.content.trim()} className="rounded-[10px]">
                    {taskSaving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Save Task
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Task list */}
          <div className="apple-card divide-y divide-border/50 overflow-hidden">
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
                <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
                  <LayoutTemplate className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">No tasks for today</p>
                <p className="text-xs text-muted-foreground">
                  {templates.length > 0
                    ? "Click 'Generate from Templates' to fill today's tasks automatically."
                    : accounts.length > 0
                    ? "Go to Templates tab to set up your recurring daily tasks."
                    : "Add accounts first, then create your templates."}
                </p>
              </div>
            ) : (
              tasks.map(task => {
                const platform = task.accounts?.platform ?? "TikTok"
                const meta = platformMeta[platform] ?? { icon: Video, color: "text-foreground", bg: "bg-secondary" }
                const Icon = meta.icon
                const isDone = task.status === "completed"
                const isToggling = toggling === task.id
                return (
                  <div key={task.id} className="group flex w-full items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/30">
                    {/* Toggle Button */}
                    <button 
                      onClick={() => toggle(task)} 
                      disabled={isToggling}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                        isDone ? "bg-foreground border-foreground" : "border-border bg-transparent hover:border-foreground/50"
                      }`}
                    >
                      {isToggling
                        ? <Loader2 className="h-3 w-3 animate-spin text-background" />
                        : isDone && <svg className="h-3 w-3 text-background" viewBox="0 0 12 12" fill="none" strokeWidth="2.5" stroke="currentColor"><path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      }
                    </button>

                    {/* Content (Clickable to toggle) */}
                    <div 
                      onClick={() => toggle(task)}
                      className="flex flex-1 min-w-0 items-center gap-4 cursor-pointer"
                    >
                      <div className={`flex h-9 w-9 items-center justify-center rounded-[10px] shrink-0 ${meta.bg}`}>
                        <Icon className={`h-4 w-4 ${meta.color}`} />
                      </div>
                      
                      {task.accounts?.profiles && (
                        <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 overflow-hidden text-[10px] font-semibold text-primary">
                          {task.accounts.profiles.avatar_url ? (
                            <img src={task.accounts.profiles.avatar_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            task.accounts.profiles.display_name[0].toUpperCase()
                          )}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <p className={`text-[14px] font-medium leading-none ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>{task.content}</p>
                        <p className="text-[11px] text-muted-foreground mt-1.5">{platform} · {task.accounts?.handle ?? "Unknown"}</p>
                      </div>
                      <span className={`text-[12px] shrink-0 tabular-nums ${isDone ? "text-muted-foreground/60" : "text-muted-foreground"}`}>
                        {task.scheduled_time ?? "—"}
                      </span>
                    </div>

                    {/* Completion Info & Delete Action */}
                    <div className="flex items-center gap-3 shrink-0">
                      {isDone && task.completer && (
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
                          <Check className="h-3 w-3" />
                          <span className="truncate max-w-[80px]">{task.completer.display_name}</span>
                        </div>
                      )}
                      <button 
                        onClick={() => deleteTask(task.id)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all focus:opacity-100 focus-visible:outline-none"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </>
      ) : (
        /* ── Templates tab ── */
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Templates repeat every day — click <strong>Generate from Templates</strong> on the Today tab to create your daily tasks instantly.
            </p>
            <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
              <DialogTrigger render={<Button className="rounded-[10px] shadow-sm ml-4 shrink-0" disabled={accounts.length === 0} />}>
                <Plus className="h-4 w-4 mr-1.5" />
                New Template
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Daily Template</DialogTitle>
                  <DialogDescription>This task will be available to generate every day.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Account</Label>
                    <Select value={templateForm.account_id} onValueChange={val => setTemplateForm(f => ({ ...f, account_id: val ?? "" }))}>
                      <SelectTrigger className="rounded-[10px]"><SelectValue placeholder="Select an account…" /></SelectTrigger>
                      <SelectContent>
                        {accounts.map(a => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.handle} · {a.platform} {a.profiles ? `(${a.profiles.display_name})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-content" className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Content</Label>
                    <Input id="tpl-content" placeholder="e.g. Daily reel post" value={templateForm.content} onChange={e => setTemplateForm(f => ({ ...f, content: e.target.value }))} className="rounded-[10px]" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-time" className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Default Time <span className="normal-case opacity-50">(optional)</span></Label>
                    <Input id="tpl-time" placeholder="e.g. 10:00 AM" value={templateForm.scheduled_time} onChange={e => setTemplateForm(f => ({ ...f, scheduled_time: e.target.value }))} className="rounded-[10px]" />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={addTemplate} disabled={templateSaving || !templateForm.account_id || !templateForm.content.trim()} className="rounded-[10px]">
                    {templateSaving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Save Template
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="apple-card divide-y divide-border/50 overflow-hidden">
            {templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
                <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
                  <LayoutTemplate className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">No templates yet</p>
                <p className="text-xs text-muted-foreground">Click 'New Template' to create a recurring daily task.</p>
              </div>
            ) : (
              templates.map(tpl => {
                const platform = tpl.accounts?.platform ?? "TikTok"
                const meta = platformMeta[platform] ?? { icon: Video, color: "text-foreground", bg: "bg-secondary" }
                const Icon = meta.icon
                return (
                  <div key={tpl.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-[10px] shrink-0 ${meta.bg}`}>
                      <Icon className={`h-4 w-4 ${meta.color}`} />
                    </div>
                    
                    {tpl.accounts?.profiles && (
                      <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 overflow-hidden text-[10px] font-semibold text-primary">
                        {tpl.accounts.profiles.avatar_url ? (
                          <img src={tpl.accounts.profiles.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          tpl.accounts.profiles.display_name[0].toUpperCase()
                        )}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-foreground leading-none">{tpl.content}</p>
                      <p className="text-[11px] text-muted-foreground mt-1.5">{platform} · {tpl.accounts?.handle ?? "Unknown"}{tpl.scheduled_time ? ` · ${tpl.scheduled_time}` : ""}</p>
                    </div>
                    <button onClick={() => deleteTemplate(tpl.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-[8px] text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}
