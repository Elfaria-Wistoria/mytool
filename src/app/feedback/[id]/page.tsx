"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Send, CheckCircle2, MessageSquare, Star } from "lucide-react"

export default function PublicFeedbackForm() {
  const params = useParams()
  const profileId = params.id as string
  const supabase = createClient()

  const [workspaceName, setWorkspaceName] = useState<string>("Workspace")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    title: "",
    description: "",
    rating: 0,
  })

  // Fetch only the profile's display_name so users know who they are submitting to
  useEffect(() => {
    async function loadProfile() {
      if (!profileId) return
      setLoading(true)
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", profileId)
        .single()

      if (data) {
        setWorkspaceName(data.display_name)
      } else if (error) {
        console.error("Failed to load workspace name", error)
      }
      setLoading(false)
    }
    loadProfile()
  }, [profileId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      if (!formData.title || !formData.description || !formData.name || !formData.email) {
        throw new Error("Please fill in all required fields.")
      }

      const { error: insertError } = await supabase
        .from("user_feedbacks")
        .insert([
          {
            profile_id: profileId,
            title: formData.title,
            description: formData.description,
            reporter_name: formData.name,
            reporter_email: formData.email,
            rating: formData.rating > 0 ? formData.rating : null,
          }
        ])

      if (insertError) throw insertError

      setSubmitted(true)
    } catch (err: any) {
      console.error(err)
      setError(err.message || "Failed to submit feedback. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-[#f9fafb] dark:bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-[#f9fafb] dark:bg-background">
        <div className="apple-card p-8 md:p-12 max-w-md w-full text-center space-y-6 animate-in fade-in zoom-in duration-500">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10 mb-6">
            <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-500" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Thank You!</h1>
          <p className="text-muted-foreground leading-relaxed">
            Your feedback has been successfully submitted. We highly appreciate your input in helping <strong>{workspaceName}</strong> improve.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f9fafb] dark:bg-background py-10 px-4 sm:px-6 flex flex-col items-center">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] bg-primary/10 mb-4 shadow-sm">
            <MessageSquare className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Submit Feedback</h1>
          <p className="text-muted-foreground text-lg">
            Help <span className="font-semibold text-foreground">{workspaceName}</span> improve by sharing your thoughts.
          </p>
        </div>

        {/* Form Container */}
        <div className="apple-card p-6 sm:p-10 border-border/50">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your Name <span className="text-red-500">*</span></Label>
                <Input
                  id="name"
                  required
                  placeholder="John Doe"
                  className="h-11 rounded-xl bg-background/50 border-input shadow-sm focus-visible:ring-1 focus-visible:ring-primary"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email Address <span className="text-red-500">*</span></Label>
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="john@example.com"
                  className="h-11 rounded-xl bg-background/50 border-input shadow-sm focus-visible:ring-1 focus-visible:ring-primary"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">How would you rate your experience?</Label>
              <div className="flex items-center gap-2 pt-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFormData({ ...formData, rating: star })}
                    className={`transition-all hover:scale-110 p-1 rounded-full ${formData.rating >= star ? 'text-yellow-400 drop-shadow-sm' : 'text-muted-foreground/30 hover:text-yellow-400/50'}`}
                  >
                    <Star className="h-8 w-8" fill={formData.rating >= star ? "currentColor" : "none"} strokeWidth={1.5} />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Feedback Subject <span className="text-red-500">*</span></Label>
              <Input
                id="title"
                required
                placeholder="Brief summary of your feedback"
                className="h-11 rounded-xl bg-background/50 border-input shadow-sm focus-visible:ring-1 focus-visible:ring-primary"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Details <span className="text-red-500">*</span></Label>
              <Textarea
                id="description"
                required
                placeholder="Please describe what you liked, disliked, or what we can improve..."
                className="min-h-[160px] resize-none rounded-xl bg-background/50 border-input shadow-sm p-4 text-base focus-visible:ring-1 focus-visible:ring-primary"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 p-4 border border-destructive/20 text-sm text-destructive font-medium">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-12 rounded-xl text-base font-semibold shadow-md hover:shadow-lg transition-all gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  Submit Feedback
                </>
              )}
            </Button>
          </form>
        </div>
        
        <p className="text-center text-xs text-muted-foreground opacity-60">
          Powered by NorraClip secure feedback system.
        </p>
      </div>
    </div>
  )
}
