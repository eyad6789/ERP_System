import { api } from './client'

export interface AnnouncementListItem {
  id: number
  title_ar: string
  title_en: string
  body: string
  audience: string
  published_date: string
  classification: number
}

export interface AnnouncementDetail extends AnnouncementListItem {
  updated_at: string
}

export interface AnnouncementWriteBody {
  title_ar: string
  title_en: string
  body: string
  audience: string
  published_date: string
  classification: number
}

export interface AnnouncementListParams {
  q?: string
  ordering?: string
}

export function fetchAnnouncements(
  params: AnnouncementListParams = {},
): Promise<AnnouncementListItem[]> {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.ordering) search.set('ordering', params.ordering)
  const qs = search.toString()
  return api<AnnouncementListItem[]>(`/announcements/${qs ? `?${qs}` : ''}`)
}

export function fetchAnnouncement(id: number): Promise<AnnouncementDetail> {
  return api<AnnouncementDetail>(`/announcements/${id}`)
}

export function createAnnouncement(
  body: AnnouncementWriteBody,
): Promise<AnnouncementDetail> {
  return api<AnnouncementDetail>('/announcements/', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateAnnouncement(
  id: number,
  body: Partial<AnnouncementWriteBody>,
): Promise<AnnouncementDetail> {
  return api<AnnouncementDetail>(`/announcements/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function removeAnnouncement(id: number): Promise<void> {
  return api<void>(`/announcements/${id}`, { method: 'DELETE' })
}
