"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Users, Loader2, CheckCircle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

function AcceptInviteContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token")
  const supabase = createClient()

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [message, setMessage] = useState("")
  const [workspaceId, setWorkspaceId] = useState("")
  const [user, setUser] = useState<{ email?: string } | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
    })
  }, [supabase])

  const handleAccept = async () => {
    if (!token) { setStatus("error"); setMessage("Invalid invite link."); return }

    setStatus("loading")

    const res = await fetch("/api/workspace/accept-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
    const json = await res.json()

    if (!res.ok) {
      setStatus("error")
      setMessage(json.error ?? "Failed to accept invite.")
    } else {
      setStatus("success")
      setWorkspaceId(json.workspaceId)
    }
  }

  if (!token) {
    return (
      <div className="text-center space-y-2">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <p className="font-semibold text-foreground">Invalid invite link</p>
        <p className="text-sm text-muted-foreground">This link appears to be broken or expired.</p>
      </div>
    )
  }

  return (
    <div className="text-center space-y-5">
      {status === "idle" && (
        <>
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">You&apos;re invited!</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {user ? `Joining as ${user.email}` : "You need to be logged in to accept this invite."}
            </p>
          </div>
          {user ? (
            <Button onClick={handleAccept} className="rounded-[10px] gap-2 w-full max-w-[200px]">
              Join Workspace
            </Button>
          ) : (
            <Button
              onClick={() => router.push(`/auth/login?next=/team/accept?token=${token}`)}
              className="rounded-[10px] gap-2"
            >
              Sign in to accept
            </Button>
          )}
        </>
      )}

      {status === "loading" && (
        <>
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Joining workspace…</p>
        </>
      )}

      {status === "success" && (
        <>
          <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto" />
          <div>
            <p className="font-semibold text-foreground">You&apos;ve joined the workspace!</p>
            <p className="text-sm text-muted-foreground mt-1">Welcome to the team 🎉</p>
          </div>
          <Button
            onClick={() => router.push("/team")}
            className="rounded-[10px] gap-2"
          >
            Go to Team page
          </Button>
        </>
      )}

      {status === "error" && (
        <>
          <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
          <div>
            <p className="font-semibold text-foreground">Something went wrong</p>
            <p className="text-sm text-muted-foreground mt-1">{message}</p>
          </div>
          <Button variant="outline" onClick={() => router.push("/")} className="rounded-[10px]">
            Back to Dashboard
          </Button>
        </>
      )}
    </div>
  )
}

export default function AcceptInvitePage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="apple-card w-full max-w-sm p-8">
        <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />}>
          <AcceptInviteContent />
        </Suspense>
      </div>
    </div>
  )
}
