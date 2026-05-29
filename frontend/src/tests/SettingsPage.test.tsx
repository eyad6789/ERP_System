import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SettingsPage } from '../features/settings/SettingsPage'
import i18n from '../i18n'

describe('SettingsPage', () => {
  it('renders the preference toggles including the language switch', async () => {
    await i18n.changeLanguage('en')

    render(<SettingsPage />)

    await waitFor(() => expect(screen.getByText('Settings & Preferences')).toBeInTheDocument())
    // Language ToggleButtonGroup is present with both language options.
    expect(screen.getByTestId('settings-language')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'العربية' })).toBeInTheDocument()
    // Density + numerals toggles exist too.
    expect(screen.getByTestId('settings-density')).toBeInTheDocument()
    expect(screen.getByTestId('settings-numerals')).toBeInTheDocument()
  })
})
