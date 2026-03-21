export type TaskStatus = "todo" | "in_progress" | "done"
export type TaskPriority = "low" | "medium" | "high"

export interface ScheduleTask {
  id: string
  profile_id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  completed_by?: string | null
  created_at: string
  updated_at: string
  profiles?: { display_name: string; avatar_url: string | null } | null
  completer?: { display_name: string; avatar_url: string | null } | null
}
