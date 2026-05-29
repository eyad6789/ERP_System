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

export interface PersonInput {
  name_ar: string
  name_en: string
  rank_ar: string
  rank_en: string
  classification: number
  status: Person['status']
  attendance: number
  joined_year: number
  contract_type: string
}

export interface PersonnelListParams {
  q?: string
  ordering?: string
}

export function fetchPersonnel(params: PersonnelListParams = {}): Promise<Person[]> {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.ordering) search.set('ordering', params.ordering)
  const qs = search.toString()
  return api<Person[]>(`/personnel/${qs ? `?${qs}` : ''}`)
}

export function fetchPerson(id: number): Promise<Person> {
  return api<Person>(`/personnel/${id}`)
}

export function fetchOrgTree(): Promise<OrgNode[]> {
  return api<OrgNode[]>('/personnel/tree')
}

export function createPerson(body: PersonInput): Promise<Person> {
  return api<Person>('/personnel/', { method: 'POST', body: JSON.stringify(body) })
}

export function updatePerson(id: number, body: Partial<PersonInput>): Promise<Person> {
  return api<Person>(`/personnel/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function removePerson(id: number): Promise<void> {
  return api<void>(`/personnel/${id}`, { method: 'DELETE' })
}
