import { api } from './client'

export interface Workspace {
  key: string
  name_ar: string
  name_en: string
  description_ar: string
  description_en: string
  mission_ar: string
  mission_en: string
  accent_color: string
  owner_department: string
  head_name: string
  featured: string[]
  can_edit: boolean
  updated_at: string
  updated_by: string | null
}

export type WorkspacePatch = Partial<
  Pick<
    Workspace,
    | 'name_ar'
    | 'name_en'
    | 'description_ar'
    | 'description_en'
    | 'mission_ar'
    | 'mission_en'
    | 'accent_color'
    | 'head_name'
    | 'featured'
  >
>

export function fetchWorkspaces(): Promise<Workspace[]> {
  return api<Workspace[]>('/workspaces/')
}

export function updateWorkspace(key: string, body: WorkspacePatch): Promise<Workspace> {
  return api<Workspace>(`/workspaces/${key}`, { method: 'PATCH', body: JSON.stringify(body) })
}
