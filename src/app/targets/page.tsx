"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRealtimeData } from "@/hooks/use-realtime-data"
import type { Tables } from "@/lib/supabase/types"
import { format, isValid } from "date-fns"
import {
  Target, Plus, Loader2, Trash2, Calendar,
  CheckCircle2, Circle, Pencil, PiggyBank, Wallet, X
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog"

type GoalTarget = Tables<"targets">
type WalletRow = Tables<"wallets">

export default function TargetsPage() {
  const supabase = createClient()
  const { data: targets, loading, setData: setTargets } = useRealtimeData<GoalTarget>("targets", "created_at", false)

  // ── Wallets (for deposit linking) ────────────────────────────────────────
  const [wallets, setWallets] = useState<WalletRow[]>([])
  useEffect(() => {
    const loadWallets = async () => {
      const { data } = await supabase.from("wallets").select("*").order("name")
      if (data) setWallets(data)
    }
    loadWallets()
  }, [])

  // ── Create / Edit modal state ─────────────────────────────────────────────
  const [isOpen, setIsOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [editTarget, setEditTarget] = useState<GoalTarget | null>(null)
  const [form, setForm] = useState({
    title: "",
    description: "",
    target_date: "",
    target_amount: "",
    is_financial: true,
  })

  // ── Deposit modal state ───────────────────────────────────────────────────
  const [depositOpen, setDepositOpen] = useState(false)
  const [depositTarget, setDepositTarget] = useState<GoalTarget | null>(null)
  const [depositForm, setDepositForm] = useState({
    amount: "",
    useWallet: false,
    walletId: "",
    note: ""
  })
  const [depositing, setDepositing] = useState(false)

  // ── Helpers ───────────────────────────────────────────────────────────────
  const formatNumber = (val: string) => {
    const numericOnly = val.replace(/[^0-9]/g, "")
    if (!numericOnly) return ""
    return new Intl.NumberFormat("id-ID").format(parseInt(numericOnly, 10))
  }

  const parseFormatted = (val: string) =>
    val ? parseFloat(val.replace(/\./g, "").replace(/,/g, "")) : 0

  // ── Open create modal ─────────────────────────────────────────────────────
  const openCreate = () => {
    setIsEdit(false)
    setEditTarget(null)
    setForm({ title: "", description: "", target_date: "", target_amount: "", is_financial: true })
    setIsOpen(true)
  }

  // ── Open edit modal ───────────────────────────────────────────────────────
  const openEdit = (target: GoalTarget) => {
    setIsEdit(true)
    setEditTarget(target)
    setForm({
      title: target.title,
      description: target.description || "",
      target_date: target.target_date || "",
      target_amount: target.target_amount ? formatNumber(target.target_amount.toString()) : "",
      is_financial: target.is_financial ?? true,
    })
    setIsOpen(true)
  }

  // ── Open deposit modal ────────────────────────────────────────────────────
  const openDeposit = (target: GoalTarget) => {
    setDepositTarget(target)
    setDepositForm({ amount: "", useWallet: false, walletId: "", note: "" })
    setDepositOpen(true)
  }

  // ── Save target (create / update) ─────────────────────────────────────────
  const handleSave = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const targetAmount = parseFormatted(form.target_amount) || null
    const payload = {
      profile_id: user.id,
      title: form.title.trim(),
      description: form.description.trim() || null,
      target_date: form.target_date || null,
      target_amount: targetAmount,
      is_financial: form.is_financial,
    }

    if (isEdit && editTarget) {
      const { data, error } = await supabase
        .from("targets").update(payload).eq("id", editTarget.id).select().single()
      if (!error && data) {
        setTargets(prev => prev.map(t => t.id === editTarget.id ? { ...t, ...data } : t))
        setIsOpen(false)
      }
    } else {
      const { data, error } = await supabase
        .from("targets").insert({ ...payload, current_amount: 0, status: "in_progress" }).select().single()
      if (!error && data) {
        setTargets(prev => [data, ...prev])
        setIsOpen(false)
      }
    }
    setSaving(false)
  }

  const handleDeposit = async () => {
    if (!depositTarget || !depositForm.amount) return
    setDepositing(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setDepositing(false); return }

    const depositAmt = parseFormatted(depositForm.amount)
    const newCurrent = Number(depositTarget.current_amount || 0) + depositAmt
    const targetAmt = Number(depositTarget.target_amount || 0)
    const newStatus = targetAmt > 0 && newCurrent >= targetAmt ? "achieved" : "in_progress"

    // 1. Update the target
    const { data: updatedTarget, error: targetError } = await supabase
      .from("targets")
      .update({ current_amount: newCurrent, status: newStatus })
      .eq("id", depositTarget.id)
      .select()
      .single()

    if (targetError) { setDepositing(false); return }

    // 2. If user chose to deduct from wallet, create an expense transaction
    if (depositTarget.is_financial !== false && depositForm.useWallet && depositForm.walletId) {
      const wallet = wallets.find(w => w.id === depositForm.walletId)
      if (wallet) {
        // Create expense transaction
        await supabase.from("transactions").insert({
          profile_id: user.id,
          wallet_id: depositForm.walletId,
          amount: depositAmt,
          type: "expense",
          category: "Savings / Target",
          date: new Date().toISOString().slice(0, 10),
          description: depositForm.note || `Tabungan: ${depositTarget.title}`
        })

        // Deduct wallet balance
        await supabase
          .from("wallets")
          .update({ balance: (wallet.balance || 0) - depositAmt })
          .eq("id", depositForm.walletId)

        // Update local wallets state
        setWallets(prev => prev.map(w =>
          w.id === depositForm.walletId
            ? { ...w, balance: (w.balance || 0) - depositAmt }
            : w
        ))
      }
    }

    if (updatedTarget) {
      setTargets(prev => prev.map(t => t.id === depositTarget.id ? updatedTarget : t))
    }

    setDepositOpen(false)
    setDepositing(false)
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm("Hapus target ini?")) return
    setTargets(prev => prev.filter(t => t.id !== id))
    await supabase.from("targets").delete().eq("id", id)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">My Targets</h1>
          <p className="text-sm text-muted-foreground">Track your life goals and savings progress.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger render={
            <Button onClick={openCreate} className="rounded-[10px] shadow-sm whitespace-nowrap">
              <Plus className="h-4 w-4 mr-1.5" /> New Target
            </Button>
          } />
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{isEdit ? "Edit Target" : "Buat Target Baru"}</DialogTitle>
              <DialogDescription>{isEdit ? "Perbarui detail target Anda." : "Tentukan apa yang ingin Anda capai."}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground tracking-widest">Nama Target</label>
                <Input placeholder="e.g. Modal Nikah, Beli Rumah..." value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="rounded-[10px]" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground tracking-widest">Deskripsi</label>
                <Textarea placeholder="Kenapa ini penting bagimu?..." value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="rounded-[10px] resize-none h-20" />
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="isFinancialToggle" checked={form.is_financial} onChange={e => setForm(f => ({ ...f, is_financial: e.target.checked }))} className="rounded accent-primary h-4 w-4" />
                  <label htmlFor="isFinancialToggle" className="text-sm font-medium cursor-pointer select-none">Ini adalah target berbentuk uang (finansial)</label>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase text-muted-foreground tracking-widest">Target Tanggal</label>
                  <Input type="date" value={form.target_date}
                    onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))} className="rounded-[10px]" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase text-muted-foreground tracking-widest">{form.is_financial ? "Target Nominal (Rp)" : "Target Angka"}</label>
                  <Input type="text" inputMode="numeric" placeholder={form.is_financial ? "Opsional (e.g. 50.000.000)" : "Opsional (e.g. 1.000)"}
                    value={form.target_amount}
                    onChange={e => setForm(f => ({ ...f, target_amount: formatNumber(e.target.value) }))}
                    className="rounded-[10px]" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSave} disabled={saving || !form.title.trim()} className="rounded-[10px]">
                {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                {isEdit ? "Simpan Perubahan" : "Buat Target"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Deposit Modal */}
      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PiggyBank className="h-5 w-5 text-emerald-500" />
              {depositTarget?.is_financial !== false ? "Tambah Tabungan" : "Update Progress"}
            </DialogTitle>
            <DialogDescription>
              {depositTarget?.is_financial !== false ? "Tambahkan uang yang sudah kamu tabung untuk" : "Catat progress baru untuk pencapaian"} <span className="font-semibold text-foreground">{depositTarget?.title}</span>.
            </DialogDescription>
          </DialogHeader>

          {depositTarget && (
            <div className="space-y-4 py-2">
              {/* Progress info */}
              {depositTarget.target_amount && Number(depositTarget.target_amount) > 0 && (
                <div className="rounded-xl bg-muted p-3 space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-muted-foreground">Terkumpul</span>
                    <span className="text-foreground">
                      {depositTarget.is_financial !== false ? "Rp " : ""}
                      {Number(depositTarget.current_amount || 0).toLocaleString("id-ID")} / {depositTarget.is_financial !== false ? "Rp " : ""}
                      {Number(depositTarget.target_amount).toLocaleString("id-ID")}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, (Number(depositTarget.current_amount || 0) / Number(depositTarget.target_amount)) * 100)}%` }} />
                  </div>
                </div>
              )}

              {/* Amount input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-muted-foreground tracking-widest">{depositTarget?.is_financial !== false ? "Jumlah Tabungan (Rp)" : "Jumlah Penambahan Progress"}</label>
                <Input type="text" inputMode="numeric" placeholder={depositTarget?.is_financial !== false ? "e.g. 500.000" : "e.g. 10"}
                  value={depositForm.amount}
                  onChange={e => setDepositForm(f => ({ ...f, amount: formatNumber(e.target.value) }))}
                  className="rounded-[10px] text-lg font-semibold" />
              </div>

              {/* Wallet option */}
              {depositTarget?.is_financial !== false && (
                <div className="space-y-3 pt-2 border-t border-border/50">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDepositForm(f => ({ ...f, useWallet: !f.useWallet, walletId: "" }))}
                    className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${depositForm.useWallet ? "bg-primary border-primary" : "border-border"}`}
                  >
                    {depositForm.useWallet && <span className="text-primary-foreground text-[10px] font-bold">✓</span>}
                  </button>
                  <label className="text-sm font-medium cursor-pointer" onClick={() => setDepositForm(f => ({ ...f, useWallet: !f.useWallet, walletId: "" }))}>
                    Potong dari rekening Money Tracker
                  </label>
                </div>

                {depositForm.useWallet && (
                  <div className="space-y-2 pl-7">
                    <label className="text-xs font-semibold uppercase text-muted-foreground tracking-widest">Pilih Rekening</label>
                    <div className="grid grid-cols-1 gap-2">
                      {wallets.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Belum ada rekening di Money Tracker.</p>
                      ) : wallets.map(wallet => (
                        <button
                          key={wallet.id}
                          type="button"
                          onClick={() => setDepositForm(f => ({ ...f, walletId: wallet.id }))}
                          className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                            depositForm.walletId === wallet.id
                              ? "border-primary bg-primary/5 dark:bg-primary/10"
                              : "border-border hover:border-primary/50 hover:bg-muted/50"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Wallet className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{wallet.name}</span>
                          </div>
                          <span className="text-xs font-semibold text-muted-foreground">
                            Rp {Number(wallet.balance || 0).toLocaleString("id-ID")}
                          </span>
                        </button>
                      ))}
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <label className="text-xs font-semibold uppercase text-muted-foreground tracking-widest">Keterangan (opsional)</label>
                      <Input placeholder="Deskripsi transaksi..." value={depositForm.note}
                        onChange={e => setDepositForm(f => ({ ...f, note: e.target.value }))}
                        className="rounded-[10px]" />
                    </div>
                  </div>
                )}
              </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDepositOpen(false)} className="rounded-[10px]">Batal</Button>
            <Button
              onClick={handleDeposit}
              disabled={depositing || !depositForm.amount || (depositForm.useWallet && !depositForm.walletId)}
              className="rounded-[10px] bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {depositing && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Tambah Tabungan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : targets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
          <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
            <Target className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">Belum ada target</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[250px]">Mulai tuliskan target hidupmu dan pantau progresnya.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {targets.map(target => {
            const isAchieved = target.status === "achieved"
            const hasAmount = !!target.target_amount && Number(target.target_amount) > 0
            const current = Number(target.current_amount || 0)
            const goal = Number(target.target_amount || 1)
            const percentage = hasAmount ? Math.min(100, Math.round((current / goal) * 100)) : 0
            const validDate = target.target_date ? new Date(target.target_date) : null
            const isDateValid = validDate && isValid(validDate)
            const isFinancial = target.is_financial !== false

            return (
              <div key={target.id}
                className={`apple-card p-5 group relative flex flex-col gap-3 overflow-hidden transition-all ${isAchieved ? "opacity-70" : ""}`}
              >
                {/* Badge + Title */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className={`text-[10px] font-bold uppercase tracking-widest mb-1 block ${isFinancial ? "text-emerald-500" : "text-blue-500"}`}>
                      {isAchieved ? "✓ Tercapai" : isFinancial ? "Financial Goal" : "Target Achievement"}
                    </span>
                    <h3 className={`font-semibold text-base leading-tight text-foreground truncate ${isAchieved ? "line-through opacity-60" : ""}`}>
                      {target.title}
                    </h3>
                  </div>
                </div>

                {target.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{target.description}</p>
                )}

                {/* Progress bar */}
                {hasAmount && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] font-medium">
                      <span>{isFinancial ? "Rp " : ""}{current.toLocaleString("id-ID")}</span>
                      <span className="text-muted-foreground">{isFinancial ? "Rp " : ""}{goal.toLocaleString("id-ID")}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${percentage >= 100 ? "bg-emerald-500" : "bg-primary"}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="text-right text-[10px] font-bold text-muted-foreground">{percentage}%</div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-border/40 mt-auto">
                  {isDateValid ? (
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{format(validDate, "d MMM yyyy")}</span>
                    </div>
                  ) : (
                    <span className="text-[11px] italic text-muted-foreground/40">No deadline</span>
                  )}

                  <div className="flex items-center gap-1">
                    {/* Deposit button (only for goals that are not achieved) */}
                    {hasAmount && !isAchieved && (
                      <Button variant="ghost" size="icon"
                        onClick={(e) => { e.stopPropagation(); openDeposit(target) }}
                        className="h-7 w-7 rounded-[8px] text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                        title="Update Progress"
                      >
                        <PiggyBank className="h-4 w-4" />
                      </Button>
                    )}
                    {/* Edit */}
                    <Button variant="ghost" size="icon"
                      onClick={(e) => { e.stopPropagation(); openEdit(target) }}
                      className="h-7 w-7 rounded-[8px] text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-all"
                      title="Edit Target"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {/* Delete */}
                    <Button variant="ghost" size="icon"
                      onClick={(e) => handleDelete(target.id, e)}
                      className="h-7 w-7 rounded-[8px] text-destructive/40 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                      title="Hapus Target"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
