import { api } from './client'

export interface MfaSetup {
  secret: string
  otpauth_uri: string
}

export interface SessionInfo {
  key: string
  current: boolean
  user_agent: string
  ip: string
  last_active: string
}

export function changePassword(input: {
  old_password: string
  new_password: string
}): Promise<void> {
  return api<void>('/auth/password', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function mfaSetup(): Promise<MfaSetup> {
  return api<MfaSetup>('/auth/mfa/setup', { method: 'POST' })
}

export function mfaVerify(code: string): Promise<void> {
  return api<void>('/auth/mfa/verify', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

export function mfaDisable(): Promise<void> {
  return api<void>('/auth/mfa/disable', { method: 'POST' })
}

export function fetchSessions(): Promise<SessionInfo[]> {
  return api<SessionInfo[]>('/auth/sessions')
}

export function revokeSession(key: string): Promise<void> {
  return api<void>(`/auth/sessions/${key}`, { method: 'DELETE' })
}
