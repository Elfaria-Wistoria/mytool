"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Image as ImageIcon, X, CheckCircle2, Bug } from "lucide-react"

export default function PublicBugReportPage() {
  const params = useParams()
  const profileId = params.id as string

  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState({ title: "", description: "", reporter_name: "", reporter_email: "" })
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null
    setFile(f)
    if (f) {
      setPreview(URL.createObjectURL(f))
    } else {
      setPreview(null)
    }
  }

  const clearFile = () => {
    setFile(null)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
  }

  const submitReport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.reporter_name.trim() || !form.reporter_email.trim()) return
    setSaving(true)
    setUploadError(null)

    let image_url: string | null = null

    if (file) {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `${profileId}/${fileName}`

      const { error: storageError } = await supabase.storage
        .from('bug_images')
        .upload(filePath, file)

      if (storageError) {
        setUploadError(storageError.message)
        setSaving(false)
        return
      }

      const { data: publicData } = supabase.storage
        .from('bug_images')
        .getPublicUrl(filePath)
      
      image_url = publicData.publicUrl
    }

    const { error } = await supabase
      .from("bug_reports")
      .insert({
        profile_id: profileId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        reporter_name: form.reporter_name.trim() || null,
        reporter_email: form.reporter_email.trim() || null,
        image_url,
        status: "unstarted",
      })

    if (error) {
      setUploadError("Failed to submit report. Please try again.")
      setSaving(false)
      return
    }

    setSuccess(true)
    setSaving(false)
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/10">
        <div className="max-w-md w-full bg-background rounded-[24px] p-10 text-center shadow-xl border border-border/50">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">Laporan Diterima!</h1>
          <p className="text-muted-foreground mb-8 text-[15px] leading-relaxed">
            Terima kasih telah meluangkan waktu untuk melapor. Laporan Anda telah kami terima, tim <strong>NorraClip</strong> akan segera memperbaiki bug tersebut dan melakukan update pada aplikasi secepatnya.
          </p>
          <Button onClick={() => window.location.reload()} variant="outline" className="rounded-[12px] w-full">
            Kirim Laporan Lainnya
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/10">
      <div className="max-w-xl w-full">
        <div className="mb-8 text-center space-y-3">
          <div className="w-14 h-14 bg-primary/10 text-primary rounded-[16px] flex items-center justify-center mx-auto mb-4 border border-primary/20 shadow-sm">
            <Bug className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Report an Issue</h1>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto leading-relaxed">
            Found a bug or experiencing an issue? Let us know the details below so we can fix it as soon as possible.
          </p>
        </div>

        <form onSubmit={submitReport} className="bg-background rounded-[24px] p-6 sm:p-8 shadow-2xl border border-border/60 space-y-7 relative overflow-hidden">
          
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Your Name <span className="text-destructive">*</span></Label>
                <Input
                  id="name"
                  required
                  placeholder="e.g. John Doe"
                  value={form.reporter_name}
                  onChange={e => setForm(f => ({ ...f, reporter_name: e.target.value }))}
                  className="rounded-[12px] h-12 bg-muted/30 border-border/50 focus-visible:ring-primary/50 text-md px-4"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Your Email <span className="text-destructive">*</span></Label>
                <Input
                  id="email"
                  required
                  type="email"
                  placeholder="e.g. john@example.com"
                  value={form.reporter_email}
                  onChange={e => setForm(f => ({ ...f, reporter_email: e.target.value }))}
                  className="rounded-[12px] h-12 bg-muted/30 border-border/50 focus-visible:ring-primary/50 text-md px-4"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Issue Title <span className="text-destructive">*</span></Label>
              <Input
                id="title"
                required
                placeholder="e.g. Cannot upload video file on iOS"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="rounded-[12px] h-12 bg-muted/30 border-border/50 focus-visible:ring-primary/50 text-md px-4"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="desc" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Description</Label>
              <Textarea
                id="desc"
                placeholder="What were you trying to do? What went wrong? Steps to reproduce..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="rounded-[12px] min-h-[140px] resize-none bg-muted/30 border-border/50 focus-visible:ring-primary/50 text-[15px] p-4"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Screenshot Attachment</Label>
              {preview ? (
                <div className="relative rounded-[16px] border border-border/80 bg-muted/30 p-2 group h-56 overflow-hidden flex items-center justify-center shadow-inner">
                  <img src={preview} alt="Upload preview" className="max-h-full max-w-full object-contain rounded-[8px]" />
                  <button 
                    type="button"
                    onClick={clearFile}
                    className="absolute top-3 right-3 bg-background/90 backdrop-blur border border-border text-foreground hover:bg-destructive hover:text-destructive-foreground hover:border-destructive p-2 rounded-full shadow-lg transition-all opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <Label 
                  htmlFor="image" 
                  className="flex flex-col items-center justify-center h-44 w-full rounded-[16px] border-2 border-dashed border-border/60 hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all group"
                >
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <ImageIcon className="h-6 w-6 text-muted-foreground opacity-80" />
                  </div>
                  <span className="text-sm font-semibold text-primary/80">Click to upload screenshot</span>
                  <span className="text-xs text-muted-foreground mt-1.5 opacity-80">PNG, JPG, GIF up to 5MB</span>
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </Label>
              )}
            </div>

            {uploadError && (
              <div className="p-4 rounded-[12px] bg-destructive/10 text-destructive text-[13px] font-medium border border-destructive/20 flex items-start gap-2">
                <X className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{uploadError}</span>
              </div>
            )}
          </div>

          <Button type="submit" disabled={saving || !form.title.trim() || !form.reporter_name.trim() || !form.reporter_email.trim()} className="w-full h-12 rounded-[12px] font-semibold text-[15px] shadow-md shadow-primary/20">
            {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Bug className="h-5 w-5 mr-2" />}
            {saving ? "Submitting..." : "Submit Report"}
          </Button>
        </form>
      </div>
    </div>
  )
}
