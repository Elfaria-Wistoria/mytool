"use client"
import React, { useState, useEffect, useCallback } from "react"
import { CreditCard, RefreshCw, TrendingUp, Users, ShoppingBag, CheckCircle2, Circle, ChevronDown, ChevronUp, Tag, Mail, Phone, User, Package } from "lucide-react"
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { snipieClient } from "@/lib/supabase/snipie-client"
import { format, subDays, formatDistanceToNow, startOfDay } from "date-fns"
import { id } from "date-fns/locale"

type Payment = {
  id: string; ref_id: string; message_id: string; grand_total: number
  total_price: number; convenience_fee: number; discount: number
  customer_name: string|null; customer_email: string|null; customer_phone: string|null
  items: Array<{title:string;price:number;qty:number;addons?:Array<{name:string;price:string}>}>|null
  voucher_code: string|null; created_at: string
}

const idr = (n:number) => new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n)
const fmt = (d:string,f:string) => format(new Date(d),f,{locale:id})
const ago = (d:string) => formatDistanceToNow(new Date(d),{addSuffix:true,locale:id})

function PaymentRow({p}:{p:Payment}) {
  const [open,setOpen] = useState(false)
  const items = p.items??[]
  return (
    <div className="border-b border-border/40 last:border-0">
      <div className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 cursor-pointer" onClick={()=>setOpen(o=>!o)}>
        <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-[10px] bg-emerald-50 dark:bg-emerald-950/40">
          <CheckCircle2 className="h-5 w-5 text-emerald-500"/>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-semibold truncate">{p.customer_name??"Anonim"}</p>
            {p.voucher_code&&<span className="inline-flex items-center gap-1 rounded-full bg-violet-50 border border-violet-200 px-2 py-0.5 text-[10px] font-bold text-violet-600"><Tag className="h-2.5 w-2.5"/>{p.voucher_code}</span>}
          </div>
          <p className="text-[11px] text-muted-foreground">{p.customer_email} · {ago(p.created_at)}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-muted-foreground">{items.length} item</p>
            <p className="text-[11px] font-mono text-muted-foreground">{p.ref_id.slice(0,10)}…</p>
          </div>
          <div className="text-right">
            <p className="text-[15px] font-bold text-emerald-600">{idr(p.grand_total)}</p>
          </div>
          {open?<ChevronUp className="h-4 w-4 text-muted-foreground"/>:<ChevronDown className="h-4 w-4 text-muted-foreground"/>}
        </div>
      </div>
      {open&&(
        <div className="px-5 pb-5 space-y-4 bg-muted/10 border-t border-border/30">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
            {[{icon:User,label:"Nama",val:p.customer_name??"-"},{icon:Mail,label:"Email",val:p.customer_email??"-"},{icon:Phone,label:"Phone",val:p.customer_phone??"-"}].map(f=>(
              <div key={f.label} className="flex items-center gap-2.5 rounded-[10px] border border-border/50 bg-background px-3.5 py-2.5">
                <f.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0"/>
                <div><p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{f.label}</p><p className="text-[13px] font-medium">{f.val}</p></div>
              </div>
            ))}
          </div>
          {items.length>0&&(
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"><Package className="h-3.5 w-3.5"/>Items</p>
              {items.map((item,i)=>(
                <div key={i} className="rounded-[10px] border border-border/50 bg-background px-4 py-3">
                  <div className="flex justify-between gap-2">
                    <div><p className="text-[13px] font-semibold">{item.title}</p><p className="text-[11px] text-muted-foreground">{idr(item.price)} × {item.qty}</p></div>
                    <p className="text-[13px] font-bold">{idr(item.price*item.qty)}</p>
                  </div>
                  {item.addons&&item.addons.length>0&&(
                    <div className="mt-2 pl-3 border-l-2 border-violet-200 space-y-1">
                      {item.addons.map((a,j)=><div key={j} className="flex justify-between text-[11px] text-muted-foreground"><span>+ {a.name}</span><span>{a.price}</span></div>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="rounded-[10px] border border-border/50 bg-background px-4 py-3 space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Rincian</p>
            {[{l:"Total Item",v:idr(p.total_price),c:""},{l:"Convenience Fee",v:idr(p.convenience_fee),c:p.convenience_fee<0?"text-red-500":""},{l:"Diskon",v:idr(p.discount),c:p.discount>0?"text-emerald-500":""}].map(r=>(
              <div key={r.l} className="flex justify-between text-[12px]"><span className="text-muted-foreground">{r.l}</span><span className={`font-medium ${r.c}`}>{r.v}</span></div>
            ))}
            <div className="flex justify-between text-[13px] font-bold border-t border-border/50 pt-1.5 mt-1"><span>Grand Total</span><span className="text-emerald-600">{idr(p.grand_total)}</span></div>
          </div>
          <p className="text-[11px] text-muted-foreground font-mono">Ref: <span className="select-all text-foreground">{p.ref_id}</span> · {fmt(p.created_at,"dd MMM yyyy, HH:mm")}</p>
        </div>
      )}
    </div>
  )
}

type Period = "7d"|"30d"|"all"

export default function LynkAnalytics() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [allPayments, setAllPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [period, setPeriod] = useState<Period>("30d")
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const PAGE_SIZE = 20

  const fetchAll = useCallback(async(soft=false) => {
    soft?setRefreshing(true):setLoading(true)
    const cutoff = period==="7d"?subDays(new Date(),7):period==="30d"?subDays(new Date(),30):null
    let q = snipieClient.from("lynk_payments").select("*").order("created_at",{ascending:false})
    if(cutoff) q = q.gte("created_at",cutoff.toISOString())
    const {data} = await q
    if(data) setAllPayments(data as Payment[])
    setLoading(false); setRefreshing(false)
  },[period])

  const fetchPage = useCallback(async() => {
    const cutoff = period==="7d"?subDays(new Date(),7):period==="30d"?subDays(new Date(),30):null
    let q = snipieClient.from("lynk_payments").select("*",{count:"exact"}).order("created_at",{ascending:false}).range(page*PAGE_SIZE,(page+1)*PAGE_SIZE-1)
    if(cutoff) q = q.gte("created_at",cutoff.toISOString())
    const {data,count} = await q
    if(data) setPayments(data as Payment[])
    if(count!==null) setTotalCount(count)
  },[period,page])

  useEffect(()=>{setPage(0)},[period])
  useEffect(()=>{fetchAll()},[fetchAll])
  useEffect(()=>{fetchPage()},[fetchPage])

  useEffect(()=>{
    const ch = snipieClient.channel("lynk_rt")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"lynk_payments"},p=>{
        setAllPayments(prev=>[p.new as Payment,...prev])
        setPayments(prev=>[p.new as Payment,...prev])
        setTotalCount(c=>c+1)
      }).subscribe()
    return ()=>{snipieClient.removeChannel(ch)}
  },[])

  // Derived stats
  const totalRevenue = allPayments.reduce((s,p)=>s+(p.grand_total??0),0)
  const avgOrderValue = allPayments.length? totalRevenue/allPayments.length:0
  const uniqueEmails = new Set(allPayments.map(p=>p.customer_email).filter(Boolean)).size

  const today = startOfDay(new Date())
  const todayPayments = allPayments.filter(p=>new Date(p.created_at)>=today)
  const todayRevenue = todayPayments.reduce((s,p)=>s+(p.grand_total??0),0)

  // Daily chart data (last 14 days)
  const dailyMap: Record<string,number> = {}
  const days = period==="7d"?7:period==="30d"?30:14
  for(let i=days-1;i>=0;i--) {
    const d = format(subDays(new Date(),i),"dd MMM")
    dailyMap[d]=0
  }
  allPayments.forEach(p=>{
    const d = fmt(p.created_at,"dd MMM")
    if(d in dailyMap) dailyMap[d]+=(p.grand_total??0)
  })
  const chartData = Object.entries(dailyMap).map(([date,revenue])=>({date,revenue}))

  // Top products
  const productMap: Record<string,{count:number;revenue:number}> = {}
  allPayments.forEach(p=>{
    (p.items??[]).forEach(item=>{
      if(!productMap[item.title]) productMap[item.title]={count:0,revenue:0}
      productMap[item.title].count+=item.qty
      productMap[item.title].revenue+=item.price*item.qty
    })
  })
  const topProducts = Object.entries(productMap).sort((a,b)=>b[1].revenue-a[1].revenue).slice(0,5).map(([name,d])=>({name:name.length>30?name.slice(0,30)+"…":name,...d}))

  // Voucher stats
  const voucherMap: Record<string,number> = {}
  allPayments.filter(p=>p.voucher_code).forEach(p=>{ voucherMap[p.voucher_code!]=(voucherMap[p.voucher_code!]??0)+1 })
  const topVouchers = Object.entries(voucherMap).sort((a,b)=>b[1]-a[1]).slice(0,5)

  const totalPages = Math.ceil(totalCount/PAGE_SIZE)

  const PERIODS: {key:Period;label:string}[] = [{key:"7d",label:"7 Hari"},{key:"30d",label:"30 Hari"},{key:"all",label:"Semua"}]

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      {/* Header */}
      <div className="relative rounded-[16px] overflow-hidden bg-gradient-to-br from-emerald-600 to-teal-600 p-6 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold tracking-wider backdrop-blur-sm">
                <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse"/>REALTIME · lynk.id
              </div>
            </div>
            <h1 className="text-2xl font-bold">Lynk.id Analytics</h1>
            <p className="text-sm text-white/70 mt-1">Dashboard analitik transaksi & revenue.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 rounded-[10px] bg-white/20 p-1">
              {PERIODS.map(p=>(
                <button key={p.key} onClick={()=>setPeriod(p.key)}
                  className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold transition-all ${period===p.key?"bg-white text-emerald-700":"text-white/80 hover:text-white"}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <button onClick={()=>{fetchAll(true);fetchPage()}} disabled={refreshing||loading}
              className="flex items-center gap-1.5 rounded-[10px] bg-white/20 hover:bg-white/30 border border-white/20 px-3 py-2 text-sm font-medium text-white transition-all disabled:opacity-50">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing?"animate-spin":""}`}/>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {label:"Total Revenue",value:idr(totalRevenue),sub:`${allPayments.length} transaksi`,icon:TrendingUp,color:"text-emerald-500",bg:"bg-emerald-50 dark:bg-emerald-950/40"},
          {label:"Avg Order Value",value:idr(avgOrderValue),sub:"per transaksi",icon:CreditCard,color:"text-teal-500",bg:"bg-teal-50 dark:bg-teal-950/40"},
          {label:"Revenue Hari Ini",value:idr(todayRevenue),sub:`${todayPayments.length} transaksi`,icon:ShoppingBag,color:"text-violet-500",bg:"bg-violet-50 dark:bg-violet-950/40"},
          {label:"Unique Customers",value:uniqueEmails.toLocaleString("id-ID"),sub:"email unik",icon:Users,color:"text-blue-500",bg:"bg-blue-50 dark:bg-blue-950/40"},
        ].map((s,i)=>(
          <div key={s.label} className="apple-card px-4 py-4 animate-stagger-item" style={{"--i":i} as React.CSSProperties}>
            <div className={`flex h-9 w-9 items-center justify-center rounded-[10px] mb-2.5 ${s.bg}`}>
              <s.icon className={`h-4 w-4 ${s.color}`}/>
            </div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{s.label}</p>
            <p className={`text-lg font-bold mt-0.5 truncate ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div className="apple-card p-5">
        <h2 className="text-[13px] font-semibold mb-4">Tren Revenue Harian</h2>
        {loading?(
          <div className="h-48 flex items-center justify-center"><div className="skeleton h-40 w-full rounded-[10px]"/></div>
        ):(
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5}/>
              <XAxis dataKey="date" tick={{fontSize:10}} stroke="var(--muted-foreground)" tickLine={false}/>
              <YAxis tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}K`:v.toString()} tick={{fontSize:10}} stroke="var(--muted-foreground)" tickLine={false} axisLine={false}/>
              <Tooltip formatter={(v:number)=>[idr(v),"Revenue"]} contentStyle={{borderRadius:10,border:"1px solid var(--border)",background:"var(--background)",fontSize:12}}/>
              <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} dot={false} activeDot={{r:4,fill:"#10b981"}}/>
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Products + Voucher */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Top Products */}
        <div className="apple-card p-5">
          <h2 className="text-[13px] font-semibold mb-4">Top Produk</h2>
          {loading?(
            <div className="space-y-2">{Array.from({length:4}).map((_,i)=><div key={i} className="skeleton h-8 rounded-[8px]"/>)}</div>
          ):topProducts.length===0?(
            <p className="text-[12px] text-muted-foreground text-center py-6">Belum ada data produk</p>
          ):(
            <>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={topProducts} layout="vertical" margin={{left:0,right:16}}>
                  <XAxis type="number" hide/>
                  <YAxis type="category" dataKey="name" width={120} tick={{fontSize:10}} tickLine={false} axisLine={false}/>
                  <Tooltip formatter={(v:number)=>[idr(v),"Revenue"]} contentStyle={{borderRadius:10,border:"1px solid var(--border)",background:"var(--background)",fontSize:12}}/>
                  <Bar dataKey="revenue" fill="#8b5cf6" radius={[0,4,4,0]}/>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1.5">
                {topProducts.map((p,i)=>(
                  <div key={p.name} className="flex items-center gap-3">
                    <span className="text-[11px] font-bold text-muted-foreground w-4">{i+1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium truncate">{p.name}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[12px] font-bold text-emerald-600">{idr(p.revenue)}</p>
                      <p className="text-[10px] text-muted-foreground">{p.count}x terjual</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Voucher Usage + Summary */}
        <div className="space-y-4">
          <div className="apple-card p-5">
            <h2 className="text-[13px] font-semibold mb-3">Voucher Usage</h2>
            {topVouchers.length===0?(
              <p className="text-[12px] text-muted-foreground text-center py-4">Tidak ada voucher digunakan</p>
            ):(
              <div className="space-y-2">
                {topVouchers.map(([code,count])=>(
                  <div key={code} className="flex items-center gap-3">
                    <code className="text-[11px] font-mono font-bold bg-violet-50 dark:bg-violet-950/40 text-violet-600 px-2 py-0.5 rounded-md">{code}</code>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-violet-400 rounded-full" style={{width:`${(count/(topVouchers[0][1]||1))*100}%`}}/>
                    </div>
                    <span className="text-[12px] font-bold tabular-nums text-muted-foreground">{count}x</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="apple-card p-5">
            <h2 className="text-[13px] font-semibold mb-3">Ringkasan Finansial</h2>
            <div className="space-y-2">
              {[
                {l:"Total Revenue",v:idr(totalRevenue),c:"text-emerald-600 font-bold"},
                {l:"Total Convenience Fee",v:idr(allPayments.reduce((s,p)=>s+(p.convenience_fee??0),0)),c:"text-red-500"},
                {l:"Total Diskon",v:idr(allPayments.reduce((s,p)=>s+(p.discount??0),0)),c:"text-amber-500"},
                {l:"Avg Order Value",v:idr(avgOrderValue),c:"text-foreground"},
                {l:"Transaksi Terbesar",v:idr(Math.max(0,...allPayments.map(p=>p.grand_total??0))),c:"text-violet-600"},
              ].map(r=>(
                <div key={r.l} className="flex justify-between text-[12px] py-1 border-b border-border/30 last:border-0">
                  <span className="text-muted-foreground">{r.l}</span>
                  <span className={r.c}>{r.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Webhook URL */}
      <div className="rounded-[12px] border border-blue-200/60 bg-blue-50/50 dark:border-blue-800/40 dark:bg-blue-950/20 px-4 py-3">
        <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-widest mb-1">Webhook URL</p>
        <code className="text-[12px] text-blue-800 dark:text-blue-300 font-mono select-all">https://mytool-silk.vercel.app/api/webhooks/lynk</code>
      </div>

      {/* Transaction List */}
      <div className="apple-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50 bg-muted/20">
          <h2 className="text-[13px] font-semibold">Riwayat Transaksi</h2>
          <div className="flex items-center gap-2">
            {totalPages>1&&<span className="text-[11px] text-muted-foreground">hal. {page+1}/{totalPages}</span>}
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{totalCount.toLocaleString("id-ID")}</span>
          </div>
        </div>
        {loading?(
          <div className="divide-y divide-border/40">
            {Array.from({length:5}).map((_,i)=>(
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="skeleton h-10 w-10 rounded-[10px] shrink-0"/>
                <div className="flex-1 space-y-2"><div className="skeleton h-3 w-1/3"/><div className="skeleton h-3 w-1/2"/></div>
                <div className="skeleton h-6 w-24 rounded"/>
              </div>
            ))}
          </div>
        ):payments.length===0?(
          <div className="flex flex-col items-center py-16 gap-3">
            <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center"><Circle className="h-6 w-6 text-muted-foreground/50"/></div>
            <p className="text-sm font-medium text-muted-foreground">Belum ada transaksi</p>
          </div>
        ):(
          <div>{payments.map(p=><PaymentRow key={p.id} p={p}/>)}</div>
        )}
        {totalPages>1&&!loading&&(
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-border/50 bg-muted/10">
            <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0}
              className="rounded-[8px] px-3 py-1.5 text-[13px] font-medium border border-border bg-background hover:bg-muted transition-colors disabled:opacity-40">← Sebelumnya</button>
            <span className="text-[12px] text-muted-foreground">{page*PAGE_SIZE+1}–{Math.min((page+1)*PAGE_SIZE,totalCount)} dari {totalCount}</span>
            <button onClick={()=>setPage(p=>Math.min(totalPages-1,p+1))} disabled={page>=totalPages-1}
              className="rounded-[8px] px-3 py-1.5 text-[13px] font-medium border border-border bg-background hover:bg-muted transition-colors disabled:opacity-40">Berikutnya →</button>
          </div>
        )}
      </div>
    </div>
  )
}
