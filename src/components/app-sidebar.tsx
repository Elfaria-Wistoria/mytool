"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { useState } from "react"
import { Calendar, LayoutDashboard, BarChart2, Smartphone, LogOut, Loader2, Bug, Wallet, Kanban, BookOpen, Target, Users, User, MessageSquare } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar"

import { createClient } from "@/lib/supabase/client"

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Accounts", url: "/accounts", icon: Smartphone },
  { title: "Schedule", url: "/schedule", icon: Kanban },
  { title: "Planner", url: "/planner", icon: Calendar },
  { title: "Money Tracker", url: "/finance", icon: Wallet },
  {
    title: "Users Feedback",
    url: "/feedbacks",
    icon: MessageSquare,
  },
  { title: "Bug Tracker", url: "/bugs", icon: Bug },
  { title: "Journaling", url: "/journaling", icon: BookOpen },
  { title: "Targets", url: "/targets", icon: Target },
  { title: "Auto Threads", url: "/auto-threads", icon: LayoutDashboard },
  { title: "Team", url: "/team", icon: Users },
  { title: "Profile", url: "/profile", icon: User },
]

export function AppSidebar() {
  const pathname = usePathname()
  const supabase = createClient()
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    await supabase.auth.signOut()
    window.location.href = "/auth/login"
  }

  return (
    <Sidebar className="border-r border-border/50">
      {/* Wordmark */}
      <SidebarHeader className="px-5 py-5">
        <div className="flex items-center gap-2.5">
          <img src="/pp.png" alt="Edwin tools" className="h-7 w-7 rounded-[8px] object-cover shadow-sm" />
          <span className="font-semibold text-[15px] tracking-tight text-foreground">All in for Naura</span>
        </div>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent className="px-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {items.map((item) => {
                const isActive = pathname === item.url
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      render={<Link href={item.url} />}
                      className={`
                        flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm font-medium transition-all duration-100
                        ${isActive
                          ? "bg-foreground text-background shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent"
                        }
                      `}
                    >
                      <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "opacity-100" : "opacity-60"}`} />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer — sign out only */}
      <SidebarFooter className="px-4 py-4">
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors disabled:opacity-50"
        >
          {signingOut
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <LogOut className="h-4 w-4 opacity-60" />
          }
          <span>Sign Out</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  )
}
