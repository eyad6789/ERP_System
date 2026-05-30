import AddIcon from '@mui/icons-material/Add'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import DescriptionIcon from '@mui/icons-material/Description'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import PaidIcon from '@mui/icons-material/Paid'
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
  createContract,
  fetchContracts,
  removeContract,
  updateContract,
  type ContractListItem,
  type ContractStatus,
  type ContractWriteBody,
} from '../../api/contracts'
import { ClassificationBadge } from '../../components/ClassificationBadge'
import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import { tokens } from '../../theme/tokens'

const STATUS_COLOR: Record<ContractStatus, 'success' | 'error' | 'info'> = {
  active: 'success',
  expired: 'error',
  renewed: 'info',
}

const STATUSES: ContractStatus[] = ['active', 'expired', 'renewed']
const CLEARANCES: ReadonlyArray<1 | 2 | 3 | 4> = [1, 2, 3, 4]

type SortField = 'title_en' | 'party' | 'value' | 'end_date' | 'status' | 'classification'

const EMPTY_FORM: ContractWriteBody = {
  title_ar: '',
  title_en: '',
  party: '',
  value: '0',
  start_date: '',
  end_date: '',
  status: 'active',
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

function ContractFormDialog({
  open,
  initial,
  onClose,
  onSubmit,
  pending,
}: {
  open: boolean
  initial: ContractWriteBody
  onClose: () => void
  onSubmit: (body: ContractWriteBody) => void
  pending: boolean
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState<ContractWriteBody>(initial)

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
            label={`${t('contracts.title', 'Title')} (AR)`}
            value={form.title_ar}
            onChange={(e) => setForm((f) => ({ ...f, title_ar: e.target.value }))}
            required
            fullWidth
            inputProps={{ 'data-testid': 'field-title_ar' }}
          />
          <TextField
            label={`${t('contracts.title', 'Title')} (EN)`}
            value={form.title_en}
            onChange={(e) => setForm((f) => ({ ...f, title_en: e.target.value }))}
            required
            fullWidth
            inputProps={{ 'data-testid': 'field-title_en' }}
          />
          <TextField
            label={t('contracts.party', 'Party')}
            value={form.party}
            onChange={(e) => setForm((f) => ({ ...f, party: e.target.value }))}
            fullWidth
            inputProps={{ 'data-testid': 'field-party' }}
          />
          <TextField
            type="number"
            label={t('contracts.value', 'Value')}
            value={form.value}
            onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
            fullWidth
            inputProps={{ 'data-testid': 'field-value' }}
          />
          <TextField
            type="date"
            label={t('contracts.start_date', 'Start Date')}
            value={form.start_date}
            onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
            fullWidth
            InputLabelProps={{ shrink: true }}
            inputProps={{ 'data-testid': 'field-start_date' }}
          />
          <TextField
            type="date"
            label={t('contracts.end_date', 'End Date')}
            value={form.end_date}
            onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
            fullWidth
            InputLabelProps={{ shrink: true }}
            inputProps={{ 'data-testid': 'field-end_date' }}
          />
          <TextField
            select
            label={t('contracts.status', 'Status')}
            value={form.status}
            onChange={(e) =>
              setForm((f) => ({ ...f, status: e.target.value as ContractStatus }))
            }
            fullWidth
            inputProps={{ 'data-testid': 'field-status' }}
          >
            {STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {t(`contracts.${s}`, s)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={t('contracts.classification', 'Classification')}
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

export function ContractsPage() {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const q = useDebounced(search)
  const [sortField, setSortField] = useState<SortField>('title_en')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const ordering = `${sortDir === 'desc' ? '-' : ''}${sortField}`

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ContractListItem | null>(null)
  const [deleting, setDeleting] = useState<ContractListItem | null>(null)

  const queryKey = ['contracts', q, ordering] as const
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchContracts({ q, ordering }),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['contracts'] })

  const createMutation = useMutation({
    mutationFn: (body: ContractWriteBody) => createContract(body),
    onSuccess: () => {
      invalidate()
      setFormOpen(false)
    },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: ContractWriteBody }) =>
      updateContract(id, body),
    onSuccess: () => {
      invalidate()
      setFormOpen(false)
      setEditing(null)
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => removeContract(id),
    onSuccess: () => {
      invalidate()
      setDeleting(null)
    },
  })

  const formInitial: ContractWriteBody = useMemo(
    () =>
      editing
        ? {
            title_ar: editing.title_ar,
            title_en: editing.title_en,
            party: editing.party,
            value: editing.value,
            start_date: editing.start_date,
            end_date: editing.end_date,
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

  const handleSubmit = (body: ContractWriteBody) => {
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

  const contracts: ContractListItem[] = data ?? []
  const activeCount = contracts.filter((c) => c.status === 'active').length
  const totalValue = contracts.reduce((sum, c) => sum + Number(c.value), 0)

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
        <Typography variant="h5">{t('nav.contracts')}</Typography>
        <Chip size="small" label={contracts.length} variant="outlined" />
      </Stack>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <Box data-testid="kpi-total" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('contracts.total', 'Total Contracts')}
            value={contracts.length}
            accent={tokens.gold}
            icon={<DescriptionIcon />}
          />
        </Box>
        <Box data-testid="kpi-active" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('contracts.active', 'Active')}
            value={activeCount}
            accent={tokens.green}
            icon={<CheckCircleIcon />}
          />
        </Box>
        <Box data-testid="kpi-value" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('contracts.totalValue', 'Total Value')}
            value={totalValue.toLocaleString()}
            accent={tokens.cyan}
            icon={<PaidIcon />}
          />
        </Box>
      </Box>

      <SectionCard
        title={t('nav.contracts')}
        action={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TextField
              size="small"
              placeholder={t('common.searchHere')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              inputProps={{ 'data-testid': 'contracts-search' }}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
              data-testid="contract-new"
            >
              {t('common.new')}
            </Button>
          </Stack>
        }
      >
        <TableContainer>
          <Table data-testid="contracts-table">
            <TableHead>
              <TableRow>
                <TableCell>{sortHeader('title_en', t('contracts.title', 'Title'))}</TableCell>
                <TableCell>{sortHeader('party', t('contracts.party', 'Party'))}</TableCell>
                <TableCell>{sortHeader('value', t('contracts.value', 'Value'))}</TableCell>
                <TableCell>{sortHeader('end_date', t('contracts.end_date', 'End Date'))}</TableCell>
                <TableCell>{sortHeader('status', t('contracts.status', 'Status'))}</TableCell>
                <TableCell>
                  {sortHeader('classification', t('contracts.classification', 'Classification'))}
                </TableCell>
                <TableCell align="right">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {contracts.map((c) => (
                <TableRow key={c.id} data-testid="contract-row">
                  <TableCell>{ar ? c.title_ar : c.title_en}</TableCell>
                  <TableCell>{c.party}</TableCell>
                  <TableCell>{Number(c.value).toLocaleString()}</TableCell>
                  <TableCell>{c.end_date}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={STATUS_COLOR[c.status]}
                      label={t(`contracts.${c.status}`, c.status)}
                    />
                  </TableCell>
                  <TableCell>
                    <ClassificationBadge level={c.classification} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      aria-label={t('common.edit')}
                      data-testid="contract-edit"
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
                      data-testid="contract-delete"
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

      <ContractFormDialog
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
