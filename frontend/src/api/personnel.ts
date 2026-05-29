import { api } from './client'

export interface Person {
  id: number
  name_ar: string
  name_en: string
  rank_ar: string
  rank_en: string
  department_code: string
  department_name_ar: string
  department_name_en: string
  classification: number
  status: 'active' | 'leave' | 'mission'
  // detail-only
  attendance?: number
  joined_year?: number
  contract_type?: string
}

export interface OrgNode {
  code: string
  name_ar: string
  name_en: string
  parent: string | null
  member_count: number
}

export function fetchPersonnel(): Promise<Person[]> {
  return api<Person[]>('/personnel/')
}

export function fetchPerson(id: number): Promise<Person> {
  return api<Person>(`/personnel/${id}`)
}

export function fetchOrgTree(): Promise<OrgNode[]> {
  return api<OrgNode[]>('/personnel/tree')
}
