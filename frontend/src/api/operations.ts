import { api } from './client'

export type TaskPriority = 'high' | 'medium' | 'low'
export type TaskStatus = 'open' | 'active' | 'closed'

export interface Task {
  id: number
  title_ar: string
  title_en: string
  assignee: string
  priority: TaskPriority
  due_date: string | null
  status: TaskStatus
  classification: number
  updated_at: string
}

export function fetchTasks(): Promise<Task[]> {
  return api<Task[]>('/operations/tasks')
}

export function fetchTask(id: number): Promise<Task> {
  return api<Task>(`/operations/tasks/${id}`)
}

export function updateTaskStatus(id: number, status: TaskStatus): Promise<Task> {
  return api<Task>(`/operations/tasks/${id}/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  })
}
