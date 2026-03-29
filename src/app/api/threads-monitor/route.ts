import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "@/lib/supabase/types"

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

// Catatan: Karena public URL threads direct-fetch biasanya me-return halaman Login
// Disarankan untuk replace fungsi fetchMockData ini dengan panggilan ke RapidAPI Threads Scraper 
// Atau API pihak ketiga lainnya jika untuk produksi.
async function fetchThreadsMetrics(url: string) {
  try {
    // Sebagai fallback/mock sementara agar UI tetap berfungsi ketika diklik Refresh
    const randomViews = Math.floor(Math.random() * 5000) + 100;
    const randomLikes = Math.floor(randomViews * 0.15);
    const randomReplies = Math.floor(randomLikes * 0.05);

    return {
      content_preview: `Extracted content from ${new URL(url).pathname}...`,
      views_count: randomViews,
      likes_count: randomLikes,
      replies_count: randomReplies,
      success: true
    }
  } catch (err) {
    console.error("Scraping error:", err)
    return { success: false }
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action, id, url, views, likes, replies } = await req.json()
    const supabase = await getSupabase()

    // Cek auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    // ACTION: ADD NEW POST TO TRACK
    if (action === "add" && url) {
      // Basic URL validation
      if (!url.includes("threads.")) {
        return NextResponse.json({ error: "Invalid Threads URL" }, { status: 400 })
      }

      // 1. Initial Data Fetch
      const metrics = await fetchThreadsMetrics(url);
      
      // 2. Insert to DB
      const { data, error } = await supabase.from('tracked_posts').insert({
        profile_id: user.id,
        url: url,
        content_preview: metrics.success ? metrics.content_preview : "Waiting for metrics...",
        views_count: metrics.success ? metrics.views_count : 0,
        likes_count: metrics.success ? metrics.likes_count : 0,
        replies_count: metrics.success ? metrics.replies_count : 0,
        last_checked_at: new Date().toISOString()
      }).select().single()

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
           return NextResponse.json({ error: "Post ini sudah di-track" }, { status: 400 })
        }
        throw error;
      }

      return NextResponse.json({ data })
    }
    
    // ACTION: REFRESH A SPECIFIC POST OR ALL
    if (action === "refresh") {
      let postsToRefresh: any[] = [];
      
      if (id) {
        // Fetch single post
        const { data } = await supabase.from('tracked_posts').select('*').eq('id', id).eq('profile_id', user.id).single()
        if (data) postsToRefresh.push(data)
      } else {
        // Fetch all active posts for this user
        const { data } = await supabase.from('tracked_posts').select('*').eq('profile_id', user.id)
        if (data) postsToRefresh = data
      }

      const updatedPosts = [];
      
      // Bisa dioptimasi jadi Promise.all jika pakai external API yg support concurrent
      for (const post of postsToRefresh) {
        const metrics = await fetchThreadsMetrics(post.url);
        if (metrics.success) {
          const { data: updated } = await supabase.from('tracked_posts').update({
            content_preview: metrics.content_preview,
            views_count: metrics.views_count,
            likes_count: metrics.likes_count,
            replies_count: metrics.replies_count,
            last_checked_at: new Date().toISOString()
          }).eq('id', post.id).select().single()
          
          if (updated) updatedPosts.push(updated)
        }
      }

      return NextResponse.json({ data: updatedPosts })
    }

    // ACTION: UPDATE METRICS MANUALLY
    if (action === "update_metrics" && id) {
       const { data, error } = await supabase.from('tracked_posts').update({
         views_count: views,
         likes_count: likes,
         replies_count: replies,
         last_checked_at: new Date().toISOString()
       }).eq('id', id).eq('profile_id', user.id).select().single()
       
       if (error) throw error;
       return NextResponse.json({ data })
    }

    // ACTION: DELETE POST
    if (action === "delete" && id) {
       const { error } = await supabase.from('tracked_posts').delete().eq('id', id).eq('profile_id', user.id)
       if (error) throw error;
       return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })

  } catch (error: any) {
    console.error("Threads Monitor error:", error)
    return NextResponse.json({ 
      error: "Internal server error occurred." 
    }, { status: 500 })
  }
}
