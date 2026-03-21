"use client"

import { useState, useEffect } from "react"
import { Sparkles, BrainCircuit, PenTool, BarChart2, Loader2, Save, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
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
  const [activeTab, setActiveTab] = useState<'post' | 'metrics'>('post')
  const [postLanguage, setPostLanguage] = useState<'id' | 'en'>('id')
  const [postCount, setPostCount] = useState<number>(1)

  // Dialog State
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [dayPosts, setDayPosts] = useState<Record<string, ThreadPost>>({})
  const [isGenerating, setIsGenerating] = useState(false)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

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
