"use client"

import { useState, useEffect } from "react"
import { BarChart, Eye, Heart, MessageCircle, RefreshCw, Plus, Trash2, ExternalLink, Edit2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { formatDistanceToNow } from "date-fns"

const supabase = createClient()

type TrackedPost = {
  id: string
  url: string
  content_preview: string | null
  views_count: number | null
  likes_count: number | null
  replies_count: number | null
  last_checked_at: string | null
}

export default function ThreadsMonitorPage() {
  const [urlInput, setUrlInput] = useState("")
  const [posts, setPosts] = useState<TrackedPost[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [isRefreshingGlobal, setIsRefreshingGlobal] = useState(false)
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState({ views: 0, likes: 0, replies: 0 })
  const [isSaving, setIsSaving] = useState(false)

  const fetchPosts = async () => {
    setIsLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('tracked_posts')
      .select('*')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false })

    if (data) setPosts(data)
    setIsLoading(false)
  }

  useEffect(() => {
    fetchPosts()
  }, [])

  const handleAddUrl = async () => {
    if (!urlInput.trim() || !urlInput.includes("threads.")) return
    setIsAdding(true)
    try {
      const res = await fetch("/api/threads-monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", url: urlInput.trim() })
      })
      const { data, error } = await res.json()
      if (error) {
        alert(error)
      } else if (data) {
        setPosts([data, ...posts])
        setUrlInput("")
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsAdding(false)
    }
  }

  const handleRefresh = async (id?: string) => {
    if (!id) setIsRefreshingGlobal(true)
    try {
      const res = await fetch("/api/threads-monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refresh", id })
      })
      const { data, error } = await res.json()
      if (data && data.length > 0) {
        setPosts(prev => prev.map(p => {
          const updated = data.find((d: any) => d.id === p.id)
          return updated ? { ...p, ...updated } : p
        }))
      }
    } catch (e) {
      console.error(e)
    } finally {
      if (!id) setIsRefreshingGlobal(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to stop tracking this post?")) return
    try {
      await fetch("/api/threads-monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id })
      })
      setPosts(prev => prev.filter(p => p.id !== id))
    } catch (e) {
      console.error(e)
    }
  }

  const handleSaveEdit = async (id: string) => {
    setIsSaving(true)
    try {
      const res = await fetch("/api/threads-monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_metrics", id, ...editValues })
      })
      const { data } = await res.json()
      if (data) {
        setPosts(prev => prev.map(p => p.id === id ? { ...p, ...data } : p))
        setEditingPostId(null)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background/95">
      <div className="border-b border-border/40 bg-background/60 backdrop-blur-md px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BarChart className="w-5 h-5 text-primary" />
            Post Monitor
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Track views, likes, and replies across your Threads posts.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleRefresh()} 
            disabled={isRefreshingGlobal || posts.length === 0}
            className="whitespace-nowrap h-9 w-full sm:w-auto shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshingGlobal ? "animate-spin" : ""}`} />
            Refresh All
          </Button>
        </div>
      </div>

      <div className="p-6 flex-1 overflow-y-auto w-full max-w-5xl mx-auto">
        <div className="mb-8 bg-accent/20 border border-border/50 rounded-xl p-6 shadow-sm">
          <h2 className="text-sm font-semibold mb-3">Track New Post</h2>
          <div className="flex gap-3">
            <Input 
              placeholder="Paste Threads URL here (https://www.threads.net/ or .com/...)"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="bg-background shadow-sm border-border/50 focus:ring-primary h-10"
              onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
            />
            <Button onClick={handleAddUrl} disabled={isAdding || !urlInput.includes("threads.")} className="h-10 px-6 shadow-sm">
              {isAdding ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Track
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-40 animate-pulse bg-accent/30 rounded-xl border border-border/30"></div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 bg-accent/5 rounded-xl border border-dashed border-border flex flex-col items-center">
            <BarChart className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium">No posts tracked</h3>
            <p className="text-muted-foreground mt-1">Paste a URL above to start monitoring.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {posts.map(post => (
              <div key={post.id} className="bg-background relative group border border-border/60 hover:border-primary/50 transition-colors rounded-xl p-5 shadow-sm space-y-4">
                
                <div className="flex justify-between items-start gap-4">
                  <p className="text-sm line-clamp-2 leading-relaxed text-foreground/90 font-medium tracking-wide">
                    {post.content_preview || "No preview available"}
                  </p>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive" onClick={() => handleDelete(post.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider">Metrics {editingPostId === post.id && "(Edit Mode)"}</h3>
                  {editingPostId === post.id ? (
                    <Button variant="default" size="sm" className="h-7 text-[11px] gap-1 px-2" onClick={() => handleSaveEdit(post.id)} disabled={isSaving}>
                      {isSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      Save
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1 px-2" onClick={() => {
                      setEditingPostId(post.id)
                      setEditValues({
                        views: post.views_count || 0,
                        likes: post.likes_count || 0,
                        replies: post.replies_count || 0
                      })
                    }}>
                      <Edit2 className="w-3 h-3" />
                      Manual Update
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-accent/30 flex flex-col justify-center py-3 px-2 rounded-lg border border-border/40 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                      <Eye className="w-3.5 h-3.5" />
                      <span className="text-[10px] uppercase font-bold tracking-wider">Views</span>
                    </div>
                    {editingPostId === post.id ? (
                      <Input type="number" className="h-7 text-center text-sm font-bold bg-background mt-1" value={editValues.views} onChange={(e) => setEditValues({ ...editValues, views: Number(e.target.value) })} />
                    ) : (
                      <p className="text-xl font-bold tabular-nums text-foreground">{post.views_count?.toLocaleString() || "-"}</p>
                    )}
                  </div>
                  <div className="bg-accent/30 flex flex-col justify-center py-3 px-2 rounded-lg border border-border/40 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                      <Heart className="w-3.5 h-3.5" />
                      <span className="text-[10px] uppercase font-bold tracking-wider">Likes</span>
                    </div>
                    {editingPostId === post.id ? (
                      <Input type="number" className="h-7 text-center text-sm font-bold bg-background mt-1" value={editValues.likes} onChange={(e) => setEditValues({ ...editValues, likes: Number(e.target.value) })} />
                    ) : (
                      <p className="text-xl font-bold tabular-nums text-foreground">{post.likes_count?.toLocaleString() || "-"}</p>
                    )}
                  </div>
                  <div className="bg-accent/30 flex flex-col justify-center py-3 px-2 rounded-lg border border-border/40 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span className="text-[10px] uppercase font-bold tracking-wider">Replies</span>
                    </div>
                    {editingPostId === post.id ? (
                      <Input type="number" className="h-7 text-center text-sm font-bold bg-background mt-1" value={editValues.replies} onChange={(e) => setEditValues({ ...editValues, replies: Number(e.target.value) })} />
                    ) : (
                      <p className="text-xl font-bold tabular-nums text-foreground">{post.replies_count?.toLocaleString() || "-"}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-4 pt-4 border-t border-border/30">
                  <span>Last checked {post.last_checked_at ? formatDistanceToNow(new Date(post.last_checked_at), { addSuffix: true }) : "never"}</span>
                  <a href={post.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer">
                    View on Threads <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
