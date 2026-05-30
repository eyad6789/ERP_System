import AddIcon from '@mui/icons-material/Add'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import PaymentsIcon from '@mui/icons-material/Payments'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
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
  createPayslip,
  fetchPayslips,
  removePayslip,
  updatePayslip,
  type PayslipListItem,
  type PayslipWriteBody,
} from '../../api/payroll'
import { ClassificationBadge } from '../../components/ClassificationBadge'
import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import { tokens } from '../../theme/tokens'

const CLEARANCES: ReadonlyArray<1 | 2 | 3 | 4> = [1, 2, 3, 4]

type SortField = 'employee' | 'period' | 'base' | 'net' | 'classification'

const EMPTY_FORM: PayslipWriteBody = {
  employee: '',
  period: '',
  base: 0,
  allowances: 0,
  deductions: 0,
  classification: 1,
}

function toNum(value: string): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

function PayslipFormDialog({
  open,
  initial,
  onClose,
  onSubmit,
  pending,
}: {
  open: boolean
  initial: PayslipWriteBody
  onClose: () => void
  onSubmit: (body: PayslipWriteBody) => void
  pending: boolean
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState<PayslipWriteBody>(initial)

  useEffect(() => {
    if (open) setForm(initial)
  }, [open, initial])

  const valid = form.employee.trim() !== '' && form.period.trim() !== ''
  const net = form.base + form.allowances - form.deductions

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{initial.employee ? t('common.edit') : t('common.new')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label={t('payroll.employee', 'Employee')}
            value={form.employee}
            onChange={(e) => setForm((f) => ({ ...f, employee: e.target.value }))}
            required
            fullWidth
            inputProps={{ 'data-testid': 'field-employee' }}
          />
          <TextField
            label={t('payroll.period', 'Period')}
            value={form.period}
            onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
            required
            fullWidth
            inputProps={{ 'data-testid': 'field-period' }}
          />
          <TextField
            label={t('payroll.base', 'Base')}
            type="number"
            value={form.base}
            onChange={(e) => setForm((f) => ({ ...f, base: toNum(e.target.value) }))}
            fullWidth
            inputProps={{ 'data-testid': 'field-base' }}
          />
          <TextField
            label={t('payroll.allowances', 'Allowances')}
            type="number"
            value={form.allowances}
            onChange={(e) => setForm((f) => ({ ...f, allowances: toNum(e.target.value) }))}
            fullWidth
            inputProps={{ 'data-testid': 'field-allowances' }}
          />
          <TextField
            label={t('payroll.deductions', 'Deductions')}
            type="number"
            value={form.deductions}
            onChange={(e) => setForm((f) => ({ ...f, deductions: toNum(e.target.value) }))}
            fullWidth
            inputProps={{ 'data-testid': 'field-deductions' }}
          />
          <TextField
            label={t('payroll.net', 'Net')}
            value={net}
            InputProps={{ readOnly: true }}
            fullWidth
            inputProps={{ 'data-testid': 'field-net' }}
          />
          <TextField
            select
            label={t('payroll.classification', 'Classification')}
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

export function PayrollPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const q = useDebounced(search)
  const [sortField, setSortField] = useState<SortField>('employee')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const ordering = `${sortDir === 'desc' ? '-' : ''}${sortField}`

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PayslipListItem | null>(null)
  const [deleting, setDeleting] = useState<PayslipListItem | null>(null)

  const queryKey = ['payroll', q, ordering] as const
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchPayslips({ q, ordering }),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['payroll'] })

  const createMutation = useMutation({
    mutationFn: (body: PayslipWriteBody) => createPayslip(body),
    onSuccess: () => {
      invalidate()
      setFormOpen(false)
    },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: PayslipWriteBody }) =>
      updatePayslip(id, body),
    onSuccess: () => {
      invalidate()
      setFormOpen(false)
      setEditing(null)
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => removePayslip(id),
    onSuccess: () => {
      invalidate()
      setDeleting(null)
    },
  })

  const formInitial: PayslipWriteBody = useMemo(
    () =>
      editing
        ? {
            employee: editing.employee,
            period: editing.period,
            base: toNum(editing.base),
            allowances: toNum(editing.allowances),
            deductions: toNum(editing.deductions),
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

  const handleSubmit = (body: PayslipWriteBody) => {
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

  const payslips: PayslipListItem[] = data ?? []
  const totalNet = payslips.reduce((sum, p) => sum + toNum(p.net), 0)

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
        <Typography variant="h5">{t('nav.payroll')}</Typography>
        <Chip size="small" label={payslips.length} variant="outlined" />
      </Stack>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <Box data-testid="kpi-total" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('payroll.total', 'Total Payslips')}
            value={payslips.length}
            accent={tokens.gold}
            icon={<ReceiptLongIcon />}
          />
        </Box>
        <Box data-testid="kpi-net" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('payroll.totalNet', 'Total Net')}
            value={totalNet.toLocaleString()}
            accent={tokens.green}
            icon={<PaymentsIcon />}
          />
        </Box>
      </Box>

      <SectionCard
        title={t('nav.payroll')}
        action={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TextField
              size="small"
              placeholder={t('common.searchHere')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              inputProps={{ 'data-testid': 'payroll-search' }}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
              data-testid="payroll-new"
            >
              {t('common.new')}
            </Button>
          </Stack>
        }
      >
        <TableContainer>
          <Table data-testid="payroll-table">
            <TableHead>
              <TableRow>
                <TableCell>{sortHeader('employee', t('payroll.employee', 'Employee'))}</TableCell>
                <TableCell>{sortHeader('period', t('payroll.period', 'Period'))}</TableCell>
                <TableCell align="right">{sortHeader('base', t('payroll.base', 'Base'))}</TableCell>
                <TableCell align="right">{sortHeader('net', t('payroll.net', 'Net'))}</TableCell>
                <TableCell>
                  {sortHeader('classification', t('payroll.classification', 'Classification'))}
                </TableCell>
                <TableCell align="right">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payslips.map((p) => (
                <TableRow key={p.id} data-testid="payroll-row">
                  <TableCell>{p.employee}</TableCell>
                  <TableCell>{p.period}</TableCell>
                  <TableCell align="right">{p.base}</TableCell>
                  <TableCell align="right">{p.net}</TableCell>
                  <TableCell>
                    <ClassificationBadge level={p.classification} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      aria-label={t('common.edit')}
                      data-testid="payroll-edit"
                      onClick={() => {
                        setEditing(p)
                        setFormOpen(true)
                      }}
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={t('common.delete')}
                      data-testid="payroll-delete"
                      onClick={() => setDeleting(p)}
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

      <PayslipFormDialog
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
