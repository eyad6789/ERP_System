import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type { SearchResponse } from '../api/search'
import { CommandPalette } from '../components/CommandPalette'
import i18n from '../i18n'

const searchBody: SearchResponse = {
  query: 'rafidain',
  count: 1,
  results: [
    {
      id: 7,
      kind: 'contract',
      label_ar: 'عقد الرافدين',
      label_en: 'Rafidain Contract',
      detail: 'OPS · under_review',
    },
  ],
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('CommandPalette', () => {
  it('opens on Ctrl+K, searches, and renders a matching result', async () => {
    await i18n.changeLanguage('en')
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/search')) return Promise.resolve(jsonResponse(searchBody))
      return Promise.resolve(jsonResponse({}))
    })

    render(
      <MemoryRouter>
        <CommandPalette />
      </MemoryRouter>,
    )

    // Toggle open via the global Ctrl+K shortcut.
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

    const input = await screen.findByPlaceholderText(/Ctrl\+K/i)
    fireEvent.change(input, { target: { value: 'rafidain' } })

    await waitFor(() => expect(screen.getByText('Rafidain Contract')).toBeInTheDocument(), {
      timeout: 2000,
    })
  })
})
