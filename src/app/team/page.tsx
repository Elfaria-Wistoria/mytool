"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Users, Plus, Copy, Check, Trash2, Crown, Shield, UserRound,
  Loader2, Link2, LogOut, UserPlus, ChevronDown
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { InviteModal } from "@/components/team/invite-modal"
import { CreateWorkspaceModal } from "@/components/team/create-workspace-modal"

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */
type Workspace = {
  id: string
  name: string
  owner_id: string
  created_at: string
  myRole: string
}

type Member = {
  id: string
  profile_id: string
  role: string
  joined_at: string
  profiles: { display_name: string; avatar_url: string | null; bio: string | null } | null
}

type Invite = {
  id: string
  email: string | null
  token: string
  status: string
  expires_at: string
  created_at: string
  invited_by: string
}

const roleIcon: Record<string, React.ReactNode> = {
  owner: <Crown className="h-3 w-3 text-amber-500" />,
  admin: <Shield className="h-3 w-3 text-blue-500" />,
  member: <UserRound className="h-3 w-3 text-muted-foreground" />,
}

const roleBadge: Record<string, string> = {
  owner: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  admin: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  member: "bg-secondary text-muted-foreground border-border",
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */
function CopyLinkButton({ link }: { link: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied!" : "Copy link"}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Main Page                                                            */
/* ------------------------------------------------------------------ */
export default function TeamPage() {
  const supabase = createClient()

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeWs, setActiveWs] = useState<Workspace | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [membersLoading, setMembersLoading] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [origin, setOrigin] = useState("")
  const [wsDropdown, setWsDropdown] = useState(false)

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  /* ---- Load workspaces ---- */
  const loadWorkspaces = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setCurrentUserId(user.id)

    const res = await fetch("/api/workspace")
    if (!res.ok) { setLoading(false); return }
    const json = await res.json()
    const list: Workspace[] = json.workspaces ?? []
    setWorkspaces(list)
    if (list.length > 0) setActiveWs(list[0])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadWorkspaces() }, [loadWorkspaces])

  /* ---- Load members + invites for active workspace ---- */
  const loadWorkspaceDetails = useCallback(async (wsId: string) => {
    setMembersLoading(true)

    const [{ data: membersData }, { data: invitesData }] = await Promise.all([
      supabase
        .from("workspace_members")
        .select("id, profile_id, role, joined_at, profiles(display_name, avatar_url, bio)")
        .eq("workspace_id", wsId)
        .order("joined_at"),
      supabase
        .from("workspace_invites")
        .select("*")
        .eq("workspace_id", wsId)
        .order("created_at", { ascending: false }),
    ])

    setMembers((membersData as Member[]) ?? [])
    setInvites(invitesData ?? [])
    setMembersLoading(false)
  }, [supabase])

  useEffect(() => {
    if (activeWs) loadWorkspaceDetails(activeWs.id)
  }, [activeWs, loadWorkspaceDetails])

  /* ---- Actions ---- */
  const handleRemoveMember = async (memberId: string) => {
    await supabase.from("workspace_members").delete().eq("id", memberId)
    if (activeWs) loadWorkspaceDetails(activeWs.id)
  }

  const handleRevokeInvite = async (inviteId: string) => {
    await fetch(`/api/workspace/invite?inviteId=${inviteId}`, { method: "DELETE" })
    if (activeWs) loadWorkspaceDetails(activeWs.id)
  }

  const handleLeaveWorkspace = async () => {
    if (!activeWs || !currentUserId) return
    const me = members.find((m) => m.profile_id === currentUserId)
    if (!me) return
    await supabase.from("workspace_members").delete().eq("id", me.id)
    await loadWorkspaces()
  }

  const handleWorkspaceCreated = async (ws: Workspace) => {
    setWorkspaces((prev) => [...prev, ws])
    setActiveWs(ws)
  }

  const isOwnerOrAdmin = activeWs?.myRole === "owner" || activeWs?.myRole === "admin"

  /* ============================== RENDER ============================= */
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Team
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Invite friends and collaborate on your workspace.
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          size="sm"
          className="gap-2 rounded-[10px]"
        >
          <Plus className="h-4 w-4" />
          New Workspace
        </Button>
      </div>

      {workspaces.length === 0 ? (
        /* ---- Empty state ---- */
        <div className="apple-card flex flex-col items-center justify-center py-24 text-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground">No workspaces yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a workspace and invite your team to get started.
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="gap-2 rounded-[10px]">
            <Plus className="h-4 w-4" />
            Create your first workspace
          </Button>
        </div>
      ) : (
        <>
          {/* Workspace selector */}
          <div className="relative">
            <button
              onClick={() => setWsDropdown((v) => !v)}
              className="flex items-center gap-2 rounded-[10px] border border-border/60 bg-card px-4 py-2.5 text-sm font-medium shadow-sm hover:bg-accent transition-colors"
            >
              <div className="h-6 w-6 rounded-md bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                {activeWs?.name[0].toUpperCase()}
              </div>
              <span>{activeWs?.name}</span>
              <span className={`ml-1 inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full border font-medium ${roleBadge[activeWs?.myRole ?? "member"]}`}>
                {roleIcon[activeWs?.myRole ?? "member"]}
                {activeWs?.myRole}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-1" />
            </button>

            {wsDropdown && (
              <div className="absolute top-full left-0 mt-1 z-20 min-w-[200px] rounded-[12px] border border-border bg-popover shadow-lg overflow-hidden">
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    onClick={() => { setActiveWs(ws); setWsDropdown(false) }}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-accent transition-colors text-left ${activeWs?.id === ws.id ? "bg-accent" : ""}`}
                  >
                    <div className="h-5 w-5 rounded-md bg-primary/20 flex items-center justify-center text-primary font-bold text-[10px] shrink-0">
                      {ws.name[0].toUpperCase()}
                    </div>
                    <span className="font-medium truncate">{ws.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {membersLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Members */}
              <div className="apple-card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
                  <div>
                    <h2 className="text-[15px] font-semibold">Members</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{members.length} people in this workspace</p>
                  </div>
                  {isOwnerOrAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 rounded-[10px] text-xs h-8"
                      onClick={() => setShowInvite(true)}
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Invite
                    </Button>
                  )}
                </div>

                <div className="divide-y divide-border/40">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 px-5 py-3.5 group">
                      {/* Avatar */}
                      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center shrink-0 text-sm font-semibold text-primary overflow-hidden">
                        {m.profiles?.avatar_url ? (
                          <img src={m.profiles.avatar_url} alt={m.profiles?.display_name ?? "Avatar"} className="h-full w-full object-cover" />
                        ) : (
                          (m.profiles?.display_name ?? "?")[0].toUpperCase()
                        )}
                      </div>
                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {m.profiles?.display_name ?? "Unknown"}
                          {m.profile_id === currentUserId && (
                            <span className="ml-2 text-[11px] text-muted-foreground font-normal">(you)</span>
                          )}
                        </p>
                        {m.profiles?.bio ? (
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[200px] xl:max-w-sm">
                            {m.profiles.bio}
                          </p>
                        ) : (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Joined {new Date(m.joined_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      {/* Role badge */}
                      <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-medium ${roleBadge[m.role]}`}>
                        {roleIcon[m.role]}
                        {m.role}
                      </span>
                      {/* Actions */}
                      {isOwnerOrAdmin && m.role !== "owner" && m.profile_id !== currentUserId && (
                        <button
                          onClick={() => handleRemoveMember(m.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 text-destructive hover:bg-destructive/10 rounded-md p-1.5"
                          title="Remove member"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Pending Invites */}
              {isOwnerOrAdmin && (
                <div className="apple-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-border/40">
                    <h2 className="text-[15px] font-semibold">Pending Invites</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {invites.filter((i) => i.status === "pending").length} pending
                    </p>
                  </div>

                  {invites.filter((i) => i.status === "pending").length === 0 ? (
                    <div className="px-5 py-8 text-center text-sm text-muted-foreground opacity-60">
                      No pending invites.
                    </div>
                  ) : (
                    <div className="divide-y divide-border/40">
                      {invites
                        .filter((i) => i.status === "pending")
                        .map((inv) => {
                          const link = `${origin}/team/accept?token=${inv.token}`
                          const isExpired = new Date() > new Date(inv.expires_at)
                          return (
                            <div key={inv.id} className="flex items-center gap-3 px-5 py-3.5 group">
                              <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
                                <Link2 className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {inv.email ?? "Anyone with the link"}
                                </p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  {isExpired ? (
                                    <span className="text-destructive">Expired</span>
                                  ) : (
                                    <>Expires {new Date(inv.expires_at).toLocaleDateString()}</>
                                  )}
                                </p>
                              </div>
                              {!isExpired && <CopyLinkButton link={link} />}
                              <button
                                onClick={() => handleRevokeInvite(inv.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 text-destructive hover:bg-destructive/10 rounded-md p-1.5"
                                title="Revoke invite"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )
                        })}
                    </div>
                  )}
                </div>
              )}

              {/* Leave workspace (for non-owners) */}
              {activeWs?.myRole !== "owner" && (
                <div className="flex justify-end">
                  <button
                    onClick={handleLeaveWorkspace}
                    className="flex items-center gap-2 text-sm text-destructive hover:text-destructive/80 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Leave workspace
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateWorkspaceModal
          onClose={() => setShowCreate(false)}
          onCreated={handleWorkspaceCreated}
        />
      )}
      {showInvite && activeWs && (
        <InviteModal
          workspaceId={activeWs.id}
          workspaceName={activeWs.name}
          onClose={() => { setShowInvite(false); loadWorkspaceDetails(activeWs.id) }}
        />
      )}
    </div>
  )
}
