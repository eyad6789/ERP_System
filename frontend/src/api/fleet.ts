import { api } from './client'

export type VehicleStatus = 'active' | 'maintenance' | 'retired'

export interface VehicleListItem {
  id: number
  plate: string
  vtype: string
  make: string
  status: VehicleStatus
  odometer: number
  classification: number
}

export interface VehicleDetail extends VehicleListItem {
  updated_at: string
}

export interface VehicleWriteBody {
  plate: string
  vtype: string
  make: string
  status: VehicleStatus
  odometer: number
  classification: number
}

export interface VehicleListParams {
  q?: string
  ordering?: string
}

export function fetchVehicles(params: VehicleListParams = {}): Promise<VehicleListItem[]> {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.ordering) search.set('ordering', params.ordering)
  const qs = search.toString()
  return api<VehicleListItem[]>(`/fleet/${qs ? `?${qs}` : ''}`)
}

export function fetchVehicle(id: number): Promise<VehicleDetail> {
  return api<VehicleDetail>(`/fleet/${id}`)
}

export function createVehicle(body: VehicleWriteBody): Promise<VehicleDetail> {
  return api<VehicleDetail>('/fleet/', { method: 'POST', body: JSON.stringify(body) })
}

export function updateVehicle(
  id: number,
  body: Partial<VehicleWriteBody>,
): Promise<VehicleDetail> {
  return api<VehicleDetail>(`/fleet/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function removeVehicle(id: number): Promise<void> {
  return api<void>(`/fleet/${id}`, { method: 'DELETE' })
}
