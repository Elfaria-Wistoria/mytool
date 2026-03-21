"use client"

import { useState, useEffect, useCallback } from "react"
import { Wallet, TrendingUp, TrendingDown, Clock, Plus, Loader2, ArrowUpRight, ArrowDownRight, CreditCard, PlusCircle, Trash2, PieChart, AlertTriangle, Wifi } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format, startOfMonth, subMonths, isSameMonth, subDays, isSameDay } from "date-fns"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

type Transaction = Tables<"transactions"> & { wallets?: { name: string } | null }
type BankWallet = Tables<"wallets">

const CATEGORIES = {
  income: ["Revenue", "Investment", "Other Income"],
  expense: ["Software", "Payroll", "Marketing", "Office", "Travel", "Legal", "Other Expense"]
}

const chartConfig = {
  income: { label: "Income", color: "#10b981" },
  expense: { label: "Expense", color: "#f43f5e" },
} satisfies ChartConfig

const CARD_STYLES = [
  { bg: "from-zinc-900 via-zinc-800 to-zinc-950 ring-white/10", text: "text-white", label: "text-zinc-400" },
  { bg: "from-slate-200 via-slate-100 to-slate-200 ring-black/5", text: "text-slate-800", label: "text-slate-500" },
  { bg: "from-slate-800 via-blue-950 to-slate-900 ring-white/10", text: "text-white", label: "text-blue-300" },
  { bg: "from-teal-800 via-emerald-900 to-teal-950 ring-white/10", text: "text-white", label: "text-teal-300" },
]

export default function FinancePage() {
  const supabase = createClient()
  const [txs, setTxs] = useState<Transaction[]>([])
  const [wallets, setWallets] = useState<BankWallet[]>([])
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState("JOHN DOE")
  
  // Analytics State
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "6m">("6m")

  // Modals
  const [isTxOpen, setIsTxOpen] = useState(false)
  const [isWalletOpen, setIsWalletOpen] = useState(false)
  const [isResetOpen, setIsResetOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  
  const [form, setForm] = useState({
    amount: "", type: "expense" as "income" | "expense", category: "Software", description: "", wallet_id: ""
  })
  const [walletForm, setWalletForm] = useState({ name: "" })
  const [resetPassword, setResetPassword] = useState("")
  const [resetError, setResetError] = useState("")

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).single()
    if (profile?.display_name) setUserName(profile.display_name)

    const { data: wData } = await supabase.from("wallets").select("*").order("created_at")

    let currentWallets = wData ?? []
    if (currentWallets.length === 0) {
      const { data: newW } = await supabase.from("wallets").insert({ profile_id: user.id, name: "Main Account" }).select().single()
      if (newW) currentWallets = [newW]
    }
    setWallets(currentWallets)

    const { data } = await supabase
      .from("transactions")
      .select("*, wallets(name)")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })

    setTxs(data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (isTxOpen && wallets.length > 0 && !form.wallet_id) {
      setForm(f => ({ ...f, wallet_id: wallets[0].id }))
    }
  }, [isTxOpen, wallets, form.wallet_id])

  const addWallet = async () => {
    if (!walletForm.name.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const { data, error } = await supabase
      .from("wallets")
      .insert({ profile_id: user.id, name: walletForm.name.trim() })
      .select()
      .single()

    if (!error && data) {
      setWallets(prev => [...prev, data])
      setIsWalletOpen(false)
      setWalletForm({ name: "" })
    }
    setSaving(false)
  }

  const deleteWallet = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the card "${name}"?\nWARNING: All transaction history linked to this card will be permanently lost.`)) return
    setSaving(true)
    const { error } = await supabase.from("wallets").delete().eq("id", id)
    if (!error) {
      setWallets(prev => prev.filter(w => w.id !== id))
      setTxs(prev => prev.filter(t => t.wallet_id !== id))
    }
    setSaving(false)
  }

  const resetAllData = async () => {
    setSaving(true)
    setResetError("")
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !user.email) {
      setSaving(false)
      return
    }

    // Authenticate to verify identity
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: resetPassword
    })

    if (authError) {
      setResetError("Incorrect password. Please try again.")
      setSaving(false)
      return
    }

    // Wipe transaction history
    const { error } = await supabase.from("transactions").delete().eq("profile_id", user.id)
    if (!error) {
      setTxs([])
      setIsResetOpen(false)
      setResetPassword("")
    } else {
      setResetError("Failed to reset data.")
    }
    setSaving(false)
  }

  const addTx = async () => {
    const rawAmount = Number(form.amount.replace(/\D/g, ""))
    if (!rawAmount || isNaN(rawAmount)) return
    setSaving(true)
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const activeWalletId = form.wallet_id || wallets[0].id

    const { data, error } = await supabase
      .from("transactions")
      .insert({
        profile_id: user.id,
        amount: rawAmount,
        type: form.type,
        category: form.category,
        description: form.description.trim() || null,
        wallet_id: activeWalletId,
        date: new Date().toISOString().split("T")[0]
      })
      .select("*, wallets(name)")
      .single()

    if (!error && data) {
      const walletName = wallets.find(w => w.id === activeWalletId)?.name || "Unknown"
      const completeTx = { ...data, wallets: { name: walletName } }
      
      setTxs(prev => {
        const next = [completeTx, ...prev]
        return next.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      })
      setIsTxOpen(false)
      setForm({ amount: "", type: "expense", category: "Software", description: "", wallet_id: wallets[0].id })
    }
    setSaving(false)
  }

  // --- Core Calculations ---
  const totalIncome = txs.filter(t => t.type === "income").reduce((sum, t) => sum + t.amount, 0)
  const totalExpense = txs.filter(t => t.type === "expense").reduce((sum, t) => sum + t.amount, 0)
  const currentBalance = totalIncome - totalExpense

  // --- Dynamic Filtering & Chart Building ---
  const now = new Date()
  let periodTxs: Transaction[] = []
  let chartData: Array<{ name: string, income: number, expense: number }> = []

  if (timeRange === "7d") {
    const startDate = subDays(now, 6)
    periodTxs = txs.filter(t => new Date(t.date) >= startDate)
    chartData = Array.from({ length: 7 }).map((_, i) => {
      const d = subDays(now, 6 - i)
      const dayTxs = txs.filter(t => isSameDay(new Date(t.date), d))
      return {
        name: format(d, "EEE"),
        income: dayTxs.filter(t => t.type === "income").reduce((sum, t) => sum + t.amount, 0),
        expense: dayTxs.filter(t => t.type === "expense").reduce((sum, t) => sum + t.amount, 0)
      }
    })
  } else if (timeRange === "30d") {
    const startDate = subDays(now, 29)
    periodTxs = txs.filter(t => new Date(t.date) >= startDate)
    chartData = Array.from({ length: 30 }).map((_, i) => {
      const d = subDays(now, 29 - i)
      const dayTxs = txs.filter(t => isSameDay(new Date(t.date), d))
      return {
        name: format(d, "MMM d"),
        income: dayTxs.filter(t => t.type === "income").reduce((sum, t) => sum + t.amount, 0),
        expense: dayTxs.filter(t => t.type === "expense").reduce((sum, t) => sum + t.amount, 0)
      }
    })
  } else if (timeRange === "6m") {
    const startDate = startOfMonth(subMonths(now, 5))
    periodTxs = txs.filter(t => new Date(t.date) >= startDate)
    chartData = Array.from({ length: 6 }).map((_, i) => {
      const d = subMonths(now, 5 - i)
      const monthTxs = txs.filter(t => isSameMonth(new Date(t.date), d))
      return {
        name: format(d, "MMM"),
        income: monthTxs.filter(t => t.type === "income").reduce((sum, t) => sum + t.amount, 0),
        expense: monthTxs.filter(t => t.type === "expense").reduce((sum, t) => sum + t.amount, 0)
      }
    })
  }

  const periodIncome = periodTxs.filter(t => t.type === "income").reduce((sum, t) => sum + t.amount, 0)
  const periodExpense = periodTxs.filter(t => t.type === "expense").reduce((sum, t) => sum + t.amount, 0)
  const periodFlow = periodIncome - periodExpense

  // Find top expense category
  const expenseCatMap = periodTxs.filter(t => t.type === "expense").reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount
    return acc
  }, {} as Record<string, number>)
  const topCategoryEntry = Object.entries(expenseCatMap).sort((a,b) => b[1] - a[1])[0]

  const currency = (val: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val)

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Financial Overview</h1>
          <p className="text-sm text-muted-foreground">Monitor your company's cash flow, track runtime, and log transactions.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsResetOpen(true)} className="rounded-[10px] shadow-sm bg-background text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20">
            <AlertTriangle className="h-4 w-4 mr-1.5" /> Reset Data
          </Button>
          <Button onClick={() => setIsTxOpen(true)} className="rounded-[10px] shadow-sm">
            <Plus className="h-4 w-4 mr-1.5" /> Log Transaction
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Virtual Accounts / Cards Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {wallets.map((w, i) => {
              const wTxs = txs.filter(t => t.wallet_id === w.id)
              const wBal = wTxs.reduce((sum, t) => t.type === "income" ? sum + t.amount : sum - t.amount, 0)
              const style = CARD_STYLES[i % CARD_STYLES.length]
              
              // Generate a pseudo-random 4 digit number based on wallet id
              const fakeDigits = ((w.id.charCodeAt(0) + w.id.charCodeAt(w.id.length - 1)) * 31).toString().padStart(4, '0').slice(-4)

              return (
                <div key={w.id} className={`relative overflow-hidden rounded-[20px] p-6 shadow-2xl bg-gradient-to-br ${style.bg} ${style.text} flex flex-col justify-between min-h-[200px] transform hover:scale-[1.02] transition-all group ring-1`}>
                  
                  {/* Subtle Grain Overlay */}
                  <div className="absolute inset-0 opacity-[0.04] mix-blend-overlay pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>

                  {/* Highlights */}
                  <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 blur-3xl rounded-full translate-x-12 -translate-y-12 pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/10 blur-2xl rounded-full -translate-x-10 translate-y-10 pointer-events-none" />

                  {/* Delete Button */}
                  <button 
                    onClick={() => deleteWallet(w.id, w.name)}
                    className="absolute z-20 top-4 right-4 p-2 rounded-full bg-black/20 text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 scale-90 hover:scale-100 pointer-events-auto shadow-sm"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  {/* Top section: Bank Name + Contactless */}
                  <div className="z-10 relative flex justify-between items-center pointer-events-none w-full">
                    <p className="font-bold text-[14px] tracking-widest drop-shadow-sm uppercase opacity-90 pr-10 truncate">{w.name}</p>
                    <Wifi className="h-5 w-5 rotate-90 opacity-60 shrink-0" />
                  </div>

                  {/* Realistic EMV Chip */}
                  <div className="z-10 relative mt-4 mb-2">
                    <div className="w-10 h-7 rounded-[4px] border border-current/20 flex flex-col justify-evenly overflow-hidden relative opacity-80" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.05) 100%)' }}>
                      <div className="w-full h-[1px] bg-current/20" />
                      <div className="w-full h-[1px] bg-current/20" />
                      <div className="absolute left-1/3 top-0 bottom-0 w-[1px] bg-current/20" />
                      <div className="absolute right-1/3 top-0 bottom-0 w-[1px] bg-current/20" />
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-[14px] rounded-full border border-current/20" />
                    </div>
                  </div>

                  {/* Card Number Placeholder */}
                  <div className="z-10 relative mb-3 font-mono text-[16px] tracking-[0.2em] opacity-80 pointer-events-none drop-shadow-sm flex items-center gap-1">
                    <span>••••</span> <span>••••</span> <span>••••</span> <span className="ml-1">{fakeDigits}</span>
                  </div>

                  {/* Bottom section: Name, Balance & Logo */}
                  <div className="z-10 relative flex justify-between items-end pointer-events-none mt-auto">
                    <div>
                      <p className={`text-[12px] uppercase font-bold tracking-widest drop-shadow-sm opacity-90 truncate max-w-[150px] mb-3`}>{userName}</p>
                      <p className={`text-[8px] uppercase font-bold tracking-[0.15em] mb-0.5 ${style.label}`}>Available Balance</p>
                      <p className="text-lg font-extrabold tracking-tight drop-shadow-sm leading-none">{currency(wBal)}</p>
                    </div>
                    {/* Fake Modern Brand Logo (overlapping circles) */}
                    <div className="flex -space-x-3 drop-shadow-md shrink-0 mb-1">
                      <div className="w-8 h-8 rounded-full bg-current opacity-[0.35]" />
                      <div className="w-8 h-8 rounded-full bg-current opacity-[0.25]" />
                    </div>
                  </div>
                </div>
              )
            })}
            
            {/* Add New Card Slot */}
            <button 
              onClick={() => setIsWalletOpen(true)}
              className="flex flex-col items-center justify-center rounded-[20px] border-2 border-dashed border-border/60 bg-muted/20 hover:bg-muted/40 hover:border-border transition-all min-h-[200px] p-6 text-muted-foreground hover:text-foreground"
            >
              <PlusCircle className="h-8 w-8 mb-3 opacity-80" />
              <span className="text-sm font-semibold tracking-wide">Add New Card</span>
            </button>
          </div>

          <div className="h-px bg-border/50 w-full" />

          {/* Time Filter Settings Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Advanced Analytics</h2>
            <Select value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
              <SelectTrigger className="w-[180px] h-9 text-xs font-semibold rounded-[8px] border-border/60 bg-muted/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="6m">Last 6 Months</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* KPI Cards (Filtered) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="apple-card px-5 py-4 flex flex-col justify-between">
              <div className="flex items-center gap-2 text-muted-foreground mb-3 font-medium text-[13px]">
                <Wallet className="h-4 w-4" /> Global Balance
              </div>
              <p className="text-xl font-bold tracking-tight text-foreground">{currency(currentBalance)}</p>
            </div>
            <div className="apple-card px-5 py-4 flex flex-col justify-between">
              <div className="flex items-center gap-2 text-muted-foreground mb-3 font-medium text-[13px]">
                <ArrowUpRight className="h-4 w-4 text-emerald-500" /> Period Income
              </div>
              <p className="text-xl font-bold tracking-tight text-emerald-500">{currency(periodIncome)}</p>
            </div>
            <div className="apple-card px-5 py-4 flex flex-col justify-between">
              <div className="flex items-center gap-2 text-muted-foreground mb-3 font-medium text-[13px]">
                <ArrowDownRight className="h-4 w-4 text-rose-500" /> Period Expense
              </div>
              <p className="text-xl font-bold tracking-tight text-rose-500">{currency(periodExpense)}</p>
            </div>
            <div className="apple-card px-5 py-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3 text-[13px]">
                <span className="flex items-center gap-2 font-medium text-muted-foreground">
                  <PieChart className="h-4 w-4 text-orange-500" /> Top Expense
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold tracking-tight text-foreground truncate">{topCategoryEntry ? topCategoryEntry[0] : "—"}</p>
                <p className="text-sm text-orange-500 font-bold tabular-nums">
                  {topCategoryEntry ? currency(topCategoryEntry[1]) : currency(0)}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-20">
            {/* Chart */}
            <div className="col-span-1 lg:col-span-2 apple-card p-5 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[14px] font-semibold text-foreground">Cash Flow Visualization</h2>
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <span className={`tabular-nums ${periodFlow >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                    Net: {periodFlow >= 0 ? "+" : ""}{currency(periodFlow)}
                  </span>
                </div>
              </div>
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <BarChart accessibilityLayer data={chartData} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.2} />
                  <XAxis 
                    dataKey="name" 
                    tickLine={false} 
                    tickMargin={10} 
                    axisLine={false}
                    className="text-xs font-medium text-muted-foreground"
                    tickFormatter={(val) => timeRange === "30d" ? val.split(" ")[0] : val} // trim 30d labels to fit better
                  />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dashed" />} />
                  <Bar dataKey="income" fill="var(--color-income)" radius={[4, 4, 0, 0]} barSize={timeRange==="30d"? 8 : 32} />
                  <Bar dataKey="expense" fill="var(--color-expense)" radius={[4, 4, 0, 0]} barSize={timeRange==="30d"? 8 : 32} />
                </BarChart>
              </ChartContainer>
            </div>

            {/* Recent Transactions List */}
            <div className="col-span-1 apple-card flex flex-col overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-border/50 bg-muted/20">
                <h2 className="text-[14px] font-semibold text-foreground">Activity Log</h2>
              </div>
              
              <div className="flex-1 overflow-y-auto max-h-[290px] p-2">
                {periodTxs.length === 0 ? (
                  <div className="h-full min-h-[150px] flex flex-col items-center justify-center text-center gap-2 opacity-50">
                    <Clock className="h-6 w-6 text-muted-foreground" />
                    <p className="text-xs font-medium text-foreground">No transactions</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {periodTxs.map(t => (
                      <div key={t.id} className="flex items-center justify-between p-3 rounded-[10px] hover:bg-muted/40 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-full ${t.type === "income" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}>
                            {t.type === "income" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="text-[13px] font-medium leading-none text-foreground">{t.category}</p>
                            <p className="text-[11px] text-muted-foreground mt-1 max-w-[120px] truncate">{t.wallets?.name ?? "Unknown"} {t.description && `• ${t.description}`}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-[13px] font-bold tabular-nums ${t.type === "income" ? "text-emerald-500" : "text-foreground"}`}>
                            {t.type === "income" ? "+" : "-"}{currency(t.amount)}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(t.date), "MMM d")}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Reset Data Verification Modal */}
      <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Danger Zone</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete all transaction history? Every bank account balance will be reset to Rp 0. This action is irreversible.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Verify Identity</Label>
              <Input
                type="password"
                placeholder="Enter your account password"
                value={resetPassword}
                onChange={e => setResetPassword(e.target.value)}
                className="rounded-[10px]"
              />
            </div>
            {resetError && (
              <p className="text-sm font-medium text-destructive">{resetError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsResetOpen(false)} className="rounded-[10px]">Cancel</Button>
            <Button onClick={resetAllData} disabled={saving || !resetPassword} variant="destructive" className="rounded-[10px]">
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Permanently Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Wallet Modal */}
      <Dialog open={isWalletOpen} onOpenChange={setIsWalletOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Bank Card</DialogTitle>
            <DialogDescription>Create a new virtual wallet or bank account to track funds securely.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Card Name</Label>
              <Input
                placeholder="e.g. BCA Company, Mandiri, Cash"
                value={walletForm.name}
                onChange={e => setWalletForm({ name: e.target.value })}
                className="rounded-[10px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={addWallet} disabled={saving || !walletForm.name.trim()} className="rounded-[10px]">
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Create Card
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Transaction Modal */}
      <Dialog open={isTxOpen} onOpenChange={setIsTxOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Transaction</DialogTitle>
            <DialogDescription>Record a new income or expense item.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Bank Account</Label>
                <Select value={form.wallet_id} onValueChange={val => val && setForm(f => ({ ...f, wallet_id: val }))}>
                  <SelectTrigger className="rounded-[10px]">
                    <SelectValue placeholder="Select Account">
                      {wallets.find(w => w.id === form.wallet_id)?.name || "Select Account"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {wallets.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Type</Label>
                <Select value={form.type} onValueChange={(val) => {
                  if (!val) return
                  const t = val as "income" | "expense"
                  setForm(f => ({ ...f, type: t, category: CATEGORIES[t][0] }))
                }}>
                  <SelectTrigger className="rounded-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Category</Label>
                <Select value={form.category} onValueChange={val => {
                  if (val) setForm(f => ({ ...f, category: val }))
                }}>
                  <SelectTrigger className="rounded-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES[form.type].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Amount (Rp)</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={form.amount}
                  onChange={e => {
                    const raw = e.target.value.replace(/\D/g, "")
                    if (!raw) {
                      setForm(f => ({ ...f, amount: "" }))
                    } else {
                      const formatted = new Intl.NumberFormat("id-ID").format(parseInt(raw, 10))
                      setForm(f => ({ ...f, amount: formatted }))
                    }
                  }}
                  className="rounded-[10px]"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Description</Label>
              <Input
                placeholder="e.g. Vercel hosting"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="rounded-[10px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={addTx} disabled={saving || !form.amount || isNaN(Number(form.amount.replace(/\D/g, "")))} className="rounded-[10px]">
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Save Transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
