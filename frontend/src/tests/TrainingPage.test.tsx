import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { TrainingListItem } from '../api/training'
import { TrainingPage } from '../features/training/TrainingPage'
import i18n from '../i18n'

const courses: TrainingListItem[] = [
  {
    id: 1, title_ar: 'الأمن السيبراني', title_en: 'Cybersecurity Basics', category: 'Security',
    hours: 12, status: 'ongoing', classification: 2,
  },
  {
    id: 2, title_ar: 'الإسعافات الأولية', title_en: 'First Aid', category: 'Safety',
    hours: 8, status: 'upcoming', classification: 1,
  },
  {
    id: 3, title_ar: 'القيادة الإدارية', title_en: 'Leadership', category: 'Management',
    hours: 20, status: 'completed', classification: 1,
  },
]

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

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
      <TrainingPage />
    </QueryClientProvider>,
  )
}

describe('TrainingPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders KPI counts and the training table rows', async () => {
    await i18n.changeLanguage('en')
    mockFetch(() => json(courses))
    renderPage()

    await waitFor(() => expect(screen.getByText('Cybersecurity Basics')).toBeInTheDocument())
    expect(screen.getByTestId('kpi-total')).toHaveTextContent('3')
    expect(screen.getByTestId('kpi-ongoing')).toHaveTextContent('1')
    expect(screen.getAllByTestId('training-row')).toHaveLength(3)
  })

  it('creates a course via the New dialog and POSTs the body', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch((_url, init) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'POST') {
        return json({ ...courses[0], id: 99, updated_at: '2026-01-01' }, 201)
      }
      return json(courses)
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Cybersecurity Basics')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('training-new'))

    fireEvent.change(screen.getByTestId('field-title_ar'), { target: { value: 'دورة جديدة' } })
    fireEvent.change(screen.getByTestId('field-title_en'), { target: { value: 'New Course' } })
    fireEvent.click(screen.getByTestId('form-submit'))

    await waitFor(() => {
      const post = fetchSpy.mock.calls.find(
        ([, init]) => (init?.method ?? 'GET').toUpperCase() === 'POST',
      )
      expect(post).toBeTruthy()
      expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ title_en: 'New Course' })
    })
  })
})
