import { NextRequest, NextResponse } from "next/server"
import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/lib/supabase/types"

function client() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// GET /api/tasks?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const supabase = client()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const date = req.nextUrl.searchParams.get("date") ?? new Date().toISOString().slice(0, 10)

  // Fetch tasks joined with account info, only for this user's accounts
  const { data, error } = await supabase
    .from("daily_tasks")
    .select("*, accounts!inner(handle, platform, profile_id)")
    .eq("date", date)
    .order("created_at")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/tasks – create a task
export async function POST(req: NextRequest) {
  const supabase = client()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { account_id, content, scheduled_time, date } = body

  if (!account_id || !content) {
    return NextResponse.json({ error: "account_id and content are required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("daily_tasks")
    .insert({ account_id, content, scheduled_time, date })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// PATCH /api/tasks?id=<uuid> – toggle status
export async function PATCH(req: NextRequest) {
  const supabase = client()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

  const body = await req.json()
  const { status } = body

  const { data, error } = await supabase
    .from("daily_tasks")
    .update({ status })
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
