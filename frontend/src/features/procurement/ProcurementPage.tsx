import AddIcon from '@mui/icons-material/Add'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import PaymentsIcon from '@mui/icons-material/Payments'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import StorefrontIcon from '@mui/icons-material/Storefront'
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
  fetchVendors,
  remove,
  update,
  type PurchaseOrderListItem,
  type PurchaseOrderStatus,
  type PurchaseOrderWriteBody,
  type VendorListItem,
} from '../../api/procurement'
import { ClassificationBadge } from '../../components/ClassificationBadge'
import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import { tokens } from '../../theme/tokens'

const STATUS_COLOR: Record<PurchaseOrderStatus, 'default' | 'info' | 'success' | 'warning'> = {
  draft: 'default',
  approved: 'info',
  received: 'success',
  closed: 'warning',
}

const STATUSES: PurchaseOrderStatus[] = ['draft', 'approved', 'received', 'closed']
const CLEARANCES: ReadonlyArray<1 | 2 | 3 | 4> = [1, 2, 3, 4]

type SortField = 'title_en' | 'total' | 'status' | 'classification'

const EMPTY_FORM: PurchaseOrderWriteBody = {
  vendor: '',
  title_ar: '',
  title_en: '',
  total: '',
  status: 'draft',
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

function ProcurementFormDialog({
  open,
  initial,
  vendors,
  ar,
  onClose,
  onSubmit,
  pending,
}: {
  open: boolean
  initial: PurchaseOrderWriteBody
  vendors: VendorListItem[]
  ar: boolean
  onClose: () => void
  onSubmit: (body: PurchaseOrderWriteBody) => void
  pending: boolean
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState<PurchaseOrderWriteBody>(initial)

  useEffect(() => {
    if (open) setForm(initial)
  }, [open, initial])

  const valid =
    form.title_ar.trim() !== '' && form.title_en.trim() !== '' && form.vendor !== ''

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{initial.title_en ? t('common.edit') : t('common.new')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label={`${t('procurement.title', 'Title')} (AR)`}
            value={form.title_ar}
            onChange={(e) => setForm((f) => ({ ...f, title_ar: e.target.value }))}
            required
            fullWidth
            inputProps={{ 'data-testid': 'field-title_ar' }}
          />
          <TextField
            label={`${t('procurement.title', 'Title')} (EN)`}
            value={form.title_en}
            onChange={(e) => setForm((f) => ({ ...f, title_en: e.target.value }))}
            required
            fullWidth
            inputProps={{ 'data-testid': 'field-title_en' }}
          />
          <TextField
            select
            label={t('procurement.vendor', 'Vendor')}
            value={form.vendor === '' ? '' : String(form.vendor)}
            onChange={(e) =>
              setForm((f) => ({ ...f, vendor: e.target.value === '' ? '' : Number(e.target.value) }))
            }
            required
            fullWidth
            inputProps={{ 'data-testid': 'field-vendor' }}
          >
            {vendors.map((v) => (
              <MenuItem key={v.id} value={String(v.id)}>
                {ar ? v.name_ar : v.name_en}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={t('procurement.total', 'Total')}
            type="number"
            value={form.total}
            onChange={(e) => setForm((f) => ({ ...f, total: e.target.value }))}
            fullWidth
            inputProps={{ 'data-testid': 'field-total' }}
          />
          <TextField
            select
            label={t('procurement.status', 'Status')}
            value={form.status}
            onChange={(e) =>
              setForm((f) => ({ ...f, status: e.target.value as PurchaseOrderStatus }))
            }
            fullWidth
            inputProps={{ 'data-testid': 'field-status' }}
          >
            {STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {t(`procurement.${s}`, s)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={t('procurement.classification', 'Classification')}
            value={form.classification}
            onChange={(e) => setForm((f) => ({ ...f, classification: Number(e.target.value) }))}
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

export function ProcurementPage() {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const q = useDebounced(search)
  const [sortField, setSortField] = useState<SortField>('title_en')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const ordering = `${sortDir === 'desc' ? '-' : ''}${sortField}`

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PurchaseOrderListItem | null>(null)
  const [deleting, setDeleting] = useState<PurchaseOrderListItem | null>(null)

  const queryKey = ['procurement', q, ordering] as const
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchList({ q, ordering }),
  })
  const { data: vendorsData } = useQuery({
    queryKey: ['procurement-vendors'],
    queryFn: () => fetchVendors(),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['procurement'] })

  const createMutation = useMutation({
    mutationFn: (body: PurchaseOrderWriteBody) => create(body),
    onSuccess: () => {
      invalidate()
      setFormOpen(false)
    },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: PurchaseOrderWriteBody }) => update(id, body),
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

  const formInitial: PurchaseOrderWriteBody = useMemo(
    () =>
      editing
        ? {
            vendor: editing.vendor,
            title_ar: editing.title_ar,
            title_en: editing.title_en,
            total: editing.total,
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

  const handleSubmit = (body: PurchaseOrderWriteBody) => {
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

  const orders: PurchaseOrderListItem[] = data ?? []
  const vendors: VendorListItem[] = vendorsData ?? []
  const totalValue = orders.reduce((sum, o) => sum + Number(o.total || 0), 0)
  const vendorCount = new Set(orders.map((o) => o.vendor)).size

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
        <Typography variant="h5">{t('nav.procurement')}</Typography>
        <Chip size="small" label={orders.length} variant="outlined" />
      </Stack>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <Box data-testid="kpi-total" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('procurement.totalOrders', 'Purchase Orders')}
            value={orders.length}
            accent={tokens.gold}
            icon={<ReceiptLongIcon />}
          />
        </Box>
        <Box data-testid="kpi-value" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('procurement.totalValue', 'Total Value')}
            value={totalValue.toLocaleString()}
            accent={tokens.green}
            icon={<PaymentsIcon />}
          />
        </Box>
        <Box data-testid="kpi-vendors" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('procurement.vendorsCount', 'Vendors')}
            value={vendorCount}
            accent={tokens.cyan}
            icon={<StorefrontIcon />}
          />
        </Box>
      </Box>

      <SectionCard
        title={t('nav.procurement')}
        action={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TextField
              size="small"
              placeholder={t('common.searchHere')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              inputProps={{ 'data-testid': 'procurement-search' }}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
              data-testid="procurement-new"
            >
              {t('common.new')}
            </Button>
          </Stack>
        }
      >
        <TableContainer>
          <Table data-testid="procurement-table">
            <TableHead>
              <TableRow>
                <TableCell>{sortHeader('title_en', t('procurement.title', 'Title'))}</TableCell>
                <TableCell>{t('procurement.vendor', 'Vendor')}</TableCell>
                <TableCell>{sortHeader('total', t('procurement.total', 'Total'))}</TableCell>
                <TableCell>{sortHeader('status', t('procurement.status', 'Status'))}</TableCell>
                <TableCell>
                  {sortHeader('classification', t('procurement.classification', 'Classification'))}
                </TableCell>
                <TableCell align="right">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id} data-testid="procurement-row">
                  <TableCell>{ar ? o.title_ar : o.title_en}</TableCell>
                  <TableCell>{ar ? o.vendor_name_ar : o.vendor_name_en}</TableCell>
                  <TableCell>{Number(o.total || 0).toLocaleString()}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={STATUS_COLOR[o.status]}
                      label={t(`procurement.${o.status}`, o.status)}
                    />
                  </TableCell>
                  <TableCell>
                    <ClassificationBadge level={o.classification} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      aria-label={t('common.edit')}
                      data-testid="procurement-edit"
                      onClick={() => {
                        setEditing(o)
                        setFormOpen(true)
                      }}
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={t('common.delete')}
                      data-testid="procurement-delete"
                      onClick={() => setDeleting(o)}
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

      <ProcurementFormDialog
        open={formOpen}
        initial={formInitial}
        vendors={vendors}
        ar={ar}
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
