"use client"

import { useState } from "react"
import { X, Building2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

type Workspace = {
  id: string
  name: string
  owner_id: string
  created_at: string
  myRole: string
}

interface CreateWorkspaceModalProps {
  onClose: () => void
  onCreated: (ws: Workspace) => void
}

export function CreateWorkspaceModal({ onClose, onCreated }: CreateWorkspaceModalProps) {
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleCreate = async () => {
    const trimmed = name.trim()
    if (!trimmed) { setError("Workspace name is required"); return }

    setLoading(true)
    setError("")

    const res = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    })
    const json = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(json.error ?? "Failed to create workspace")
      return
    }

    onCreated(json.workspace)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-background shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold">New Workspace</h2>
              <p className="text-xs text-muted-foreground">Give your team a home</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Workspace Name
            </label>
            <input
              autoFocus
              type="text"
              placeholder="e.g. Content Team, Side Project…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="w-full rounded-[10px] border border-border bg-secondary/50 px-3 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-[10px] px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 pb-5">
          <Button variant="ghost" size="sm" onClick={onClose} className="rounded-[10px]">Cancel</Button>
          <Button size="sm" onClick={handleCreate} disabled={loading} className="rounded-[10px] gap-2">
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Create Workspace
          </Button>
        </div>
      </div>
    </div>
  )
}
