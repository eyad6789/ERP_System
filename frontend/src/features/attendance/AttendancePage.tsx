import AddIcon from '@mui/icons-material/Add'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import EventAvailableIcon from '@mui/icons-material/EventAvailable'
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
  TableContainer,
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
  create,
  fetchList,
  remove,
  update,
  type AttendanceListItem,
  type AttendanceStatus,
  type AttendanceWriteBody,
} from '../../api/attendance'
import { ClassificationBadge } from '../../components/ClassificationBadge'
import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import { tokens } from '../../theme/tokens'

const STATUS_COLOR: Record<AttendanceStatus, 'success' | 'error' | 'info' | 'warning'> = {
  present: 'success',
  absent: 'error',
  leave: 'info',
  late: 'warning',
}

const STATUSES: AttendanceStatus[] = ['present', 'absent', 'leave', 'late']
const CLEARANCES: ReadonlyArray<1 | 2 | 3 | 4> = [1, 2, 3, 4]

type SortField = 'employee' | 'date' | 'status' | 'check_in' | 'check_out' | 'classification'

const EMPTY_FORM: AttendanceWriteBody = {
  employee: '',
  date: '',
  status: 'present',
  check_in: '',
  check_out: '',
  classification: 1,
}

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

function AttendanceFormDialog({
  open,
  initial,
  onClose,
  onSubmit,
  pending,
}: {
  open: boolean
  initial: AttendanceWriteBody
  onClose: () => void
  onSubmit: (body: AttendanceWriteBody) => void
  pending: boolean
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState<AttendanceWriteBody>(initial)

  useEffect(() => {
    if (open) setForm(initial)
  }, [open, initial])

  const valid = form.employee.trim() !== '' && form.date.trim() !== ''

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{initial.employee ? t('common.edit') : t('common.new')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label={t('attendance.employee', 'Employee')}
            value={form.employee}
            onChange={(e) => setForm((f) => ({ ...f, employee: e.target.value }))}
            required
            fullWidth
            inputProps={{ 'data-testid': 'field-employee' }}
          />
          <TextField
            type="date"
            label={t('attendance.date', 'Date')}
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            required
            fullWidth
            InputLabelProps={{ shrink: true }}
            inputProps={{ 'data-testid': 'field-date' }}
          />
          <TextField
            select
            label={t('attendance.status', 'Status')}
            value={form.status}
            onChange={(e) =>
              setForm((f) => ({ ...f, status: e.target.value as AttendanceStatus }))
            }
            fullWidth
            inputProps={{ 'data-testid': 'field-status' }}
          >
            {STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {t(`attendance.${s}`, s)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={t('attendance.check_in', 'Check In')}
            value={form.check_in}
            onChange={(e) => setForm((f) => ({ ...f, check_in: e.target.value }))}
            fullWidth
            inputProps={{ 'data-testid': 'field-check_in' }}
          />
          <TextField
            label={t('attendance.check_out', 'Check Out')}
            value={form.check_out}
            onChange={(e) => setForm((f) => ({ ...f, check_out: e.target.value }))}
            fullWidth
            inputProps={{ 'data-testid': 'field-check_out' }}
          />
          <TextField
            select
            label={t('attendance.classification', 'Classification')}
            value={form.classification}
            onChange={(e) =>
              setForm((f) => ({ ...f, classification: Number(e.target.value) }))
            }
            fullWidth
            inputProps={{ 'data-testid': 'field-classification' }}
          >
            {CLEARANCES.map((n) => (
              <MenuItem key={n} value={n}>
                {t(`clearance.${n}`)}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          disabled={!valid || pending}
          onClick={() => onSubmit(form)}
          data-testid="form-submit"
        >
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export function AttendancePage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const q = useDebounced(search)
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const ordering = `${sortDir === 'desc' ? '-' : ''}${sortField}`

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AttendanceListItem | null>(null)
  const [deleting, setDeleting] = useState<AttendanceListItem | null>(null)

  const queryKey = ['attendance', q, ordering] as const
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchList({ q, ordering }),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['attendance'] })

  const createMutation = useMutation({
    mutationFn: (body: AttendanceWriteBody) => create(body),
    onSuccess: () => {
      invalidate()
      setFormOpen(false)
    },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: AttendanceWriteBody }) => update(id, body),
    onSuccess: () => {
      invalidate()
      setFormOpen(false)
      setEditing(null)
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => remove(id),
    onSuccess: () => {
      invalidate()
      setDeleting(null)
    },
  })

  const formInitial: AttendanceWriteBody = useMemo(
    () =>
      editing
        ? {
            employee: editing.employee,
            date: editing.date,
            status: editing.status,
            check_in: editing.check_in,
            check_out: editing.check_out,
            classification: editing.classification,
          }
        : EMPTY_FORM,
    [editing],
  )

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const handleSubmit = (body: AttendanceWriteBody) => {
    if (editing) updateMutation.mutate({ id: editing.id, body })
    else createMutation.mutate(body)
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  const records: AttendanceListItem[] = data ?? []
  const presentCount = records.filter((r) => r.status === 'present').length

  const sortHeader = (field: SortField, label: string) => (
    <TableSortLabel
      active={sortField === field}
      direction={sortField === field ? sortDir : 'asc'}
      onClick={() => handleSort(field)}
      IconComponent={sortDir === 'desc' ? ArrowDownwardIcon : ArrowUpwardIcon}
    >
      {label}
    </TableSortLabel>
  )

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Typography variant="h5">{t('nav.attendance')}</Typography>
        <Chip size="small" label={records.length} variant="outlined" />
      </Stack>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <Box data-testid="kpi-total" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('attendance.total', 'Total')}
            value={records.length}
            accent={tokens.gold}
            icon={<EventAvailableIcon />}
          />
        </Box>
        <Box data-testid="kpi-present" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('attendance.present', 'Present')}
            value={presentCount}
            accent={tokens.green}
            icon={<CheckCircleIcon />}
          />
        </Box>
      </Box>

      <SectionCard
        title={t('nav.attendance')}
        action={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TextField
              size="small"
              placeholder={t('common.searchHere')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              inputProps={{ 'data-testid': 'attendance-search' }}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
              data-testid="attendance-new"
            >
              {t('common.new')}
            </Button>
          </Stack>
        }
      >
        <TableContainer>
          <Table data-testid="attendance-table">
            <TableHead>
              <TableRow>
                <TableCell>{sortHeader('employee', t('attendance.employee', 'Employee'))}</TableCell>
                <TableCell>{sortHeader('date', t('attendance.date', 'Date'))}</TableCell>
                <TableCell>{sortHeader('status', t('attendance.status', 'Status'))}</TableCell>
                <TableCell>{sortHeader('check_in', t('attendance.check_in', 'Check In'))}</TableCell>
                <TableCell>
                  {sortHeader('check_out', t('attendance.check_out', 'Check Out'))}
                </TableCell>
                <TableCell>
                  {sortHeader('classification', t('attendance.classification', 'Classification'))}
                </TableCell>
                <TableCell align="right">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.id} data-testid="attendance-row">
                  <TableCell>{r.employee}</TableCell>
                  <TableCell>{r.date}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={STATUS_COLOR[r.status]}
                      label={t(`attendance.${r.status}`, r.status)}
                    />
                  </TableCell>
                  <TableCell>{r.check_in}</TableCell>
                  <TableCell>{r.check_out}</TableCell>
                  <TableCell>
                    <ClassificationBadge level={r.classification} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      aria-label={t('common.edit')}
                      data-testid="attendance-edit"
                      onClick={() => {
                        setEditing(r)
                        setFormOpen(true)
                      }}
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={t('common.delete')}
                      data-testid="attendance-delete"
                      onClick={() => setDeleting(r)}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </SectionCard>

      <AttendanceFormDialog
        open={formOpen}
        initial={formInitial}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
        pending={createMutation.isPending || updateMutation.isPending}
      />

      <Dialog open={deleting !== null} onClose={() => setDeleting(null)} maxWidth="xs">
        <DialogTitle>{t('common.delete')}</DialogTitle>
        <DialogContent>
          <Typography>{t('common.confirmDelete')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(null)} color="inherit">
            {t('common.cancel')}
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (deleting) deleteMutation.mutate(deleting.id)
            }}
            data-testid="confirm-delete"
          >
            {t('common.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
