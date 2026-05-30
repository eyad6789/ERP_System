import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import * as authModule from '../auth/AuthProvider'
import { Sidebar } from '../components/Sidebar'

function renderWithModules(modules: string[]) {
  vi.spyOn(authModule, 'useAuth').mockReturnValue({
    me: { username: 'u', full_name_ar: '', full_name_en: '', department: '', clearance: 2, modules, role: null },
    isLoading: false,
    can: (m: string) => modules.includes(m),
    refetch: () => {},
  })
  return render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>,
  )
}

describe('Sidebar', () => {
  it('groups are collapsed by default — only department headers show', () => {
    renderWithModules(['dashboard', 'documents'])
    // The 8 department group headers are always present.
    expect(screen.getByTestId('navgroup-command')).toBeInTheDocument()
    expect(screen.getByTestId('navgroup-finance')).toBeInTheDocument()
    // Items stay collapsed (unmounted) until their group is opened.
    expect(screen.queryByTestId('nav-dashboard')).toBeNull()
  })

  it('enables only permitted modules and disables the rest when a group is expanded', () => {
    renderWithModules(['dashboard', 'documents'])
    // Open the two department groups holding the items under test.
    fireEvent.click(screen.getByTestId('navgroup-command'))
    fireEvent.click(screen.getByTestId('navgroup-finance'))
    // Permitted = real link (not disabled)
    expect(screen.getByTestId('nav-dashboard')).not.toHaveAttribute('aria-disabled')
    // Not permitted = disabled button
    expect(screen.getByTestId('nav-finance')).toHaveAttribute('aria-disabled')
  })
})
