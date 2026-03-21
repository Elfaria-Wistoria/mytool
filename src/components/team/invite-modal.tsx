"use client"

import { useState } from "react"
import { X, Link2, Copy, Check, Loader2, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"

interface InviteModalProps {
  workspaceId: string
  workspaceName: string
  onClose: () => void
}

export function InviteModal({ workspaceId, workspaceName, onClose }: InviteModalProps) {
  const [email, setEmail] = useState("")
  const [inviteLink, setInviteLink] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    setError("")
    setInviteLink("")

    const res = await fetch("/api/workspace/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, email: email || undefined }),
    })
    const json = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(json.error ?? "Failed to create invite")
      return
    }
    setInviteLink(json.inviteLink)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Link2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold">Invite to {workspaceName}</h2>
              <p className="text-xs text-muted-foreground">Share a link or invite by email</p>
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
        <div className="px-6 py-5 space-y-4">
          {/* Email input (optional) */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Email (optional)
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                placeholder="friend@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-[10px] border border-border bg-secondary/50 px-3 py-2.5 pl-9 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Leave blank to generate a link anyone can use.
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-[10px] px-3 py-2">
              {error}
            </p>
          )}

          {/* Generated link */}
          {inviteLink && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Invite Link
              </label>
              <div className="flex items-center gap-2 rounded-[10px] border border-primary/30 bg-primary/5 px-3 py-2.5">
                <p className="flex-1 text-xs font-mono text-foreground truncate">{inviteLink}</p>
                <button
                  onClick={handleCopy}
                  className="shrink-0 text-primary hover:text-primary/80 transition-colors"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                This link expires in 7 days. Share it with your teammate.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 pb-5">
          <Button variant="ghost" size="sm" onClick={onClose} className="rounded-[10px]">
            {inviteLink ? "Close" : "Cancel"}
          </Button>
          {!inviteLink && (
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={loading}
              className="rounded-[10px] gap-2"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Generate Invite Link
            </Button>
          )}
          {inviteLink && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerate}
              disabled={loading}
              className="rounded-[10px] gap-2"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Generate New Link
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
