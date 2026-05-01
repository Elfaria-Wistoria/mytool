"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
  CreditCard, RefreshCw, TrendingUp, ShoppingBag,
  User, Mail, Phone, ChevronDown, ChevronUp, Package,
  CheckCircle2, Circle, Tag,
} from "lucide-react"
import { snipieClient } from "@/lib/supabase/snipie-client"
import { format, formatDistanceToNow } from "date-fns"
import { id } from "date-fns/locale"

type LynkPayment = {
  id: string
  event: string
  ref_id: string
  message_id: string
  grand_total: number
  total_price: number
  convenience_fee: number
  discount: number
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  items: Array<{ title: string; price: number; qty: number; addons?: Array<{ name: string; price: string }> }> | null
  voucher_code: string | null
  raw_payload: Record<string, unknown> | null
  created_at: string
}

const idr = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n)

const fmtDate = (d: string) =>
  format(new Date(d), "dd MMM yyyy, HH:mm", { locale: id })

const timeAgo = (d: string) =>
  formatDistanceToNow(new Date(d), { addSuffix: true, locale: id })

// ─── Payment row ──────────────────────────────────────────────────────────────
function PaymentRow({ p }: { p: LynkPayment }) {
  const [open, setOpen] = useState(false)
  const items = p.items ?? []

  return (
    <div className="border-b border-border/40 last:border-0">
      {/* Main row */}
      <div
        className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors cursor-pointer"
        onClick={() => setOpen(o => !o)}
      >
        {/* Icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-emerald-50 dark:bg-emerald-950/40">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        </div>

        {/* Customer info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-semibold text-foreground truncate">
              {p.customer_name ?? "Anonim"}
            </p>
            {p.voucher_code && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 px-2 py-0.5 text-[10px] font-bold text-violet-600 dark:text-violet-400">
                <Tag className="h-2.5 w-2.5" />{p.voucher_code}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            {p.customer_email && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" />{p.customer_email}
              </span>
            )}
            <span className="text-[11px] text-muted-foreground">· {timeAgo(p.created_at)}</span>
          </div>
        </div>

        {/* Amount + items count */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="hidden sm:block text-right">
            <p className="text-[10px] text-muted-foreground font-medium">{items.length} item</p>
            <p className="text-[11px] font-mono text-muted-foreground truncate max-w-[120px]">{p.ref_id.slice(0, 12)}…</p>
          </div>
          <div className="text-right">
            <p className="text-[15px] font-bold text-emerald-600 dark:text-emerald-400">{idr(p.grand_total)}</p>
            <p className="text-[10px] text-muted-foreground">diterima</p>
          </div>
          {open
            ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
        </div>
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="px-5 pb-5 space-y-4 bg-muted/10 border-t border-border/30">

          {/* Customer detail */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
            {[
              { icon: User,  label: "Nama",  value: p.customer_name ?? "—" },
              { icon: Mail,  label: "Email", value: p.customer_email ?? "—" },
              { icon: Phone, label: "Phone", value: p.customer_phone ?? "—" },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-2.5 rounded-[10px] bg-background border border-border/50 px-3.5 py-2.5">
                <f.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{f.label}</p>
                  <p className="text-[13px] font-medium truncate">{f.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Items */}
          {items.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" /> Items
              </p>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="rounded-[10px] border border-border/50 bg-background px-4 py-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[13px] font-semibold">{item.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {idr(item.price)} × {item.qty}
                        </p>
                      </div>
                      <p className="text-[13px] font-bold text-foreground shrink-0">{idr(item.price * item.qty)}</p>
                    </div>
                    {item.addons && item.addons.length > 0 && (
                      <div className="pl-3 border-l-2 border-violet-200 dark:border-violet-800 space-y-1">
                        {item.addons.map((a, j) => (
                          <div key={j} className="flex justify-between text-[11px] text-muted-foreground">
                            <span>+ {a.name}</span>
                            <span className="font-medium">{a.price}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Totals */}
          <div className="rounded-[10px] border border-border/50 bg-background px-4 py-3 space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Rincian Pembayaran</p>
            {[
              { label: "Total Item",       value: idr(p.total_price),     color: "" },
              { label: "Convenience Fee",  value: idr(p.convenience_fee), color: p.convenience_fee < 0 ? "text-red-500" : "" },
              { label: "Diskon",           value: idr(p.discount),        color: p.discount > 0 ? "text-emerald-500" : "" },
            ].map(r => (
              <div key={r.label} className="flex justify-between text-[12px]">
                <span className="text-muted-foreground">{r.label}</span>
                <span className={`font-medium ${r.color}`}>{r.value}</span>
              </div>
            ))}
            <div className="flex justify-between text-[13px] font-bold border-t border-border/50 pt-1.5 mt-1">
              <span>Grand Total</span>
              <span className="text-emerald-600 dark:text-emerald-400">{idr(p.grand_total)}</span>
            </div>
          </div>

          {/* Ref ID */}
          <p className="text-[11px] text-muted-foreground font-mono">
            Ref: <span className="select-all text-foreground">{p.ref_id}</span>
            {" · "}{fmtDate(p.created_at)}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function LynkPaymentsPage() {
  const [payments, setPayments] = useState<LynkPayment[]>([])
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage]         = useState(0)
  const PAGE_SIZE = 30

  const fetchPayments = useCallback(async (soft = false) => {
    soft ? setRefreshing(true) : setLoading(true)
    const { data, count } = await snipieClient
      .from("lynk_payments")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    if (data)  setPayments(data as LynkPayment[])
    if (count !== null) setTotalCount(count)
    setLoading(false); setRefreshing(false)
  }, [page])

  useEffect(() => { fetchPayments() }, [fetchPayments])

  // Stats
  const totalRevenue = payments.reduce((a, p) => a + (p.grand_total ?? 0), 0)
  const totalItems   = payments.reduce((a, p) => a + (p.items?.length ?? 0), 0)
  const todayCount   = payments.filter(p => {
    const d = new Date(p.created_at)
    const now = new Date()
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  // Realtime subscription
  useEffect(() => {
    const channel = snipieClient
      .channel("lynk_payments_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "lynk_payments" },
        (payload) => {
          setPayments(prev => [payload.new as LynkPayment, ...prev])
          setTotalCount(c => c + 1)
        })
      .subscribe()
    return () => { snipieClient.removeChannel(channel) }
  }, [])

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10">

      {/* Header */}
      <div className="relative rounded-[16px] overflow-hidden bg-gradient-to-br from-emerald-600 to-teal-600 p-6 text-white shadow-lg">
        <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold tracking-wider backdrop-blur-sm">
                <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                REALTIME · lynk.id
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Lynk.id Payments</h1>
            <p className="text-sm text-white/70 mt-1">Monitor transaksi masuk secara real-time via webhook.</p>
          </div>
          <button onClick={() => fetchPayments(true)} disabled={refreshing || loading}
            className="flex items-center gap-1.5 rounded-[10px] bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/20 px-3 py-2 text-sm font-medium text-white transition-all disabled:opacity-50 self-start sm:self-auto">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Transaksi", value: totalCount,          color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/40", icon: CreditCard,  fmt: (v: number) => v.toLocaleString("id-ID") },
          { label: "Revenue (halaman ini)", value: totalRevenue,  color: "text-teal-500",    bg: "bg-teal-50 dark:bg-teal-950/40",       icon: TrendingUp,  fmt: idr },
          { label: "Total Items",     value: totalItems,          color: "text-blue-500",    bg: "bg-blue-50 dark:bg-blue-950/40",       icon: ShoppingBag, fmt: (v: number) => v.toLocaleString("id-ID") },
          { label: "Hari Ini",        value: todayCount,          color: "text-violet-500",  bg: "bg-violet-50 dark:bg-violet-950/40",   icon: CheckCircle2,fmt: (v: number) => v.toString() },
        ].map((s, i) => (
          <div key={s.label} className="apple-card px-4 py-4 animate-stagger-item" style={{ "--i": i } as React.CSSProperties}>
            <div className={`flex h-9 w-9 items-center justify-center rounded-[10px] mb-2.5 ${s.bg}`}>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{s.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${s.color} truncate`}>{s.fmt(s.value)}</p>
          </div>
        ))}
      </div>

      {/* Webhook URL info */}
      <div className="rounded-[12px] border border-blue-200/60 bg-blue-50/50 dark:border-blue-800/40 dark:bg-blue-950/20 px-4 py-3">
        <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-widest mb-1">Webhook URL</p>
        <code className="text-[12px] text-blue-800 dark:text-blue-300 font-mono select-all break-all">
          {typeof window !== "undefined" ? window.location.origin : "https://your-domain.com"}/api/webhooks/lynk
        </code>
        <p className="text-[11px] text-blue-600/70 dark:text-blue-500 mt-1">
          Daftarkan URL ini di dashboard Lynk.id → tambahkan <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">LYNK_MERCHANT_KEY</code> ke .env.local setelah mendapat merchant key.
        </p>
      </div>

      {/* Payment list */}
      <div className="apple-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50 bg-muted/20">
          <h2 className="text-[13px] font-semibold">Riwayat Transaksi</h2>
          <div className="flex items-center gap-2">
            {totalPages > 1 && (
              <span className="text-[11px] text-muted-foreground">hal. {page + 1}/{totalPages}</span>
            )}
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {totalCount.toLocaleString("id-ID")}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="divide-y divide-border/40">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="skeleton h-10 w-10 rounded-[10px] shrink-0" />
                <div className="flex-1 space-y-2"><div className="skeleton h-3 w-1/3" /><div className="skeleton h-3 w-1/2" /></div>
                <div className="skeleton h-6 w-24 rounded" />
              </div>
            ))}
          </div>
        ) : payments.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3 text-center">
            <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
              <Circle className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Belum ada transaksi masuk</p>
            <p className="text-[12px] text-muted-foreground/60">Daftarkan webhook URL di Lynk.id untuk mulai menerima notifikasi.</p>
          </div>
        ) : (
          <div>
            {payments.map(p => <PaymentRow key={p.id} p={p} />)}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && !loading && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-border/50 bg-muted/10">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="rounded-[8px] px-3 py-1.5 text-[13px] font-medium border border-border bg-background hover:bg-muted transition-colors disabled:opacity-40">
              ← Sebelumnya
            </button>
            <span className="text-[12px] text-muted-foreground">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} dari {totalCount}
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="rounded-[8px] px-3 py-1.5 text-[13px] font-medium border border-border bg-background hover:bg-muted transition-colors disabled:opacity-40">
              Berikutnya →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
