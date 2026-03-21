"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { ScheduleTask, TaskStatus, TaskPriority } from "@/lib/types/schedule"
import { Plus, MoreHorizontal, Calendar } from "lucide-react"
import { TaskModal } from "./task-modal"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { format } from "date-fns"

interface KanbanBoardProps {
  initialTasks: ScheduleTask[]
}

const COLUMNS: { id: TaskStatus; title: string }[] = [
  { id: "todo", title: "To Do" },
  { id: "in_progress", title: "In Progress" },
  { id: "done", title: "Done" },
]

export function KanbanBoard({ initialTasks }: KanbanBoardProps) {
  const [tasks, setTasks] = useState<ScheduleTask[]>(initialTasks)
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<ScheduleTask | undefined>(undefined)
  const [activeColumnId, setActiveColumnId] = useState<TaskStatus | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null))
  }, [])

  useEffect(() => {
    setTasks(initialTasks)
  }, [initialTasks])

  const supabase = createClient()

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedTaskId(id)
    e.dataTransfer.effectAllowed = "move"
    // Make it look a bit transparent while dragging
    const target = e.target as HTMLElement
    setTimeout(() => {
      target.style.opacity = "0.5"
    }, 0)
  }

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedTaskId(null)
    setActiveColumnId(null)
    const target = e.target as HTMLElement
    target.style.opacity = "1"
  }

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setActiveColumnId(status)
  }

  const handleDragLeave = () => {
    setActiveColumnId(null)
  }

  const handleDrop = async (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault()
    setActiveColumnId(null)

    if (!draggedTaskId) return

    const task = tasks.find(t => t.id === draggedTaskId)
    if (!task || task.status === status) return

    const updates: any = { status }
    
    if (status === "done" && currentUserId) {
      updates.completed_by = currentUserId
    } else if (status !== "done") {
      updates.completed_by = null
    }

    // Optimistic update
    const previousTasks = [...tasks]
    setTasks(tasks.map(t => {
      if (t.id !== draggedTaskId) return t
      
      const updatedTask = { ...t, status }
      if (status === "done" && currentUserId) {
        updatedTask.completed_by = currentUserId
      } else if (status !== "done") {
        updatedTask.completed_by = null
        updatedTask.completer = null
      }
      return updatedTask
    }))

    // Update in DB
    const { error } = await supabase
      .from("schedule_tasks")
      .update(updates)
      .eq("id", draggedTaskId)

    if (error) {
      toast.error("Failed to update task status")
      setTasks(previousTasks) // Revert
    }
  }

  const openCreateModal = () => {
    setEditingTask(undefined)
    setIsModalOpen(true)
  }

  const openEditModal = (task: ScheduleTask) => {
    setEditingTask(task)
    setIsModalOpen(true)
  }

  const onTaskSaved = (savedTask: ScheduleTask) => {
    if (editingTask) {
      setTasks(tasks.map((t) => (t.id === savedTask.id ? savedTask : t)))
    } else {
      setTasks([...tasks, savedTask])
    }
  }

  const onTaskDeleted = (id: string) => {
    setTasks(tasks.filter((t) => t.id !== id))
  }

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case "high": return "bg-red-500/10 text-red-500 hover:bg-red-500/20"
      case "medium": return "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20"
      case "low": return "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20"
      default: return "bg-secondary text-secondary-foreground"
    }
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Schedule</h2>
          <p className="text-muted-foreground">Manage your tasks and upcoming content.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="fixed bottom-8 right-24 z-[40] inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all shadow-xl hover:shadow-2xl focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-6 hover:scale-105"
        >
          <Plus className="h-5 w-5" />
          New Task
        </button>
      </div>

      <div className="flex flex-row md:grid md:grid-cols-3 gap-4 md:gap-6 h-full pb-20 items-start overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id)

          return (
            <div
              key={col.id}
              className="w-[85vw] max-w-[320px] shrink-0 md:w-auto md:max-w-none snap-center md:snap-align-none flex flex-col gap-3 rounded-lg bg-muted/40 p-3 min-h-[500px]"
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">{col.title}</h3>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-background text-xs text-muted-foreground shadow-sm">
                    {colTasks.length}
                  </span>
                </div>
                <button className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>

              <div className={`flex flex-col gap-3 min-h-[100px] transition-colors rounded-md ${activeColumnId === col.id ? 'bg-muted/50' : ''}`}>
                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => openEditModal(task)}
                    className="group relative flex cursor-grab active:cursor-grabbing flex-col gap-3 rounded-lg border border-border/50 bg-background p-4 shadow-sm hover:border-border hover:shadow-md transition-all"
                  >
                      <div className="flex items-center gap-2">
                        {task.profiles && (
                          <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 overflow-hidden text-[10px] font-semibold text-primary">
                            {task.profiles.avatar_url ? (
                              <img src={task.profiles.avatar_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              task.profiles.display_name[0].toUpperCase()
                            )}
                          </div>
                        )}
                        <p className="font-medium text-sm leading-tight text-foreground">{task.title}</p>
                      </div>

                    {task.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {task.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-5 font-medium border-0 capitalize ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </Badge>
                      </div>

                      {task.due_date && (
                        <div className="flex items-center text-xs text-muted-foreground gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{format(new Date(task.due_date), "MMM d")}</span>
                        </div>
                      )}
                    </div>
                    
                    {task.status === "done" && task.completer && (
                      <div className="mt-1 pt-2 border-t border-border/40 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span className="truncate">Completed by {task.completer.display_name}</span>
                      </div>
                    )}
                  </div>
                ))}

                {colTasks.length === 0 && (
                  <div className="flex items-center justify-center h-24 rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                    Drop tasks here
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <TaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        task={editingTask}
        onSaved={onTaskSaved}
        onDeleted={onTaskDeleted}
      />
    </div>
  )
}
