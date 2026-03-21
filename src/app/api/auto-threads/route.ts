import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "@/lib/supabase/types"

const SYSTEM_PROMPT = `You are a world-class Social Media AI specialized in generating highly engaging, viral Threads for a specific B2B desktop application.

Context about the Product:
1. What it does: A desktop app that converts long-form videos into viral Shorts/Reels/TikToks.
2. Value Proposition (The "Why"):
   - It doesn't just cut videos; it automatically adds engaging, viral-style subtitles and hook styles to maximize watch time.
   - It runs completely locally on the user's computer, meaning their footage stays private and processing depends on their hardware.
3. Pricing & Business Model:
   - NO monthly subscriptions. Users buy a one-time lifetime license.
   - It's a BYOK (Bring Your Own Key) model: Users plug in their own Deepseek API key to handle AI costs directly, making it extremely cheap to run compared to subscription tools like OpusClip or Veed.
4. Current State: Early access. Bugs may happen on some devices, and we are transparent about this.

Your goal is to generate Hooks, Content Strategies, and full-fledged Threads posts based on user prompts. 
Always embody a confident, disruptive, transparent, and value-driven tone. Emphasize the anti-subscription movement, local privacy, and the undeniable quality of the viral hooks it produces.`

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
      }
    }
  )
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()
    const supabase = await getSupabase()

    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Build the request for Deepseek
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        max_tokens: 1536,
        temperature: 0.7,
        stream: false,
      }),
    })

    if (!response.ok) {
      let errorMsg = "AI service unavailable"
      try {
        const errJson = await response.json()
        errorMsg = errJson.error?.message || errorMsg
      } catch {
        errorMsg = await response.text()
      }
      console.error("DeepSeek API error for Auto Threads:", errorMsg)
      return NextResponse.json({ error: "Failed to generate AI response." }, { status: response.status })
    }

    const result = await response.json()
    const content = result.choices?.[0]?.message?.content ?? "Failed to generate response."
    return NextResponse.json({ content })

  } catch (error: any) {
    console.error("Auto Threads route error:", error)
    return NextResponse.json({ 
      error: "Internal server error occurred while processing your request." 
    }, { status: 500 })
  }
}
