import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ProjectListItem } from '../api/projects'
import { ProjectsPage } from '../features/projects/ProjectsPage'
import i18n from '../i18n'

// What the API returned for a clearance-2 viewer: only projects at/below clearance
// (over-clearance projects are filtered out server-side, so they never arrive).
const projects: ProjectListItem[] = [
  {
    id: 1, name_ar: 'بوابة', name_en: 'Citizen Portal', status: 'active',
    progress: 60, start_date: '2026-01-10', end_date: '2026-09-30',
    lead: 'A. Salem', classification: 2,
  },
  {
    id: 2, name_ar: 'ترحيل', name_en: 'Data Migration', status: 'done',
    progress: 100, start_date: '2025-06-01', end_date: '2026-02-15',
    lead: 'N. Faris', classification: 2,
  },
  {
    id: 3, name_ar: 'تخطيط', name_en: 'Network Upgrade', status: 'planning',
    progress: 0, start_date: '2026-04-01', end_date: '2026-12-31',
    lead: 'M. Adel', classification: 1,
  },
]

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

// Route mock fresh per request (Response bodies are single-use, refetches occur).
function mockFetch(handler: (url: string, init?: RequestInit) => Response) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = typeof input === 'string' ? input : input.toString()
    return Promise.resolve(handler(url, init))
  })
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ProjectsPage />
    </QueryClientProvider>,
  )
}

describe('ProjectsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders KPI counts and the project table rows', async () => {
    await i18n.changeLanguage('en')
    mockFetch(() => json(projects))
    renderPage()

    await waitFor(() => expect(screen.getByText('Citizen Portal')).toBeInTheDocument())
    expect(screen.getByTestId('kpi-total')).toHaveTextContent('3')
    expect(screen.getByTestId('kpi-active')).toHaveTextContent('1')
    expect(screen.getByTestId('kpi-done')).toHaveTextContent('1')
    expect(screen.getAllByTestId('project-row')).toHaveLength(3)
  })

  it('debounces the search box into the list query param q', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch(() => json(projects))
    renderPage()

    await waitFor(() => expect(screen.getByText('Citizen Portal')).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('projects-search'), { target: { value: 'portal' } })

    await waitFor(() => {
      const called = fetchSpy.mock.calls.some(([u]) =>
        (typeof u === 'string' ? u : u.toString()).includes('q=portal'),
      )
      expect(called).toBe(true)
    })
  })

  it('sets ordering when a column header is clicked', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch(() => json(projects))
    renderPage()

    await waitFor(() => expect(screen.getByText('Citizen Portal')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Lead'))

    await waitFor(() => {
      const called = fetchSpy.mock.calls.some(([u]) =>
        (typeof u === 'string' ? u : u.toString()).includes('ordering=lead'),
      )
      expect(called).toBe(true)
    })
  })

  it('creates a project via the New dialog and POSTs the body', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch((_url, init) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'POST') {
        return json({ ...projects[0], id: 99 }, 201)
      }
      return json(projects)
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Citizen Portal')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('project-new'))

    fireEvent.change(screen.getByTestId('field-name_ar'), { target: { value: 'مشروع جديد' } })
    fireEvent.change(screen.getByTestId('field-name_en'), { target: { value: 'New Project' } })
    fireEvent.click(screen.getByTestId('form-submit'))

    await waitFor(() => {
      const post = fetchSpy.mock.calls.find(
        ([u, init]) =>
          (init?.method ?? 'GET').toUpperCase() === 'POST' &&
          (typeof u === 'string' ? u : u.toString()).includes('/projects/'),
      )
      expect(post).toBeTruthy()
      expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ name_en: 'New Project' })
    })
  })

  it('deletes a project after confirming in the dialog', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch((_url, init) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'DELETE') {
        return new Response(null, { status: 204 })
      }
      return json(projects)
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Citizen Portal')).toBeInTheDocument())
    const firstRow = screen.getAllByTestId('project-row')[0]!
    fireEvent.click(within(firstRow).getByTestId('project-delete'))

    expect(screen.getByText(/audited/i)).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('confirm-delete'))

    await waitFor(() => {
      const del = fetchSpy.mock.calls.find(
        ([u, init]) =>
          (init?.method ?? 'GET').toUpperCase() === 'DELETE' &&
          (typeof u === 'string' ? u : u.toString()).includes('/projects/1'),
      )
      expect(del).toBeTruthy()
    })
  })
})
