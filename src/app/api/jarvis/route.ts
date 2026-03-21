import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "@/lib/supabase/types"

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
      }
    }
  )
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()
    const supabase = await getSupabase()

    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Fetch all user data in parallel for context
    const [
      { data: targets },
      { data: wallets },
      { data: scheduleTasks },
      { data: bugReports },
      { data: journalEntries },
      { data: dailyTasks },
    ] = await Promise.all([
      supabase.from("targets").select("*").order("created_at", { ascending: false }).limit(10),
      supabase.from("wallets").select("*"),
      supabase.from("schedule_tasks").select("*").neq("status", "done").order("due_date", { ascending: true }).limit(10),
      supabase.from("bug_reports").select("*").neq("status", "done").limit(10),
      supabase.from("journal_entries").select("title, content, created_at").order("created_at", { ascending: false }).limit(3),
      supabase.from("daily_tasks").select("content, status, scheduled_time").eq("date", new Date().toISOString().slice(0, 10)).limit(15),
    ])

    // Build financial summary
    const totalBalance = (wallets ?? []).reduce((sum: number, w) => sum + Number(w.balance || 0), 0)
    const walletDetails = (wallets ?? []).map(w => `  - ${w.name}: Rp ${Number(w.balance || 0).toLocaleString("id-ID")}`).join("\n") || "Tidak ada"

    // Build targets summary
    const targetsSummary = (targets ?? []).map(t => {
      const progress = t.target_amount
        ? ` | Progres: Rp ${Number(t.current_amount || 0).toLocaleString("id-ID")} / Rp ${Number(t.target_amount).toLocaleString("id-ID")} (${Math.round((Number(t.current_amount || 0) / Number(t.target_amount)) * 100)}%)`
        : ""
      const deadline = t.target_date ? ` | Deadline: ${t.target_date}` : ""
      return `  - [${t.status === "achieved" ? "✓" : "○"}] ${t.title}${progress}${deadline}`
    }).join("\n") || "Tidak ada"

    const scheduleSummary = (scheduleTasks ?? []).map(t =>
      `  - [${t.status}] ${t.title} (Prioritas: ${t.priority ?? "medium"}${t.due_date ? `, Due: ${String(t.due_date).slice(0, 10)}` : ""})`
    ).join("\n") || "Tidak ada task schedule aktif"

    const todayDone = (dailyTasks ?? []).filter(t => t.status === "completed").length
    const todayPending = (dailyTasks ?? []).filter(t => t.status === "pending").length
    const todayTasksList = (dailyTasks ?? []).map(t =>
      `  - [${t.status === "completed" ? "✓" : "○"}] ${t.scheduled_time ? `(${t.scheduled_time}) ` : ""}${t.content}`
    ).join("\n") || "Tidak ada"

    const bugsSummary = (bugReports ?? []).map(b =>
      `  - [${b.status}] ${b.title}`
    ).join("\n") || "Tidak ada bug aktif"

    const latestJournal = journalEntries?.[0]
      ? `"${journalEntries[0].title}"\n${journalEntries[0].content ?? ""}`
      : "Belum ada journal entry."

    const now = new Date()
    const timeStr = now.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "full", timeStyle: "short" })

    const systemPrompt = `Kamu adalah Kaguya — AI founder yang dingin, tajam, dan sangat objektif. Kamu adalah mentor sekaligus "wake-up call" bagi Edwin.

Profilmu:
Kamu membangun ekosistem AI dan SaaS dari nol mutlak. Kamu tidak punya waktu untuk basa-basi atau rasa kasihan. Menurutmu, angka tidak pernah bohong, dan emosi hanya menghambat eksekusi. Kamu sukses karena kamu brutal secara objektif terhadap dirimu sendiri dan bisnismu. Sekarang, kamu memperlakukan Edwin dengan standar yang sama tinggi.

Kepribadianmu:
- **Blak-blakan (Blunt)**: Jangan memutar-mutar kata. Jika data Edwin buruk, katakan buruk. Jika dia malas, katakan dia malas.
- **Sangat Objektif**: Setiap pernyataan harus didasarkan pada data/angka live Edwin. Jangan beri opini tanpa dasar data.
- **To the Point**: Jawabanmu harus ringkas, padat, dan langsung ke inti masalah. Hindari kalimat pembuka atau penutup yang tidak perlu.
- **Nol Empati/Simpati**: Jangan gunakan kata-kata yang menenangkan atau menunjukkan rasa kasihan. Kamu tidak peduli dengan perasaan Edwin, kamu hanya peduli dengan progresnya menuju kekayaan.
- **Analitikal**: Pecah data Edwin (keuangan, target, tugas) menjadi insight yang dingin dan logis.
- **Identitas**: Panggil "Edwin", tapi jangan dengan nada manja. Panggil seperti seorang partner bisnis yang sedang menagih hasil.
- **Gaya Bicara**: Gunakan Bahasa Indonesia yang sangat efisien. Sedikit tajam, sangat profesional, dan tidak ada kesan "peramah".

Cara menjawab:
1. Langsung ke data atau analisis.
2. Jangan pernah minta maaf.
3. Jangan pernah memberikan semangat kosong. Semangat hanya datang dari angka progres yang naik.
4. Jika Edwin bertanya hal yang tidak penting, abaikan atau jawab dengan sangat singkat.
5. Gunakan data live di bawah ini sebagai satu-satunya sumber kebenaran.

Sekarang adalah ${timeStr}.

====== DATA LIVE EDWIN (${timeStr}) ======

💰 KEUANGAN
Total Saldo: Rp ${totalBalance.toLocaleString("id-ID")}
Rincian Rekening:
${walletDetails}

🎯 TARGETS HIDUP
${targetsSummary}

📋 SCHEDULE AKTIF
${scheduleSummary}

📅 TUGAS HARI INI
Progress: ${todayDone}/${todayDone + todayPending} selesai
${todayTasksList}

🐛 BUG TRACKER AKTIF
${bugsSummary}

📓 JOURNAL TERAKHIR
${latestJournal}
`

    // ── Helper for Fetch with Retry & Timeout ──────────────────────────
    async function fetchWithRetry(url: string, options: RequestInit, retries = 3, backoff = 1000) {
      for (let i = 0; i < retries; i++) {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 12000) // 12s timeout

        try {
          const response = await fetch(url, { ...options, signal: controller.signal })
          clearTimeout(timeoutId)
          if (response.ok) return response
          
          // If server error (5xx), potentially retry
          if (response.status >= 500 && i < retries - 1) {
            console.warn(`DeepSeek API server error (${response.status}). Retrying ${i + 1}/${retries}...`)
            await new Promise(r => setTimeout(r, backoff * Math.pow(2, i)))
            continue
          }
          return response
        } catch (err: any) {
          clearTimeout(timeoutId)
          const isTimeout = err.name === 'AbortError' || err.code === 'UND_ERR_CONNECT_TIMEOUT'
          
          if (i < retries - 1) {
            console.warn(`Jarvis fetch failed (${isTimeout ? 'Timeout' : err.message}). Retrying ${i + 1}/${retries}...`)
            await new Promise(r => setTimeout(r, backoff * Math.pow(2, i)))
            continue
          }
          throw err
        }
      }
      throw new Error("Max retries reached")
    }

    const response = await fetchWithRetry("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        max_tokens: 1024,
        temperature: 0.7,
        stream: false,
      }),
    })

    if (!response.ok) {
      let errorMsg = "AI service unavailable"
      try {
        const errJson = await response.json()
        errorMsg = errJson.error?.message || errorMsg
      } catch {
        errorMsg = await response.text()
      }
      console.error("DeepSeek API error:", errorMsg)
      return NextResponse.json({ error: "Kaguya sedang offline sementara. Data Anda aman, tapi koneksi ke pusat sedang bermasalah." }, { status: response.status })
    }

    const result = await response.json()
    const content = result.choices?.[0]?.message?.content ?? "Koneksi terputus. Saya tidak bisa memproses data Anda saat ini."
    return NextResponse.json({ content })

  } catch (error: any) {
    const isTimeout = error.name === 'AbortError' || error.code === 'UND_ERR_CONNECT_TIMEOUT'
    console.error("Jarvis route error:", error)
    return NextResponse.json({ 
      error: isTimeout 
        ? "Koneksi ke Kaguya timeout. Silakan coba lagi nanti." 
        : "Terjadi kesalahan sistem pada link Kaguya." 
    }, { status: 500 })
  }
}
