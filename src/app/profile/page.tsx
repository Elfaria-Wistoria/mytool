"use client"

import { useEffect, useState, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Loader2, Camera, Upload, Edit2, X } from "lucide-react"
import Image from "next/image"

export default function ProfilePage() {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  const [userId, setUserId] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState("")
  const [bio, setBio] = useState("")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  const loadProfile = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    setUserId(user.id)
    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, bio, avatar_url")
      .eq("id", user.id)
      .single()

    if (!error && data) {
      setDisplayName(data.display_name || "")
      setBio(data.bio || "")
      setAvatarUrl(data.avatar_url)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadProfile()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase])

  const handleUpdateProfile = async () => {
    if (!userId) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim(),
          bio: bio.trim() || null,
        })
        .eq("id", userId)

      if (error) throw error
      toast.success("Profile updated successfully")
      setIsEditing(false)
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !userId) return

    setUploading(true)
    const file = event.target.files[0]
    const fileExt = file.name.split('.').pop()
    const filePath = `${userId}-${Date.now()}.${fileExt}`

    try {
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // Update the profile table directly
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId)

      if (updateError) throw updateError

      setAvatarUrl(publicUrl)
      toast.success("Avatar updated!")
    } catch (error: any) {
      toast.error(error.message || "Error uploading avatar")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">My Profile</h1>
          <p className="text-sm text-muted-foreground">Manage your personal information and avatar.</p>
        </div>
        {!isEditing && (
          <Button onClick={() => setIsEditing(true)} className="gap-2 shadow-sm">
            <Edit2 className="h-4 w-4" />
            Edit Profile
          </Button>
        )}
      </div>

      <div className="apple-card overflow-hidden">
        {/* Banner/Header background just for aesthetics */}
        <div className="h-32 w-full bg-gradient-to-r from-primary/20 via-primary/5 to-transparent border-b border-border/50" />
        
        <div className="p-6 -mt-16 sm:-mt-20 relative">
          {!isEditing ? (
            // --- VIEW MODE ---
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 text-center sm:text-left">
                <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-full overflow-hidden bg-background border-4 border-background shadow-md flex items-center justify-center shrink-0 mx-auto sm:mx-0 ring-1 ring-border/50">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-3xl font-semibold opacity-40">
                      {displayName ? displayName.charAt(0).toUpperCase() : "?"}
                    </span>
                  )}
                </div>
                
                <div className="space-y-1 flex-1 pb-2">
                  <h2 className="text-2xl font-bold tracking-tight text-foreground">
                    {displayName || "Unnamed User"}
                  </h2>
                  <p className="text-muted-foreground text-sm font-medium">
                    Profile
                  </p>
                </div>
              </div>

              <div className="pt-6 sm:pt-4 border-t border-border/50">
                <h3 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wider">About</h3>
                <p className="text-foreground/80 text-[15px] leading-relaxed max-w-xl whitespace-pre-wrap">
                  {bio || "No bio provided yet."}
                </p>
              </div>
            </div>
          ) : (
            // --- EDIT MODE ---
            <div className="space-y-8 bg-background rounded-xl mt-16 sm:mt-20 p-2 sm:p-0">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <div className="relative group shrink-0">
                  <div className="h-24 w-24 rounded-full overflow-hidden bg-muted border-2 border-border/50 shadow-sm flex items-center justify-center">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-2xl font-semibold opacity-40">
                        {displayName ? displayName.charAt(0).toUpperCase() : "?"}
                      </span>
                    )}
                  </div>

                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary text-primary-foreground shadow-sm flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleAvatarUpload} 
                    accept="image/*" 
                    className="hidden" 
                  />
                </div>

                <div className="space-y-1">
                  <h3 className="font-medium text-[15px] text-foreground">Profile Picture</h3>
                  <p className="text-sm text-muted-foreground">JPG, GIF or PNG. 1MB max.</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2 text-xs" 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload className="h-3 w-3 mr-2" /> Upload New
                  </Button>
                </div>
              </div>

              <hr className="border-border/50" />

              {/* Info Section */}
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input 
                    id="displayName" 
                    value={displayName} 
                    onChange={(e) => setDisplayName(e.target.value)} 
                    placeholder="Your full name" 
                    className="max-w-md"
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea 
                    id="bio" 
                    value={bio} 
                    onChange={(e) => setBio(e.target.value)} 
                    placeholder="A short biography or your current focus..." 
                    className="max-w-md h-24 resize-none"
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3 border-t border-border/50 mt-4">
                <Button onClick={handleUpdateProfile} disabled={saving} className="gap-2">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
                <Button variant="outline" onClick={() => { setIsEditing(false); loadProfile(); }} disabled={saving}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
