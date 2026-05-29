import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Task } from '../api/operations'
import { OperationsPage } from '../features/operations/OperationsPage'
import i18n from '../i18n'

// Board the server returned for a clearance-2 viewer: only levels 1-2 present
// (the API already excluded higher-classification tasks server-side).
const tasks: Task[] = [
  {
    id: 1, title_ar: 'مهمة أ', title_en: 'Patrol Route', assignee: 'Capt. Huda',
    priority: 'high', due_date: '2026-06-05', status: 'active', classification: 2,
    updated_at: '2026-05-29T00:00:00Z',
  },
  {
    id: 2, title_ar: 'مهمة ب', title_en: 'Update Board', assignee: 'Cpl. Yousef',
    priority: 'low', due_date: null, status: 'open', classification: 1,
    updated_at: '2026-05-29T00:00:00Z',
  },
]

describe('OperationsPage', () => {
  it('renders the clearance-filtered board into status columns', async () => {
    await i18n.changeLanguage('en')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(tasks), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <OperationsPage />
      </QueryClientProvider>,
    )

    await waitFor(() => expect(screen.getByText('Patrol Route')).toBeInTheDocument())
    expect(screen.getByText('Update Board')).toBeInTheDocument()
    expect(screen.getByTestId('column-open')).toBeInTheDocument()
    expect(screen.getByTestId('column-active')).toBeInTheDocument()
    expect(screen.getByTestId('column-closed')).toBeInTheDocument()
    expect(screen.getAllByTestId('task-card')).toHaveLength(2)
  })
})
