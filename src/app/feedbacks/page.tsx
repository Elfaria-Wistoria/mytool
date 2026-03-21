"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, MessageSquare, Copy, Check, Star, Mail, Search, Clock, Inbox } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const supabase = createClient()

type Feedback = {
  id: string
  title: string
  description: string
  reporter_name: string
  reporter_email: string
  rating: number | null
  status: string
  created_at: string
}

export default function FeedbacksPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [profileId, setProfileId] = useState<string | null>(null)
  
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const fetchFeedbacks = async () => {
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    const userProfileId = userData.user?.id
    
    if (userProfileId) {
      setProfileId(userProfileId)
      // No .eq("profile_id") filter — RLS (get_accessible_profile_ids) handles
      // workspace-scoped visibility so all teammates' feedbacks are returned.
      const { data, error } = await supabase
        .from("user_feedbacks")
        .select("*")
        .order("created_at", { ascending: false })

      if (data) setFeedbacks(data)
      if (error) console.error(error)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchFeedbacks()
  }, [])

  const handleCopyLink = () => {
    if (!profileId) return
    const url = `${window.location.origin}/feedback/${profileId}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success("Public link copied to clipboard")
    setTimeout(() => setCopied(false), 2000)
  }

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setIsUpdating(true)
    const { error } = await supabase
      .from("user_feedbacks")
      .update({ status: newStatus })
      .eq("id", id)

    if (!error) {
      setFeedbacks(feedbacks.map(f => f.id === id ? { ...f, status: newStatus } : f))
      toast.success(`Marked as ${newStatus}`)
      if (selectedFeedback && selectedFeedback.id === id) {
        setSelectedFeedback({ ...selectedFeedback, status: newStatus })
      }
    } else {
      toast.error("Failed to update status")
    }
    setIsUpdating(false)
  }

  const filteredFeedbacks = feedbacks.filter(f => {
    const matchesSearch = f.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          f.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          f.reporter_name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || f.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
      case 'reviewed': return 'bg-amber-500/10 text-amber-500 border-amber-500/20'
      case 'implemented': return 'bg-green-500/10 text-green-500 border-green-500/20'
      case 'archived': return 'bg-gray-500/10 text-gray-500 border-gray-500/20'
      default: return 'bg-secondary text-secondary-foreground'
    }
  }

  const avgRating = feedbacks.filter(f => f.rating).reduce((acc, f) => acc + (f.rating || 0), 0) / (feedbacks.filter(f => f.rating).length || 1)

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Header & Stats */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="animate-heading">
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-primary" />
            Users Feedback
          </h1>
          <p className="mt-2 text-muted-foreground">Monitor and manage feedback from your customers.</p>
        </div>
        
        <Button onClick={handleCopyLink} size="lg" className="rounded-xl shadow-md gap-2 w-full sm:w-auto h-12">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied!" : "Share Public Link"}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Feedbacks', value: feedbacks.length, valueClass: '' },
          { label: 'New', value: feedbacks.filter(f => f.status === 'new').length, valueClass: 'text-blue-500' },
          { label: 'Reviewed', value: feedbacks.filter(f => f.status === 'reviewed').length, valueClass: 'text-amber-500' },
          { label: 'Avg Rating', value: feedbacks.filter(f=>f.rating).length > 0 ? avgRating.toFixed(1) : '—', valueClass: 'text-yellow-500', icon: true },
        ].map((stat, i) => (
          <div
            key={stat.label}
            className="apple-card p-5 border-border/50 animate-stagger-item"
            style={{ '--i': i } as React.CSSProperties}
          >
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{stat.label}</p>
            <div className="flex items-center gap-1.5 mt-1">
              {stat.icon && <Star className="h-6 w-6 text-yellow-500 fill-yellow-500 translate-y-[-2px]" />}
              <p className={`text-3xl font-bold tabular-nums ${stat.valueClass}`}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between apple-card p-4">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Search feedback..." 
            className="pl-9 h-10 border-none bg-accent/50 focus-visible:ring-1 focus-visible:ring-primary shadow-inner rounded-xl"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto scrollbar-hide">
          {['all', 'new', 'reviewed', 'implemented', 'archived'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all shrink-0 ${statusFilter === status ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-transparent text-muted-foreground hover:bg-muted'}`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="space-y-4">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="apple-card p-5 h-[240px] flex flex-col gap-3 animate-stagger-item" style={{ '--i': i } as React.CSSProperties}>
                <div className="skeleton h-5 w-20 rounded-full" />
                <div className="skeleton h-6 w-3/4" />
                <div className="skeleton h-4 w-full" />
                <div className="skeleton h-4 w-5/6" />
                <div className="skeleton h-4 w-4/6" />
                <div className="mt-auto pt-4 border-t border-border/50 flex justify-between">
                  <div className="skeleton h-4 w-24" />
                  <div className="skeleton h-4 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredFeedbacks.length === 0 ? (
          <div className="apple-card py-24 flex flex-col items-center justify-center text-center text-muted-foreground/60 border-dashed">
            <Inbox className="h-12 w-12 mb-4 opacity-20" />
            <p className="font-medium text-foreground">No feedback found</p>
            <p className="text-sm mt-1">Share your public link to start collecting feedback.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredFeedbacks.map((f, i) => (
              <div 
                key={f.id} 
                onClick={() => setSelectedFeedback(f)}
                className="apple-card p-5 sm:p-6 border border-border/50 hover:border-primary/30 cursor-pointer hover:shadow-lg hover:-translate-y-1 group flex flex-col h-[240px] animate-stagger-item"
                style={{ '--i': i } as React.CSSProperties}
              >
                <div className="flex justify-between items-start mb-3 gap-2">
                  <Badge variant="outline" className={`capitalize ${getStatusColor(f.status)}`}>{f.status}</Badge>
                  {f.rating && (
                    <div className="flex items-center gap-1 text-yellow-500 font-semibold text-sm bg-yellow-500/10 px-2 py-0.5 rounded-full">
                      <Star className="h-3.5 w-3.5 fill-current" />
                      {f.rating}
                    </div>
                  )}
                </div>
                
                <h3 className="font-semibold text-lg line-clamp-2 leading-tight group-hover:text-primary transition-colors">{f.title}</h3>
                
                <p className="text-muted-foreground text-sm mt-3 line-clamp-3 leading-relaxed flex-1">
                  {f.description}
                </p>
                
                <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium truncate max-w-[140px] text-foreground/80">{f.reporter_name}</span>
                  <span className="flex items-center gap-1 shrink-0"><Clock className="h-3 w-3" /> {format(new Date(f.created_at), "MMM d")}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Details Modal */}
      <Dialog open={!!selectedFeedback} onOpenChange={(open) => !open && setSelectedFeedback(null)}>
        <DialogContent className="max-w-2xl sm:max-w-2xl overflow-hidden p-0 gap-0 w-[calc(100vw-2rem)] rounded-2xl border-border/50 bg-background/95 backdrop-blur-xl">
          {selectedFeedback && (
            <>
              <div className="p-5 sm:p-8 bg-muted/20 border-b border-border/50 flex flex-row gap-4 items-start justify-between relative pr-10 sm:pr-12">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-3">
                    <Badge variant="outline" className={`capitalize shrink-0 ${getStatusColor(selectedFeedback.status)}`}>{selectedFeedback.status}</Badge>
                    <span className="text-xs text-muted-foreground font-medium flex items-center gap-1 shrink-0">
                      <Clock className="h-3.5 w-3.5" />
                      {format(new Date(selectedFeedback.created_at), "MMM d, yyyy 'at' h:mm a")}
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground leading-tight break-words">{selectedFeedback.title}</h2>
                </div>
                
                {selectedFeedback.rating && (
                  <div className="shrink-0 flex flex-col items-center bg-background p-2.5 sm:p-3 rounded-xl shadow-sm border border-border/50 mt-1">
                    <span className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Rating</span>
                    <div className="flex items-center gap-1 text-yellow-500">
                      <Star className="h-4 w-4 sm:h-5 sm:w-5 fill-current" />
                      <span className="text-lg sm:text-xl font-bold text-foreground">{selectedFeedback.rating}</span>
                      <span className="text-xs sm:text-sm text-muted-foreground font-medium">/5</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 sm:p-8 space-y-8 max-h-[60vh] overflow-y-auto">
                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Feedback Details</h3>
                  <p className="text-base text-foreground leading-relaxed whitespace-pre-wrap">{selectedFeedback.description}</p>
                </div>

                <div className="bg-muted/30 rounded-xl p-5 border border-border/50">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Reporter Information</h3>
                  <div className="flex flex-col gap-5 sm:flex-row sm:gap-8">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                        {selectedFeedback.reporter_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{selectedFeedback.reporter_name}</p>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Name</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="h-10 w-10 shrink-0 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
                        <Mail className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 w-full">
                        <a href={`mailto:${selectedFeedback.reporter_email}`} className="block font-semibold text-sm text-foreground hover:underline truncate w-full" title={selectedFeedback.reporter_email}>
                          {selectedFeedback.reporter_email}
                        </a>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Email</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-6 border-t border-border/50 bg-background flex flex-col gap-3">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Update Status:</span>
                <div className="flex flex-wrap gap-2 w-full">
                  {['new', 'reviewed', 'implemented', 'archived'].map(status => (
                    <Button 
                      key={status}
                      variant={selectedFeedback.status === status ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleUpdateStatus(selectedFeedback.id, status)}
                      disabled={isUpdating || selectedFeedback.status === status}
                      className="capitalize flex-1 sm:flex-none rounded-lg"
                    >
                      {status}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
