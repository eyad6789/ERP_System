import AddIcon from '@mui/icons-material/Add'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline'
import SchoolIcon from '@mui/icons-material/School'
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
  type TrainingListItem,
  type TrainingStatus,
  type TrainingWriteBody,
} from '../../api/training'
import { ClassificationBadge } from '../../components/ClassificationBadge'
import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import { tokens } from '../../theme/tokens'

const STATUS_COLOR: Record<TrainingStatus, 'info' | 'success' | 'default'> = {
  upcoming: 'info',
  ongoing: 'success',
  completed: 'default',
}

const STATUSES: TrainingStatus[] = ['upcoming', 'ongoing', 'completed']
const CLEARANCES: ReadonlyArray<1 | 2 | 3 | 4> = [1, 2, 3, 4]

type SortField = 'title_en' | 'category' | 'hours' | 'status' | 'classification'

const EMPTY_FORM: TrainingWriteBody = {
  title_ar: '',
  title_en: '',
  category: '',
  hours: 0,
  status: 'upcoming',
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

function TrainingFormDialog({
  open,
  initial,
  onClose,
  onSubmit,
  pending,
}: {
  open: boolean
  initial: TrainingWriteBody
  onClose: () => void
  onSubmit: (body: TrainingWriteBody) => void
  pending: boolean
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState<TrainingWriteBody>(initial)

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
            label={`${t('training.title', 'Title')} (AR)`}
            value={form.title_ar}
            onChange={(e) => setForm((f) => ({ ...f, title_ar: e.target.value }))}
            required
            fullWidth
            inputProps={{ 'data-testid': 'field-title_ar' }}
          />
          <TextField
            label={`${t('training.title', 'Title')} (EN)`}
            value={form.title_en}
            onChange={(e) => setForm((f) => ({ ...f, title_en: e.target.value }))}
            required
            fullWidth
            inputProps={{ 'data-testid': 'field-title_en' }}
          />
          <TextField
            label={t('training.category', 'Category')}
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            fullWidth
            inputProps={{ 'data-testid': 'field-category' }}
          />
          <TextField
            type="number"
            label={t('training.hours', 'Hours')}
            value={form.hours}
            onChange={(e) => setForm((f) => ({ ...f, hours: Number(e.target.value) }))}
            fullWidth
            inputProps={{ 'data-testid': 'field-hours' }}
          />
          <TextField
            select
            label={t('training.status', 'Status')}
            value={form.status}
            onChange={(e) =>
              setForm((f) => ({ ...f, status: e.target.value as TrainingStatus }))
            }
            fullWidth
            inputProps={{ 'data-testid': 'field-status' }}
          >
            {STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {t(`training.${s}`, s)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={t('training.classification', 'Classification')}
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

export function TrainingPage() {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const q = useDebounced(search)
  const [sortField, setSortField] = useState<SortField>('title_en')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const ordering = `${sortDir === 'desc' ? '-' : ''}${sortField}`

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<TrainingListItem | null>(null)
  const [deleting, setDeleting] = useState<TrainingListItem | null>(null)

  const queryKey = ['training', q, ordering] as const
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchList({ q, ordering }),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['training'] })

  const createMutation = useMutation({
    mutationFn: (body: TrainingWriteBody) => create(body),
    onSuccess: () => {
      invalidate()
      setFormOpen(false)
    },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: TrainingWriteBody }) => update(id, body),
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

  const formInitial: TrainingWriteBody = useMemo(
    () =>
      editing
        ? {
            title_ar: editing.title_ar,
            title_en: editing.title_en,
            category: editing.category,
            hours: editing.hours,
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

  const handleSubmit = (body: TrainingWriteBody) => {
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

  const courses: TrainingListItem[] = data ?? []
  const ongoing = courses.filter((c) => c.status === 'ongoing').length

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
        <Typography variant="h5">{t('nav.training')}</Typography>
        <Chip size="small" label={courses.length} variant="outlined" />
      </Stack>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <Box data-testid="kpi-total" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('training.total', 'Total Courses')}
            value={courses.length}
            accent={tokens.gold}
            icon={<SchoolIcon />}
          />
        </Box>
        <Box data-testid="kpi-ongoing" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('training.ongoing', 'Ongoing')}
            value={ongoing}
            accent={tokens.green}
            icon={<PlayCircleOutlineIcon />}
          />
        </Box>
      </Box>

      <SectionCard
        title={t('nav.training')}
        action={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TextField
              size="small"
              placeholder={t('common.searchHere')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              inputProps={{ 'data-testid': 'training-search' }}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
              data-testid="training-new"
            >
              {t('common.new')}
            </Button>
          </Stack>
        }
      >
        <TableContainer>
          <Table data-testid="training-table">
            <TableHead>
              <TableRow>
                <TableCell>{sortHeader('title_en', t('training.title', 'Title'))}</TableCell>
                <TableCell>{sortHeader('category', t('training.category', 'Category'))}</TableCell>
                <TableCell>{sortHeader('hours', t('training.hours', 'Hours'))}</TableCell>
                <TableCell>{sortHeader('status', t('training.status', 'Status'))}</TableCell>
                <TableCell>
                  {sortHeader('classification', t('training.classification', 'Classification'))}
                </TableCell>
                <TableCell align="right">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {courses.map((c) => (
                <TableRow key={c.id} data-testid="training-row">
                  <TableCell>{ar ? c.title_ar : c.title_en}</TableCell>
                  <TableCell>{c.category}</TableCell>
                  <TableCell>{c.hours}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={STATUS_COLOR[c.status]}
                      label={t(`training.${c.status}`, c.status)}
                    />
                  </TableCell>
                  <TableCell>
                    <ClassificationBadge level={c.classification} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      aria-label={t('common.edit')}
                      data-testid="training-edit"
                      onClick={() => {
                        setEditing(c)
                        setFormOpen(true)
                      }}
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={t('common.delete')}
                      data-testid="training-delete"
                      onClick={() => setDeleting(c)}
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

      <TrainingFormDialog
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
