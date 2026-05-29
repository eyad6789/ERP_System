import { api } from './client'

// Federated search across every module the viewer's role can reach.
export type SearchKind =
  | 'personnel'
  | 'document'
  | 'site'
  | 'contract'
  | 'operation'
  | 'asset'
  | 'incident'

export interface SearchResult {
  id: number
  kind: SearchKind
  label_ar: string
  label_en: string
  detail: string
}

export interface SearchResponse {
  query: string
  count: number
  results: SearchResult[]
}

export function searchAll(q: string): Promise<SearchResponse> {
  return api<SearchResponse>(`/search?q=${encodeURIComponent(q)}`)
}
