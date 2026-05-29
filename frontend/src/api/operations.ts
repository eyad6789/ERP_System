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

// Fields the create/edit form submits; the server assigns id/updated_at.
export interface TaskInput {
  title_ar: string
  title_en: string
  assignee: string
  priority: TaskPriority
  due_date: string | null
  status: TaskStatus
  classification: number
}

export interface TaskListParams {
  q?: string
  ordering?: string
}

export function fetchTasks(params: TaskListParams = {}): Promise<Task[]> {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.ordering) search.set('ordering', params.ordering)
  const qs = search.toString()
  return api<Task[]>(`/operations/tasks${qs ? `?${qs}` : ''}`)
}

export function fetchTask(id: number): Promise<Task> {
  return api<Task>(`/operations/tasks/${id}`)
}

export function createTask(body: TaskInput): Promise<Task> {
  return api<Task>('/operations/tasks', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateTask(id: number, body: Partial<TaskInput>): Promise<Task> {
  return api<Task>(`/operations/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function removeTask(id: number): Promise<void> {
  return api<void>(`/operations/tasks/${id}`, { method: 'DELETE' })
}

export function updateTaskStatus(id: number, status: TaskStatus): Promise<Task> {
  return api<Task>(`/operations/tasks/${id}/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  })
}
