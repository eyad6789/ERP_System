import BadgeIcon from '@mui/icons-material/Badge'
import CloseIcon from '@mui/icons-material/Close'
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff'
import GroupsIcon from '@mui/icons-material/Groups'
import HowToRegIcon from '@mui/icons-material/HowToReg'
import {
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
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
import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import { tokens } from '../../theme/tokens'

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
      <DialogTitle
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        {t('personnel.profile')}
        <IconButton size="small" onClick={onClose} aria-label="close" sx={{ color: tokens.muted }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {isLoading || !data ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
              <Typography variant="h6" sx={{ color: tokens.text }}>
                {ar ? data.name_ar : data.name_en}
              </Typography>
              <ClassificationBadge level={data.classification} />
            </Stack>
            <Stack direction="row" spacing={2} flexWrap="wrap">
              <StatCard
                label={t('personnel.attendance')}
                value={`${data.attendance ?? '-'}%`}
                accent={tokens.green}
                icon={<HowToRegIcon fontSize="small" />}
              />
              <StatCard
                label={t('personnel.joined')}
                value={String(data.joined_year ?? '-')}
                accent={tokens.gold}
                icon={<BadgeIcon fontSize="small" />}
              />
            </Stack>
            <Stack spacing={1.25}>
              <Row label={t('personnel.rank')} value={ar ? data.rank_ar : data.rank_en} />
              <Row
                label={t('personnel.department')}
                value={ar ? data.department_name_ar : data.department_name_en}
              />
              <Row label={t('personnel.contract')} value={data.contract_type ?? '-'} />
            </Stack>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      sx={{ py: 0.75, borderBottom: `1px solid ${tokens.border}` }}
    >
      <Typography sx={{ color: tokens.muted }}>{label}</Typography>
      <Typography sx={{ color: tokens.text }}>{value}</Typography>
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
  const activeCount = people.filter((p) => p.status === 'active').length
  const leaveCount = people.filter((p) => p.status === 'leave').length
  const missionCount = people.filter((p) => p.status === 'mission').length

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" spacing={2}>
        <Typography variant="h5">{t('nav.personnel')}</Typography>
        <Chip label={`${people.length}`} size="small" />
      </Stack>

      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <StatCard
          label={t('personnel.status')}
          value={people.length}
          accent={tokens.gold}
          icon={<GroupsIcon fontSize="small" />}
        />
        <StatCard
          label={t('personnel.statusValue.active')}
          value={activeCount}
          accent={tokens.green}
          icon={<HowToRegIcon fontSize="small" />}
        />
        <StatCard
          label={t('personnel.statusValue.leave')}
          value={leaveCount}
          accent={tokens.orange}
          icon={<BadgeIcon fontSize="small" />}
        />
        <StatCard
          label={t('personnel.statusValue.mission')}
          value={missionCount}
          accent={tokens.cyan}
          icon={<FlightTakeoffIcon fontSize="small" />}
        />
      </Stack>

      <SectionCard title={t('nav.personnel')}>
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
                <TableCell sx={{ color: tokens.text }}>{ar ? p.name_ar : p.name_en}</TableCell>
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
      </SectionCard>
      {selected !== null && <ProfileDialog id={selected} onClose={() => setSelected(null)} />}
    </Stack>
  )
}
