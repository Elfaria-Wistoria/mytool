import { createClient } from "@supabase/supabase-js"
import { createHash } from "crypto"
import { NextRequest, NextResponse } from "next/server"

const SNIPIE_URL   = "https://etrmhgiymyzkkdwpcufu.supabase.co"
const SNIPIE_ANON  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0cm1oZ2l5bXl6a2tkd3BjdWZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzOTk4ODIsImV4cCI6MjA4Njk3NTg4Mn0.dWjAH2_Vf9ec--Do51Ej4VBG-NuabtEQ4whasQePfg4"

function validateSignature(
  refId: string,
  amount: string,
  messageId: string,
  received: string,
  merchantKey: string,
): boolean {
  const str  = amount + refId + messageId + merchantKey
  const calc = createHash("sha256").update(str, "utf8").digest("hex")
  return calc === received
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const signature  = req.headers.get("x-lynk-signature") ?? ""
    const merchantKey = process.env.LYNK_MERCHANT_KEY ?? ""

    const messageId  = body?.data?.message_id ?? ""
    const refId      = body?.data?.message_data?.refId ?? ""
    const grandTotal = body?.data?.message_data?.totals?.grandTotal ?? 0
    const amount     = String(grandTotal)

    // Validate signature only if merchant key is configured
    if (merchantKey) {
      const valid = validateSignature(refId, amount, messageId, signature, merchantKey)
      if (!valid) {
        console.warn("[lynk-webhook] ❌ Invalid signature", {
          received: signature,
          refId, amount, messageId,
          computed: createHash("sha256")
            .update(amount + refId + messageId + merchantKey, "utf8")
            .digest("hex"),
        })
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
      }
    } else {
      // No merchant key configured — accept all (useful during initial setup)
      console.warn("[lynk-webhook] ⚠️ No LYNK_MERCHANT_KEY set, accepting without validation")
    }

    if (body?.event !== "payment.received") {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const md       = body.data.message_data
    const customer = md?.customer ?? {}
    const totals   = md?.totals ?? {}
    const items    = md?.items ?? []

    const supabase = createClient(SNIPIE_URL, SNIPIE_ANON)
    const { error } = await supabase.from("lynk_payments").insert({
      event:           body.event,
      ref_id:          refId,
      message_id:      messageId,
      grand_total:     totals.grandTotal ?? 0,
      total_price:     totals.totalPrice ?? 0,
      convenience_fee: totals.convenienceFee ?? 0,
      discount:        totals.discount ?? 0,
      customer_name:   customer.name  ?? null,
      customer_email:  customer.email ?? null,
      customer_phone:  customer.phone ?? null,
      items:           items,
      voucher_code:    md?.voucherCode || null,
      raw_payload:     body,
    })

    if (error) {
      if (error.code === "23505") {
        console.log("[lynk-webhook] ℹ️ Duplicate message_id, skipping:", messageId)
        return NextResponse.json({ ok: true, duplicate: true })
      }
      console.error("[lynk-webhook] ❌ DB error:", JSON.stringify(error))
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log("[lynk-webhook] ✅ Saved:", refId, "Rp", grandTotal)
    return NextResponse.json({ ok: true, ref_id: refId })

  } catch (err) {
    console.error("[lynk-webhook] ❌ Parse error:", err)
    return NextResponse.json({ error: "Bad request" }, { status: 400 })
  }
}

export async function GET() {
  return NextResponse.json({
    status: "lynk webhook endpoint active",
    configured: !!process.env.LYNK_MERCHANT_KEY,
  })
}
