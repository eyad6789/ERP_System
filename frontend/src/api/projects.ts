import { api } from './client'

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'done'

export interface ProjectListItem {
  id: number
  name_ar: string
  name_en: string
  status: ProjectStatus
  progress: number
  start_date: string
  end_date: string
  classification: number
  lead: string
}

export interface ProjectDetail extends ProjectListItem {
  updated_at: string
}

export interface ProjectWriteBody {
  name_ar: string
  name_en: string
  status: ProjectStatus
  progress: number
  start_date: string
  end_date: string
  classification: number
  lead: string
}

export interface ProjectListParams {
  q?: string
  ordering?: string
}

export function fetchProjects(params: ProjectListParams = {}): Promise<ProjectListItem[]> {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.ordering) search.set('ordering', params.ordering)
  const qs = search.toString()
  return api<ProjectListItem[]>(`/projects/${qs ? `?${qs}` : ''}`)
}

export function fetchProject(id: number): Promise<ProjectDetail> {
  return api<ProjectDetail>(`/projects/${id}`)
}

export function createProject(body: ProjectWriteBody): Promise<ProjectDetail> {
  return api<ProjectDetail>('/projects/', { method: 'POST', body: JSON.stringify(body) })
}

export function updateProject(
  id: number,
  body: Partial<ProjectWriteBody>,
): Promise<ProjectDetail> {
  return api<ProjectDetail>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function removeProject(id: number): Promise<void> {
  return api<void>(`/projects/${id}`, { method: 'DELETE' })
}
