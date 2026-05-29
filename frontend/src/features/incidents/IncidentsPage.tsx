import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import ReportProblemIcon from '@mui/icons-material/ReportProblem'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import {
  Box,
  Chip,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import {
  fetchIncidents,
  type Incident,
  type IncidentSeverity,
  type IncidentStatus,
} from '../../api/incidents'
import { ClassificationBadge } from '../../components/ClassificationBadge'
import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import { tokens } from '../../theme/tokens'

const SEVERITY_COLOR: Record<IncidentSeverity, 'error' | 'warning' | 'info'> = {
  critical: 'error',
  high: 'warning',
  medium: 'info',
}

const STATUS_COLOR: Record<IncidentStatus, 'warning' | 'primary' | 'success'> = {
  active: 'warning',
  open: 'primary',
  closed: 'success',
}

export function IncidentsPage() {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const { data, isLoading } = useQuery({ queryKey: ['incidents'], queryFn: fetchIncidents })

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  const incidents: Incident[] = data ?? []
  const count = (pred: (i: Incident) => boolean) => incidents.filter(pred).length
  const critical = count((i) => i.severity === 'critical')
  const high = count((i) => i.severity === 'high')
  const active = count((i) => i.status === 'active')
  const closed = count((i) => i.status === 'closed')

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
        <Typography variant="h5">{t('nav.incidents')}</Typography>
        <Chip
          size="small"
          variant="outlined"
          label={incidents.length}
          sx={{ color: tokens.gold, borderColor: tokens.borderGold, fontWeight: 600 }}
        />
      </Stack>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <Box data-testid="kpi-critical" sx={{ flex: 1, minWidth: 200 }}>
          <StatCard
            label={t('incidents.critical')}
            value={critical}
            accent={tokens.red}
            icon={<ErrorIcon />}
          />
        </Box>
        <Box data-testid="kpi-high" sx={{ flex: 1, minWidth: 200 }}>
          <StatCard
            label={t('incidents.high')}
            value={high}
            accent={tokens.orange}
            icon={<ReportProblemIcon />}
          />
        </Box>
        <Box data-testid="kpi-active" sx={{ flex: 1, minWidth: 200 }}>
          <StatCard
            label={t('incidents.active')}
            value={active}
            accent={tokens.gold}
            icon={<WarningAmberIcon />}
          />
        </Box>
        <Box data-testid="kpi-closed" sx={{ flex: 1, minWidth: 200 }}>
          <StatCard
            label={t('incidents.closed')}
            value={closed}
            accent={tokens.green}
            icon={<CheckCircleIcon />}
          />
        </Box>
      </Box>

      <SectionCard title={t('nav.incidents')}>
        <Table size="small" data-testid="incidents-table">
          <TableHead>
            <TableRow>
              <TableCell>{t('incidents.title')}</TableCell>
              <TableCell>{t('incidents.severity')}</TableCell>
              <TableCell>{t('incidents.status')}</TableCell>
              <TableCell>{t('incidents.reportedDate')}</TableCell>
              <TableCell>{t('incidents.classification')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {incidents.map((i) => (
              <TableRow key={i.id} data-testid="incident-row">
                <TableCell>{ar ? i.title_ar : i.title_en}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={SEVERITY_COLOR[i.severity]}
                    label={t(`incidents.severityValue.${i.severity}`)}
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    variant="outlined"
                    color={STATUS_COLOR[i.status]}
                    label={t(`incidents.statusValue.${i.status}`)}
                  />
                </TableCell>
                <TableCell>{i.reported_date ?? '-'}</TableCell>
                <TableCell>
                  <ClassificationBadge level={i.classification} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>
    </Stack>
  )
}
