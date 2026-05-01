import { createClient } from "@supabase/supabase-js"
import { createHash } from "crypto"
import { NextRequest, NextResponse } from "next/server"

const SNIPIE_URL     = "https://etrmhgiymyzkkdwpcufu.supabase.co"
const SNIPIE_ANON    = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0cm1oZ2l5bXl6a2tkd3BjdWZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzOTk4ODIsImV4cCI6MjA4Njk3NTg4Mn0.dWjAH2_Vf9ec--Do51Ej4VBG-NuabtEQ4whasQePfg4"
const MERCHANT_KEY   = process.env.LYNK_MERCHANT_KEY ?? ""

function validateSignature(
  refId: string,
  amount: string,
  messageId: string,
  received: string,
): boolean {
  if (!MERCHANT_KEY) return false
  const str = amount + refId + messageId + MERCHANT_KEY
  const calc = createHash("sha256").update(str, "utf8").digest("hex")
  return calc === received
}

export async function POST(req: NextRequest) {
  try {
    // 1. Parse body
    const body = await req.json()

    // 2. Get signature from header
    const signature = req.headers.get("x-lynk-signature") ?? ""

    // 3. Extract required fields for validation
    const messageId  = body?.data?.message_id ?? ""
    const refId      = body?.data?.message_data?.refId ?? ""
    const grandTotal = body?.data?.message_data?.totals?.grandTotal
    const amount     = String(grandTotal ?? "")

    // 4. Validate signature (skip in dev if no key set)
    if (MERCHANT_KEY && !validateSignature(refId, amount, messageId, signature)) {
      console.warn("[lynk-webhook] Invalid signature:", { refId, amount, messageId })
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    // 5. Only process payment.received
    if (body?.event !== "payment.received") {
      return NextResponse.json({ ok: true, skipped: true })
    }

    // 6. Extract data
    const md       = body.data.message_data
    const customer = md?.customer ?? {}
    const totals   = md?.totals ?? {}
    const items    = md?.items ?? []

    // 7. Store in Supabase
    const supabase = createClient(SNIPIE_URL, SNIPIE_ANON)
    const { error } = await supabase.from("lynk_payments").insert({
      event:           body.event,
      ref_id:          refId,
      message_id:      messageId,
      grand_total:     totals.grandTotal ?? 0,
      total_price:     totals.totalPrice ?? 0,
      convenience_fee: totals.convenienceFee ?? 0,
      discount:        totals.discount ?? 0,
      customer_name:   customer.name ?? null,
      customer_email:  customer.email ?? null,
      customer_phone:  customer.phone ?? null,
      items:           items,
      voucher_code:    md?.voucherCode ?? null,
      raw_payload:     body,
    })

    if (error) {
      // Duplicate message_id — idempotent, return 200
      if (error.code === "23505") {
        return NextResponse.json({ ok: true, duplicate: true })
      }
      console.error("[lynk-webhook] DB error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log("[lynk-webhook] ✅ Payment saved:", refId, `Rp ${grandTotal}`)
    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error("[lynk-webhook] Parse error:", err)
    return NextResponse.json({ error: "Bad request" }, { status: 400 })
  }
}

// Lynk.id may send OPTIONS preflight
export async function GET() {
  return NextResponse.json({ status: "lynk webhook endpoint active" })
}
