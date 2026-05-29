import { render, screen } from '@testing-library/react'
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
  it('enables only permitted modules and disables the rest', () => {
    renderWithModules(['dashboard', 'documents'])
    // Permitted = real link (not disabled)
    expect(screen.getByTestId('nav-dashboard')).not.toHaveAttribute('aria-disabled')
    // Not permitted = disabled button
    expect(screen.getByTestId('nav-finance')).toHaveAttribute('aria-disabled')
  })
})
