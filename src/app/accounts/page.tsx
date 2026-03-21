"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Instagram, Youtube, Twitter, Video, Plus, Trash2, Loader2, AtSign } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/types"

type Account = Tables<"accounts">

const platformMeta: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  Instagram: { icon: Instagram, color: "text-pink-500",    bg: "bg-pink-50 dark:bg-pink-950/40" },
  TikTok:    { icon: Video,      color: "text-foreground",  bg: "bg-secondary" },
  YouTube:   { icon: Youtube,    color: "text-red-500",    bg: "bg-red-50 dark:bg-red-950/40" },
  X:         { icon: Twitter,    color: "text-sky-500",    bg: "bg-sky-50 dark:bg-sky-950/40" },
  Threads:   { icon: AtSign,     color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-950/40" },
}

import { useRealtimeData } from "@/hooks/use-realtime-data"

export default function AccountsPage() {
  const supabase = createClient()
  const [isOpen, setIsOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ handle: "", platform: "Instagram" })

  const { data: accounts, loading, setData: setAccounts } = useRealtimeData<Account>("accounts", "created_at", true)

  const handleAdd = async () => {
    if (!form.handle.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      // No auth: still allow local demo usage by inserting without RLS constraints
      // In production you'd redirect to login
      setSaving(false)
      return
    }

    const { data, error } = await supabase
      .from("accounts")
      .insert({ profile_id: user.id, platform: form.platform, handle: form.handle.trim() })
      .select()
      .single()

    if (!error && data) {
      setAccounts(prev => [...prev, data])
      setIsOpen(false)
      setForm({ handle: "", platform: "Instagram" })
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("accounts").delete().eq("id", id)
    if (!error) setAccounts(prev => prev.filter(a => a.id !== id))
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Heading row */}
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
          <p className="text-sm text-muted-foreground">Manage your connected social media accounts.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger render={<Button className="rounded-[10px] shadow-sm" />}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Account
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Account</DialogTitle>
              <DialogDescription>Add a social media account to your dashboard.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="handle" className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Handle / Name</Label>
                <Input
                  id="handle"
                  placeholder="e.g. @yourhandle"
                  value={form.handle}
                  onChange={e => setForm(f => ({ ...f, handle: e.target.value }))}
                  className="rounded-[10px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Platform</Label>
                <Select value={form.platform} onValueChange={val => setForm(f => ({ ...f, platform: val || "Instagram" }))}>
                  <SelectTrigger className="rounded-[10px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Instagram">Instagram</SelectItem>
                    <SelectItem value="TikTok">TikTok</SelectItem>
                    <SelectItem value="YouTube">YouTube</SelectItem>
                    <SelectItem value="X">X (Twitter)</SelectItem>
                    <SelectItem value="Threads">Threads</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAdd} disabled={saving} className="rounded-[10px]">
                {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                Save Account
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Account list */}
      <div className="apple-card divide-y divide-border/50 overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && accounts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
              <Plus className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No accounts yet</p>
            <p className="text-xs text-muted-foreground mt-1">Click 'Add Account' to get started.</p>
          </div>
        )}
        {accounts.map((account) => {
          const meta = platformMeta[account.platform] ?? { icon: Video, color: "text-foreground", bg: "bg-secondary" }
          const Icon = meta.icon
          return (
            <div key={account.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors">
              <div className={`flex h-10 w-10 items-center justify-center rounded-[10px] shrink-0 ${meta.bg}`}>
                <Icon className={`h-4 w-4 ${meta.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-foreground leading-none">{account.handle}</p>
                <p className="text-[12px] text-muted-foreground mt-1">{account.platform}</p>
              </div>
              <button
                onClick={() => handleDelete(account.id)}
                className="flex h-8 w-8 items-center justify-center rounded-[8px] text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors"
                aria-label="Delete account"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>

      {!loading && (
        <p className="text-center text-[11px] text-muted-foreground">
          {accounts.length} account{accounts.length !== 1 ? "s" : ""} connected
        </p>
      )}
    </div>
  )
}
