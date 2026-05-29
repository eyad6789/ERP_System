import { api } from './client'

export interface DocumentListItem {
  id: number
  classification: number
  locked: boolean
  version: number
  access_count: number
  owner: string | null
  updated_at: string
  title_ar: string | null
  title_en: string | null
}

export interface DocumentVersion {
  number: number
  note_ar: string
  note_en: string
  created_at: string
}

export interface DocumentDetail {
  id: number
  title_ar: string
  title_en: string
  body: string
  classification: number
  version: number
  access_count: number
  owner: string | null
  updated_at: string
  versions: DocumentVersion[]
}

// Payload for create/update. classification is constrained to the 1..4 range.
export interface DocumentWrite {
  title_ar: string
  title_en: string
  body: string
  classification: number
}

export interface DocumentListQuery {
  q?: string
  ordering?: string
}

// Note appended when stamping a new version. The server may snapshot the body;
// these optional fields keep the contract forward-compatible.
export interface DocumentVersionNote {
  note_ar?: string
  note_en?: string
  body?: string
}

export function fetchDocuments(params: DocumentListQuery = {}): Promise<DocumentListItem[]> {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.ordering) search.set('ordering', params.ordering)
  const qs = search.toString()
  return api<DocumentListItem[]>(`/documents/${qs ? `?${qs}` : ''}`)
}

export function fetchDocument(id: number): Promise<DocumentDetail> {
  return api<DocumentDetail>(`/documents/${id}`)
}

export function createDocument(body: DocumentWrite): Promise<DocumentDetail> {
  return api<DocumentDetail>('/documents/', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateDocument(
  id: number,
  body: Partial<DocumentWrite>,
): Promise<DocumentDetail> {
  return api<DocumentDetail>(`/documents/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function removeDocument(id: number): Promise<void> {
  return api<void>(`/documents/${id}`, { method: 'DELETE' })
}

export function addDocumentVersion(
  id: number,
  note: DocumentVersionNote = {},
): Promise<DocumentDetail> {
  return api<DocumentDetail>(`/documents/${id}/version`, {
    method: 'POST',
    body: JSON.stringify(note),
  })
}
