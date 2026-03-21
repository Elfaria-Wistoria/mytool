import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import type { Database } from "@/lib/supabase/types"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

function makeSupabase(request: NextRequest, response: NextResponse): AnyClient {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )
}

// GET /api/workspace — list workspaces the current user belongs to
export async function GET(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = makeSupabase(request, response)

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: memberships, error: membErr } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("profile_id", user.id)

  if (membErr) return NextResponse.json({ error: membErr.message }, { status: 500 })

  const workspaceIds = (memberships ?? []).map((m: { workspace_id: string }) => m.workspace_id)

  if (workspaceIds.length === 0) {
    return NextResponse.json({ workspaces: [] })
  }

  const { data: workspaces, error: wsErr } = await supabase
    .from("workspaces")
    .select("*")
    .in("id", workspaceIds)
    .order("created_at")

  if (wsErr) return NextResponse.json({ error: wsErr.message }, { status: 500 })

  const result = (workspaces ?? []).map((ws: { id: string }) => ({
    ...ws,
    myRole: (memberships ?? []).find((m: { workspace_id: string; role: string }) => m.workspace_id === ws.id)?.role ?? "member",
  }))

  return NextResponse.json({ workspaces: result })
}

// POST /api/workspace — create a new workspace
export async function POST(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = makeSupabase(request, response)

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const name = (body.name as string)?.trim()
  if (!name) return NextResponse.json({ error: "Workspace name is required" }, { status: 400 })

  const { data: ws, error: wsErr } = await supabase
    .from("workspaces")
    .insert({ name, owner_id: user.id })
    .select()
    .single()

  if (wsErr || !ws) return NextResponse.json({ error: wsErr?.message ?? "Failed" }, { status: 500 })

  const { error: memErr } = await supabase
    .from("workspace_members")
    .insert({ workspace_id: ws.id, profile_id: user.id, role: "owner" })

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 })

  return NextResponse.json({ workspace: { ...ws, myRole: "owner" } }, { status: 201 })
}
