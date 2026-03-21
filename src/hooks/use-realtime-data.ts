import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/lib/supabase/types"

type TableName = keyof Database["public"]["Tables"]

// Global memory cache to prevent loading spinners on navigation
const cache: Record<string, any[]> = {}

export function useRealtimeData<T>(
  table: TableName,
  orderBy: string = "created_at",
  ascending: boolean = false,
  selectQuery: string = "*"
) {
  const supabase = createClient()
  const [data, setData] = useState<T[]>(cache[table] || [])
  const [loading, setLoading] = useState(!cache[table])

  const loadData = useCallback(async (showLoader = false) => {
    if (showLoader && !cache[table]) setLoading(true)
    
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      setLoading(false)
      return
    }

    const { data: rows, error } = await supabase
      .from(table)
      .select(selectQuery)
      .order(orderBy, { ascending })

    if (!error && rows) {
      cache[table] = rows
      setData(rows as T[])
    }
    setLoading(false)
  }, [supabase, table, orderBy, ascending])

  useEffect(() => {
    // initial fetch
    loadData(true)

    // Setup realtime subscription
    const channel = supabase
      .channel(`public:${table}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: table },
        () => {
          // silently fetch new DB changes without loading spinner
          loadData(false)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadData, supabase, table])

  // update cache when setData is used optimistically
  const setOptimisticData = useCallback((newData: T[] | ((prev: T[]) => T[])) => {
    setData((prev) => {
      const next = typeof newData === "function" ? (newData as any)(prev) : newData
      cache[table] = next
      return next
    })
  }, [table])

  return { data, loading, setData: setOptimisticData }
}
