"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
  Key, Copy, Check, RefreshCw, ToggleLeft, ToggleRight,
  Search, Filter, Loader2, Calendar, User, ChevronLeft, ChevronRight,
} from "lucide-react"
import { snipieClient, type ActivationCode } from "@/lib/supabase/snipie-client"
import { format } from "date-fns"
import { id } from "date-fns/locale"
import { toast } from "sonner"

type FilterStatus = "all" | "unused" | "used"

const PAGE_SIZE = 50

const fmtDate = (d: string | null) =>
  d ? format(new Date(d), "dd MMM yyyy", { locale: id }) : "—"

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handle = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success("Kode disalin!")
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={handle} title="Salin kode"
      className={`flex h-7 w-7 items-center justify-center rounded-[7px] border transition-all ${
        copied
          ? "border-emerald-300 bg-emerald-50 text-emerald-500 dark:border-emerald-700 dark:bg-emerald-950/40"
          : "border-border bg-background text-muted-foreground hover:border-violet-300 hover:bg-violet-50 hover:text-violet-500"
      }`}>
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

function ToggleStatus({ code, status, onToggle }: {
  code: string; status: string | null; onToggle: (code: string, newStatus: string) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const isUnused = status === "unused"
  const handle = async () => {
    setBusy(true)
    await onToggle(code, isUnused ? "used" : "unused")
    setBusy(false)
  }
  return (
    <button onClick={handle} disabled={busy} title={isUnused ? "Tandai Used" : "Reset ke Unused"}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition-all disabled:opacity-50 ${
        isUnused
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
          : "border-border bg-muted text-muted-foreground hover:border-violet-200 hover:bg-violet-50 hover:text-violet-600"
      }`}>
      {busy ? <Loader2 className="h-3 w-3 animate-spin" />
        : isUnused ? <ToggleRight className="h-3.5 w-3.5" />
        : <ToggleLeft className="h-3.5 w-3.5" />}
      {isUnused ? "Unused" : "Used"}
    </button>
  )
}

export default function ActivationCodesPage() {
  const [codes, setCodes]         = useState<ActivationCode[]>([])
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter]       = useState<FilterStatus>("all")
  const [search, setSearch]       = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [page, setPage]           = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [unusedCount, setUnusedCount] = useState(0)
  const [usedCount, setUsedCount] = useState(0)

  // Fetch stats (total counts) separately — no row limit
  const fetchStats = useCallback(async () => {
    const [all, unused, used] = await Promise.all([
      snipieClient.from("activation_codes").select("*", { count: "exact", head: true }),
      snipieClient.from("activation_codes").select("*", { count: "exact", head: true }).eq("status", "unused"),
      snipieClient.from("activation_codes").select("*", { count: "exact", head: true }).eq("status", "used"),
    ])
    setUnusedCount(unused.count ?? 0)
    setUsedCount(used.count ?? 0)
    // total depends on filter
    if (filter === "all") setTotalCount(all.count ?? 0)
    else if (filter === "unused") setTotalCount(unused.count ?? 0)
    else setTotalCount(used.count ?? 0)
  }, [filter])

  // Fetch current page data
  const fetchPage = useCallback(async (soft = false) => {
    soft ? setRefreshing(true) : setLoading(true)

    let query = snipieClient
      .from("activation_codes")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (filter !== "all") query = query.eq("status", filter)
    if (search) query = query.ilike("code", `%${search}%`)

    const { data, count, error } = await query
    if (error) toast.error("Gagal memuat: " + error.message)
    if (data) setCodes(data as ActivationCode[])
    if (count !== null) setTotalCount(count)
    setLoading(false)
    setRefreshing(false)
  }, [page, filter, search])

  useEffect(() => { fetchStats() }, [fetchStats])
  useEffect(() => { setPage(0) }, [filter, search])
  useEffect(() => { fetchPage() }, [fetchPage])

  const toggleStatus = async (code: string, newStatus: string) => {
    const { error } = await snipieClient.from("activation_codes").update({ status: newStatus }).eq("code", code)
    if (error) { toast.error("Gagal mengubah status"); return }
    setCodes(prev => prev.map(c => c.code === code ? { ...c, status: newStatus } : c))
    // update counts
    if (newStatus === "unused") { setUnusedCount(p => p + 1); setUsedCount(p => p - 1) }
    else { setUnusedCount(p => p - 1); setUsedCount(p => p + 1) }
    toast.success(newStatus === "unused" ? "✅ Direset ke Unused" : "Ditandai sebagai Used")
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400)
    return () => clearTimeout(t)
  }, [searchInput])

  const totalAll = unusedCount + usedCount

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-[8px] bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center">
              <Key className="h-4 w-4 text-violet-500" />
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">norraclip.com</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Activation Codes</h1>
          <p className="text-sm text-muted-foreground">Kelola dan pantau semua kode aktivasi lisensi.</p>
        </div>
        <button onClick={() => { fetchPage(true); fetchStats() }} disabled={refreshing || loading}
          className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-sm font-medium border border-border bg-background hover:bg-muted transition-colors disabled:opacity-50 shadow-sm self-start sm:self-auto">
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Kode",  value: totalAll,    color: "text-violet-500",  bg: "bg-violet-50 dark:bg-violet-950/40" },
          { label: "Unused",      value: unusedCount, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
          { label: "Used",        value: usedCount,   color: "text-foreground",  bg: "bg-muted" },
        ].map((s, i) => (
          <div key={s.label} className="apple-card px-4 py-4 animate-stagger-item" style={{ "--i": i } as React.CSSProperties}>
            <div className={`flex h-9 w-9 items-center justify-center rounded-[10px] mb-2.5 ${s.bg}`}>
              <Key className={`h-4 w-4 ${s.color}`} />
            </div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{s.label}</p>
            <p className={`text-2xl font-bold tracking-tight mt-0.5 tabular-nums ${s.color}`}>{s.value.toLocaleString("id-ID")}</p>
          </div>
        ))}
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input type="text" placeholder="Cari kode..." value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="w-full rounded-[10px] border border-border bg-background pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-violet-400 transition-all" />
        </div>
        <div className="flex items-center gap-1 rounded-[10px] border border-border bg-background p-1">
          <Filter className="h-3.5 w-3.5 text-muted-foreground ml-2 shrink-0" />
          {(["all", "unused", "used"] as FilterStatus[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-colors ${
                filter === f ? "bg-violet-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}>
              {f === "all" ? "Semua" : f === "unused" ? "Unused" : "Used"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="apple-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50 bg-muted/20">
          <h2 className="text-[13px] font-semibold">
            {filter === "all" ? "Semua Kode" : filter === "unused" ? "Kode Unused" : "Kode Used"}
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              hal. {page + 1} / {totalPages || 1}
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {totalCount.toLocaleString("id-ID")}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="divide-y divide-border/40">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                <div className="skeleton h-8 w-40 rounded-[8px]" />
                <div className="flex-1 space-y-1.5"><div className="skeleton h-3 w-32" /></div>
                <div className="skeleton h-7 w-20 rounded-full" />
              </div>
            ))}
          </div>
        ) : codes.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3 text-center">
            <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
              <Key className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Tidak ada kode ditemukan</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {codes.map((c, i) => (
              <div key={c.code}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors animate-stagger-item"
                style={{ "--i": Math.min(i, 15) } as React.CSSProperties}>
                <div className="flex items-center gap-2 shrink-0">
                  <code className={`text-[13px] font-mono font-bold px-3 py-1.5 rounded-[8px] tracking-wider select-all ${
                    c.status === "unused"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground line-through"
                  }`}>{c.code}</code>
                  <CopyButton text={c.code} />
                </div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  {c.owner_email && (
                    <p className="text-[12px] text-muted-foreground flex items-center gap-1.5 truncate">
                      <User className="h-3 w-3 shrink-0" />{c.owner_email}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />{fmtDate(c.created_at)}
                    </span>
                    {c.duration_months && (
                      <span className="px-1.5 py-0.5 rounded-md bg-muted text-[10px] font-semibold">
                        {c.duration_months} bln
                      </span>
                    )}
                  </div>
                </div>
                <ToggleStatus code={c.code} status={c.status} onToggle={toggleStatus} />
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-border/50 bg-muted/10">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0 || loading}
              className="flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[13px] font-medium border border-border bg-background hover:bg-muted transition-colors disabled:opacity-40">
              <ChevronLeft className="h-3.5 w-3.5" /> Sebelumnya
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
                const p = totalPages <= 7 ? i : page < 4 ? i : page > totalPages - 4 ? totalPages - 7 + i : page - 3 + i
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`h-7 min-w-[28px] px-2 rounded-[6px] text-[12px] font-medium transition-colors ${
                      p === page ? "bg-violet-500 text-white" : "text-muted-foreground hover:bg-muted"
                    }`}>
                    {p + 1}
                  </button>
                )
              })}
            </div>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1 || loading}
              className="flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[13px] font-medium border border-border bg-background hover:bg-muted transition-colors disabled:opacity-40">
              Berikutnya <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
