"use client"

import { useState, useEffect, useCallback } from "react"
import { Bug, Plus, Loader2, Circle, Clock, CheckCircle2, MoreHorizontal, Trash2, Image as ImageIcon, X, Share2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"

type BugReport = Tables<"bug_reports">

const StatusConfig: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  unstarted:   { label: "Todo",        icon: Circle,       color: "text-muted-foreground", bg: "bg-muted" },
  in_progress: { label: "In Progress", icon: Clock,        color: "text-blue-500",         bg: "bg-blue-50 dark:bg-blue-950/40" },
  done:        { label: "Done",        icon: CheckCircle2, color: "text-emerald-500",      bg: "bg-emerald-50 dark:bg-emerald-950/40" },
}

import { useRealtimeData } from "@/hooks/use-realtime-data"

export default function BugsPage() {
  const supabase = createClient()
  const { data: bugs, loading, setData: setBugs } = useRealtimeData<BugReport>("bug_reports", "created_at", false)
  const [isOpen, setIsOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: "", description: "" })
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  
  // Detail view state
  const [selectedBug, setSelectedBug] = useState<BugReport | null>(null)

  const copyPublicLink = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const link = `${window.location.origin}/report-bug/${user.id}`
    await navigator.clipboard.writeText(link)
    toast.success("Link berhasil disalin!", { description: "Bagikan link ini ke user Anda untuk menerima laporan bug." })
  }

  const addBug = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    setUploadError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    let image_url: string | null = null

    if (file) {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `${user.id}/${fileName}`

      const { error: storageError } = await supabase.storage
        .from('bug_images')
        .upload(filePath, file)

      if (storageError) {
        setUploadError(storageError.message)
        setSaving(false)
        return
      }

      const { data: publicData } = supabase.storage
        .from('bug_images')
        .getPublicUrl(filePath)
      image_url = publicData.publicUrl
    }

    const { data, error } = await supabase
      .from("bug_reports")
      .insert({
        profile_id: user.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        image_url,
        status: "unstarted",
      })
      .select()
      .single()

    if (error) {
      setUploadError("Failed to save report.")
      setSaving(false)
      return
    }

    if (data) {
      setBugs(prev => [data, ...prev])
      setIsOpen(false)
      setForm({ title: "", description: "" })
      setFile(null)
      if (preview) URL.revokeObjectURL(preview)
      setPreview(null)
    }
    setSaving(false)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null
    setFile(f)
    if (f) {
      const objUrl = URL.createObjectURL(f)
      setPreview(objUrl)
    } else {
      setPreview(null)
    }
  }

  const clearFile = () => {
    setFile(null)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
  }

  const updateStatus = async (id: string, newStatus: string) => {
    // Optimistic update
    setBugs(prev => prev.map(bug => bug.id === id ? { ...bug, status: newStatus, updated_at: new Date().toISOString() } : bug))
    await supabase.from("bug_reports").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", id)
  }

  const deleteBug = async (id: string) => {
    setBugs(prev => prev.filter(bug => bug.id !== id))
    await supabase.from("bug_reports").delete().eq("id", id)
  }

  const todo = bugs.filter(b => b.status === "unstarted").length
  const inProgress = bugs.filter(b => b.status === "in_progress").length
  const done = bugs.filter(b => b.status === "done").length

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1 animate-heading">
          <h1 className="text-2xl font-semibold tracking-tight">Bug Tracker</h1>
          <p className="text-sm text-muted-foreground">Manage issue reports and track resolution progress.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={copyPublicLink} className="rounded-[10px] shadow-sm">
            <Share2 className="h-4 w-4 mr-1.5" /> Share Public Link
          </Button>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger render={<Button className="rounded-[10px] shadow-sm"><Plus className="h-4 w-4 mr-1.5" /> Report Issue</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Report an Issue</DialogTitle>
              <DialogDescription>Add a new bug to the tracking board.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="title" className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Title</Label>
                <Input
                  id="title"
                  placeholder="e.g. Cannot upload video file"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="rounded-[10px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="desc" className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Description <span className="normal-case opacity-50">(optional)</span></Label>
                <Textarea
                  id="desc"
                  placeholder="Steps to reproduce, expected behavior, etc."
                  value={form.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm(f => ({ ...f, description: e.target.value }))}
                  className="rounded-[10px] min-h-[100px] resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Attachment <span className="normal-case opacity-50">(optional image)</span></Label>
                {preview ? (
                  <div className="relative rounded-[12px] border border-border bg-muted/30 p-2 group h-40 overflow-hidden flex items-center justify-center">
                    <img src={preview} alt="Upload preview" className="max-h-full object-contain" />
                    <button 
                      onClick={clearFile}
                      className="absolute top-2 right-2 bg-background/80 backdrop-blur border border-border text-foreground hover:bg-destructive hover:text-destructive-foreground hover:border-destructive p-1.5 rounded-full shadow-sm transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <Label 
                    htmlFor="image" 
                    className="flex flex-col items-center justify-center h-28 w-full rounded-[12px] border-2 border-dashed border-border/60 hover:border-border hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <ImageIcon className="h-6 w-6 text-muted-foreground mb-2" />
                    <span className="text-sm font-medium text-muted-foreground">Click to upload image</span>
                    <Input
                      id="image"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </Label>
                )}
              </div>
              
              {uploadError && (
                <div className="p-3 rounded-[10px] bg-destructive/10 text-destructive text-sm font-medium">
                  {uploadError}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={addBug} disabled={saving || !form.title.trim()} className="rounded-[10px]">
                {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Save Issue
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          {/* skeleton stat cards */}
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="apple-card px-4 py-3 animate-stagger-item" style={{ '--i': i } as React.CSSProperties}>
                <div className="skeleton h-3 w-16 mb-2" />
                <div className="skeleton h-7 w-10" />
              </div>
            ))}
          </div>
          {/* skeleton list rows */}
          <div className="apple-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border/50 bg-muted/20"><div className="skeleton h-4 w-20" /></div>
            <div className="divide-y divide-border/40">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-4 px-5 py-4 animate-stagger-item" style={{ '--i': i } as React.CSSProperties}>
                  <div className="skeleton h-9 w-9 rounded-[10px] shrink-0" />
                  <div className="flex-1 space-y-2 pt-0.5">
                    <div className="skeleton h-4 w-2/3" />
                    <div className="skeleton h-3 w-5/6" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Todo", count: todo, color: "text-foreground" },
              { label: "In Progress", count: inProgress, color: "text-blue-500" },
              { label: "Done", count: done, color: "text-emerald-500" },
            ].map((s, i) => (
              <div key={s.label} className="apple-card px-4 py-3 animate-stagger-item" style={{ '--i': i } as React.CSSProperties}>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">{s.label}</p>
                <p className={`text-2xl font-bold tracking-tight mt-1 ${s.color}`}>{s.count}</p>
              </div>
            ))}
          </div>

          <div className="apple-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border/50 bg-muted/20">
              <h2 className="text-[13px] font-semibold text-foreground">All Issues</h2>
            </div>
            
            {bugs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
                <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
                  <Bug className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">No bugs reported</p>
                <p className="text-xs text-muted-foreground">Click 'Report Issue' to add the first trackable item.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {bugs.map(bug => {
                  const conf = StatusConfig[bug.status] ?? StatusConfig.unstarted
                  const Icon = conf.icon
                  
                  return (
                    <div key={bug.id}
                      onClick={() => setSelectedBug(bug)}
                      className="group flex gap-4 px-5 py-4 hover:bg-muted/30 transition-colors cursor-pointer animate-stagger-item"
                      style={{ '--i': bugs.indexOf(bug) } as React.CSSProperties}
                    >
                      {/* Status indicator */}
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${conf.bg}`}>
                        <Icon className={`h-4 w-4 ${conf.color}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pt-0.5 space-y-1">
                        <div className="flex items-start justify-between gap-4">
                          <p className={`text-[14px] font-medium leading-tight ${bug.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                            {bug.title}
                          </p>
                          <span className="text-[11px] text-muted-foreground shrink-0 whitespace-nowrap">
                            {formatDistanceToNow(new Date(bug.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        {bug.description && (
                          <p className="text-[13px] text-muted-foreground line-clamp-2 leading-snug">
                            {bug.description}
                          </p>
                        )}
                        {(bug.reporter_name || bug.reporter_email) && (
                          <div className="text-[12px] text-muted-foreground pt-0.5 font-medium">
                            Reporter: <span className="text-foreground/80">{bug.reporter_name || "Anonymous"}</span> {bug.reporter_email ? `(${bug.reporter_email})` : ""}
                          </div>
                        )}
                        {bug.image_url && (
                          <div className="pt-2">
                            <img src={bug.image_url} alt="Bug screenshot" className="rounded-[8px] max-h-32 object-contain border border-border bg-muted/30" />
                          </div>
                        )}
                        <div className="flex items-center gap-2 pt-1.5">
                          <span className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${conf.bg} ${conf.color}`}>
                            {conf.label}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex shrink-0 items-start">
                        <DropdownMenu>
                          <DropdownMenuTrigger onClick={(e) => e.stopPropagation()} render={
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[8px] opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity -mr-2">
                              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          } />
                          <DropdownMenuContent align="end" className="w-[160px] rounded-[10px]" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={() => updateStatus(bug.id, "unstarted")} disabled={bug.status === "unstarted"}>
                              <Circle className="mr-2 h-4 w-4" /> Todo
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(bug.id, "in_progress")} disabled={bug.status === "in_progress"}>
                              <Clock className="mr-2 h-4 w-4" /> In Progress
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(bug.id, "done")} disabled={bug.status === "done"}>
                              <CheckCircle2 className="mr-2 h-4 w-4" /> Done
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => deleteBug(bug.id)} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" /> Delete Issue
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Notion-style Detail Modal */}
      {selectedBug && (
        <Dialog open={!!selectedBug} onOpenChange={(open) => {
          if (!open) setSelectedBug(null)
          // Also update the selected bug reference if it changed in the background
          if (open && selectedBug) {
            const current = bugs.find(b => b.id === selectedBug.id)
            if (current) setSelectedBug(current)
          }
        }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto px-10 py-12">
            <div className="space-y-8">
              {/* Header */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger render={
                      <Button variant="outline" className={`h-8 rounded-[8px] px-3 text-xs font-semibold uppercase tracking-wider ${StatusConfig[selectedBug.status].color} ${StatusConfig[selectedBug.status].bg} border-transparent hover:brightness-95`}>
                        {StatusConfig[selectedBug.status].label}
                      </Button>
                    } />
                    <DropdownMenuContent align="start" className="w-[160px] rounded-[10px]">
                      <DropdownMenuItem onClick={() => { updateStatus(selectedBug.id, "unstarted"); setSelectedBug({ ...selectedBug, status: "unstarted" }); }}>
                        <Circle className="mr-2 h-4 w-4" /> Todo
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { updateStatus(selectedBug.id, "in_progress"); setSelectedBug({ ...selectedBug, status: "in_progress" }); }}>
                        <Clock className="mr-2 h-4 w-4" /> In Progress
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { updateStatus(selectedBug.id, "done"); setSelectedBug({ ...selectedBug, status: "done" }); }}>
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Done
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <span className="text-xs text-muted-foreground font-medium">
                    Reported by <span className="text-foreground">{selectedBug.reporter_name || "Anonymous"}</span> {selectedBug.reporter_email ? `(${selectedBug.reporter_email})` : ""} • {formatDistanceToNow(new Date(selectedBug.created_at), { addSuffix: true })}
                  </span>
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-foreground leading-tight">
                  {selectedBug.title}
                </h2>
              </div>

              {/* Description */}
              {selectedBug.description && (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="text-[15px] leading-relaxed text-foreground whitespace-pre-wrap">
                    {selectedBug.description}
                  </p>
                </div>
              )}

              {/* Image */}
              {selectedBug.image_url && (
                <div className="rounded-[12px] border border-border/50 bg-muted/20 overflow-hidden">
                  <img src={selectedBug.image_url} alt="Bug attachment" className="w-full h-auto object-contain max-h-[500px]" />
                </div>
              )}

            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
