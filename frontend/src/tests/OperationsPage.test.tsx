import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

// Routes fetch by URL + method so list / create / delete each get a tailored response.
function mockFetchByUrl() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = typeof input === 'string' ? input : (input as Request).url
    const method = (init?.method ?? 'GET').toUpperCase()
    if (method === 'POST' && url.includes('/operations/tasks')) {
      return Promise.resolve(jsonResponse({ ...tasks[1]!, id: 99 }, 201))
    }
    if (method === 'DELETE') {
      return Promise.resolve(new Response(null, { status: 204 }))
    }
    // GET list (with or without ?q=&ordering=)
    return Promise.resolve(jsonResponse(tasks))
  })
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <OperationsPage />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('OperationsPage', () => {
  it('renders the clearance-filtered board into status columns', async () => {
    await i18n.changeLanguage('en')
    mockFetchByUrl()
    renderPage()

    await waitFor(() => expect(screen.getByText('Patrol Route')).toBeInTheDocument())
    expect(screen.getByText('Update Board')).toBeInTheDocument()
    expect(screen.getByTestId('column-open')).toBeInTheDocument()
    expect(screen.getByTestId('column-active')).toBeInTheDocument()
    expect(screen.getByTestId('column-closed')).toBeInTheDocument()
    expect(screen.getAllByTestId('task-card')).toHaveLength(2)
  })

  it('debounces the search box into the list query string', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetchByUrl()
    renderPage()

    await waitFor(() => expect(screen.getByText('Patrol Route')).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('operations-search'), { target: { value: 'patrol' } })

    await waitFor(() => {
      const called = fetchSpy.mock.calls.some(([input]) => {
        const url = typeof input === 'string' ? input : (input as Request).url
        return url.includes('q=patrol')
      })
      expect(called).toBe(true)
    })
  })

  it('opens the create dialog and POSTs a new task', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetchByUrl()
    renderPage()

    await waitFor(() => expect(screen.getByText('Patrol Route')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('operations-new'))

    const dialog = await screen.findByTestId('task-form')
    fireEvent.change(within(dialog).getByTestId('field-title_ar'), { target: { value: 'جديد' } })
    fireEvent.change(within(dialog).getByTestId('field-title_en'), { target: { value: 'New Task' } })
    fireEvent.click(screen.getByTestId('task-form-save'))

    await waitFor(() => {
      const posted = fetchSpy.mock.calls.some(
        ([, init]) => (init?.method ?? 'GET').toUpperCase() === 'POST',
      )
      expect(posted).toBe(true)
    })
  })

  it('confirms before issuing a delete', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetchByUrl()
    renderPage()

    await waitFor(() => expect(screen.getByText('Patrol Route')).toBeInTheDocument())
    const card = screen.getAllByTestId('task-card')[0]!
    fireEvent.click(within(card).getByLabelText('Delete'))

    fireEvent.click(await screen.findByTestId('confirm-delete'))

    await waitFor(() => {
      const deleted = fetchSpy.mock.calls.some(
        ([, init]) => (init?.method ?? 'GET').toUpperCase() === 'DELETE',
      )
      expect(deleted).toBe(true)
    })
  })
})
