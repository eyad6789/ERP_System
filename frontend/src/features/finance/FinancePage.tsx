import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import AddIcon from '@mui/icons-material/Add'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import CloseIcon from '@mui/icons-material/Close'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import LockIcon from '@mui/icons-material/Lock'
import PaymentsIcon from '@mui/icons-material/Payments'
import SavingsIcon from '@mui/icons-material/Savings'
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts'

import {
  advanceContractStatus,
  createContract,
  fetchContracts,
  fetchFinanceSummary,
  removeContract,
  updateContract,
  type ContractInput,
  type ContractListItem,
} from '../../api/finance'
import { ClassificationBadge } from '../../components/ClassificationBadge'
import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import { tokens } from '../../theme/tokens'

const STATUS_COLOR: Record<string, 'default' | 'info' | 'warning' | 'success' | 'primary'> = {
  signed: 'info',
  in_progress: 'primary',
  under_review: 'warning',
  completed: 'success',
}

const STATUS_OPTIONS = ['signed', 'in_progress', 'under_review', 'completed'] as const
const CLASSIFICATION_OPTIONS = [1, 2, 3, 4] as const

type SortField = 'title_en' | 'vendor' | 'status' | 'progress' | 'value' | 'classification'

function formatAmount(value: string): string {
  const n = Number(value)
  if (Number.isNaN(n)) return value
  return n.toLocaleString()
}

const EMPTY_FORM: ContractInput = {
  title_ar: '',
  title_en: '',
  vendor: '',
  value: '',
  progress: 0,
  status: 'signed',
  classification: 1,
}

function ContractFormDialog({
  initial,
  onClose,
  onSubmit,
  pending,
}: {
  initial: ContractInput
  onClose: () => void
  onSubmit: (body: ContractInput) => void
  pending: boolean
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState<ContractInput>(initial)

  const valid = form.title_ar.trim() !== '' && form.title_en.trim() !== '' && form.vendor.trim() !== ''

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {t('finance.title')}
        <IconButton size="small" onClick={onClose} aria-label="close" sx={{ color: tokens.muted }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label={`${t('finance.title')} (AR)`}
            value={form.title_ar}
            onChange={(e) => setForm({ ...form, title_ar: e.target.value })}
            required
            fullWidth
            inputProps={{ 'data-testid': 'contract-title-ar' }}
          />
          <TextField
            label={`${t('finance.title')} (EN)`}
            value={form.title_en}
            onChange={(e) => setForm({ ...form, title_en: e.target.value })}
            required
            fullWidth
            inputProps={{ 'data-testid': 'contract-title-en' }}
          />
          <TextField
            label={t('finance.vendor')}
            value={form.vendor}
            onChange={(e) => setForm({ ...form, vendor: e.target.value })}
            required
            fullWidth
          />
          <TextField
            label={t('finance.value')}
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
            fullWidth
            inputProps={{ inputMode: 'decimal' }}
          />
          <TextField
            label={t('finance.progress')}
            type="number"
            value={form.progress}
            onChange={(e) =>
              setForm({
                ...form,
                progress: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
              })
            }
            fullWidth
            inputProps={{ min: 0, max: 100 }}
          />
          <Select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            fullWidth
            size="small"
            data-testid="contract-status-select"
          >
            {STATUS_OPTIONS.map((s) => (
              <MenuItem key={s} value={s}>
                {t(`finance.status.${s}`)}
              </MenuItem>
            ))}
          </Select>
          <Select
            value={form.classification}
            onChange={(e) => setForm({ ...form, classification: Number(e.target.value) })}
            fullWidth
            size="small"
            data-testid="contract-classification-select"
          >
            {CLASSIFICATION_OPTIONS.map((c) => (
              <MenuItem key={c} value={c}>
                {t(`clearance.${c}`)}
              </MenuItem>
            ))}
          </Select>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          color="primary"
          disabled={!valid || pending}
          onClick={() => onSubmit(form)}
          data-testid="contract-save"
        >
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function ContractRow({
  contract,
  onEdit,
  onDelete,
  onAdvance,
}: {
  contract: ContractListItem
  onEdit: (c: ContractListItem) => void
  onDelete: (c: ContractListItem) => void
  onAdvance: (c: ContractListItem) => void
}) {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const title = ar ? contract.title_ar : contract.title_en
  const statusColor = STATUS_COLOR[contract.status] ?? 'default'

  return (
    <TableRow data-testid={contract.locked ? 'contract-locked' : 'contract-open'}>
      <TableCell>
        {contract.locked ? (
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: tokens.muted }}>
            <LockIcon sx={{ fontSize: 15 }} />
            <Typography variant="body2" component="span">
              —
            </Typography>
          </Stack>
        ) : (
          title
        )}
      </TableCell>
      <TableCell sx={{ color: contract.locked ? tokens.muted : undefined }}>
        {contract.locked ? '—' : contract.vendor}
      </TableCell>
      <TableCell>
        <Chip size="small" color={statusColor} label={t(`finance.status.${contract.status}`)} />
      </TableCell>
      <TableCell sx={{ minWidth: 160 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ flex: 1 }}>
            <LinearProgress
              variant="determinate"
              value={contract.progress}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: tokens.surface3,
                '& .MuiLinearProgress-bar': { backgroundColor: tokens.gold, borderRadius: 3 },
              }}
            />
          </Box>
          <Typography variant="caption" sx={{ color: tokens.muted, minWidth: 32 }}>
            {contract.progress}%
          </Typography>
        </Stack>
      </TableCell>
      <TableCell align="right" sx={{ color: contract.locked ? tokens.muted : undefined }}>
        {contract.locked || contract.value === null ? '—' : formatAmount(contract.value)}
      </TableCell>
      <TableCell>
        <ClassificationBadge level={contract.classification} />
      </TableCell>
      <TableCell align="right">
        {!contract.locked && (
          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
            <Tooltip title={t('finance.statusLabel')}>
              <span>
                <IconButton
                  size="small"
                  aria-label="advance-status"
                  data-testid="contract-advance"
                  disabled={contract.status === 'completed'}
                  onClick={() => onAdvance(contract)}
                  sx={{ color: tokens.muted }}
                >
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={t('common.edit')}>
              <IconButton
                size="small"
                aria-label="edit"
                data-testid="contract-edit"
                onClick={() => onEdit(contract)}
                sx={{ color: tokens.muted }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('common.delete')}>
              <IconButton
                size="small"
                aria-label="delete"
                data-testid="contract-delete"
                onClick={() => onDelete(contract)}
                sx={{ color: tokens.red }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        )}
      </TableCell>
    </TableRow>
  )
}

export function FinancePage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [sortField, setSortField] = useState<SortField>('title_en')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<ContractListItem | null>(null)
  const [deleting, setDeleting] = useState<ContractListItem | null>(null)

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  const ordering = useMemo(
    () => `${sortDir === 'desc' ? '-' : ''}${sortField}`,
    [sortField, sortDir],
  )

  const summaryQuery = useQuery({ queryKey: ['finance-summary'], queryFn: fetchFinanceSummary })
  const contractsQuery = useQuery({
    queryKey: ['finance-contracts', debouncedQ, ordering],
    queryFn: () => fetchContracts({ q: debouncedQ, ordering }),
  })

  const invalidateList = () =>
    queryClient.invalidateQueries({ queryKey: ['finance-contracts'] })

  const createMutation = useMutation({
    mutationFn: (body: ContractInput) => createContract(body),
    onSuccess: () => {
      setCreateOpen(false)
      invalidateList()
    },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: ContractInput }) => updateContract(id, body),
    onSuccess: () => {
      setEditing(null)
      invalidateList()
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => removeContract(id),
    onSuccess: () => {
      setDeleting(null)
      invalidateList()
    },
  })
  const advanceMutation = useMutation({
    mutationFn: (id: number) => advanceContractStatus(id),
    onSuccess: () => invalidateList(),
  })

  const toggleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const sortIndicator = (field: SortField) =>
    field === sortField ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''

  if (summaryQuery.isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  const summary = summaryQuery.data
  const contracts = contractsQuery.data ?? []
  const chartData = (summary?.by_department ?? []).map((d) => ({
    department: d.department_code,
    amount: Number(d.amount),
  }))

  const editInitial: ContractInput | null = editing
    ? {
        title_ar: editing.title_ar ?? '',
        title_en: editing.title_en ?? '',
        vendor: editing.vendor ?? '',
        value: editing.value ?? '',
        progress: editing.progress,
        status: editing.status,
        classification: editing.classification,
      }
    : null

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Typography variant="h5">{t('nav.finance')}</Typography>
        <Chip size="small" variant="outlined" label={contracts.length} />
      </Stack>

      {summary && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <Box data-testid="finance-kpi" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
            <StatCard
              label={t('finance.total')}
              value={formatAmount(summary.total_amount)}
              accent={tokens.gold}
              icon={<AccountBalanceWalletIcon />}
            />
          </Box>
          <Box data-testid="finance-kpi" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
            <StatCard
              label={t('finance.spent')}
              value={formatAmount(summary.spent)}
              accent={tokens.orange}
              icon={<PaymentsIcon />}
            />
          </Box>
          <Box data-testid="finance-kpi" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
            <StatCard
              label={t('finance.remaining')}
              value={formatAmount(summary.remaining)}
              accent={tokens.green}
              icon={<SavingsIcon />}
            />
          </Box>
        </Box>
      )}

      {chartData.length > 0 && (
        <SectionCard title={t('finance.byDepartment')}>
          <Box data-testid="finance-chart" sx={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <defs>
                  <linearGradient id="financeBarGold" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={tokens.goldBright} />
                    <stop offset="100%" stopColor={tokens.gold} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={tokens.border} strokeDasharray="3 3" />
                <XAxis
                  dataKey="department"
                  stroke={tokens.muted}
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis stroke={tokens.muted} fontSize={12} tickLine={false} />
                <RTooltip
                  contentStyle={{
                    background: tokens.surface2,
                    border: `1px solid ${tokens.border}`,
                    borderRadius: 8,
                    color: tokens.text,
                  }}
                  cursor={{ fill: 'rgba(201,162,39,0.06)' }}
                />
                <Bar dataKey="amount" fill="url(#financeBarGold)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </SectionCard>
      )}

      <SectionCard
        title={t('finance.statusLabel')}
        action={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TextField
              size="small"
              placeholder={t('common.searchHere')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              inputProps={{ 'data-testid': 'finance-search' }}
            />
            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setCreateOpen(true)}
              data-testid="finance-new"
            >
              {t('common.new')}
            </Button>
          </Stack>
        }
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell
                onClick={() => toggleSort('title_en')}
                sx={{ cursor: 'pointer', userSelect: 'none' }}
              >
                {t('finance.title')}
                {sortIndicator('title_en')}
              </TableCell>
              <TableCell
                onClick={() => toggleSort('vendor')}
                sx={{ cursor: 'pointer', userSelect: 'none' }}
              >
                {t('finance.vendor')}
                {sortIndicator('vendor')}
              </TableCell>
              <TableCell
                onClick={() => toggleSort('status')}
                sx={{ cursor: 'pointer', userSelect: 'none' }}
              >
                {t('finance.statusLabel')}
                {sortIndicator('status')}
              </TableCell>
              <TableCell
                onClick={() => toggleSort('progress')}
                sx={{ cursor: 'pointer', userSelect: 'none' }}
              >
                {t('finance.progress')}
                {sortIndicator('progress')}
              </TableCell>
              <TableCell
                align="right"
                onClick={() => toggleSort('value')}
                sx={{ cursor: 'pointer', userSelect: 'none' }}
              >
                {t('finance.value')}
                {sortIndicator('value')}
              </TableCell>
              <TableCell
                onClick={() => toggleSort('classification')}
                sx={{ cursor: 'pointer', userSelect: 'none' }}
              >
                {t('finance.classification')}
                {sortIndicator('classification')}
              </TableCell>
              <TableCell align="right">{t('common.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {contracts.map((c) => (
              <ContractRow
                key={c.id}
                contract={c}
                onEdit={setEditing}
                onDelete={setDeleting}
                onAdvance={(ct) => advanceMutation.mutate(ct.id)}
              />
            ))}
          </TableBody>
        </Table>
      </SectionCard>

      {createOpen && (
        <ContractFormDialog
          initial={EMPTY_FORM}
          pending={createMutation.isPending}
          onClose={() => setCreateOpen(false)}
          onSubmit={(body) => createMutation.mutate(body)}
        />
      )}

      {editing && editInitial && (
        <ContractFormDialog
          initial={editInitial}
          pending={updateMutation.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(body) => updateMutation.mutate({ id: editing.id, body })}
        />
      )}

      <Dialog open={deleting !== null} onClose={() => setDeleting(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('common.delete')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('common.confirmDelete')}</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleting(null)} color="inherit">
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={deleteMutation.isPending}
            onClick={() => deleting && deleteMutation.mutate(deleting.id)}
            data-testid="contract-confirm-delete"
          >
            {t('common.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
