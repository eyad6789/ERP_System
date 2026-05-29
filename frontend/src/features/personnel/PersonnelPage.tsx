import AddIcon from '@mui/icons-material/Add'
import BadgeIcon from '@mui/icons-material/Badge'
import CloseIcon from '@mui/icons-material/Close'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff'
import GroupsIcon from '@mui/icons-material/Groups'
import HowToRegIcon from '@mui/icons-material/HowToReg'
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  createPerson,
  fetchPerson,
  fetchPersonnel,
  removePerson,
  updatePerson,
  type Person,
  type PersonInput,
} from '../../api/personnel'
import { ClassificationBadge } from '../../components/ClassificationBadge'
import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import { tokens } from '../../theme/tokens'

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'info'> = {
  active: 'success',
  leave: 'warning',
  mission: 'info',
}

const STATUS_VALUES: Person['status'][] = ['active', 'leave', 'mission']
const CLEARANCE_LEVELS: (1 | 2 | 3 | 4)[] = [1, 2, 3, 4]
type SortField = 'name_en' | 'rank_en' | 'status' | 'classification'

const EMPTY_FORM: PersonInput = {
  name_ar: '',
  name_en: '',
  rank_ar: '',
  rank_en: '',
  classification: 1,
  status: 'active',
  attendance: 0,
  joined_year: new Date().getFullYear(),
  contract_type: '',
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

function PersonFormDialog({
  person,
  onClose,
}: {
  person: Person | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const editing = person !== null
  const [form, setForm] = useState<PersonInput>(() =>
    person
      ? {
          name_ar: person.name_ar,
          name_en: person.name_en,
          rank_ar: person.rank_ar,
          rank_en: person.rank_en,
          classification: person.classification,
          status: person.status,
          attendance: person.attendance ?? 0,
          joined_year: person.joined_year ?? new Date().getFullYear(),
          contract_type: person.contract_type ?? '',
        }
      : EMPTY_FORM,
  )

  const mutation = useMutation({
    mutationFn: () =>
      editing ? updatePerson(person.id, form) : createPerson(form),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['personnel'] })
      onClose()
    },
  })

  function set<K extends keyof PersonInput>(key: K, value: PersonInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        {editing ? t('common.edit') : t('common.new')}
        <IconButton size="small" onClick={onClose} aria-label={t('common.close')} sx={{ color: tokens.muted }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Stack direction="row" spacing={2}>
            <TextField
              label={`${t('personnel.name')} (AR)`}
              value={form.name_ar}
              onChange={(e) => set('name_ar', e.target.value)}
              fullWidth
              size="small"
              inputProps={{ 'data-testid': 'field-name_ar' }}
            />
            <TextField
              label={`${t('personnel.name')} (EN)`}
              value={form.name_en}
              onChange={(e) => set('name_en', e.target.value)}
              fullWidth
              size="small"
              inputProps={{ 'data-testid': 'field-name_en' }}
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              label={`${t('personnel.rank')} (AR)`}
              value={form.rank_ar}
              onChange={(e) => set('rank_ar', e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label={`${t('personnel.rank')} (EN)`}
              value={form.rank_en}
              onChange={(e) => set('rank_en', e.target.value)}
              fullWidth
              size="small"
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              select
              label={t('personnel.clearance')}
              value={form.classification}
              onChange={(e) => set('classification', Number(e.target.value))}
              fullWidth
              size="small"
              inputProps={{ 'data-testid': 'field-classification' }}
            >
              {CLEARANCE_LEVELS.map((level) => (
                <MenuItem key={level} value={level}>
                  {t(`clearance.${level}`)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={t('personnel.status')}
              value={form.status}
              onChange={(e) => set('status', e.target.value as Person['status'])}
              fullWidth
              size="small"
              inputProps={{ 'data-testid': 'field-status' }}
            >
              {STATUS_VALUES.map((status) => (
                <MenuItem key={status} value={status}>
                  {t(`personnel.statusValue.${status}`)}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              label={t('personnel.attendance')}
              type="number"
              value={form.attendance}
              onChange={(e) => set('attendance', Number(e.target.value))}
              fullWidth
              size="small"
            />
            <TextField
              label={t('personnel.joined')}
              type="number"
              value={form.joined_year}
              onChange={(e) => set('joined_year', Number(e.target.value))}
              fullWidth
              size="small"
            />
          </Stack>
          <TextField
            label={t('personnel.contract')}
            value={form.contract_type}
            onChange={(e) => set('contract_type', e.target.value)}
            fullWidth
            size="small"
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: tokens.muted }}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          data-testid="submit-person"
        >
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function ConfirmDeleteDialog({
  person,
  onClose,
}: {
  person: Person
  onClose: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => removePerson(person.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['personnel'] })
      onClose()
    },
  })

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t('common.delete')}</DialogTitle>
      <DialogContent>
        <Typography sx={{ color: tokens.text }}>{t('common.confirmDelete')}</Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: tokens.muted }}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          data-testid="confirm-delete-person"
        >
          {t('common.confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export function PersonnelPage() {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const [selected, setSelected] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [ordering, setOrdering] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Person | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Person | null>(null)

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(handle)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['personnel', debouncedSearch, ordering],
    queryFn: () => fetchPersonnel({ q: debouncedSearch, ordering }),
  })

  const { sortField, sortDir } = useMemo(() => {
    const desc = ordering.startsWith('-')
    const field = (desc ? ordering.slice(1) : ordering) as SortField | ''
    return { sortField: field, sortDir: desc ? ('desc' as const) : ('asc' as const) }
  }, [ordering])

  function toggleSort(field: SortField) {
    setOrdering((prev) => {
      if (prev === field) return `-${field}`
      return field
    })
  }

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

      <SectionCard
        title={t('nav.personnel')}
        action={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TextField
              size="small"
              placeholder={t('common.searchHere')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              inputProps={{ 'data-testid': 'personnel-search' }}
            />
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditTarget(null)
                setFormOpen(true)
              }}
              data-testid="personnel-new"
            >
              {t('common.new')}
            </Button>
          </Stack>
        }
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sortDirection={sortField === 'name_en' ? sortDir : false}>
                <TableSortLabel
                  active={sortField === 'name_en'}
                  direction={sortField === 'name_en' ? sortDir : 'asc'}
                  onClick={() => toggleSort('name_en')}
                >
                  {t('personnel.name')}
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={sortField === 'rank_en' ? sortDir : false}>
                <TableSortLabel
                  active={sortField === 'rank_en'}
                  direction={sortField === 'rank_en' ? sortDir : 'asc'}
                  onClick={() => toggleSort('rank_en')}
                >
                  {t('personnel.rank')}
                </TableSortLabel>
              </TableCell>
              <TableCell>{t('personnel.department')}</TableCell>
              <TableCell sortDirection={sortField === 'status' ? sortDir : false}>
                <TableSortLabel
                  active={sortField === 'status'}
                  direction={sortField === 'status' ? sortDir : 'asc'}
                  onClick={() => toggleSort('status')}
                >
                  {t('personnel.status')}
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={sortField === 'classification' ? sortDir : false}>
                <TableSortLabel
                  active={sortField === 'classification'}
                  direction={sortField === 'classification' ? sortDir : 'asc'}
                  onClick={() => toggleSort('classification')}
                >
                  {t('personnel.clearance')}
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">{t('common.actions')}</TableCell>
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
                <TableCell align="right">
                  <IconButton
                    size="small"
                    aria-label={t('common.edit')}
                    sx={{ color: tokens.muted }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditTarget(p)
                      setFormOpen(true)
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label={t('common.delete')}
                    sx={{ color: tokens.red }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteTarget(p)
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>
      {selected !== null && <ProfileDialog id={selected} onClose={() => setSelected(null)} />}
      {formOpen && (
        <PersonFormDialog
          person={editTarget}
          onClose={() => {
            setFormOpen(false)
            setEditTarget(null)
          }}
        />
      )}
      {deleteTarget !== null && (
        <ConfirmDeleteDialog person={deleteTarget} onClose={() => setDeleteTarget(null)} />
      )}
    </Stack>
  )
}
