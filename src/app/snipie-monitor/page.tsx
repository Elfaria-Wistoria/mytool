"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
  Users, Bug, Megaphone, Wallet, RefreshCw, ExternalLink,
  CheckCircle2, Clock, XCircle, Circle, AlertTriangle,
  TrendingUp, ChevronDown, Loader2, Activity, Shield,
} from "lucide-react"
import {
  snipieClient,
  type CreatorApplication,
  type BugReport,
  type PromotionSubmission,
  type WithdrawalRequest,
  type SnipieUser,
  type ActivationCode,
} from "@/lib/supabase/snipie-client"
import { formatDistanceToNow, format } from "date-fns"
import { id } from "date-fns/locale"
import { toast } from "sonner"

// ─── Helpers ──────────────────────────────────────────────────────────────────
const idr = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n)

const timeAgo = (d: string | null) =>
  d ? formatDistanceToNow(new Date(d), { addSuffix: true, locale: id }) : "—"

const fmtDate = (d: string | null) =>
  d ? format(new Date(d), "dd MMM yyyy, HH:mm", { locale: id }) : "—"

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; icon: React.ElementType; pill: string; dot: string }> = {
  pending:  { label: "Pending",  icon: Clock,        pill: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400",   dot: "bg-amber-400" },
  approved: { label: "Disetujui", icon: CheckCircle2, pill: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400", dot: "bg-emerald-400" },
  rejected: { label: "Ditolak",  icon: XCircle,      pill: "bg-red-100 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400",             dot: "bg-red-400" },
  paid:     { label: "Dibayar",  icon: CheckCircle2, pill: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",        dot: "bg-blue-400" },
}

// ─── StatusDropdown ───────────────────────────────────────────────────────────
function StatusDropdown({ status, options, onChange }: {
  status: string | null; options: string[]; onChange: (s: string) => Promise<void>
}) {
  const s = status ?? "pending"
  const cfg = STATUS_MAP[s] ?? { label: s, icon: Circle, pill: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground" }
  const Icon = cfg.icon
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const btnRef = React.useRef<HTMLButtonElement>(null)

  const handleOpen = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 6, right: window.innerWidth - r.right })
    }
    setOpen(o => !o)
  }

  const pick = async (val: string) => {
    setOpen(false); setBusy(true)
    await onChange(val)
    setBusy(false)
  }

  return (
    <div>
      <button
        ref={btnRef}
        onClick={handleOpen}
        disabled={busy}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all hover:opacity-80 disabled:opacity-50 ${cfg.pill}`}
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
        {cfg.label}
        <ChevronDown className="h-2.5 w-2.5 opacity-60" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 min-w-[140px] rounded-[12px] border border-border bg-background shadow-xl overflow-hidden py-1"
            style={{ top: pos.top, right: pos.right }}
          >
            {options.map(opt => {
              const c = STATUS_MAP[opt] ?? { label: opt, icon: Circle, dot: "" }
              const Ic = c.icon
              return (
                <button key={opt} onClick={() => pick(opt)} disabled={s === opt}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-[12px] font-medium hover:bg-muted transition-colors disabled:opacity-40">
                  <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                  <Ic className="h-3.5 w-3.5" /> {c.label}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
const Avatar = ({ email }: { email: string }) => (
  <div className="h-10 w-10 rounded-full shrink-0 flex items-center justify-center text-[14px] font-bold uppercase text-white select-none ring-2 ring-white/20 shadow-sm"
    style={{ background: `hsl(${(email.charCodeAt(0) * 37) % 360} 55% 48%)` }}>
    {email.charAt(0)}
  </div>
)

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ icon: Icon, title, count, accent, children }: {
  icon: React.ElementType; title: string; count: number; accent: string; children: React.ReactNode
}) {
  return (
    <div className="apple-card overflow-hidden">
      <div className={`flex items-center justify-between px-5 py-4 border-b border-border/50 ${accent}/5`}>
        <div className="flex items-center gap-3">
          <div className={`flex h-8 w-8 items-center justify-center rounded-[10px] ${accent}/10`}>
            <Icon className={`h-4 w-4 ${accent.replace("bg-", "text-")}`} />
          </div>
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        </div>
        <span className="min-w-[28px] text-center text-[11px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{count}</span>
      </div>
      {children}
    </div>
  )
}

const Empty = ({ label }: { label: string }) => (
  <div className="flex flex-col items-center py-12 gap-2 text-center">
    <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
      <Circle className="h-5 w-5 text-muted-foreground/50" />
    </div>
    <p className="text-sm text-muted-foreground">Belum ada {label}</p>
  </div>
)

const Skel = () => (
  <div className="flex gap-3 px-5 py-4 border-b border-border/40 last:border-0">
    <div className="skeleton h-10 w-10 rounded-full shrink-0" />
    <div className="flex-1 space-y-2 pt-1.5">
      <div className="skeleton h-3 w-2/5" /><div className="skeleton h-3 w-3/5" />
    </div>
    <div className="skeleton h-6 w-20 rounded-full self-center" />
  </div>
)

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function NorraclipMonitorPage() {
  const [creators, setCreators]       = useState<CreatorApplication[]>([])
  const [bugs, setBugs]               = useState<BugReport[]>([])
  const [promotions, setPromotions]   = useState<PromotionSubmission[]>([])
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([])
  const [users, setUsers]             = useState<SnipieUser[]>([])
  const [codes, setCodes]             = useState<ActivationCode[]>([])
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [tab, setTab] = useState<"all" | "creators" | "bugs" | "promos" | "withdrawals" | "users">("all")

  const fetchAll = useCallback(async (soft = false) => {
    soft ? setRefreshing(true) : setLoading(true)
    const [c, b, p, w, u, ac] = await Promise.all([
      snipieClient.from("creator_applications").select("*").order("created_at", { ascending: false }),
      snipieClient.from("bug_reports").select("*").order("created_at", { ascending: false }),
      snipieClient.from("promotion_submissions").select("*").order("created_at", { ascending: false }),
      snipieClient.from("withdrawal_requests").select("*").order("created_at", { ascending: false }),
      snipieClient.from("users").select("*").order("created_at", { ascending: false }),
      snipieClient.from("activation_codes").select("*").order("created_at", { ascending: false }),
    ])
    if (c.data) setCreators(c.data as CreatorApplication[])
    if (b.data) setBugs(b.data as BugReport[])
    if (p.data) setPromotions(p.data as PromotionSubmission[])
    if (w.data) setWithdrawals(w.data as WithdrawalRequest[])
    if (u.data) setUsers(u.data as SnipieUser[])
    if (ac.data) setCodes(ac.data as ActivationCode[])
    setLastRefresh(new Date())
    setLoading(false); setRefreshing(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const updateCreator    = async (id: string, status: string) => {
    const { error } = await snipieClient.from("creator_applications").update({ status }).eq("id", id)
    if (error) { toast.error("Gagal memperbarui"); return }
    setCreators(p => p.map(c => c.id === id ? { ...c, status } : c))
    toast.success(`Status creator: ${STATUS_MAP[status]?.label ?? status}`)
  }
  const updatePromo      = async (id: string, status: string) => {
    console.log("[updatePromo] id:", id, "status:", status)
    const { data, error } = await snipieClient
      .from("promotion_submissions")
      .update({ status })
      .eq("id", id)
      .select()
    console.log("[updatePromo] result:", { data, error })
    if (error) {
      toast.error(`Gagal: ${error.message ?? error.code ?? "Unknown"}`)
      return
    }
    setPromotions(p => p.map(x => x.id === id ? { ...x, status } : x))
    toast.success(`Status promosi: ${STATUS_MAP[status]?.label ?? status}`)
  }
  const updateWithdrawal = async (id: string, status: string) => {
    const { error } = await snipieClient.from("withdrawal_requests").update({ status }).eq("id", id)
    if (error) { toast.error("Gagal memperbarui"); return }
    setWithdrawals(p => p.map(w => w.id === id ? { ...w, status } : w))
    toast.success(`Status penarikan: ${STATUS_MAP[status]?.label ?? status}`)
  }

  // Stats
  const pendingC = creators.filter(c => c.status === "pending").length
  const pendingP = promotions.filter(p => p.status === "pending").length
  const pendingW = withdrawals.filter(w => w.status === "pending").length
  const totalPending  = pendingC + pendingP + pendingW
  const totalWithdraw = withdrawals.reduce((a, w) => a + (w.amount ?? 0), 0)
  const totalEarned   = creators.reduce((a, c) => a + (c.total_earned ?? 0), 0)
  const totalBalance  = creators.reduce((a, c) => a + (c.balance ?? 0), 0)
  const unusedCodes   = codes.filter(c => c.status === "unused").length
  const activatedUsers = users.filter(u => u.is_activated).length

  const TABS = [
    { key: "all",         label: "Semua" },
    { key: "creators",    label: `Creator${pendingC ? ` · ${pendingC}` : ""}` },
    { key: "bugs",        label: "Bug" },
    { key: "promos",      label: `Promosi${pendingP ? ` · ${pendingP}` : ""}` },
    { key: "withdrawals", label: `Penarikan${pendingW ? ` · ${pendingW}` : ""}` },
    { key: "users",       label: `Users (${users.length})` },
  ] as const

  const show = (k: string) => tab === "all" || tab === k

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="relative rounded-[16px] overflow-hidden bg-gradient-to-br from-violet-600 via-violet-500 to-indigo-600 p-6 text-white shadow-lg">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold tracking-wider backdrop-blur-sm">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE · norraclip.com
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Norraclip Monitoring</h1>
            <p className="text-sm text-white/70 mt-1">Kelola creator, laporan bug, promosi & penarikan dana.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-[11px] text-white/60">
              <p>Diperbarui</p>
              <p className="font-medium text-white/80">{timeAgo(lastRefresh.toISOString())}</p>
            </div>
            <button onClick={() => fetchAll(true)} disabled={refreshing || loading}
              className="flex items-center gap-1.5 rounded-[10px] bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/20 px-3 py-2 text-sm font-medium text-white transition-all disabled:opacity-50">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total Users",      value: users.length,       sub: `${activatedUsers} aktif`,   icon: Users,     color: "text-violet-500",  bg: "bg-violet-50 dark:bg-violet-950/40" },
          { label: "Kode Aktif (sisa)",value: unusedCodes,        sub: `${codes.length} total kode`, icon: Shield,    color: "text-indigo-500",  bg: "bg-indigo-50 dark:bg-indigo-950/40" },
          { label: "Laporan Bug",      value: bugs.length,        sub: "belum diselesaikan",          icon: Bug,       color: "text-red-500",     bg: "bg-red-50 dark:bg-red-950/40" },
          { label: "Total Penarikan",  value: idr(totalWithdraw), sub: `${pendingW} menunggu`,       icon: Wallet,    color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
          { label: "Total Earned",     value: idr(totalEarned),   sub: idr(totalBalance) + " saldo", icon: TrendingUp,color: "text-blue-500",    bg: "bg-blue-50 dark:bg-blue-950/40" },
        ].map((s, i) => (
          <div key={s.label} className="apple-card px-4 py-4 animate-stagger-item" style={{ "--i": i } as React.CSSProperties}>
            <div className={`flex h-9 w-9 items-center justify-center rounded-[10px] mb-3 ${s.bg}`}>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{s.label}</p>
            <p className={`text-lg font-bold tracking-tight mt-0.5 ${s.color} truncate`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Alert pending ───────────────────────────────────────────────────── */}
      {!loading && totalPending > 0 && (
        <div className="flex gap-3 rounded-[12px] border border-amber-200/70 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-950/20 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">{totalPending} item membutuhkan perhatian</p>
            <p className="text-[12px] text-amber-700/70 dark:text-amber-500">
              {pendingC > 0 && `${pendingC} creator · `}{pendingP > 0 && `${pendingP} promosi · `}{pendingW > 0 && `${pendingW} penarikan`}
            </p>
          </div>
        </div>
      )}

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 overflow-x-auto pb-px border-b border-border/50 scrollbar-none">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
            className={`px-4 py-2 text-[13px] font-medium whitespace-nowrap transition-all rounded-t-[6px] -mb-px border-b-2 ${
              tab === t.key
                ? "border-violet-500 text-violet-600 dark:text-violet-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-4">
          {[0,1,2].map(i => (
            <div key={i} className="apple-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border/50 bg-muted/20"><div className="skeleton h-4 w-36" /></div>
              <Skel /><Skel /><Skel />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-5">

          {/* Creator Applications */}
          {show("creators") && (
            <Section icon={Users} title="Creator Applications" count={creators.length} accent="bg-violet">
              {creators.length === 0 ? <Empty label="creator" /> : (
                <div className="divide-y divide-border/40">
                  {creators.map(c => (
                    <div key={c.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors group">
                      <Avatar email={c.email} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold truncate">{c.email}</p>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          {c.social_link && (
                            <a href={c.social_link} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-violet-500 hover:underline font-medium">
                              <ExternalLink className="h-3 w-3" /> Profil Social
                            </a>
                          )}
                          <span className="text-[11px] text-muted-foreground">{timeAgo(c.created_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="hidden sm:block text-right">
                          <p className="text-[10px] text-muted-foreground font-medium">Saldo</p>
                          <p className="text-[13px] font-bold text-foreground">{idr(c.balance ?? 0)}</p>
                        </div>
                        <div className="hidden sm:block text-right">
                          <p className="text-[10px] text-muted-foreground font-medium">Total Earned</p>
                          <p className="text-[13px] font-bold text-emerald-500">{idr(c.total_earned ?? 0)}</p>
                        </div>
                        <StatusDropdown status={c.status} options={["pending","approved","rejected"]}
                          onChange={s => updateCreator(c.id, s)} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* Bug Reports */}
          {show("bugs") && (
            <Section icon={Bug} title="Laporan Bug" count={bugs.length} accent="bg-red">
              {bugs.length === 0 ? <Empty label="laporan bug" /> : (
                <div className="divide-y divide-border/40">
                  {bugs.map(b => (
                    <div key={b.id} className="flex gap-4 px-5 py-4 hover:bg-muted/30 transition-colors group">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-red-50 dark:bg-red-950/40">
                        <Bug className="h-4 w-4 text-red-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-foreground leading-snug">{b.description}</p>
                        <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                          <Activity className="h-3 w-3" /> {fmtDate(b.created_at)}
                        </p>
                      </div>
                      {b.image_url && (
                        <a href={b.image_url} target="_blank" rel="noopener noreferrer" className="shrink-0 group/img">
                          <img src={b.image_url} alt="Bug"
                            className="h-16 w-24 object-cover rounded-[10px] border border-border bg-muted group-hover/img:opacity-90 transition-opacity" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* Promotion Submissions */}
          {show("promos") && (
            <Section icon={Megaphone} title="Submission Promosi" count={promotions.length} accent="bg-amber">
              {promotions.length === 0 ? <Empty label="submission promosi" /> : (
                <div className="divide-y divide-border/40">
                  {promotions.map(p => (
                    <div key={p.id} className="flex items-start gap-4 px-5 py-4 hover:bg-muted/30 transition-colors">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-amber-50 dark:bg-amber-950/40">
                        <Megaphone className="h-4 w-4 text-amber-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap gap-2 mb-1.5">
                          <a href={p.post_link} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 text-[11px] font-medium text-blue-600 hover:bg-blue-100 transition-colors">
                            <ExternalLink className="h-3 w-3" /> Lihat Post
                          </a>
                          <a href={p.account_link} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 text-[11px] font-medium text-blue-600 hover:bg-blue-100 transition-colors">
                            <ExternalLink className="h-3 w-3" /> Akun
                          </a>
                        </div>
                        <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                          <span className="font-medium">{p.views_claimed.toLocaleString("id-ID")} views</span>
                          <span className="font-semibold text-emerald-600">{idr(p.reward_amount ?? 0)} reward</span>
                          <span>{timeAgo(p.created_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        {p.screenshot_url && (
                          <a href={p.screenshot_url} target="_blank" rel="noopener noreferrer">
                            <img src={p.screenshot_url} alt="Bukti"
                              className="h-14 w-20 object-cover rounded-[10px] border border-border bg-muted" />
                          </a>
                        )}
                        <StatusDropdown status={p.status} options={["pending","approved","rejected"]}
                          onChange={s => updatePromo(p.id, s)} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* Withdrawal Requests */}
          {show("withdrawals") && (
            <Section icon={Wallet} title="Permintaan Penarikan" count={withdrawals.length} accent="bg-emerald">
              {withdrawals.length === 0 ? <Empty label="permintaan penarikan" /> : (
                <div className="divide-y divide-border/40">
                  {withdrawals.map(w => (
                    <div key={w.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-emerald-50 dark:bg-emerald-950/40">
                        <Shield className="h-4 w-4 text-emerald-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-bold text-foreground">{idr(w.amount)}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          via <span className="font-medium text-foreground">{w.payment_method}</span> · {fmtDate(w.created_at)}
                        </p>
                      </div>
                      <StatusDropdown status={w.status} options={["pending","paid","rejected"]}
                        onChange={s => updateWithdrawal(w.id, s)} />
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* Users */}
          {show("users") && (
            <Section icon={Users} title={`Daftar Users (${users.length})`} count={activatedUsers} accent="bg-violet">
              {users.length === 0 ? <Empty label="user" /> : (
                <div className="divide-y divide-border/40">
                  {users.slice(0, tab === "users" ? users.length : 5).map(u => (
                    <div key={u.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors">
                      <Avatar email={u.email ?? u.id} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold truncate">{u.full_name ?? u.email ?? "Anonymous"}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="hidden sm:block text-right">
                          <p className="text-[10px] text-muted-foreground">Daftar</p>
                          <p className="text-[11px] font-medium">{timeAgo(u.created_at)}</p>
                        </div>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                          u.is_activated
                            ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground border-border"
                        }`}>
                          {u.is_activated ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                          {u.is_activated ? "Aktif" : "Tidak Aktif"}
                        </span>
                      </div>
                    </div>
                  ))}
                  {tab !== "users" && users.length > 5 && (
                    <div className="px-5 py-3 text-center">
                      <button onClick={() => setTab("users")}
                        className="text-[12px] font-medium text-violet-500 hover:underline">
                        Lihat semua {users.length} user →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </Section>
          )}

          {/* Activation Codes — only on "all" or "users" tab */}
          {(tab === "all" || tab === "users") && (
            <Section icon={Shield} title="Activation Codes" count={codes.length} accent="bg-indigo">
              <div className="grid grid-cols-3 divide-x divide-border/40 border-b border-border/40">
                {[
                  { label: "Unused", value: unusedCodes, color: "text-emerald-500" },
                  { label: "Used",   value: codes.filter(c => c.status === "used").length, color: "text-foreground" },
                  { label: "Total",  value: codes.length, color: "text-indigo-500" },
                ].map(s => (
                  <div key={s.label} className="px-4 py-3 text-center">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{s.label}</p>
                    <p className={`text-xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>
              {tab === "users" && (
                <div className="divide-y divide-border/40 max-h-64 overflow-y-auto">
                  {codes.filter(c => c.status === "unused").slice(0, 20).map(c => (
                    <div key={c.code} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors">
                      <code className="text-[12px] font-mono font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md">{c.code}</code>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-muted-foreground">{c.owner_email ?? "—"}</p>
                      </div>
                      <span className="text-[11px] text-muted-foreground">{c.duration_months} bln</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

        </div>
      )}
    </div>
  )
}
