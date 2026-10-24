import { useState, useCallback } from "react"
import type { ToastItem } from "../shared/components/ToastContainer"

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const addToast = useCallback((message: string, type: ToastItem["type"] = "info") => {
    const trimmed = String(message || '').trim()
    if (!trimmed) return

    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => {
      // Deduplicate: avoid spamming identical toast messages
      if (prev.some((t) => t.message === trimmed && t.type === type)) {
        return prev
      }
      // Keep maximum 4 visible toasts to prevent viewport clutter/DoS
      const current = prev.length >= 4 ? prev.slice(prev.length - 3) : prev
      return [...current, { id, message: trimmed, type }]
    })

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4500)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { toasts, addToast, removeToast }
}
