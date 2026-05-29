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

export function fetchDocuments(): Promise<DocumentListItem[]> {
  return api<DocumentListItem[]>('/documents/')
}

export function fetchDocument(id: number): Promise<DocumentDetail> {
  return api<DocumentDetail>(`/documents/${id}`)
}
