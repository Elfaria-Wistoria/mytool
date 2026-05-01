import { createClient as createSupabaseClient } from "@supabase/supabase-js"

const SNIPIE_URL = "https://etrmhgiymyzkkdwpcufu.supabase.co"
const SNIPIE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0cm1oZ2l5bXl6a2tkd3BjdWZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzOTk4ODIsImV4cCI6MjA4Njk3NTg4Mn0.dWjAH2_Vf9ec--Do51Ej4VBG-NuabtEQ4whasQePfg4"

export const snipieClient = createSupabaseClient(SNIPIE_URL, SNIPIE_ANON_KEY)

// --- Types inferred from schema ---
export type CreatorApplication = {
  id: string
  email: string
  social_link: string
  status: string | null
  created_at: string | null
  device_id: string | null
  total_earned: number | null
  balance: number | null
  avatar_url: string | null
}

export type BugReport = {
  id: string
  description: string
  image_url: string | null
  created_at: string
}

export type PromotionSubmission = {
  id: string
  creator_id: string | null
  post_link: string
  account_link: string
  screenshot_url: string
  views_claimed: number
  status: string | null
  reward_amount: number | null
  created_at: string | null
}

export type WithdrawalRequest = {
  id: string
  creator_id: string | null
  amount: number
  payment_method: string
  status: string | null
  created_at: string | null
}

export type SnipieUser = {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
  is_activated: boolean | null
  subscription_expires_at: string | null
  created_at: string
}

export type ActivationCode = {
  code: string
  status: string | null
  used_by: string | null
  created_at: string
  used_at: string | null
  owner_email: string | null
  duration_months: number | null
}
