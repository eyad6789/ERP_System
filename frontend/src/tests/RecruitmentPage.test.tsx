import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ApplicantListItem } from '../api/recruitment'
import { RecruitmentPage } from '../features/recruitment/RecruitmentPage'
import i18n from '../i18n'

// What the API returned for a clearance-2 viewer: only applicants at/below
// clearance (over-clearance records are filtered out server-side).
const applicants: ApplicantListItem[] = [
  {
    id: 1, name: 'Layla Haddad', position: 'Field Analyst', email: 'layla@example.gov',
    stage: 'interview', classification: 2,
  },
  {
    id: 2, name: 'Omar Saleh', position: 'Logistics Officer', email: 'omar@example.gov',
    stage: 'hired', classification: 2,
  },
  {
    id: 3, name: 'Nada Karim', position: 'Translator', email: 'nada@example.gov',
    stage: 'applied', classification: 1,
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
      <RecruitmentPage />
    </QueryClientProvider>,
  )
}

describe('RecruitmentPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders KPI counts and the applicant table rows', async () => {
    await i18n.changeLanguage('en')
    mockFetch(() => json(applicants))
    renderPage()

    await waitFor(() => expect(screen.getByText('Layla Haddad')).toBeInTheDocument())
    expect(screen.getByText('Field Analyst')).toBeInTheDocument()
    expect(screen.getByTestId('kpi-total')).toHaveTextContent('3')
    expect(screen.getByTestId('kpi-hired')).toHaveTextContent('1')
    expect(screen.getAllByTestId('recruitment-row')).toHaveLength(3)
  })

  it('debounces the search box into the list query param q', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch(() => json(applicants))
    renderPage()

    await waitFor(() => expect(screen.getByText('Layla Haddad')).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('recruitment-search'), { target: { value: 'omar' } })

    await waitFor(() => {
      const called = fetchSpy.mock.calls.some(([u]) =>
        (typeof u === 'string' ? u : u.toString()).includes('q=omar'),
      )
      expect(called).toBe(true)
    })
  })

  it('sets ordering when a column header is clicked', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch(() => json(applicants))
    renderPage()

    await waitFor(() => expect(screen.getByText('Layla Haddad')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Position'))

    await waitFor(() => {
      const called = fetchSpy.mock.calls.some(([u]) =>
        (typeof u === 'string' ? u : u.toString()).includes('ordering=position'),
      )
      expect(called).toBe(true)
    })
  })

  it('creates an applicant via the New dialog and POSTs the body', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch((url, init) => {
      const method = (init?.method ?? 'GET').toUpperCase()
      if (method === 'POST' && url.includes('/recruitment/')) {
        return json({ ...applicants[0], id: 99 }, 201)
      }
      return json(applicants)
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Layla Haddad')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('recruitment-new'))

    fireEvent.change(screen.getByTestId('field-name'), { target: { value: 'Sami Nour' } })
    fireEvent.change(screen.getByTestId('field-position'), { target: { value: 'Auditor' } })
    fireEvent.change(screen.getByTestId('field-email'), { target: { value: 'sami@example.gov' } })
    fireEvent.click(screen.getByTestId('form-submit'))

    await waitFor(() => {
      const post = fetchSpy.mock.calls.find(
        ([, init]) => (init?.method ?? 'GET').toUpperCase() === 'POST',
      )
      expect(post).toBeTruthy()
      expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({
        name: 'Sami Nour',
        position: 'Auditor',
      })
    })
  })

  it('deletes an applicant after confirming in the dialog', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch((_url, init) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'DELETE') {
        return new Response(null, { status: 204 })
      }
      return json(applicants)
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Layla Haddad')).toBeInTheDocument())
    const firstRow = screen.getAllByTestId('recruitment-row')[0]!
    fireEvent.click(within(firstRow).getByTestId('recruitment-delete'))

    expect(screen.getByText(/audited/i)).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('confirm-delete'))

    await waitFor(() => {
      const del = fetchSpy.mock.calls.find(
        ([u, init]) =>
          (init?.method ?? 'GET').toUpperCase() === 'DELETE' &&
          (typeof u === 'string' ? u : u.toString()).includes('/recruitment/1'),
      )
      expect(del).toBeTruthy()
    })
  })
})
