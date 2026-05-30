// Attachments API: clearance-scoped file upload / listing / download / delete and
// server-side CSV parsing. Uploads are multipart, so they bypass the JSON `api()`
// wrapper (which would force a JSON Content-Type and clobber the form boundary).
import { ApiError, api } from './client'

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api'

export type AttachmentKind = 'document' | 'spreadsheet' | 'image' | 'invoice' | 'other'

export interface Attachment {
  id: number
  original_name: string
  content_type: string
  size: number
  kind: AttachmentKind
  classification: number
  owner: string | null
  linked_module: string
  linked_id: string
  extracted: Record<string, unknown>
  created_at: string
  download_url: string
}

export interface CsvParseResult {
  columns: string[]
  rows: string[][]
  total_rows: number
}

export interface UploadArgs {
  file: File
  classification: number
  kind?: AttachmentKind
  linked_module?: string
  linked_id?: string
  extracted?: Record<string, unknown>
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[2]!) : null
}

export function fetchAttachments(): Promise<Attachment[]> {
  return api<Attachment[]>('/attachments/')
}

export function fetchAttachment(id: number): Promise<Attachment> {
  return api<Attachment>(`/attachments/${id}`)
}

// Multipart upload — must NOT set Content-Type (the browser adds the boundary).
export async function uploadAttachment(args: UploadArgs): Promise<Attachment> {
  const form = new FormData()
  form.append('file', args.file)
  form.append('classification', String(args.classification))
  if (args.kind) form.append('kind', args.kind)
  if (args.linked_module) form.append('linked_module', args.linked_module)
  if (args.linked_id) form.append('linked_id', args.linked_id)
  if (args.extracted) form.append('extracted', JSON.stringify(args.extracted))

  const headers = new Headers({ Accept: 'application/json' })
  const csrf = getCookie('csrftoken')
  if (csrf) headers.set('X-CSRFToken', csrf)

  const res = await fetch(`${API_BASE}/attachments/`, {
    method: 'POST',
    body: form,
    headers,
    credentials: 'include',
  })
  const data = res.headers.get('content-type')?.includes('application/json')
    ? await res.json()
    : null
  if (!res.ok) {
    throw new ApiError(res.status, (data && data.detail) || 'Upload failed')
  }
  return data as Attachment
}

export function deleteAttachment(id: number): Promise<void> {
  return api<void>(`/attachments/${id}`, { method: 'DELETE' })
}

export function parseAttachment(id: number): Promise<CsvParseResult> {
  return api<CsvParseResult>(`/attachments/${id}/parse`, { method: 'POST' })
}

export function downloadUrl(id: number): string {
  return `${API_BASE}/attachments/${id}/download`
}
