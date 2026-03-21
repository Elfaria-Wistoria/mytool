"use client"

import { usePathname } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { ModeToggle } from "@/components/theme-toggle"
import { NotificationsPopover } from "@/components/notifications-popover"
import { JarvisChat } from "@/components/jarvis-chat"

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // If the user is on the public report bug/feedback pages or auth pages, don't show the sidebar.
  if (pathname?.startsWith("/report-bug") || pathname?.startsWith("/feedback/") || pathname?.startsWith("/auth")) {
    return (
      <div className="relative flex min-h-screen flex-col">
        <div className="absolute top-4 right-4 z-50">
          <ModeToggle />
        </div>
        <main className="flex-1">
          {children}
        </main>
      </div>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="flex flex-col flex-1 w-full min-h-screen">
        <header className="sticky top-0 z-50 flex h-14 items-center gap-3 border-b border-border/50 bg-background/95 backdrop-blur-xl px-4 sm:px-6">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground transition-colors" />
          <div className="flex-1" />
          <NotificationsPopover />
          <ModeToggle />
        </header>
        <main className="flex-1 p-5 sm:p-7 md:p-9">
          {children}
        </main>
      </div>
      {/* JARVIS — persistent floating assistant */}
      <JarvisChat />
    </SidebarProvider>
  )
}
