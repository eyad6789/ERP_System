import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { StreamPage } from '../api/activity-stream'
import { ActivityStreamPage } from '../features/activity/ActivityStreamPage'
import i18n from '../i18n'

// A page with one GRANTED and one DENIED event, matching the backend contract.
const streamPage: StreamPage = {
  results: [
    {
      id: 1,
      ts: '2026-05-29T08:14:02Z',
      actor_label: 'cpt.salim',
      action: 'document.read',
      target_type: 'document',
      target_id: '42',
      result: 'GRANTED',
    },
    {
      id: 2,
      ts: '2026-05-29T09:02:55Z',
      actor_label: 'lt.noor',
      action: 'finance.contract.read',
      target_type: 'contract',
      target_id: '7',
      result: 'DENIED',
    },
  ],
  count: 2,
  page: 1,
  pages: 1,
  page_size: 20,
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('ActivityStreamPage', () => {
  it('renders timeline rows and a DENIED chip', async () => {
    await i18n.changeLanguage('en')
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/audit/')) return Promise.resolve(jsonResponse(streamPage))
      return Promise.reject(new Error(`unexpected fetch: ${url}`))
    })

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <ActivityStreamPage />
      </QueryClientProvider>,
    )

    // Both events render as timeline rows.
    await waitFor(() => expect(screen.getAllByTestId('stream-row')).toHaveLength(2))
    // The actor of the GRANTED event is present.
    expect(screen.getByText('cpt.salim')).toBeInTheDocument()
    // The DENIED chip is rendered (label "DENIED").
    expect(screen.getAllByText('DENIED').length).toBeGreaterThan(0)
  })
})
