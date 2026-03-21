"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRealtimeData } from "@/hooks/use-realtime-data"
import type { Tables } from "@/lib/supabase/types"
import { format, formatDistanceToNow } from "date-fns"
import { Book, Plus, Loader2, Trash2, Calendar, FileText, MoreHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"

type JournalEntry = Tables<"journal_entries">

export default function JournalingPage() {
  const supabase = createClient()
  const { data: entries, loading, setData: setEntries } = useRealtimeData<JournalEntry>("journal_entries", "created_at", false)
  const [isOpen, setIsOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: "", content: "" })
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null)

  const handleSave = async () => {
    if (!form.title.trim() && !form.content.trim()) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const { data, error } = await supabase
      .from("journal_entries")
      .insert({
        profile_id: user.id,
        title: form.title.trim() || format(new Date(), "PPpp"), // default title if empty
        content: form.content.trim() || null,
      })
      .select()
      .single()

    if (!error && data) {
      // Optimistic update
      setEntries(prev => [data, ...prev])
      setIsOpen(false)
      setForm({ title: "", content: "" })
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this journal entry?")) return
    setEntries(prev => prev.filter(e => e.id !== id))
    await supabase.from("journal_entries").delete().eq("id", id)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight leading-tight">Daily Journal</h1>
          <p className="text-sm text-muted-foreground">Document your thoughts, evaluate your daily steps, and track your habits.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger render={
            <Button className="rounded-[10px] shadow-sm whitespace-nowrap">
              <Plus className="h-4 w-4 mr-1.5" /> New Entry
            </Button>
          } />
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Write a Journal Entry</DialogTitle>
              <DialogDescription>What's on your mind today? Evaluate your day.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-3">
              <div className="space-y-1.5">
                <Input
                  placeholder="Entry Title (Optional)"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="rounded-[10px] text-lg font-medium border-transparent bg-muted/30 focus-visible:bg-background focus-visible:ring-1"
                />
              </div>
              <div className="space-y-1.5">
                <Textarea
                  placeholder="Write your reflections here..."
                  value={form.content}
                  onChange={(e) => setForm(f => ({ ...f, content: e.target.value }))}
                  className="rounded-[10px] min-h-[300px] resize-y border-transparent bg-muted/30 focus-visible:bg-background focus-visible:ring-1 text-base leading-relaxed p-4"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSave} disabled={saving || (!form.title.trim() && !form.content.trim())} className="rounded-[10px]">
                {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Save Entry
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                <Book className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">No journal entries yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[250px]">Start reflecting on your daily progress by writing your first entry.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {entries.map(entry => (
                <div 
                  key={entry.id}
                  onClick={() => setSelectedEntry(entry)}
                  className="group relative flex flex-col gap-3 rounded-2xl border border-border/50 bg-background p-5 shadow-sm hover:shadow-md hover:border-border transition-all cursor-pointer overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-[15px] leading-tight text-foreground line-clamp-1">
                      {entry.title}
                    </h3>
                    <DropdownMenu>
                      <DropdownMenuTrigger onClick={e => e.stopPropagation()} render={
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-[8px] opacity-0 group-hover:opacity-100 transition-opacity -mr-1 -mt-1 shrink-0">
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      } />
                      <DropdownMenuContent align="end" className="w-[160px] rounded-[10px]" onClick={e => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => handleDelete(entry.id)} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                      {entry.content || <span className="italic opacity-50">No content</span>}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2 pt-2 border-t border-border/40 text-[11px] font-medium text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <time dateTime={entry.created_at}>{format(new Date(entry.created_at), "MMM d, yyyy • h:mm a")}</time>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reader Modal */}
      {selectedEntry && (
        <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && setSelectedEntry(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto px-6 py-8 sm:px-10 sm:py-10">
            <div className="space-y-6">
              <div className="space-y-3 border-b border-border/40 pb-6">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest font-semibold px-2 py-1 rounded-[6px] bg-muted/50">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(selectedEntry.created_at), "EEEE, MMMM do yyyy • h:mm a")}
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-tight">
                  {selectedEntry.title}
                </h2>
              </div>
              <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none pb-4">
                <p className="whitespace-pre-wrap leading-loose text-muted-foreground">
                  {selectedEntry.content || "Empty journal."}
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
