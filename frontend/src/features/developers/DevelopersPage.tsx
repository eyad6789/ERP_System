import { Box, Chip, Stack, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import { SectionCard } from '../../components/SectionCard'
import { tokens } from '../../theme/tokens'

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

const METHOD_COLOR: Record<Method, 'info' | 'success' | 'warning' | 'error'> = {
  GET: 'info',
  POST: 'success',
  PATCH: 'warning',
  DELETE: 'error',
}

interface Endpoint {
  method: Method
  path: string
  desc: string
}

interface Group {
  titleKey: string
  fallback: string
  endpoints: Endpoint[]
}

// Static API reference. No backend calls — this is documentation rendered
// entirely from the constant below, grouped into SectionCards by area.
const GROUPS: Group[] = [
  {
    titleKey: 'developers.auth',
    fallback: 'Authentication & Session',
    endpoints: [
      { method: 'POST', path: '/api/auth/login', desc: 'Open a session from username + password.' },
      { method: 'POST', path: '/api/auth/logout', desc: 'Destroy the current session.' },
      { method: 'GET', path: '/api/me', desc: 'Return the signed-in user and permissions.' },
      { method: 'POST', path: '/api/auth/password', desc: 'Change the current password.' },
      { method: 'POST', path: '/api/auth/mfa/setup', desc: 'Begin MFA enrolment, return the TOTP secret.' },
      { method: 'POST', path: '/api/auth/mfa/verify', desc: 'Confirm a TOTP code and activate MFA.' },
      { method: 'GET', path: '/api/auth/sessions', desc: 'List active sessions for the user.' },
      { method: 'DELETE', path: '/api/auth/sessions/<id>', desc: 'Revoke a single active session.' },
    ],
  },
  {
    titleKey: 'developers.dashboard',
    fallback: 'Dashboard & Search',
    endpoints: [
      { method: 'GET', path: '/api/dashboard/overview', desc: 'Aggregated KPIs across all modules.' },
      { method: 'GET', path: '/api/alerts', desc: 'Active operational alerts for the user.' },
      { method: 'GET', path: '/api/search?q=', desc: 'Global cross-module search by query string.' },
    ],
  },
  {
    titleKey: 'developers.ai',
    fallback: 'AI Services',
    endpoints: [
      { method: 'POST', path: '/api/ai/assistant', desc: 'Ask the assistant a question, get a grounded reply.' },
      { method: 'GET', path: '/api/ai/briefing', desc: 'Generate the daily executive briefing.' },
    ],
  },
  {
    titleKey: 'developers.audit',
    fallback: 'Audit Log',
    endpoints: [
      { method: 'GET', path: '/api/audit', desc: 'Paginated, filterable audit trail.' },
      { method: 'GET', path: '/api/audit/stats', desc: 'Aggregated counts by action and actor.' },
    ],
  },
  {
    titleKey: 'developers.modules',
    fallback: 'Module CRUD (representative)',
    endpoints: [
      { method: 'GET', path: '/api/personnel/', desc: 'List records (supports ?q= and ?ordering=).' },
      { method: 'POST', path: '/api/personnel/', desc: 'Create a new record.' },
      { method: 'GET', path: '/api/personnel/<id>', desc: 'Retrieve a single record.' },
      { method: 'PATCH', path: '/api/personnel/<id>', desc: 'Partially update a record.' },
      { method: 'DELETE', path: '/api/personnel/<id>', desc: 'Delete a record.' },
    ],
  },
]

function MethodChip({ method }: { method: Method }) {
  return (
    <Chip
      size="small"
      color={METHOD_COLOR[method]}
      label={method}
      sx={{
        fontFamily: 'monospace',
        fontWeight: 700,
        minWidth: 64,
        letterSpacing: 0.5,
      }}
    />
  )
}

export function DevelopersPage() {
  const { t } = useTranslation()

  return (
    <Stack spacing={3}>
      <Typography variant="h5">{t('nav.developers')}</Typography>

      <SectionCard title={t('developers.intro', 'Getting started')}>
        <Stack spacing={1.25}>
          <Typography sx={{ color: tokens.text }}>
            {t(
              'developers.authSummary',
              'The API uses cookie-based session authentication. Sign in via /api/auth/login to receive a session cookie, then send every request with credentials: "include" so the browser attaches it.',
            )}
          </Typography>
          <Typography sx={{ color: tokens.muted }}>
            {t(
              'developers.csrfSummary',
              'For write requests (POST, PATCH, PUT, DELETE) the SPA reads the csrftoken cookie set by Django and echoes it back in the X-CSRFToken header. Safe methods (GET, HEAD, OPTIONS) need no CSRF token.',
            )}
          </Typography>
        </Stack>
      </SectionCard>

      {GROUPS.map((group) => (
        <SectionCard key={group.titleKey} title={t(group.titleKey, group.fallback)}>
          <Stack divider={<Box sx={{ borderTop: `1px solid ${tokens.border}` }} />}>
            {group.endpoints.map((ep) => (
              <Box
                key={`${ep.method} ${ep.path}`}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  py: 1.25,
                  flexWrap: 'wrap',
                }}
              >
                <MethodChip method={ep.method} />
                <Typography
                  component="code"
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: 14,
                    color: tokens.goldBright,
                    direction: 'ltr',
                    unicodeBidi: 'embed',
                  }}
                >
                  {ep.path}
                </Typography>
                <Typography sx={{ color: tokens.muted, flex: 1, minWidth: 200 }}>
                  {ep.desc}
                </Typography>
              </Box>
            ))}
          </Stack>
        </SectionCard>
      ))}

      <Typography sx={{ color: tokens.muted, fontSize: 13 }}>
        {t(
          'developers.modulesNote',
          'The personnel set above is representative: the identical GET/POST list-create and GET/PATCH/DELETE detail shape applies to all 25 modules — swap the resource segment of the path.',
        )}
      </Typography>
    </Stack>
  )
}
