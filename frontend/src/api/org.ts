import { api } from './client'

// One node in the flat org tree the personnel module returns.
// `parent` is the parent department code, or null at the root.
export interface OrgNode {
  code: string
  name_ar: string
  name_en: string
  parent: string | null
  member_count: number
}

export function fetchOrgTree(): Promise<OrgNode[]> {
  return api<OrgNode[]>('/personnel/tree')
}
