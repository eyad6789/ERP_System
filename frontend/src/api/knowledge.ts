import { api } from './client'

export interface KnowledgeListItem {
  id: number
  title_ar: string
  title_en: string
  category: string
  classification: number
}

export interface KnowledgeDetail extends KnowledgeListItem {
  body: string
  updated_at: string
}

export interface KnowledgeWriteBody {
  title_ar: string
  title_en: string
  body: string
  category: string
  classification: number
}

export interface KnowledgeListParams {
  q?: string
  ordering?: string
}

export function fetchKnowledge(params: KnowledgeListParams = {}): Promise<KnowledgeListItem[]> {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.ordering) search.set('ordering', params.ordering)
  const qs = search.toString()
  return api<KnowledgeListItem[]>(`/knowledge/${qs ? `?${qs}` : ''}`)
}

export function fetchKnowledgeOne(id: number): Promise<KnowledgeDetail> {
  return api<KnowledgeDetail>(`/knowledge/${id}`)
}

export function createKnowledge(body: KnowledgeWriteBody): Promise<KnowledgeDetail> {
  return api<KnowledgeDetail>('/knowledge/', { method: 'POST', body: JSON.stringify(body) })
}

export function updateKnowledge(
  id: number,
  body: Partial<KnowledgeWriteBody>,
): Promise<KnowledgeDetail> {
  return api<KnowledgeDetail>(`/knowledge/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function removeKnowledge(id: number): Promise<void> {
  return api<void>(`/knowledge/${id}`, { method: 'DELETE' })
}
