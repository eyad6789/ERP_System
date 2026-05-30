import AddIcon from '@mui/icons-material/Add'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import EventNoteIcon from '@mui/icons-material/EventNote'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
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
  type LeaveListItem,
  type LeaveStatus,
  type LeaveType,
  type LeaveWriteBody,
} from '../../api/leave'
import { ClassificationBadge } from '../../components/ClassificationBadge'
import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import { tokens } from '../../theme/tokens'

const STATUS_COLOR: Record<LeaveStatus, 'warning' | 'success' | 'error'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
}

const LEAVE_TYPES: LeaveType[] = ['annual', 'sick', 'emergency']
const STATUSES: LeaveStatus[] = ['pending', 'approved', 'rejected']
const CLEARANCES: ReadonlyArray<1 | 2 | 3 | 4> = [1, 2, 3, 4]

type SortField = 'employee' | 'leave_type' | 'start_date' | 'end_date' | 'status' | 'classification'

const EMPTY_FORM: LeaveWriteBody = {
  employee: '',
  leave_type: 'annual',
  start_date: '',
  end_date: '',
  status: 'pending',
  reason: '',
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

function LeaveFormDialog({
  open,
  initial,
  isEdit,
  onClose,
  onSubmit,
  pending,
}: {
  open: boolean
  initial: LeaveWriteBody
  isEdit: boolean
  onClose: () => void
  onSubmit: (body: LeaveWriteBody) => void
  pending: boolean
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState<LeaveWriteBody>(initial)

  useEffect(() => {
    if (open) setForm(initial)
  }, [open, initial])

  const valid =
    form.employee.trim() !== '' && form.start_date !== '' && form.end_date !== ''

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{isEdit ? t('common.edit') : t('common.new')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label={t('leave.employee', 'Employee')}
            value={form.employee}
            onChange={(e) => setForm((f) => ({ ...f, employee: e.target.value }))}
            required
            fullWidth
            inputProps={{ 'data-testid': 'field-employee' }}
          />
          <TextField
            select
            label={t('leave.leave_type', 'Leave type')}
            value={form.leave_type}
            onChange={(e) =>
              setForm((f) => ({ ...f, leave_type: e.target.value as LeaveType }))
            }
            fullWidth
            inputProps={{ 'data-testid': 'field-leave_type' }}
          >
            {LEAVE_TYPES.map((lt) => (
              <MenuItem key={lt} value={lt}>
                {t(`leave.${lt}`, lt)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={t('leave.start_date', 'Start date')}
            type="date"
            value={form.start_date}
            onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
            required
            fullWidth
            InputLabelProps={{ shrink: true }}
            inputProps={{ 'data-testid': 'field-start_date' }}
          />
          <TextField
            label={t('leave.end_date', 'End date')}
            type="date"
            value={form.end_date}
            onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
            required
            fullWidth
            InputLabelProps={{ shrink: true }}
            inputProps={{ 'data-testid': 'field-end_date' }}
          />
          <TextField
            select
            label={t('leave.status', 'Status')}
            value={form.status}
            onChange={(e) =>
              setForm((f) => ({ ...f, status: e.target.value as LeaveStatus }))
            }
            fullWidth
            inputProps={{ 'data-testid': 'field-status' }}
          >
            {STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {t(`leave.${s}`, s)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={t('leave.reason', 'Reason')}
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            fullWidth
            multiline
            minRows={2}
            inputProps={{ 'data-testid': 'field-reason' }}
          />
          <TextField
            select
            label={t('leave.classification', 'Classification')}
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

export function LeavePage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const q = useDebounced(search)
  const [sortField, setSortField] = useState<SortField>('start_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const ordering = `${sortDir === 'desc' ? '-' : ''}${sortField}`

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<LeaveListItem | null>(null)
  const [deleting, setDeleting] = useState<LeaveListItem | null>(null)

  const queryKey = ['leave', q, ordering] as const
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchList({ q, ordering }),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['leave'] })

  const createMutation = useMutation({
    mutationFn: (body: LeaveWriteBody) => create(body),
    onSuccess: () => {
      invalidate()
      setFormOpen(false)
    },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: LeaveWriteBody }) => update(id, body),
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

  const formInitial: LeaveWriteBody = useMemo(
    () =>
      editing
        ? {
            employee: editing.employee,
            leave_type: editing.leave_type,
            start_date: editing.start_date,
            end_date: editing.end_date,
            status: editing.status,
            reason: editing.reason,
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

  const handleSubmit = (body: LeaveWriteBody) => {
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

  const rows: LeaveListItem[] = data ?? []
  const pendingCount = rows.filter((r) => r.status === 'pending').length

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
        <Typography variant="h5">{t('nav.leave')}</Typography>
        <Chip size="small" label={rows.length} variant="outlined" />
      </Stack>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <Box data-testid="kpi-total" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('leave.total', 'Total requests')}
            value={rows.length}
            accent={tokens.gold}
            icon={<EventNoteIcon />}
          />
        </Box>
        <Box data-testid="kpi-pending" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('leave.pending', 'Pending')}
            value={pendingCount}
            accent={tokens.orange}
            icon={<HourglassEmptyIcon />}
          />
        </Box>
      </Box>

      <SectionCard
        title={t('nav.leave')}
        action={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TextField
              size="small"
              placeholder={t('common.searchHere')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              inputProps={{ 'data-testid': 'leave-search' }}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
              data-testid="leave-new"
            >
              {t('common.new')}
            </Button>
          </Stack>
        }
      >
        <TableContainer>
          <Table data-testid="leave-table">
            <TableHead>
              <TableRow>
                <TableCell>{sortHeader('employee', t('leave.employee', 'Employee'))}</TableCell>
                <TableCell>{sortHeader('leave_type', t('leave.leave_type', 'Leave type'))}</TableCell>
                <TableCell>{sortHeader('start_date', t('leave.start_date', 'Start date'))}</TableCell>
                <TableCell>{sortHeader('end_date', t('leave.end_date', 'End date'))}</TableCell>
                <TableCell>{sortHeader('status', t('leave.status', 'Status'))}</TableCell>
                <TableCell>
                  {sortHeader('classification', t('leave.classification', 'Classification'))}
                </TableCell>
                <TableCell align="right">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} data-testid="leave-row">
                  <TableCell>{r.employee}</TableCell>
                  <TableCell>{t(`leave.${r.leave_type}`, r.leave_type)}</TableCell>
                  <TableCell>{r.start_date}</TableCell>
                  <TableCell>{r.end_date}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={STATUS_COLOR[r.status]}
                      label={t(`leave.${r.status}`, r.status)}
                    />
                  </TableCell>
                  <TableCell>
                    <ClassificationBadge level={r.classification} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      aria-label={t('common.edit')}
                      data-testid="leave-edit"
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
                      data-testid="leave-delete"
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

      <LeaveFormDialog
        open={formOpen}
        initial={formInitial}
        isEdit={editing !== null}
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
