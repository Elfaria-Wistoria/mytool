"use client"

import { useState, useEffect } from "react"
import { Sparkles, BrainCircuit, PenTool, BarChart2, Loader2, Save, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Copy, Check, Image as ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"
import {
  startOfMonth, endOfMonth, eachDayOfInterval, format, isSameMonth, isToday,
  addMonths, subMonths, startOfWeek, endOfWeek
} from "date-fns"

const supabase = createClient()

type ThreadPost = {
  id?: string
  date: string
  content: string | null
  viewers: number
  buyers: number
  evaluation: string | null
  profile_id?: string
  account_id?: string
}

type Account = {
  id: string
  handle: string
  platform: string
}

export default function AutoThreadsPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [posts, setPosts] = useState<Record<string, Record<string, ThreadPost>>>({})
  const [loading, setLoading] = useState(true)
  const [profileId, setProfileId] = useState<string | null>(null)
  
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'post' | 'image' | 'metrics'>('post')
  const [postLanguage, setPostLanguage] = useState<'id' | 'en'>('id')
  const [postCount, setPostCount] = useState<number>(1)

  // Dialog State
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [dayPosts, setDayPosts] = useState<Record<string, ThreadPost>>({})
  const [isGenerating, setIsGenerating] = useState(false)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [imagePrompts, setImagePrompts] = useState<Record<string, string>>({})
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [bgStyle, setBgStyle] = useState<string>('white-studio')
  const [artStyle, setArtStyle] = useState<string>('realistic')
  const [characterType, setCharacterType] = useState<string>('human')
  const [characterGender, setCharacterGender] = useState<string>('any')
  const [customCharacterStyle, setCustomCharacterStyle] = useState<string>('')
  const [customCharacterOutfit, setCustomCharacterOutfit] = useState<string>('')
  const [targetMarket, setTargetMarket] = useState<string>('')
  const [isNegativeMode, setIsNegativeMode] = useState(false)

  // Fetch currently logged in user profile_id equivalent
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setProfileId(data.user?.id || null))
  }, [])

  const fetchAccounts = async () => {
    const { data: allAccounts } = await supabase.from('accounts').select('id, handle, platform')
    if (allAccounts) {
      setAccounts(allAccounts)
      if (allAccounts.length > 0 && !selectedAccountId) {
        setSelectedAccountId(allAccounts[0].id)
      }
    }
  }

  const fetchPosts = async (date: Date) => {
    setLoading(true)
    const monthStart = startOfMonth(date)
    const monthEnd = endOfMonth(date)

    const { data, error } = await supabase
      .from("thread_posts")
      .select("*")
      .gte("date", format(monthStart, "yyyy-MM-dd"))
      .lte("date", format(monthEnd, "yyyy-MM-dd"))

    if (!error && data) {
      const postsMap: Record<string, Record<string, ThreadPost>> = {}
      data.forEach(p => {
        if (!postsMap[p.date]) postsMap[p.date] = {}
        if (p.account_id) {
          postsMap[p.date][p.account_id] = p as ThreadPost
        }
      })
      setPosts(postsMap)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (profileId) {
      fetchAccounts()
      fetchPosts(currentDate)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, profileId])

  const handleDayClick = (day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd")
    setSelectedDate(day)
    
    const postsForDay = posts[dateStr] || {}
    const drafts: Record<string, ThreadPost> = {}
    
    accounts.forEach(acc => {
      drafts[acc.id] = postsForDay[acc.id] || {
        date: dateStr,
        account_id: acc.id,
        content: "",
        viewers: 0,
        buyers: 0,
        evaluation: "",
      }
    })
    setDayPosts(drafts)
  }

  const activePost = selectedAccountId ? dayPosts[selectedAccountId] : null

  const handleGeneratePost = async () => {
    if (!activePost || !selectedAccountId) return
    setIsGenerating(true)
    
    // Auto-generate instructions based on the active account
    const activeAccount = accounts.find(a => a.id === selectedAccountId)
    const platform = activeAccount?.platform.toLowerCase() || 'threads'
    const handle = activeAccount?.handle || 'user'
    
    let instruction = `You are a top 1% direct-response copywriter and content creator for the ${platform} account @${handle}.
Your goal is to CONVERT clippers/repurposers to a desktop app that clips long videos into shorts natively.

CRITICAL RULES FOR PSYCHOLOGY & TONE:
1. NO PREDICTABLE AI TEMPLATES. DO NOT use the words "viral" or "meledak" excessively. Use credible terms like "high retention", "siap FYP", "scroll-stopping", or "lebih gampang ditonton sampai habis".
2. TONE: Confident, relatable creator/hustler. Do NOT be overly aggressive or attacking. Share frustrations as a fellow creator (e.g., "Gue sempet capek bayar langganan Web AI...", "Bikin video pakai OpusClip atau Vizard emang cepet, tapi harganya lumayan...").
3. SOCIAL PROOF: Always inject subtle social proof (e.g., "Udah dipake banyak creator", "Gue pake sendiri buat...", "Hasilnya: bikin 10 klip cuma 5 menit", "Makin banyak creator pelan-pelan pindah ke lokal").
4. THE REVEAL: Subtly introduce the app as the smarter way: One-time lifetime license (NO subs), runs locally on PC, BYO Deepseek API key, maximum privacy. 
5. DIVERSE CTAs: DO NOT just say "Klik link di bio". Use varied, low-friction CTAs: "Liat demonya dulu di bio", "Cek sebelum harga lifetime-nya naik", "Bandingin sendiri sama tool langganan lu sekarang", "Coba lihat bedanya di bio gue".

LANGUAGE: You MUST output in ${postLanguage === 'id' ? 'Bahasa Indonesia gaul/kasual (Gue/Lu, Twitter/TikTok native style). Absolutely NO robotic words like "apakah Anda".' : 'Conversational, native English hustle-Twitter style.'}
6. ENDING: Provide a VISUAL/FLYER NARRATIVE at the bottom, and exactly 3-5 hyper-targeted HASHTAGS.`

    let userPrompt = ''

    if (platform === 'tiktok' || platform === 'instagram' || platform === 'youtube') {
      instruction += `\n\nSince this is for ${platform}, structure it as a hook-driven video script. Output a devastating HOOK, a quick script body, and the CTA caption.`
      
      if (postCount > 1) {
        instruction += `\n\nCRITICAL: You are generating EXACTLY ${postCount} variations. YOU MUST VARY THE FORMATS COMPLETELY:
- Mix Hard Sell and Soft Sell.
- Include Storytelling formats (e.g., How I changed my workflow).
- Include Mini Case Studies (e.g., Results of using a local tool vs Web AI like OpusClip).
- Include Controversial Opinions (e.g., Why paying monthly for Web-based clippers is a trap).
Do NOT use the same Hook -> Feature -> CTA structure for all. Give each variation a numbered title.`
      }

      userPrompt = `Write ${postCount > 1 ? `${postCount} wildly distinct variations of ` : ''}today's short-form hook and caption for ${platform} in ${postLanguage === 'id' ? 'natural Indonesian' : 'English'}.`
    } else {
      instruction += `\n\nSince this is for a text platform (${platform}), write highly engaging, varied text posts under 300 characters. No cringe formatting.`
      
      if (postCount > 1) {
        instruction += `\n\nCRITICAL: You are generating EXACTLY ${postCount} variations. YOU MUST VARY THE FORMATS COMPLETELY:
- Mix Hard Sell and Soft Sell.
- Include Storytelling formats (e.g., How I changed my workflow).
- Include Mini Case Studies (e.g., Results of using a local tool vs an expensive Web AI).
- Include Controversial Opinions/Questions.
Do NOT use the same Hook -> Feature -> CTA structure for all. Give each variation a numbered title.`
      }

      userPrompt = `Write ${postCount > 1 ? `${postCount} wildly distinct variations of ` : ''}today's text post for ${platform} in ${postLanguage === 'id' ? 'natural Indonesian' : 'English'}.`
    }
    
    try {
      const res = await fetch("/api/auto-threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: instruction },
            { role: "user", content: userPrompt }
          ]
        })
      })

      const data = await res.json()
      if (res.ok) {
        setDayPosts(prev => ({
          ...prev,
          [selectedAccountId]: { ...prev[selectedAccountId], content: data.content }
        }))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleEvaluate = async () => {
    if (!activePost || !selectedAccountId) return
    setIsEvaluating(true)
    
    // The instructions for generating strategy/eval
    const instruction = "You are evaluating the performance of a past Threads post based on the metrics provided. Analyze the conversion from viewers to buyers. Give brutal, actionable Kaguya-style feedback on why it worked or failed, and provide exactly 1 clear strategic tweak for the next post. Keep it concise."
    const prompt = `Post Content: "${activePost.content}"\nViewers: ${activePost.viewers}\nBuyers: ${activePost.buyers}`
    
    try {
      const res = await fetch("/api/auto-threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: instruction },
            { role: "user", content: prompt }
          ]
        })
      })

      const data = await res.json()
      if (res.ok) {
         setDayPosts(prev => ({
          ...prev,
          [selectedAccountId]: { ...prev[selectedAccountId], evaluation: data.content }
        }))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsEvaluating(false)
    }
  }

  const handleGenerateImagePrompt = async () => {
    if (!activePost || !selectedAccountId) return
    const postContent = activePost.content || ''
    if (!postContent.trim()) return

    setIsGeneratingImage(true)

    const artStyles: Record<string, string> = {
      'realistic':  'photorealistic, highly detailed, cinematic lighting, 8k photography, ultra-realistic textures',
      'disney':     'Disney Pixar 3D animation style, cute, expressive, vibrant colors, soft stylized lighting, smooth render, magical feel',
      'cyberpunk':  'cyberpunk aesthetic, synthwave styling, neon glow, futuristic tech wear, moody cinematic',
      'minimal':    'vector flat art style, minimal, bold shapes, solid colors, clean modern illustration',
    }
    const charStyles: Record<string, string> = {
      'human':   `an ultra-realistic, highly expressive Asian ${characterGender === 'any' ? 'creator/entrepreneur' : characterGender} in their early 20s. ${customCharacterOutfit ? `Outfit: ${customCharacterOutfit}.` : 'Wearing modern casual stylish streetwear.'} The pose must be highly dynamic, relatable, and natural (e.g., confidently gesturing, leaning in with excitement, or casually resting on the desk) — absolutely no stiff or passport-photo poses. ${customCharacterStyle ? `Specific details and pose: ${customCharacterStyle}.` : ''}`,
      'mascot':  `a cute highly-expressive animal or robot mascot (e.g., a smart owl, a cool dog, or a friendly small robot). ${customCharacterOutfit ? `Outfit/Accessories: ${customCharacterOutfit}.` : ''} ${customCharacterStyle ? `Specific pose/details: ${customCharacterStyle}.` : ''}`,
      'none':    '(No human or character in the scene, focus entirely on the product/laptop)',
    }

    const bgDescriptions: Record<string, string> = {
      'white-studio':  'pure white seamless studio background, soft diffused overhead light, no shadows, clean and clinical',
      'dark-studio':   'deep charcoal / near-black studio background, subtle rim lighting, slight vignette, moody and premium',
      'warm-minimal':  'warm off-white linen texture background, soft warm morning light from the side, cozy yet minimal',
      'outdoor-cafe':  'blurred upscale café background, bokeh windows, soft natural daylight, shallow depth of field',
      'gradient-mono': 'smooth monochromatic gradient background from light grey to white, absolutely flat and clean',
      'concrete-loft': 'raw concrete texture background, industrial loft feel, cool neutral tones, diffused overcast light',
    }
    const selectedStyle = artStyles[artStyle] ?? artStyles['realistic']
    const selectedChar  = charStyles[characterType] ?? charStyles['human']
    const selectedBg    = bgDescriptions[bgStyle]   ?? bgDescriptions['white-studio']

    const system = `You are a premium creative director specializing in high-conversion social media advertising.
Your task: given a social media post, output a SINGLE valid JSON object (no markdown fences, no text outside the JSON) for use in an AI image generator like banana.google.

CRITICAL DESIGN RULES — Follow exactly:

1. "style": "High-end product advertisement flyer. Art style: ${selectedStyle}. Composition: generous negative space, visually striking, professional flair, uncluttered."
2. "font": REQUIRED → "Poppins for body/sub-text, Sugo Display (or bold geometric sans-serif) for headlines — clean, generous tracking, NO decorative or script fonts"
3. "typography_style": "Poppins Regular for sub-text and CTA, Sugo Display Bold for main headline, NO drop shadows, NO gradients on text, tight and punchy layout"
4. "character": "${selectedChar}. Make them the emotional anchor if present."
5. "background": "${selectedBg}"
6. "scene": "Product (thin laptop showing a bright white minimalist modern video editing interface with timeline and clips) + character (if any) + background. Seamless integration."
7. "mood": "catchy, energetic, scroll-stopping, confident."
8. "pricing_typography": "IF the post mentions a price, force formatting to exactly 'Rp 100.000' (or specific number). CRITICAL: DO NOT put the price inside a clunky box, starburst, or ugly badge. Integrate the price elegantly as sleek floating text or as a seamless part of the modern typography layout. Make it look premium, clean, and aesthetic."
9. "main_text": ${isNegativeMode ? `"Max 8 words. AGGRESSIVE COMPARISON CTA. Highlight that other tools are a $20/month subscription rip-off, while this tool is way cheaper/one-time payment."` : `"Max 6 words. CATCHY and PUNCHY. NEVER formal/kaku. Use casual/hype tone (e.g., 'Edit Video Secepat Kilat!', 'Bikin Konten Tanpa Pusing'). Match post language."`}
10. "sub_text": ${isNegativeMode ? `"10-15 words. Directly compare prices. E.g. 'Platform AI rata-rata $20/bulan. Kita cuma Rp 100.000 sekali bayar permanen!' or similar aggressive price anchoring against $20/month AI tools like OpusClip/etc."` : `"8-12 words. Understated benefit. Casual and on-point. Include the Price here if applicable (e.g., 'Mulai Rp 100.000 aja. Sekali bayar.')."`}
11. "cta_element": "Punchy CTA (e.g., 'Gas Sekarang!', 'Get Access!'). Must be a sleek minimal button or text with an arrow (->). NO stiff corporate CTAs and NO clunky 3D buttons. TARGET AUDIENCE: ${targetMarket ? `The copy MUST specifically call out '${targetMarket}' (e.g., 'Khusus buat para ${targetMarket}', 'Solusi pas buat ${targetMarket}').` : 'General audience.'}"
12. "aspect_ratio": "1080x1350" (or 4:5 vertical orientation)
13. "composition": "rule of thirds, dynamic layout, headline clearly separated from background elements, abundant negative space for copy, NEVER use cluttered geometric shapes behind text."
14. "negative_prompt": "price tag boxes, starburst badges, clunky layout, text errors, overexposed, busy background, script fonts, Comic Sans, decorative type, low quality"
15. "watermark": "ALWAYS include the exact text 'NorraClip' in a sleek, small, minimalist font centered at the very bottom edge of the flyer design."

Output ONLY the raw JSON object. No preamble. No explanation. No markdown. Start with { and end with }.`

    const userMsg = `Post content:\n"""\n${postContent}\n"""\n\nGenerate the flyer JSON prompt now.`

    try {
      const res = await fetch('/api/auto-threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: userMsg },
          ],
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setImagePrompts(prev => ({ ...prev, [selectedAccountId]: data.content }))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsGeneratingImage(false)
    }
  }

  const copyImagePrompt = () => {
    const prompt = selectedAccountId ? imagePrompts[selectedAccountId] : ''
    if (!prompt) return
    navigator.clipboard.writeText(prompt)
    setCopiedPrompt(true)
    setTimeout(() => setCopiedPrompt(false), 2000)
  }

  const handleSave = async () => {
    if (!profileId) return
    setIsSaving(true)

    const payloads = Object.values(dayPosts).map(p => ({
      ...p,
      profile_id: profileId,
      account_id: p.account_id!,
      content: p.content || null,
      viewers: p.viewers || 0,
      buyers: p.buyers || 0,
      evaluation: p.evaluation || null,
    })).filter(p => p.content || p.viewers || p.buyers || p.evaluation || p.id)

    try {
      if (payloads.length > 0) {
        const { data, error } = await supabase
          .from("thread_posts")
          .upsert(payloads, { onConflict: 'profile_id,account_id,date' })
          .select()
        
        if (!error && data) {
          const updatedPosts = { ...posts }
          data.forEach(p => {
            const castedPost = p as ThreadPost
            if (!updatedPosts[castedPost.date]) updatedPosts[castedPost.date] = {}
            if (castedPost.account_id) {
               updatedPosts[castedPost.date][castedPost.account_id] = castedPost
            }
          })
          setPosts(updatedPosts)
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  // Calendar rendering math
  const startDate = startOfWeek(startOfMonth(currentDate))
  const endDate = endOfWeek(endOfMonth(currentDate))
  const dateFormat = "d"
  const days = eachDayOfInterval({ start: startDate, end: endDate })
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-primary" />
            Auto Threads Content Calendar
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate your daily post, track metrics, and let AI evaluate the strategy for all connected accounts.
          </p>
        </div>
      </div>

      <div className="apple-card p-6">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold tabular-nums">
            {format(currentDate, "MMMM yyyy")}
          </h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 rounded-lg font-medium" onClick={() => setCurrentDate(new Date())}>
              Today
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden border border-border/50 bg-border/50">
          {weekDays.map((day) => (
            <div key={day} className="bg-background py-2 text-center text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              {day}
            </div>
          ))}
          {days.map((day, idx) => {
            const dateStr = format(day, "yyyy-MM-dd")
            const postsForDay = posts[dateStr] || {}
            const dayPostsList = Object.values(postsForDay)
            const isCurrentMonth = isSameMonth(day, currentDate)
            const isTodayDate = isToday(day)
            
            const draftedCount = dayPostsList.filter(p => p.content).length
            const evaluatedCount = dayPostsList.filter(p => p.evaluation).length

            const isPast = dateStr < format(new Date(), "yyyy-MM-dd")
            const isDisabled = isPast && draftedCount === 0

            return (
              <div
                key={day.toString()}
                onClick={() => !isDisabled && handleDayClick(day)}
                className={`bg-background min-h-[70px] sm:min-h-[100px] p-1 sm:p-2 transition-colors relative flex flex-col gap-0.5 sm:gap-1
                  ${!isCurrentMonth ? "text-muted-foreground/40 bg-muted/10 opacity-60" : "text-foreground"}
                  ${isDisabled ? "cursor-not-allowed opacity-50 bg-muted/20" : "hover:bg-muted/30 cursor-pointer"}
                `}
              >
                <div className="flex items-center gap-1 justify-end">
                  {isTodayDate && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                  <span className={`text-xs font-medium tabular-nums ${isTodayDate ? "text-primary" : ""}`}>
                    {format(day, dateFormat)}
                  </span>
                </div>
                
                {/* Visual Indicators */}
                <div className="flex-1 space-y-1 overflow-hidden pointer-events-none mt-1">
                  {draftedCount > 0 && (
                    <div className="text-[9px] sm:text-[10px] leading-tight text-foreground bg-accent/40 rounded px-1 sm:px-1.5 py-0.5 sm:py-1 truncate flex items-center gap-1">
                      <PenTool className="h-3 w-3 shrink-0" />
                      <span className="hidden sm:inline">{draftedCount} Drafts</span>
                      <span className="sm:hidden">{draftedCount}</span>
                    </div>
                  )}
                  {dayPostsList.some(p => p.viewers > 0 || p.buyers > 0) && (
                    <div className="text-[9px] sm:text-[10px] leading-tight text-green-600 dark:text-green-500 bg-green-500/10 rounded px-1 sm:px-1.5 py-0.5 sm:py-1 truncate flex items-center gap-1">
                      <BarChart2 className="h-3 w-3 shrink-0" />
                      {dayPostsList.reduce((acc, p) => acc + (p.viewers || 0), 0)}<span className="hidden sm:inline"> v</span> / {dayPostsList.reduce((acc, p) => acc + (p.buyers || 0), 0)}<span className="hidden sm:inline"> b</span>
                    </div>
                  )}
                  {evaluatedCount > 0 && (
                    <div className="text-[10px] leading-tight text-purple-600 dark:text-purple-500 bg-purple-500/10 rounded px-1.5 py-1 truncate flex items-center gap-1">
                      <BrainCircuit className="h-3 w-3 shrink-0" />
                      {evaluatedCount} Eval
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <Dialog open={!!selectedDate} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-5xl sm:max-w-5xl border-border/50 bg-background/90 backdrop-blur-xl gap-0 p-0 overflow-hidden flex flex-col">
          {selectedDate && (
            <>
              <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-border/50 shrink-0">
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-lg sm:text-xl flex flex-wrap items-center gap-2 pr-6 leading-tight">
                    {format(selectedDate, "EEEE, MMMM do, yyyy")}
                    {isToday(selectedDate) && <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs uppercase tracking-widest leading-none">Today</span>}
                  </DialogTitle>
                </div>
              </DialogHeader>
              
              <div className="flex flex-col md:flex-row h-full max-h-[75vh] min-h-[50vh] overflow-hidden">
                {/* Account Tabs / Sidebar */}
                <div className="w-full md:w-56 shrink-0 bg-muted/20 border-b md:border-b-0 md:border-r border-border/50 p-3 sm:p-4 gap-2 flex flex-row md:flex-col overflow-x-auto scrollbar-hide">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 hidden md:block px-2">Accounts</h3>
                  {accounts.map(acc => (
                    <button
                      key={acc.id}
                      onClick={() => setSelectedAccountId(acc.id)}
                      className={`text-sm px-3 py-2.5 rounded-lg text-left transition-all whitespace-nowrap md:whitespace-normal font-medium ${
                        selectedAccountId === acc.id ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted text-foreground/80"
                      }`}
                    >
                      @{acc.handle} <span className="text-[10px] opacity-60 ml-1 uppercase">{acc.platform}</span>
                    </button>
                  ))}
                  {accounts.length === 0 && (
                    <p className="text-xs text-muted-foreground p-2">Wait, no accounts linked...</p>
                  )}
                </div>

                {activePost && selectedAccountId ? (
                  <div className="flex-1 flex flex-col min-h-0 bg-accent/5 overflow-hidden">
                    {/* Tab Navigation */}
                    <div className="flex border-b border-border/50 px-4 sm:px-6 pt-3 sm:pt-4 gap-4 sm:gap-6 shrink-0 bg-background/50 backdrop-blur-md sticky top-0 z-10 overflow-x-auto scrollbar-hide">
                      <button 
                        onClick={() => setActiveTab('post')} 
                        className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'post' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                      >
                        <PenTool className="h-4 w-4" />
                        Thread Post
                      </button>
                      <button 
                        onClick={() => setActiveTab('image')} 
                        className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'image' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                      >
                        <ImageIcon className="h-4 w-4" />
                        Image Prompt
                      </button>
                      <button 
                        onClick={() => setActiveTab('metrics')} 
                        className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'metrics' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                      >
                        <BarChart2 className="h-4 w-4" />
                        Metrics & Strategy
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0">
                      {activeTab === 'post' && (
                        <div className="space-y-5 flex flex-col h-full">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                              Content Editor
                            </h3>
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <Input 
                                type="number" 
                                min={1} 
                                max={20}
                                value={postCount || ''} 
                                onChange={(e) => setPostCount(parseInt(e.target.value) || 1)}
                                className="h-8 w-16 text-xs font-semibold tabular-nums text-center bg-accent/30 text-muted-foreground border border-border/50 rounded-md focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                                placeholder="Count"
                              />
                              <select 
                                value={postLanguage} 
                                onChange={(e) => setPostLanguage(e.target.value as 'id' | 'en')}
                                className="h-8 text-[11px] font-medium uppercase tracking-wider bg-accent/30 text-muted-foreground border border-border/50 rounded-md px-2 focus:outline-none focus:ring-1 focus:ring-primary shadow-sm cursor-pointer"
                              >
                                <option value="id">ID</option>
                                <option value="en">EN</option>
                              </select>
                              <Button onClick={handleGeneratePost} disabled={isGenerating} size="sm" variant="secondary" className="h-8 text-xs gap-1.5 shadow-sm">
                                {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-primary" />}
                                Auto-Generate
                              </Button>
                            </div>
                          </div>
                          <Textarea
                            className="flex-1 min-h-[300px] resize-none text-sm leading-relaxed p-4 bg-background shadow-sm"
                            placeholder="Write your post here or click Auto-Generate..."
                            value={activePost.content || ""}
                            onChange={(e) => setDayPosts(prev => ({ ...prev, [selectedAccountId]: { ...prev[selectedAccountId], content: e.target.value } }))}
                          />
                        </div>
                      )}

                      {activeTab === 'image' && (
                        <div className="space-y-4 flex flex-col h-full">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-sm font-semibold flex items-center gap-2">
                                <ImageIcon className="h-4 w-4 text-primary" />
                                AI Image Prompt (JSON)
                              </h3>
                              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                                Prompt JSON untuk banana.google — Apple minimalist style, Poppins/Sugo Display font, karakter manusia realistis.
                              </p>
                            </div>
                            <Button
                              onClick={handleGenerateImagePrompt}
                              disabled={isGeneratingImage || !activePost?.content?.trim()}
                              size="sm"
                              variant="secondary"
                              className="h-8 text-xs gap-1.5 shadow-sm shrink-0"
                            >
                              {isGeneratingImage ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-primary" />}
                              Generate Prompt
                            </Button>
                          </div>

                          <div className="space-y-4">
                            {/* Art Style picker */}
                            <div className="space-y-2">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Art Style</p>
                              <div className="flex flex-wrap gap-2">
                                {([
                                  { id: 'realistic', label: 'Realistic' },
                                  { id: 'disney', label: 'Disney 3D' },
                                  { id: 'cyberpunk', label: 'Cyberpunk' },
                                  { id: 'minimal', label: 'Minimal Flat' },
                                ] as const).map(({ id, label }) => (
                                  <button
                                    key={id}
                                    onClick={() => setArtStyle(id)}
                                    className={`px-3 py-1.5 rounded-lg border text-[11px] font-medium transition-all ${
                                      artStyle === id
                                        ? 'border-primary bg-primary/5 text-foreground shadow-sm'
                                        : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
                                    }`}
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Character picker */}
                            <div className="space-y-2">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Character</p>
                              <div className="flex flex-wrap gap-2">
                                {([
                                  { id: 'human', label: 'Human' },
                                  { id: 'mascot', label: 'Mascot' },
                                  { id: 'none', label: 'None' },
                                ] as const).map(({ id, label }) => (
                                  <button
                                    key={id}
                                    onClick={() => setCharacterType(id)}
                                    className={`px-3 py-1.5 rounded-lg border text-[11px] font-medium transition-all ${
                                      characterType === id
                                        ? 'border-primary bg-primary/5 text-foreground shadow-sm'
                                        : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
                                    }`}
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>

                              {/* Extended Character Options */}
                              {characterType !== 'none' && (
                                <div className="pt-2 flex flex-col gap-3 border-t border-border/30 mt-2">
                                  {characterType === 'human' && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] uppercase font-semibold text-muted-foreground w-14">Gender</span>
                                      <div className="flex bg-accent/30 rounded-lg p-0.5 border border-border/50">
                                        {(['any', 'male', 'female'] as const).map((g) => (
                                          <button
                                            key={g}
                                            onClick={() => setCharacterGender(g)}
                                            className={`px-3 py-1 text-[10px] font-medium rounded-md capitalize transition-colors ${
                                              characterGender === g ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                          >
                                            {g}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] uppercase font-semibold text-muted-foreground w-14 shrink-0">Pose</span>
                                    <Input
                                      value={customCharacterStyle}
                                      onChange={(e) => setCustomCharacterStyle(e.target.value)}
                                      placeholder={characterType === 'human' ? "Bebas mau pose apa... misal: nyengir sambil bawa kopi" : "Misal: ngantuk lihat layar, ketawa lebar"}
                                      className="h-7 text-xs bg-accent/30 border-border/50 focus-visible:ring-1 focus-visible:ring-primary shadow-none"
                                    />
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] uppercase font-semibold text-muted-foreground w-14 shrink-0">Pakaian</span>
                                    <Input
                                      value={customCharacterOutfit}
                                      onChange={(e) => setCustomCharacterOutfit(e.target.value)}
                                      placeholder={characterType === 'human' ? "Misal: jaket kulit hitam & kaos polos" : "Misal: kacamata hitam neon & kalung emas"}
                                      className="h-7 text-xs bg-accent/30 border-border/50 focus-visible:ring-1 focus-visible:ring-primary shadow-none"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Background style picker */}
                            <div className="space-y-2">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Background (for Realistic/3D)</p>
                              <div className="flex flex-wrap gap-2">
                                {([
                                  { id: 'white-studio',  label: 'White Studio',    swatch: '#F8F8F8', border: '#E0E0E0' },
                                  { id: 'dark-studio',   label: 'Dark Studio',     swatch: '#1C1C1C', border: '#3A3A3A' },
                                  { id: 'warm-minimal',  label: 'Warm Minimal',    swatch: '#F0EBE0', border: '#D4C9B8' },
                                  { id: 'outdoor-cafe',  label: 'Outdoor Café',    swatch: '#C8D8C8', border: '#A0B8A0' },
                                  { id: 'gradient-mono', label: 'Mono Gradient',   swatch: 'linear-gradient(135deg,#F0F0F0,#D8D8D8)', border: '#C8C8C8' },
                                  { id: 'concrete-loft', label: 'Concrete Loft',   swatch: '#B8B4AE', border: '#9A9690' },
                                ] as const).map(({ id, label, swatch, border }) => (
                                  <button
                                    key={id}
                                    onClick={() => setBgStyle(id)}
                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all ${
                                      bgStyle === id
                                        ? 'border-primary bg-primary/5 text-foreground shadow-sm'
                                        : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
                                    }`}
                                  >
                                    <span
                                      className="h-3.5 w-3.5 rounded-sm shrink-0 border"
                                      style={{ background: swatch, borderColor: border }}
                                    />
                                    {label}
                                  </button>
                                ))}
                              </div>
                            </div>
                            
                            {/* Copywriting Setup */}
                            <div className="space-y-2">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Copywriting Setup</p>

                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] uppercase font-semibold text-muted-foreground w-20 shrink-0">Target Market</span>
                                <Input
                                  value={targetMarket}
                                  onChange={(e) => setTargetMarket(e.target.value)}
                                  placeholder="Misal: Content Creator, Editor, Agency, dll"
                                  className="h-7 text-xs bg-accent/30 border-border/50 focus-visible:ring-1 focus-visible:ring-primary shadow-none flex-1"
                                />
                              </div>

                              <div className="flex items-center gap-3 bg-accent/30 p-2.5 rounded-xl border border-border/50">
                                <button
                                  onClick={() => setIsNegativeMode(prev => !prev)}
                                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-[11px] font-semibold transition-all shrink-0 ${
                                    isNegativeMode
                                      ? 'border-red-500 bg-red-500/10 text-red-600 dark:text-red-400 shadow-sm'
                                      : 'border-border/50 bg-background text-muted-foreground hover:border-border hover:text-foreground'
                                  }`}
                                >
                                  <div className={`h-2.5 w-2.5 rounded-full border border-current transition-colors ${isNegativeMode ? 'bg-current' : 'bg-transparent'}`} />
                                  Negative Mode
                                </button>
                                <p className="text-[10px] text-muted-foreground leading-snug">
                                  Aktifkan ini untuk membuat copy teks yang agak agresif & membandingkan dengan AI $20/bulan (seperti OpusClip) untuk menonjolkan harga Rp 100.000 kamu.
                                </p>
                              </div>
                            </div>
                          </div>

                          {selectedAccountId && imagePrompts[selectedAccountId] ? (
                            <div className="flex flex-col mt-4 border-t border-border/30 pt-4">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">JSON Output</span>
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider">Ready</span>
                                </div>
                                <button
                                  onClick={copyImagePrompt}
                                  className="flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors px-2 py-1 rounded-lg hover:bg-primary/5"
                                >
                                  {copiedPrompt ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                  {copiedPrompt ? 'Copied!' : 'Copy JSON'}
                                </button>
                              </div>
                              <div className="min-h-[300px] max-h-[500px] w-full overflow-auto rounded-xl border border-border/50 bg-zinc-950/80 dark:bg-black/50 text-xs">
                                <pre className="p-4 leading-relaxed text-green-400 whitespace-pre-wrap break-words font-mono">{(() => {
                                  try {
                                    return JSON.stringify(JSON.parse(imagePrompts[selectedAccountId]), null, 2)
                                  } catch {
                                    return imagePrompts[selectedAccountId]
                                  }
                                })()}</pre>
                              </div>
                              <p className="text-[10px] text-muted-foreground/60 mt-2 flex items-center gap-1">
                                <ImageIcon className="h-3 w-3" />
                                Paste JSON ini ke banana.google atau AI image generator lainnya.
                              </p>
                            </div>
                          ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 bg-muted/20 rounded-xl border border-dashed border-border/50 min-h-[260px] px-6">
                              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center border border-border/50">
                                <ImageIcon className="h-7 w-7 text-primary/40" />
                              </div>
                              <div className="space-y-1.5">
                                <p className="text-sm font-semibold text-foreground/60">Belum ada prompt</p>
                                <p className="text-xs text-muted-foreground/70 max-w-[200px] leading-relaxed">
                                  {!activePost?.content?.trim()
                                    ? 'Generate post-nya dulu di tab Thread Post, lalu balik sini.'
                                    : 'Klik Generate Prompt untuk buat flyer JSON-nya.'}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {activeTab === 'metrics' && (
                        <div className="space-y-8 flex flex-col h-full max-w-2xl mx-auto">
                          <div>
                            <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
                              <BarChart2 className="h-4 w-4 text-primary" />
                              Performance Metrics
                            </h3>
                            <div className="grid grid-cols-2 gap-3 sm:gap-4">
                              <div className="space-y-2 bg-background p-3 sm:p-4 rounded-xl border border-border/50 shadow-sm min-w-0">
                                <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Viewers</Label>
                                <Input 
                                  type="number" 
                                  className="h-10 tabular-nums border-none shadow-none text-lg px-0 focus-visible:ring-0 bg-transparent" 
                                  placeholder="0"
                                  value={activePost.viewers || ""} 
                                  onChange={(e) => setDayPosts(prev => ({ ...prev, [selectedAccountId]: { ...prev[selectedAccountId], viewers: parseInt(e.target.value) || 0 } }))}
                                />
                              </div>
                              <div className="space-y-2 bg-background p-3 sm:p-4 rounded-xl border border-border/50 shadow-sm min-w-0">
                                <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Buyers</Label>
                                <Input 
                                  type="number" 
                                  className="h-10 tabular-nums border-none shadow-none text-lg px-0 focus-visible:ring-0 bg-transparent" 
                                  placeholder="0"
                                  value={activePost.buyers || ""} 
                                  onChange={(e) => setDayPosts(prev => ({ ...prev, [selectedAccountId]: { ...prev[selectedAccountId], buyers: parseInt(e.target.value) || 0 } }))}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex-1 flex flex-col min-h-[200px]">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-sm font-semibold flex items-center gap-2">
                                <BrainCircuit className="h-4 w-4 text-primary" />
                                AI Evaluation & Strategy
                              </h3>
                              <Button 
                                onClick={handleEvaluate} 
                                disabled={isEvaluating || !activePost.content} 
                                size="sm" 
                                variant="secondary" 
                                className="h-8 text-xs gap-1.5 shadow-sm"
                              >
                                {isEvaluating ? <Loader2 className="h-3 w-3 animate-spin" /> : <BarChart2 className="h-3 w-3" />}
                                Evaluate Post
                              </Button>
                            </div>
                            <div className="flex-1 bg-background rounded-xl p-4 sm:p-5 border border-border/50 shadow-sm overflow-y-auto">
                              {activePost.evaluation ? (
                                <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{activePost.evaluation}</div>
                              ) : (
                                <div className="h-full min-h-[150px] flex flex-col items-center justify-center text-center text-muted-foreground/60 space-y-3">
                                  <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center">
                                    <BarChart2 className="h-5 w-5 opacity-40" />
                                  </div>
                                  <p className="text-xs max-w-[220px]">Enter your metrics and evaluate the post to get strategy insights.</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Dialog Footer */}
              <div className="p-3 sm:p-4 border-t border-border/50 bg-background flex justify-end shrink-0">
                <Button onClick={handleSave} disabled={isSaving} className="gap-2 px-6">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save All Changes
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
