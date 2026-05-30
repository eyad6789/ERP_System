import AddIcon from '@mui/icons-material/Add'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import BeachAccessIcon from '@mui/icons-material/BeachAccess'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import EventIcon from '@mui/icons-material/Event'
import FlagIcon from '@mui/icons-material/Flag'
import GroupsIcon from '@mui/icons-material/Groups'
import MyLocationIcon from '@mui/icons-material/MyLocation'
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
  type EventListItem,
  type EventType,
  type EventWriteBody,
} from '../../api/events'
import { ClassificationBadge } from '../../components/ClassificationBadge'
import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import { tokens } from '../../theme/tokens'

const TYPE_COLOR: Record<EventType, 'info' | 'warning' | 'success' | 'error'> = {
  meeting: 'info',
  deadline: 'warning',
  holiday: 'success',
  operation: 'error',
}

const TYPES: EventType[] = ['meeting', 'deadline', 'holiday', 'operation']
const CLEARANCES: ReadonlyArray<1 | 2 | 3 | 4> = [1, 2, 3, 4]

type SortField = 'title_en' | 'start_at' | 'end_at' | 'event_type' | 'location' | 'classification'

const EMPTY_FORM: EventWriteBody = {
  title_ar: '',
  title_en: '',
  start_at: '',
  end_at: '',
  event_type: 'meeting',
  location: '',
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

function EventFormDialog({
  open,
  initial,
  onClose,
  onSubmit,
  pending,
}: {
  open: boolean
  initial: EventWriteBody
  onClose: () => void
  onSubmit: (body: EventWriteBody) => void
  pending: boolean
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState<EventWriteBody>(initial)

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
            label={`${t('events.title', 'Title')} (AR)`}
            value={form.title_ar}
            onChange={(e) => setForm((f) => ({ ...f, title_ar: e.target.value }))}
            required
            fullWidth
            inputProps={{ 'data-testid': 'field-title_ar' }}
          />
          <TextField
            label={`${t('events.title', 'Title')} (EN)`}
            value={form.title_en}
            onChange={(e) => setForm((f) => ({ ...f, title_en: e.target.value }))}
            required
            fullWidth
            inputProps={{ 'data-testid': 'field-title_en' }}
          />
          <TextField
            type="datetime-local"
            label={t('events.start_at', 'Starts')}
            value={form.start_at}
            onChange={(e) => setForm((f) => ({ ...f, start_at: e.target.value }))}
            fullWidth
            InputLabelProps={{ shrink: true }}
            inputProps={{ 'data-testid': 'field-start_at' }}
          />
          <TextField
            type="datetime-local"
            label={t('events.end_at', 'Ends')}
            value={form.end_at}
            onChange={(e) => setForm((f) => ({ ...f, end_at: e.target.value }))}
            fullWidth
            InputLabelProps={{ shrink: true }}
            inputProps={{ 'data-testid': 'field-end_at' }}
          />
          <TextField
            select
            label={t('events.event_type', 'Type')}
            value={form.event_type}
            onChange={(e) =>
              setForm((f) => ({ ...f, event_type: e.target.value as EventType }))
            }
            fullWidth
            inputProps={{ 'data-testid': 'field-event_type' }}
          >
            {TYPES.map((ty) => (
              <MenuItem key={ty} value={ty}>
                {t(`events.${ty}`, ty)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={t('events.location', 'Location')}
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            fullWidth
            inputProps={{ 'data-testid': 'field-location' }}
          />
          <TextField
            select
            label={t('events.classification', 'Classification')}
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

export function EventsPage() {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const q = useDebounced(search)
  const [sortField, setSortField] = useState<SortField>('start_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const ordering = `${sortDir === 'desc' ? '-' : ''}${sortField}`

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<EventListItem | null>(null)
  const [deleting, setDeleting] = useState<EventListItem | null>(null)

  const queryKey = ['events', q, ordering] as const
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchList({ q, ordering }),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['events'] })

  const createMutation = useMutation({
    mutationFn: (body: EventWriteBody) => create(body),
    onSuccess: () => {
      invalidate()
      setFormOpen(false)
    },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: EventWriteBody }) => update(id, body),
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

  const formInitial: EventWriteBody = useMemo(
    () =>
      editing
        ? {
            title_ar: editing.title_ar,
            title_en: editing.title_en,
            start_at: editing.start_at,
            end_at: editing.end_at,
            event_type: editing.event_type,
            location: editing.location,
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

  const handleSubmit = (body: EventWriteBody) => {
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

  const events: EventListItem[] = data ?? []
  const count = (ty: EventType) => events.filter((e) => e.event_type === ty).length

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
        <Typography variant="h5">{t('nav.events')}</Typography>
        <Chip size="small" label={events.length} variant="outlined" />
      </Stack>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <Box data-testid="kpi-total" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('events.total', 'Total events')}
            value={events.length}
            accent={tokens.gold}
            icon={<EventIcon />}
          />
        </Box>
        <Box data-testid="kpi-meeting" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('events.meeting', 'Meeting')}
            value={count('meeting')}
            accent={tokens.gold}
            icon={<GroupsIcon />}
          />
        </Box>
        <Box data-testid="kpi-deadline" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('events.deadline', 'Deadline')}
            value={count('deadline')}
            accent={tokens.orange}
            icon={<FlagIcon />}
          />
        </Box>
        <Box data-testid="kpi-holiday" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('events.holiday', 'Holiday')}
            value={count('holiday')}
            accent={tokens.green}
            icon={<BeachAccessIcon />}
          />
        </Box>
        <Box data-testid="kpi-operation" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('events.operation', 'Operation')}
            value={count('operation')}
            accent={tokens.red}
            icon={<MyLocationIcon />}
          />
        </Box>
      </Box>

      <SectionCard
        title={t('nav.events')}
        action={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TextField
              size="small"
              placeholder={t('common.searchHere')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              inputProps={{ 'data-testid': 'events-search' }}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
              data-testid="event-new"
            >
              {t('common.new')}
            </Button>
          </Stack>
        }
      >
        <TableContainer>
          <Table data-testid="events-table">
            <TableHead>
              <TableRow>
                <TableCell>{sortHeader('title_en', t('events.title', 'Title'))}</TableCell>
                <TableCell>{sortHeader('start_at', t('events.start_at', 'Starts'))}</TableCell>
                <TableCell>{sortHeader('end_at', t('events.end_at', 'Ends'))}</TableCell>
                <TableCell>{sortHeader('event_type', t('events.event_type', 'Type'))}</TableCell>
                <TableCell>{sortHeader('location', t('events.location', 'Location'))}</TableCell>
                <TableCell>
                  {sortHeader('classification', t('events.classification', 'Classification'))}
                </TableCell>
                <TableCell align="right">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {events.map((e) => (
                <TableRow key={e.id} data-testid="event-row">
                  <TableCell>{ar ? e.title_ar : e.title_en}</TableCell>
                  <TableCell>{e.start_at}</TableCell>
                  <TableCell>{e.end_at}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={TYPE_COLOR[e.event_type]}
                      label={t(`events.${e.event_type}`, e.event_type)}
                    />
                  </TableCell>
                  <TableCell>{e.location}</TableCell>
                  <TableCell>
                    <ClassificationBadge level={e.classification} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      aria-label={t('common.edit')}
                      data-testid="event-edit"
                      onClick={() => {
                        setEditing(e)
                        setFormOpen(true)
                      }}
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={t('common.delete')}
                      data-testid="event-delete"
                      onClick={() => setDeleting(e)}
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

      <EventFormDialog
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
