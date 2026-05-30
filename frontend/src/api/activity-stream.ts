import { api } from './client'

export type StreamResult = 'GRANTED' | 'DENIED'

export interface StreamRow {
  id: number
  ts: string
  actor_label: string
  action: string
  target_type: string
  target_id: string
  result: StreamResult
}

export interface StreamPage {
  results: StreamRow[]
  count: number
  page: number
  pages: number
  page_size: number
}

export interface StreamParams {
  page?: number
  page_size?: number
  result?: StreamResult | ''
}

// Live audit feed: paginated ledger rows, optionally narrowed to one result.
// Blank/undefined values are dropped so an empty filter never narrows results.
export function fetchStream({ page, page_size, result }: StreamParams = {}): Promise<StreamPage> {
  const qs = new URLSearchParams()
  if (page !== undefined) qs.set('page', String(page))
  if (page_size !== undefined) qs.set('page_size', String(page_size))
  if (result) qs.set('result', result)
  const s = qs.toString()
  return api<StreamPage>(`/audit/${s ? `?${s}` : ''}`)
}
