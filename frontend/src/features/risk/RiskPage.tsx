import AddIcon from '@mui/icons-material/Add'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import LockOpenIcon from '@mui/icons-material/LockOpen'
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
  createRisk,
  fetchRisks,
  removeRisk,
  updateRisk,
  type RiskListItem,
  type RiskStatus,
  type RiskWriteBody,
} from '../../api/risk'
import { ClassificationBadge } from '../../components/ClassificationBadge'
import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import { tokens } from '../../theme/tokens'

const STATUS_COLOR: Record<RiskStatus, 'error' | 'warning' | 'success'> = {
  open: 'error',
  mitigating: 'warning',
  closed: 'success',
}

const STATUSES: RiskStatus[] = ['open', 'mitigating', 'closed']
const SCALE: ReadonlyArray<1 | 2 | 3 | 4 | 5> = [1, 2, 3, 4, 5]
const CLEARANCES: ReadonlyArray<1 | 2 | 3 | 4> = [1, 2, 3, 4]

type SortField = 'title_en' | 'likelihood' | 'impact' | 'score' | 'status' | 'classification'

const EMPTY_FORM: RiskWriteBody = {
  title_ar: '',
  title_en: '',
  likelihood: 1,
  impact: 1,
  status: 'open',
  mitigation: '',
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

function ScoreChip({ score }: { score: number }) {
  const high = score >= 15
  return (
    <Chip
      size="small"
      label={score}
      sx={{
        fontWeight: 700,
        color: high ? tokens.red : score >= 8 ? tokens.orange : tokens.green,
        borderColor: high ? tokens.red : score >= 8 ? tokens.orange : tokens.green,
      }}
      variant="outlined"
    />
  )
}

function RiskFormDialog({
  open,
  initial,
  onClose,
  onSubmit,
  pending,
}: {
  open: boolean
  initial: RiskWriteBody
  onClose: () => void
  onSubmit: (body: RiskWriteBody) => void
  pending: boolean
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState<RiskWriteBody>(initial)

  useEffect(() => {
    if (open) setForm(initial)
  }, [open, initial])

  const valid = form.title_ar.trim() !== '' && form.title_en.trim() !== ''
  const score = form.likelihood * form.impact

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{initial.title_en ? t('common.edit') : t('common.new')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label={`${t('risk.title', 'Title')} (AR)`}
            value={form.title_ar}
            onChange={(e) => setForm((f) => ({ ...f, title_ar: e.target.value }))}
            required
            fullWidth
            inputProps={{ 'data-testid': 'field-title_ar' }}
          />
          <TextField
            label={`${t('risk.title', 'Title')} (EN)`}
            value={form.title_en}
            onChange={(e) => setForm((f) => ({ ...f, title_en: e.target.value }))}
            required
            fullWidth
            inputProps={{ 'data-testid': 'field-title_en' }}
          />
          <Stack direction="row" spacing={2}>
            <TextField
              select
              label={t('risk.likelihood', 'Likelihood')}
              value={form.likelihood}
              onChange={(e) =>
                setForm((f) => ({ ...f, likelihood: Number(e.target.value) }))
              }
              fullWidth
              inputProps={{ 'data-testid': 'field-likelihood' }}
            >
              {SCALE.map((n) => (
                <MenuItem key={n} value={n}>
                  {n}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={t('risk.impact', 'Impact')}
              value={form.impact}
              onChange={(e) => setForm((f) => ({ ...f, impact: Number(e.target.value) }))}
              fullWidth
              inputProps={{ 'data-testid': 'field-impact' }}
            >
              {SCALE.map((n) => (
                <MenuItem key={n} value={n}>
                  {n}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" sx={{ color: tokens.muted }}>
              {t('risk.score', 'Score')}
            </Typography>
            <ScoreChip score={score} />
          </Stack>
          <TextField
            select
            label={t('risk.status', 'Status')}
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as RiskStatus }))}
            fullWidth
            inputProps={{ 'data-testid': 'field-status' }}
          >
            {STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {t(`risk.${s}`, s)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={t('risk.mitigation', 'Mitigation')}
            value={form.mitigation}
            onChange={(e) => setForm((f) => ({ ...f, mitigation: e.target.value }))}
            fullWidth
            multiline
            minRows={3}
            inputProps={{ 'data-testid': 'field-mitigation' }}
          />
          <TextField
            select
            label={t('risk.classification', 'Classification')}
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

export function RiskPage() {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const q = useDebounced(search)
  const [sortField, setSortField] = useState<SortField>('score')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const ordering = `${sortDir === 'desc' ? '-' : ''}${sortField}`

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<RiskListItem | null>(null)
  const [deleting, setDeleting] = useState<RiskListItem | null>(null)

  const queryKey = ['risk', q, ordering] as const
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchRisks({ q, ordering }),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['risk'] })

  const createMutation = useMutation({
    mutationFn: (body: RiskWriteBody) => createRisk(body),
    onSuccess: () => {
      invalidate()
      setFormOpen(false)
    },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: RiskWriteBody }) => updateRisk(id, body),
    onSuccess: () => {
      invalidate()
      setFormOpen(false)
      setEditing(null)
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => removeRisk(id),
    onSuccess: () => {
      invalidate()
      setDeleting(null)
    },
  })

  const formInitial: RiskWriteBody = useMemo(
    () =>
      editing
        ? {
            title_ar: editing.title_ar,
            title_en: editing.title_en,
            likelihood: editing.likelihood,
            impact: editing.impact,
            status: editing.status,
            mitigation: '',
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

  const handleSubmit = (body: RiskWriteBody) => {
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

  const risks: RiskListItem[] = data ?? []
  const openCount = risks.filter((r) => r.status === 'open').length
  const highCount = risks.filter((r) => r.score >= 15).length

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
        <Typography variant="h5">{t('nav.risk')}</Typography>
        <Chip size="small" label={risks.length} variant="outlined" />
      </Stack>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <Box data-testid="kpi-total" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('risk.total', 'Total')}
            value={risks.length}
            accent={tokens.gold}
            icon={<ReportProblemIcon />}
          />
        </Box>
        <Box data-testid="kpi-open" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('risk.open', 'Open')}
            value={openCount}
            accent={tokens.orange}
            icon={<LockOpenIcon />}
          />
        </Box>
        <Box data-testid="kpi-high" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('risk.high', 'High')}
            value={highCount}
            accent={tokens.red}
            icon={<WarningAmberIcon />}
          />
        </Box>
      </Box>

      <SectionCard
        title={t('nav.risk')}
        action={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TextField
              size="small"
              placeholder={t('common.searchHere')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              inputProps={{ 'data-testid': 'risk-search' }}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
              data-testid="risk-new"
            >
              {t('common.new')}
            </Button>
          </Stack>
        }
      >
        <TableContainer>
          <Table data-testid="risk-table">
            <TableHead>
              <TableRow>
                <TableCell>{sortHeader('title_en', t('risk.title', 'Title'))}</TableCell>
                <TableCell>{sortHeader('likelihood', t('risk.likelihood', 'Likelihood'))}</TableCell>
                <TableCell>{sortHeader('impact', t('risk.impact', 'Impact'))}</TableCell>
                <TableCell>{sortHeader('score', t('risk.score', 'Score'))}</TableCell>
                <TableCell>{sortHeader('status', t('risk.status', 'Status'))}</TableCell>
                <TableCell>
                  {sortHeader('classification', t('risk.classification', 'Classification'))}
                </TableCell>
                <TableCell align="right">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {risks.map((r) => (
                <TableRow key={r.id} data-testid="risk-row">
                  <TableCell>{ar ? r.title_ar : r.title_en}</TableCell>
                  <TableCell>{r.likelihood}</TableCell>
                  <TableCell>{r.impact}</TableCell>
                  <TableCell>
                    <ScoreChip score={r.score} />
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={STATUS_COLOR[r.status]}
                      label={t(`risk.${r.status}`, r.status)}
                    />
                  </TableCell>
                  <TableCell>
                    <ClassificationBadge level={r.classification} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      aria-label={t('common.edit')}
                      data-testid="risk-edit"
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
                      data-testid="risk-delete"
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

      <RiskFormDialog
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
