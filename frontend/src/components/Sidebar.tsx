import LockIcon from '@mui/icons-material/Lock'
import { List, ListItemButton, ListItemText, Tooltip } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'

import { useAuth } from '../auth/AuthProvider'

// All modules in display order. Each is rendered, but locked (disabled) when the
// user's role does not grant it — mirrors the prototype's lock icons. The server
// is the source of truth; this only hides what the API already forbids.
const MODULES = [
  'dashboard', 'personnel', 'documents', 'finance',
  'operations', 'assets', 'gis', 'incidents',
  'projects', 'procurement', 'inventory', 'fleet', 'risk', 'knowledge',
  'attendance', 'leave', 'payroll', 'helpdesk', 'compliance', 'meetings',
  'audit',
] as const

export function Sidebar() {
  const { t } = useTranslation()
  const { can } = useAuth()

  return (
    <List component="nav" aria-label="modules" sx={{ width: 220 }}>
      {MODULES.map((mod) => {
        const allowed = can(mod)
        const label = t(`nav.${mod}`)
        if (!allowed) {
          return (
            <Tooltip key={mod} title={t('common.locked')} placement="left">
              <span>
                <ListItemButton disabled aria-disabled data-testid={`nav-${mod}`}>
                  <ListItemText primary={label} />
                  <LockIcon fontSize="small" />
                </ListItemButton>
              </span>
            </Tooltip>
          )
        }
        return (
          <ListItemButton
            key={mod}
            component={NavLink}
            to={`/${mod}`}
            data-testid={`nav-${mod}`}
          >
            <ListItemText primary={label} />
          </ListItemButton>
        )
      })}
    </List>
  )
}
