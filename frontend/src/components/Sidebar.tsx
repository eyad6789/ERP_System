import LockIcon from '@mui/icons-material/Lock'
import { Divider, List, ListItemButton, ListItemText, Tooltip } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'

import { useAuth } from '../auth/AuthProvider'

// Platform tools — not clearance-gated modules; always available to any signed-in user.
const TOOLS = [
  'calendar', 'reports', 'reportbuilder', 'builder', 'twin', 'activity',
  'departments', 'workflows', 'forms', 'chat', 'ocr', 'signatures',
  'archive', 'marketplace', 'integrations', 'developers',
] as const

// All modules in display order. Each is rendered, but locked (disabled) when the
// user's role does not grant it — mirrors the prototype's lock icons. The server
// is the source of truth; this only hides what the API already forbids.
const MODULES = [
  'dashboard', 'personnel', 'documents', 'finance',
  'operations', 'assets', 'gis', 'incidents',
  'projects', 'procurement', 'inventory', 'fleet', 'risk', 'knowledge',
  'attendance', 'leave', 'payroll', 'helpdesk', 'compliance', 'meetings',
  'recruitment', 'performance', 'training', 'contracts', 'announcements', 'events',
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
      <Divider sx={{ my: 1 }} />
      {TOOLS.map((tool) => (
        <ListItemButton
          key={tool}
          component={NavLink}
          to={`/${tool}`}
          data-testid={`nav-${tool}`}
        >
          <ListItemText primary={t(`nav.${tool}`)} />
        </ListItemButton>
      ))}
    </List>
  )
}
