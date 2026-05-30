import AddIcon from '@mui/icons-material/Add'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import AssessmentIcon from '@mui/icons-material/Assessment'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import StarIcon from '@mui/icons-material/Star'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
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
  type PerformanceListItem,
  type PerformanceRating,
  type PerformanceWriteBody,
} from '../../api/performance'
import { ClassificationBadge } from '../../components/ClassificationBadge'
import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import { tokens } from '../../theme/tokens'

const RATING_COLOR: Record<PerformanceRating, 'success' | 'info' | 'warning'> = {
  outstanding: 'success',
  good: 'info',
  needs_improvement: 'warning',
}

const RATINGS: PerformanceRating[] = ['outstanding', 'good', 'needs_improvement']
const CLEARANCES: ReadonlyArray<1 | 2 | 3 | 4> = [1, 2, 3, 4]

type SortField = 'employee' | 'period' | 'score' | 'rating' | 'classification'

const EMPTY_FORM: PerformanceWriteBody = {
  employee: '',
  period: '',
  score: 0,
  rating: 'good',
  notes: '',
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

function PerformanceFormDialog({
  open,
  initial,
  onClose,
  onSubmit,
  pending,
}: {
  open: boolean
  initial: PerformanceWriteBody
  onClose: () => void
  onSubmit: (body: PerformanceWriteBody) => void
  pending: boolean
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState<PerformanceWriteBody>(initial)

  useEffect(() => {
    if (open) setForm(initial)
  }, [open, initial])

  const valid = form.employee.trim() !== '' && form.period.trim() !== ''

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{initial.employee ? t('common.edit') : t('common.new')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label={t('performance.employee', 'Employee')}
            value={form.employee}
            onChange={(e) => setForm((f) => ({ ...f, employee: e.target.value }))}
            required
            fullWidth
            inputProps={{ 'data-testid': 'field-employee' }}
          />
          <TextField
            label={t('performance.period', 'Period')}
            value={form.period}
            onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
            required
            fullWidth
            inputProps={{ 'data-testid': 'field-period' }}
          />
          <TextField
            type="number"
            label={t('performance.score', 'Score')}
            value={form.score}
            onChange={(e) => setForm((f) => ({ ...f, score: Number(e.target.value) }))}
            fullWidth
            inputProps={{ min: 0, max: 100, 'data-testid': 'field-score' }}
          />
          <TextField
            select
            label={t('performance.rating', 'Rating')}
            value={form.rating}
            onChange={(e) =>
              setForm((f) => ({ ...f, rating: e.target.value as PerformanceRating }))
            }
            fullWidth
            inputProps={{ 'data-testid': 'field-rating' }}
          >
            {RATINGS.map((r) => (
              <MenuItem key={r} value={r}>
                {t(`performance.${r}`, r)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={t('performance.notes', 'Notes')}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            fullWidth
            multiline
            minRows={3}
            inputProps={{ 'data-testid': 'field-notes' }}
          />
          <TextField
            select
            label={t('performance.classification', 'Classification')}
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

export function PerformancePage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const q = useDebounced(search)
  const [sortField, setSortField] = useState<SortField>('employee')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const ordering = `${sortDir === 'desc' ? '-' : ''}${sortField}`

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PerformanceListItem | null>(null)
  const [deleting, setDeleting] = useState<PerformanceListItem | null>(null)

  const queryKey = ['performance', q, ordering] as const
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchList({ q, ordering }),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['performance'] })

  const createMutation = useMutation({
    mutationFn: (body: PerformanceWriteBody) => create(body),
    onSuccess: () => {
      invalidate()
      setFormOpen(false)
    },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: PerformanceWriteBody }) => update(id, body),
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

  const formInitial: PerformanceWriteBody = useMemo(
    () =>
      editing
        ? {
            employee: editing.employee,
            period: editing.period,
            score: editing.score,
            rating: editing.rating,
            notes: '',
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

  const handleSubmit = (body: PerformanceWriteBody) => {
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

  const reviews: PerformanceListItem[] = data ?? []
  const outstanding = reviews.filter((r) => r.rating === 'outstanding').length
  const avgScore = reviews.length
    ? Math.round(reviews.reduce((sum, r) => sum + r.score, 0) / reviews.length)
    : 0

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
        <Typography variant="h5">{t('nav.performance')}</Typography>
        <Chip size="small" label={reviews.length} variant="outlined" />
      </Stack>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <Box data-testid="kpi-total" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('performance.total', 'Total Reviews')}
            value={reviews.length}
            accent={tokens.gold}
            icon={<AssessmentIcon />}
          />
        </Box>
        <Box data-testid="kpi-avg" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('performance.avgScore', 'Average Score')}
            value={avgScore}
            accent={tokens.green}
            icon={<TrendingUpIcon />}
          />
        </Box>
        <Box data-testid="kpi-outstanding" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('performance.outstanding', 'Outstanding')}
            value={outstanding}
            accent={tokens.orange}
            icon={<StarIcon />}
          />
        </Box>
      </Box>

      <SectionCard
        title={t('nav.performance')}
        action={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TextField
              size="small"
              placeholder={t('common.searchHere')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              inputProps={{ 'data-testid': 'performance-search' }}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
              data-testid="performance-new"
            >
              {t('common.new')}
            </Button>
          </Stack>
        }
      >
        <TableContainer>
          <Table data-testid="performance-table">
            <TableHead>
              <TableRow>
                <TableCell>{sortHeader('employee', t('performance.employee', 'Employee'))}</TableCell>
                <TableCell>{sortHeader('period', t('performance.period', 'Period'))}</TableCell>
                <TableCell>{sortHeader('score', t('performance.score', 'Score'))}</TableCell>
                <TableCell>{sortHeader('rating', t('performance.rating', 'Rating'))}</TableCell>
                <TableCell>
                  {sortHeader('classification', t('performance.classification', 'Classification'))}
                </TableCell>
                <TableCell align="right">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reviews.map((r) => (
                <TableRow key={r.id} data-testid="performance-row">
                  <TableCell>{r.employee}</TableCell>
                  <TableCell>{r.period}</TableCell>
                  <TableCell>{r.score}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={RATING_COLOR[r.rating]}
                      label={t(`performance.${r.rating}`, r.rating)}
                    />
                  </TableCell>
                  <TableCell>
                    <ClassificationBadge level={r.classification} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      aria-label={t('common.edit')}
                      data-testid="performance-edit"
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
                      data-testid="performance-delete"
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

      <PerformanceFormDialog
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
