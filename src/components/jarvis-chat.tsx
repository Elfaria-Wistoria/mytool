"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { X, Send, Loader2, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import Image from "next/image"

type Message = {
  role: "user" | "assistant"
  content: string
}

const PROACTIVE_PROMPTS = [
  "Berikan Edwin ringkasan singkat tentang kondisi hari ini berdasarkan datanya — schedule, tugas, keuangan, dan target. Jadilah singkat dan padat, maksimal 3 kalimat. Mulai dengan sapaan yang hangat dan sedikit elegan.",
  "Cek apakah ada target hidup Edwin yang mendekati deadline atau membutuhkan perhatian. Berikan insight singkat dan motivasi. Kalau tidak ada yang urgent, beri semangat general.",
  "Apa yang harus Edwin prioritaskan hari ini berdasarkan schedule dan tugasnya? Berikan 2-3 poin action yang konkret dan singkat.",
  "Berikan Edwin insight keuangan singkat — apakah kondisi tabungannya on-track dengan target-targetnya?",
]

const STORAGE_KEY = "kaguya_chat_history"
const MAX_STORED = 60 // keep last 60 messages in memory

let proactiveInterval: ReturnType<typeof setInterval> | null = null

// ── Lightweight markdown renderer ──────────────────────────────────────────
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n")
  return lines.map((line, li) => {
    // Split by **bold** and *italic*
    const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
    return (
      <span key={li}>
        {parts.map((part, pi) => {
          if (part.startsWith("**") && part.endsWith("**"))
            return <strong key={pi} className="font-semibold">{part.slice(2, -2)}</strong>
          if (part.startsWith("*") && part.endsWith("*"))
            return <em key={pi}>{part.slice(1, -1)}</em>
          return part
        })}
        {li < lines.length - 1 && <br />}
      </span>
    )
  })
}

export function JarvisChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [mounted, setMounted] = useState(false)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [unread, setUnread] = useState(0)
  const [peekMsg, setPeekMsg] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const initialized = useRef(false)

  // Load history from localStorage after mount (client-only)
  useEffect(() => {
    setMounted(true)
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setMessages(JSON.parse(stored) as Message[])
    } catch { /* ignore */ }
  }, [])

  // Persist messages to localStorage on every change (after mounted)
  useEffect(() => {
    if (!mounted || messages.length === 0) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED)))
    } catch { /* quota exceeded */ }
  }, [messages, mounted])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  useEffect(() => {
    if (open) {
      setUnread(0)
      setPeekMsg(null)
      setTimeout(() => textareaRef.current?.focus(), 150)
    }
  }, [open])

  const callKaguya = useCallback(async (msgs: Message[], isProactive = false, proactivePrompt?: string): Promise<string | null> => {
    try {
      const payload = isProactive
        ? [{ role: "user" as const, content: proactivePrompt! }]
        : msgs.map(m => ({ role: m.role, content: m.content }))

      const res = await fetch("/api/jarvis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payload })
      })
      
      const data = await res.json()
      if (!res.ok) return data.error ?? "Terjadi kesalahan koneksi."
      return data.content ?? null
    } catch {
      return "Koneksi ke Kaguya terputus. Pastikan internet Anda lancar."
    }
  }, [])

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const runInitial = async () => {
      // Skip auto-briefing if we already restored stored history
      const hasHistory = (() => {
        try { return !!localStorage.getItem(STORAGE_KEY) } catch { return false }
      })()
      if (hasHistory) return

      await new Promise(r => setTimeout(r, 2500))
      const content = await callKaguya([], true, PROACTIVE_PROMPTS[0])
      if (!content) return

      setMessages([{ role: "assistant", content }])
      const preview = content.slice(0, 90) + (content.length > 90 ? "…" : "")
      setPeekMsg(preview)
      setUnread(1)
      setTimeout(() => setPeekMsg(null), 8000)
    }

    runInitial()

    if (!proactiveInterval) {
      proactiveInterval = setInterval(async () => {
        const idx = Math.floor(Math.random() * (PROACTIVE_PROMPTS.length - 1)) + 1
        const content = await callKaguya([], true, PROACTIVE_PROMPTS[idx])
        if (!content) return
        setMessages(prev => [...prev, { role: "assistant", content }])
        setUnread(prev => prev + 1)
        const preview = content.slice(0, 90) + (content.length > 90 ? "…" : "")
        setPeekMsg(preview)
        setTimeout(() => setPeekMsg(null), 8000)
      }, 20 * 60 * 1000)
    }

    return () => {
      if (proactiveInterval) { clearInterval(proactiveInterval); proactiveInterval = null }
    }
  }, [callKaguya])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return
    const userMsg: Message = { role: "user", content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput("")
    setLoading(true)
    const content = await callKaguya(newMessages)
    setMessages(prev => [...prev, {
      role: "assistant",
      content: content ?? "Maaf, terjadi kesalahan. Coba lagi ya Edwin!"
    }])
    setLoading(false)
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Don't render until client-side hydration is complete to avoid mismatch
  if (!mounted) return null

  return (
    <>
      {/* Peek toast */}
      {peekMsg && !open && (
        <div
          className="fixed bottom-[88px] right-6 z-50 max-w-[300px] cursor-pointer"
          onClick={() => setOpen(true)}
        >
          <div className="relative flex items-start gap-2.5 px-4 py-3 rounded-2xl rounded-br-none
            bg-background/98 dark:bg-card/98 backdrop-blur-2xl
            border border-border/60 shadow-xl text-sm text-foreground leading-snug
            animate-in slide-in-from-bottom-3 duration-300"
          >
            <Image priority src="/kaguya.jpg" alt="Kaguya" width={28} height={28} className="rounded-full object-cover shrink-0 mt-0.5 ring-1 ring-border/40" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">Kaguya</p>
              <p className="text-sm leading-relaxed text-foreground">{peekMsg}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setPeekMsg(null) }}
              className="absolute top-2.5 right-2.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          {/* Tail */}
          <div className="flex justify-end pr-5">
            <div className="w-3 h-3 bg-background/98 dark:bg-card/98 border-r border-b border-border/60 rotate-45 -translate-y-1.5 mr-1" />
          </div>
        </div>
      )}

      {/* Floating avatar button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full transition-all duration-300 group"
        aria-label="Kaguya Assistant"
      >
        <div className={`relative h-full w-full rounded-full overflow-hidden ring-2 transition-all duration-300
          ${open
            ? "ring-foreground/20 scale-90"
            : "ring-white/20 shadow-2xl hover:scale-105 hover:ring-white/40"
          }`}
        >
          <Image priority src="/kaguya.jpg" alt="Kaguya" fill sizes="56px" className="object-cover" />
          {/* Overlay when open */}
          {open && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <X className="h-5 w-5 text-white" />
            </div>
          )}
        </div>
        {/* Pulse ring */}
        {!open && <span className="absolute inset-0 rounded-full ring-4 ring-white/20 animate-ping" />}
        {/* Badge */}
        {!open && unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-5 min-w-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-background">
            {unread}
          </span>
        )}
      </button>

      {/* Chat panel */}
      <div className={`fixed bottom-[88px] right-6 z-50 w-[360px] flex flex-col rounded-2xl overflow-hidden
        border border-border/40 shadow-2xl
        bg-background/98 dark:bg-[#111113]/98 backdrop-blur-2xl
        transition-all duration-300 ease-out origin-bottom-right
        ${open ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-3 pointer-events-none"}`}
        style={{ maxHeight: "min(600px, calc(100vh - 120px))" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/30">
          <div className="relative h-9 w-9 rounded-full overflow-hidden ring-1 ring-border/40 shrink-0">
            <Image priority src="/kaguya.jpg" alt="Kaguya" fill sizes="36px" className="object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Kaguya</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-[10px] text-muted-foreground">Online · DeepSeek-V3</p>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => {
                setMessages([])
                try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
              }}
              className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted/60 transition-colors"
            >
              Clear
            </button>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)}
              className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground">
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0"
          style={{ maxHeight: "400px" }}>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <div className="relative h-16 w-16 rounded-full overflow-hidden ring-1 ring-border/40 opacity-60">
                <Image priority src="/kaguya.jpg" alt="Kaguya" fill sizes="64px" className="object-cover" />
              </div>
              <p className="text-xs text-muted-foreground">Kaguya sedang memuat briefing harian...</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
              {msg.role === "assistant" && (
                <div className="relative h-7 w-7 rounded-full overflow-hidden shrink-0 mt-0.5 ring-1 ring-border/30">
                  <Image priority src="/kaguya.jpg" alt="Kaguya" fill sizes="28px" className="object-cover" />
                </div>
              )}
              <div className={`max-w-[82%] text-sm leading-relaxed break-words
                rounded-2xl px-3.5 py-2.5
                ${msg.role === "user"
                  ? "bg-foreground text-background rounded-tr-sm"
                  : "bg-muted/70 dark:bg-white/[0.06] text-foreground rounded-tl-sm"
                }`}
              >
                {renderMarkdown(msg.content)}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-2.5">
              <div className="relative h-7 w-7 rounded-full overflow-hidden shrink-0 mt-0.5 ring-1 ring-border/30">
                <Image priority src="/kaguya.jpg" alt="Kaguya" fill sizes="28px" className="object-cover" />
              </div>
              <div className="bg-muted/70 dark:bg-white/[0.06] rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:160ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:320ms]" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-3 pb-3 pt-2 border-t border-border/30">
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Tulis pesan untuk Kaguya..."
              className="min-h-[38px] max-h-28 resize-none rounded-xl text-sm py-2 px-3
                bg-muted/40 dark:bg-white/[0.04] border-border/40
                focus-visible:ring-1 focus-visible:ring-border/80 transition-colors"
              rows={1}
            />
            <Button
              size="icon"
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="h-9 w-9 rounded-xl shrink-0 bg-foreground text-background hover:opacity-80 border-0 transition-all"
            >
              {loading
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Send className="h-3.5 w-3.5" />
              }
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground/50 text-center mt-2 select-none">
            Enter kirim · Shift+Enter baris baru
          </p>
        </div>
      </div>
    </>
  )
}
