import AddIcon from '@mui/icons-material/Add'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import MarkEmailUnreadIcon from '@mui/icons-material/MarkEmailUnread'
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
  createTicket,
  fetchTickets,
  removeTicket,
  updateTicket,
  type TicketListItem,
  type TicketPriority,
  type TicketStatus,
  type TicketWriteBody,
} from '../../api/helpdesk'
import { ClassificationBadge } from '../../components/ClassificationBadge'
import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import { tokens } from '../../theme/tokens'

const PRIORITY_COLOR: Record<TicketPriority, 'success' | 'warning' | 'error'> = {
  low: 'success',
  medium: 'warning',
  high: 'error',
}

const STATUS_COLOR: Record<TicketStatus, 'info' | 'warning' | 'success' | 'default'> = {
  open: 'info',
  in_progress: 'warning',
  resolved: 'success',
  closed: 'default',
}

const PRIORITIES: TicketPriority[] = ['low', 'medium', 'high']
const STATUSES: TicketStatus[] = ['open', 'in_progress', 'resolved', 'closed']
const CLEARANCES: ReadonlyArray<1 | 2 | 3 | 4> = [1, 2, 3, 4]

type SortField = 'title_en' | 'requester' | 'priority' | 'status' | 'classification'

const PRIORITY_LABEL: Record<TicketPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

const EMPTY_FORM: TicketWriteBody = {
  title_ar: '',
  title_en: '',
  requester: '',
  priority: 'medium',
  status: 'open',
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

function TicketFormDialog({
  open,
  initial,
  onClose,
  onSubmit,
  pending,
}: {
  open: boolean
  initial: TicketWriteBody
  onClose: () => void
  onSubmit: (body: TicketWriteBody) => void
  pending: boolean
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState<TicketWriteBody>(initial)

  useEffect(() => {
    if (open) setForm(initial)
  }, [open, initial])

  const valid = form.title_ar.trim() !== '' && form.title_en.trim() !== ''

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{initial.title_en ? t('common.edit') : t('common.new')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label={`${t('helpdesk.title', 'Title')} (AR)`}
            value={form.title_ar}
            onChange={(e) => setForm((f) => ({ ...f, title_ar: e.target.value }))}
            required
            fullWidth
            inputProps={{ 'data-testid': 'field-title_ar' }}
          />
          <TextField
            label={`${t('helpdesk.title', 'Title')} (EN)`}
            value={form.title_en}
            onChange={(e) => setForm((f) => ({ ...f, title_en: e.target.value }))}
            required
            fullWidth
            inputProps={{ 'data-testid': 'field-title_en' }}
          />
          <TextField
            label={t('helpdesk.requester', 'Requester')}
            value={form.requester}
            onChange={(e) => setForm((f) => ({ ...f, requester: e.target.value }))}
            fullWidth
            inputProps={{ 'data-testid': 'field-requester' }}
          />
          <TextField
            select
            label={t('helpdesk.priority', 'Priority')}
            value={form.priority}
            onChange={(e) =>
              setForm((f) => ({ ...f, priority: e.target.value as TicketPriority }))
            }
            fullWidth
            inputProps={{ 'data-testid': 'field-priority' }}
          >
            {PRIORITIES.map((p) => (
              <MenuItem key={p} value={p}>
                {t(`helpdesk.${p}`, PRIORITY_LABEL[p])}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={t('helpdesk.status', 'Status')}
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as TicketStatus }))}
            fullWidth
            inputProps={{ 'data-testid': 'field-status' }}
          >
            {STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {t(`helpdesk.${s}`, STATUS_LABEL[s])}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={t('helpdesk.classification', 'Classification')}
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

export function HelpDeskPage() {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const q = useDebounced(search)
  const [sortField, setSortField] = useState<SortField>('title_en')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const ordering = `${sortDir === 'desc' ? '-' : ''}${sortField}`

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<TicketListItem | null>(null)
  const [deleting, setDeleting] = useState<TicketListItem | null>(null)

  const queryKey = ['helpdesk', q, ordering] as const
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchTickets({ q, ordering }),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['helpdesk'] })

  const createMutation = useMutation({
    mutationFn: (body: TicketWriteBody) => createTicket(body),
    onSuccess: () => {
      invalidate()
      setFormOpen(false)
    },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: TicketWriteBody }) => updateTicket(id, body),
    onSuccess: () => {
      invalidate()
      setFormOpen(false)
      setEditing(null)
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => removeTicket(id),
    onSuccess: () => {
      invalidate()
      setDeleting(null)
    },
  })

  const formInitial: TicketWriteBody = useMemo(
    () =>
      editing
        ? {
            title_ar: editing.title_ar,
            title_en: editing.title_en,
            requester: editing.requester,
            priority: editing.priority,
            status: editing.status,
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

  const handleSubmit = (body: TicketWriteBody) => {
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

  const tickets: TicketListItem[] = data ?? []
  const openCount = tickets.filter((tk) => tk.status === 'open').length

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
        <Typography variant="h5">{t('nav.helpdesk')}</Typography>
        <Chip size="small" label={tickets.length} variant="outlined" />
      </Stack>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <Box data-testid="kpi-total" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('helpdesk.total', 'Total Tickets')}
            value={tickets.length}
            accent={tokens.gold}
            icon={<ConfirmationNumberIcon />}
          />
        </Box>
        <Box data-testid="kpi-open" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('helpdesk.open', 'Open')}
            value={openCount}
            accent={tokens.cyan}
            icon={<MarkEmailUnreadIcon />}
          />
        </Box>
      </Box>

      <SectionCard
        title={t('nav.helpdesk')}
        action={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TextField
              size="small"
              placeholder={t('common.searchHere')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              inputProps={{ 'data-testid': 'helpdesk-search' }}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
              data-testid="ticket-new"
            >
              {t('common.new')}
            </Button>
          </Stack>
        }
      >
        <TableContainer>
          <Table data-testid="helpdesk-table">
            <TableHead>
              <TableRow>
                <TableCell>{sortHeader('title_en', t('helpdesk.title', 'Title'))}</TableCell>
                <TableCell>
                  {sortHeader('requester', t('helpdesk.requester', 'Requester'))}
                </TableCell>
                <TableCell>
                  {sortHeader('priority', t('helpdesk.priority', 'Priority'))}
                </TableCell>
                <TableCell>{sortHeader('status', t('helpdesk.status', 'Status'))}</TableCell>
                <TableCell>
                  {sortHeader('classification', t('helpdesk.classification', 'Classification'))}
                </TableCell>
                <TableCell align="right">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tickets.map((tk) => (
                <TableRow key={tk.id} data-testid="ticket-row">
                  <TableCell>{ar ? tk.title_ar : tk.title_en}</TableCell>
                  <TableCell>{tk.requester}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={PRIORITY_COLOR[tk.priority]}
                      label={t(`helpdesk.${tk.priority}`, PRIORITY_LABEL[tk.priority])}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={STATUS_COLOR[tk.status]}
                      label={t(`helpdesk.${tk.status}`, STATUS_LABEL[tk.status])}
                    />
                  </TableCell>
                  <TableCell>
                    <ClassificationBadge level={tk.classification} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      aria-label={t('common.edit')}
                      data-testid="ticket-edit"
                      onClick={() => {
                        setEditing(tk)
                        setFormOpen(true)
                      }}
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={t('common.delete')}
                      data-testid="ticket-delete"
                      onClick={() => setDeleting(tk)}
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

      <TicketFormDialog
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
