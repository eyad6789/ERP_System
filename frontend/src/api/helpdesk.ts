import { api } from './client'

export type TicketPriority = 'low' | 'medium' | 'high'
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

export interface TicketListItem {
  id: number
  title_ar: string
  title_en: string
  requester: string
  priority: TicketPriority
  status: TicketStatus
  classification: number
}

export interface TicketDetail extends TicketListItem {
  updated_at: string
}

export interface TicketWriteBody {
  title_ar: string
  title_en: string
  requester: string
  priority: TicketPriority
  status: TicketStatus
  classification: number
}

export interface TicketListParams {
  q?: string
  ordering?: string
}

export function fetchTickets(params: TicketListParams = {}): Promise<TicketListItem[]> {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.ordering) search.set('ordering', params.ordering)
  const qs = search.toString()
  return api<TicketListItem[]>(`/helpdesk/${qs ? `?${qs}` : ''}`)
}

export function fetchTicket(id: number): Promise<TicketDetail> {
  return api<TicketDetail>(`/helpdesk/${id}`)
}

export function createTicket(body: TicketWriteBody): Promise<TicketDetail> {
  return api<TicketDetail>('/helpdesk/', { method: 'POST', body: JSON.stringify(body) })
}

export function updateTicket(id: number, body: Partial<TicketWriteBody>): Promise<TicketDetail> {
  return api<TicketDetail>(`/helpdesk/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function removeTicket(id: number): Promise<void> {
  return api<void>(`/helpdesk/${id}`, { method: 'DELETE' })
}
