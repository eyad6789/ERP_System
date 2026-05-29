import {
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { fetchPerson, fetchPersonnel, type Person } from '../../api/personnel'
import { ClassificationBadge } from '../../components/ClassificationBadge'

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'info'> = {
  active: 'success',
  leave: 'warning',
  mission: 'info',
}

function ProfileDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  // Fetching the profile hits the object-level (IDOR-safe) endpoint, which audits the view.
  const { data, isLoading } = useQuery({ queryKey: ['person', id], queryFn: () => fetchPerson(id) })

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('personnel.profile')}</DialogTitle>
      <DialogContent>
        {isLoading || !data ? (
          <CircularProgress />
        ) : (
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <Typography variant="h6">{ar ? data.name_ar : data.name_en}</Typography>
            <Row label={t('personnel.rank')} value={ar ? data.rank_ar : data.rank_en} />
            <Row
              label={t('personnel.department')}
              value={ar ? data.department_name_ar : data.department_name_en}
            />
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography color="text.secondary">{t('personnel.clearance')}:</Typography>
              <ClassificationBadge level={data.classification} />
            </Stack>
            <Row label={t('personnel.attendance')} value={`${data.attendance ?? '-'}%`} />
            <Row label={t('personnel.joined')} value={String(data.joined_year ?? '-')} />
            <Row label={t('personnel.contract')} value={data.contract_type ?? '-'} />
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography color="text.secondary">{label}</Typography>
      <Typography>{value}</Typography>
    </Stack>
  )
}

export function PersonnelPage() {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const [selected, setSelected] = useState<number | null>(null)
  const { data, isLoading } = useQuery({ queryKey: ['personnel'], queryFn: fetchPersonnel })

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  const people: Person[] = data ?? []

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" spacing={2}>
        <Typography variant="h5">{t('nav.personnel')}</Typography>
        <Chip label={`${people.length}`} size="small" />
      </Stack>
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('personnel.name')}</TableCell>
              <TableCell>{t('personnel.rank')}</TableCell>
              <TableCell>{t('personnel.department')}</TableCell>
              <TableCell>{t('personnel.status')}</TableCell>
              <TableCell>{t('personnel.clearance')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {people.map((p) => (
              <TableRow
                key={p.id}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => setSelected(p.id)}
              >
                <TableCell>{ar ? p.name_ar : p.name_en}</TableCell>
                <TableCell>{ar ? p.rank_ar : p.rank_en}</TableCell>
                <TableCell>{ar ? p.department_name_ar : p.department_name_en}</TableCell>
                <TableCell>
                  <Chip
                    label={t(`personnel.statusValue.${p.status}`)}
                    size="small"
                    color={STATUS_COLOR[p.status] ?? 'default'}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <ClassificationBadge level={p.classification} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
      {selected !== null && <ProfileDialog id={selected} onClose={() => setSelected(null)} />}
    </Stack>
  )
}
