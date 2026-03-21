"use client"

import { useRealtimeData } from "@/hooks/use-realtime-data"
import { KanbanBoard } from "@/components/schedule/kanban-board"
import { ScheduleTask } from "@/lib/types/schedule"
import { Loader2 } from "lucide-react"

export default function SchedulePage() {
  const { data: tasks, loading, setData: setTasks } = useRealtimeData<ScheduleTask>(
    "schedule_tasks",
    "created_at",
    false,
    "*, profiles!profile_id(display_name, avatar_url), completer:profiles!completed_by(display_name, avatar_url)"
  )

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex-1 w-full h-full p-4 md:p-6 lg:p-8 pt-6 max-w-7xl mx-auto">
      <KanbanBoard initialTasks={tasks} />
    </div>
  )
}
