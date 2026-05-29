import { render, screen, waitFor } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AiAssistant } from '../components/AiAssistant'
import i18n from '../i18n'

describe('AiAssistant', () => {
  it('opens, sends a question, and shows the grounded answer', async () => {
    await i18n.changeLanguage('en')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          answer: 'Within your clearance — personnel: 11, open incidents: 3.',
          intent: 'counts',
          provider: 'heuristic-offline',
          grounding: {},
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )
    render(<AiAssistant />)
    fireEvent.click(screen.getByTestId('ai-fab'))
    expect(await screen.findByTestId('ai-panel')).toBeInTheDocument()

    const input = screen.getByTestId('ai-input').querySelector('input')!
    fireEvent.change(input, { target: { value: 'how many personnel?' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() =>
      expect(screen.getByText(/personnel: 11/)).toBeInTheDocument(),
    )
  })
})
