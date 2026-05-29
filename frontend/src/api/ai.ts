import { api } from './client'

export interface AssistantReply {
  answer: string
  intent: string
  provider: string
  grounding: Record<string, unknown>
}

export interface Briefing {
  headline: string
  summary: string
  alerts: number
  critical: number
  recommendation: string
  provider: string
}

export function askAssistant(question: string, lang: string): Promise<AssistantReply> {
  return api<AssistantReply>('/ai/assistant', {
    method: 'POST',
    body: JSON.stringify({ question, lang }),
  })
}

export function fetchBriefing(lang: string): Promise<Briefing> {
  return api<Briefing>(`/ai/briefing?lang=${lang}`)
}
