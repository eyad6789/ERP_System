import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ClassificationBanner } from '../components/ClassificationBanner'

describe('ClassificationBanner', () => {
  it('renders the classification line', () => {
    render(<ClassificationBanner />)
    expect(screen.getByLabelText('classification')).toBeInTheDocument()
    expect(screen.getByText(/سري|CONFIDENTIAL/)).toBeInTheDocument()
  })
})
