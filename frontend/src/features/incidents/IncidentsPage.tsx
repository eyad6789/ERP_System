import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import ErrorIcon from '@mui/icons-material/Error'
import ReportProblemIcon from '@mui/icons-material/ReportProblem'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
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
  Select,
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
  createIncident,
  fetchIncidents,
  removeIncident,
  updateIncident,
  updateIncidentStatus,
  type Incident,
  type IncidentInput,
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

const SEVERITIES: IncidentSeverity[] = ['critical', 'high', 'medium']
const STATUSES: IncidentStatus[] = ['active', 'open', 'closed']
const CLEARANCE_LEVELS = [1, 2, 3, 4] as const
type SortField = 'reported_date' | 'severity' | 'status'

function emptyForm(): IncidentInput {
  return {
    title_ar: '',
    title_en: '',
    severity: 'medium',
    status: 'open',
    reported_date: null,
    classification: 1,
  }
}

function IncidentFormDialog({
  open,
  initial,
  onClose,
  onSubmit,
  pending,
}: {
  open: boolean
  initial: Incident | null
  onClose: () => void
  onSubmit: (body: IncidentInput) => void
  pending: boolean
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState<IncidentInput>(emptyForm())

  useEffect(() => {
    if (!open) return
    setForm(
      initial
        ? {
            title_ar: initial.title_ar,
            title_en: initial.title_en,
            severity: initial.severity,
            status: initial.status,
            reported_date: initial.reported_date,
            classification: initial.classification,
          }
        : emptyForm(),
    )
  }, [open, initial])

  const valid = form.title_ar.trim() !== '' && form.title_en.trim() !== ''

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{initial ? t('common.edit') : t('common.new')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label={`${t('incidents.title')} (AR)`}
            value={form.title_ar}
            onChange={(e) => setForm((f) => ({ ...f, title_ar: e.target.value }))}
            required
            fullWidth
            inputProps={{ 'data-testid': 'field-title-ar' }}
          />
          <TextField
            label={`${t('incidents.title')} (EN)`}
            value={form.title_en}
            onChange={(e) => setForm((f) => ({ ...f, title_en: e.target.value }))}
            required
            fullWidth
            inputProps={{ 'data-testid': 'field-title-en' }}
          />
          <Select
            value={form.severity}
            onChange={(e) =>
              setForm((f) => ({ ...f, severity: e.target.value as IncidentSeverity }))
            }
            fullWidth
            data-testid="field-severity"
          >
            {SEVERITIES.map((s) => (
              <MenuItem key={s} value={s}>
                {t(`incidents.severityValue.${s}`)}
              </MenuItem>
            ))}
          </Select>
          <Select
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as IncidentStatus }))}
            fullWidth
            data-testid="field-status"
          >
            {STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {t(`incidents.statusValue.${s}`)}
              </MenuItem>
            ))}
          </Select>
          <TextField
            type="date"
            label={t('incidents.reportedDate')}
            value={form.reported_date ?? ''}
            onChange={(e) =>
              setForm((f) => ({ ...f, reported_date: e.target.value || null }))
            }
            fullWidth
            InputLabelProps={{ shrink: true }}
            inputProps={{ 'data-testid': 'field-reported-date' }}
          />
          <Select
            value={form.classification}
            onChange={(e) =>
              setForm((f) => ({ ...f, classification: Number(e.target.value) }))
            }
            fullWidth
            data-testid="field-classification"
          >
            {CLEARANCE_LEVELS.map((n) => (
              <MenuItem key={n} value={n}>
                {t(`clearance.${n}`)}
              </MenuItem>
            ))}
          </Select>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          {t('common.cancel')}
        </Button>
        <Button
          onClick={() => onSubmit(form)}
          variant="contained"
          color="primary"
          disabled={!valid || pending}
          data-testid="incident-save"
        >
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function ConfirmDeleteDialog({
  open,
  onClose,
  onConfirm,
  pending,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  pending: boolean
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('common.delete')}</DialogTitle>
      <DialogContent>
        <Typography>{t('common.confirmDelete')}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          {t('common.cancel')}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="error"
          disabled={pending}
          data-testid="incident-delete-confirm"
        >
          {t('common.confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export function IncidentsPage() {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [sortField, setSortField] = useState<SortField>('reported_date')
  const [sortAsc, setSortAsc] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Incident | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Incident | null>(null)

  // Debounce the search box so each keystroke does not fire a request.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(search), 300)
    return () => clearTimeout(id)
  }, [search])

  const ordering = useMemo(
    () => `${sortAsc ? '' : '-'}${sortField}`,
    [sortAsc, sortField],
  )

  const { data, isLoading } = useQuery({
    queryKey: ['incidents', debouncedQ, ordering],
    queryFn: () => fetchIncidents({ q: debouncedQ, ordering }),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['incidents'] })

  const createMut = useMutation({
    mutationFn: (body: IncidentInput) => createIncident(body),
    onSuccess: () => {
      invalidate()
      setFormOpen(false)
      setEditing(null)
    },
  })
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: IncidentInput }) => updateIncident(id, body),
    onSuccess: () => {
      invalidate()
      setFormOpen(false)
      setEditing(null)
    },
  })
  const deleteMut = useMutation({
    mutationFn: (id: number) => removeIncident(id),
    onSuccess: () => {
      invalidate()
      setDeleteTarget(null)
    },
  })
  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: IncidentStatus }) =>
      updateIncidentStatus(id, status),
    onSuccess: invalidate,
  })

  const incidents: Incident[] = data ?? []
  const count = (pred: (i: Incident) => boolean) => incidents.filter(pred).length
  const critical = count((i) => i.severity === 'critical')
  const high = count((i) => i.severity === 'high')
  const active = count((i) => i.status === 'active')
  const closed = count((i) => i.status === 'closed')

  const toggleSort = (field: SortField) => {
    if (field === sortField) setSortAsc((v) => !v)
    else {
      setSortField(field)
      setSortAsc(false)
    }
  }

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (incident: Incident) => {
    setEditing(incident)
    setFormOpen(true)
  }
  const submitForm = (body: IncidentInput) => {
    if (editing) updateMut.mutate({ id: editing.id, body })
    else createMut.mutate(body)
  }

  return (
    <Stack spacing={3}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        gap={1}
      >
        <Stack direction="row" alignItems="center" gap={1}>
          <Typography variant="h5">{t('nav.incidents')}</Typography>
          <Chip
            size="small"
            variant="outlined"
            label={incidents.length}
            sx={{ color: tokens.gold, borderColor: tokens.borderGold, fontWeight: 600 }}
          />
        </Stack>
        <Button
          variant="contained"
          color="primary"
          onClick={openCreate}
          data-testid="incident-new"
        >
          + {t('common.new')}
        </Button>
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

      <SectionCard
        title={t('nav.incidents')}
        action={
          <TextField
            size="small"
            placeholder={t('common.searchHere')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            inputProps={{ 'data-testid': 'incidents-search' }}
            sx={{ minWidth: 220 }}
          />
        }
      >
        {isLoading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Table size="small" data-testid="incidents-table">
            <TableHead>
              <TableRow>
                <TableCell>{t('incidents.title')}</TableCell>
                <TableCell sortDirection={sortField === 'severity' ? (sortAsc ? 'asc' : 'desc') : false}>
                  <TableSortLabel
                    active={sortField === 'severity'}
                    direction={sortAsc ? 'asc' : 'desc'}
                    onClick={() => toggleSort('severity')}
                    data-testid="sort-severity"
                  >
                    {t('incidents.severity')}
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={sortField === 'status' ? (sortAsc ? 'asc' : 'desc') : false}>
                  <TableSortLabel
                    active={sortField === 'status'}
                    direction={sortAsc ? 'asc' : 'desc'}
                    onClick={() => toggleSort('status')}
                    data-testid="sort-status"
                  >
                    {t('incidents.status')}
                  </TableSortLabel>
                </TableCell>
                <TableCell
                  sortDirection={sortField === 'reported_date' ? (sortAsc ? 'asc' : 'desc') : false}
                >
                  <TableSortLabel
                    active={sortField === 'reported_date'}
                    direction={sortAsc ? 'asc' : 'desc'}
                    onClick={() => toggleSort('reported_date')}
                    data-testid="sort-reported-date"
                  >
                    {t('incidents.reportedDate')}
                  </TableSortLabel>
                </TableCell>
                <TableCell>{t('incidents.classification')}</TableCell>
                <TableCell align="right">{t('common.actions')}</TableCell>
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
                    {/* Existing status-transition control: change an incident's state inline. */}
                    <Select
                      size="small"
                      value={i.status}
                      onChange={(e) =>
                        statusMut.mutate({ id: i.id, status: e.target.value as IncidentStatus })
                      }
                      variant="standard"
                      data-testid="incident-status-select"
                      sx={{ minWidth: 96 }}
                    >
                      {STATUSES.map((s) => (
                        <MenuItem key={s} value={s}>
                          <Chip
                            size="small"
                            variant="outlined"
                            color={STATUS_COLOR[s]}
                            label={t(`incidents.statusValue.${s}`)}
                          />
                        </MenuItem>
                      ))}
                    </Select>
                  </TableCell>
                  <TableCell>{i.reported_date ?? '-'}</TableCell>
                  <TableCell>
                    <ClassificationBadge level={i.classification} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => openEdit(i)}
                      aria-label={t('common.edit')}
                      data-testid="incident-edit"
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => setDeleteTarget(i)}
                      aria-label={t('common.delete')}
                      data-testid="incident-delete"
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <IncidentFormDialog
        open={formOpen}
        initial={editing}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        onSubmit={submitForm}
        pending={createMut.isPending || updateMut.isPending}
      />
      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        pending={deleteMut.isPending}
      />
    </Stack>
  )
}
