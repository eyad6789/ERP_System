import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { AlertsResponse } from '../api/alerts'
import { NotificationsBell } from '../components/NotificationsBell'
import i18n from '../i18n'

const alertsBody: AlertsResponse = {
  alerts: [
    {
      severity: 'critical',
      module: 'incidents',
      count: 2,
      message_ar: 'حوادث مفتوحة',
      message_en: 'Open incidents',
    },
    {
      severity: 'high',
      module: 'finance',
      count: 1,
      message_ar: 'عقود قيد المراجعة',
      message_en: 'Contracts under review',
    },
  ],
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('NotificationsBell', () => {
  it('shows a badge count and lists alerts in the menu', async () => {
    await i18n.changeLanguage('en')
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/alerts')) return Promise.resolve(jsonResponse(alertsBody))
      return Promise.resolve(jsonResponse({}))
    })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <NotificationsBell />
      </QueryClientProvider>,
    )

    // Badge sums the alert counts (2 + 1 = 3).
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument())

    // Opening the menu reveals both alert messages.
    fireEvent.click(screen.getByTestId('notif-bell'))
    await waitFor(() => expect(screen.getByText('Open incidents')).toBeInTheDocument())
    expect(screen.getByText('Contracts under review')).toBeInTheDocument()
  })
})
