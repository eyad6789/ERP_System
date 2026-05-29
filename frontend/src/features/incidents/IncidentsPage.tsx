import {
  Box,
  Card,
  CardContent,
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

import { fetchIncidents, type Incident, type IncidentSeverity } from '../../api/incidents'
import { ClassificationBadge } from '../../components/ClassificationBadge'

const SEVERITY_COLOR: Record<IncidentSeverity, 'error' | 'warning' | 'info'> = {
  critical: 'error',
  high: 'warning',
  medium: 'info',
}

function KpiCard({ label, value, testId }: { label: string; value: number; testId: string }) {
  return (
    <Card sx={{ minWidth: 160 }} data-testid={testId}>
      <CardContent>
        <Typography variant="h4">{value}</Typography>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      </CardContent>
    </Card>
  )
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
    <Stack spacing={2}>
      <Typography variant="h5">{t('nav.incidents')}</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <KpiCard label={t('incidents.critical')} value={critical} testId="kpi-critical" />
        <KpiCard label={t('incidents.high')} value={high} testId="kpi-high" />
        <KpiCard label={t('incidents.active')} value={active} testId="kpi-active" />
        <KpiCard label={t('incidents.closed')} value={closed} testId="kpi-closed" />
      </Box>
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
              <TableCell>{t(`incidents.statusValue.${i.status}`)}</TableCell>
              <TableCell>{i.reported_date ?? '-'}</TableCell>
              <TableCell>
                <ClassificationBadge level={i.classification} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Stack>
  )
}
