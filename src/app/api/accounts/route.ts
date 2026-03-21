import { NextRequest, NextResponse } from "next/server"
import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/lib/supabase/types"

function client() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// GET /api/accounts – list all accounts for the current user
export async function GET(req: NextRequest) {
  const supabase = client()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .order("created_at")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/accounts – create a new account
export async function POST(req: NextRequest) {
  const supabase = client()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { platform, handle } = body

  if (!platform || !handle) {
    return NextResponse.json({ error: "platform and handle are required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("accounts")
    .insert({ profile_id: user.id, platform, handle })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// DELETE /api/accounts?id=<uuid>
export async function DELETE(req: NextRequest) {
  const supabase = client()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

  const { error } = await supabase
    .from("accounts")
    .delete()
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
