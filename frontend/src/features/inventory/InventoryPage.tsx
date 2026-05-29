import AddIcon from '@mui/icons-material/Add'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import WarehouseIcon from '@mui/icons-material/Warehouse'
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
  createInventoryItem,
  fetchInventory,
  removeInventoryItem,
  updateInventoryItem,
  type InventoryListItem,
  type InventoryWriteBody,
} from '../../api/inventory'
import { ClassificationBadge } from '../../components/ClassificationBadge'
import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import { tokens } from '../../theme/tokens'

const CLEARANCES: ReadonlyArray<1 | 2 | 3 | 4> = [1, 2, 3, 4]
const LOW_STOCK_THRESHOLD = 10

type SortField = 'sku' | 'name_en' | 'quantity' | 'unit' | 'warehouse' | 'classification'

const EMPTY_FORM: InventoryWriteBody = {
  sku: '',
  name_ar: '',
  name_en: '',
  quantity: 0,
  unit: '',
  warehouse: '',
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

function InventoryFormDialog({
  open,
  initial,
  onClose,
  onSubmit,
  pending,
}: {
  open: boolean
  initial: InventoryWriteBody
  onClose: () => void
  onSubmit: (body: InventoryWriteBody) => void
  pending: boolean
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState<InventoryWriteBody>(initial)

  useEffect(() => {
    if (open) setForm(initial)
  }, [open, initial])

  const valid =
    form.sku.trim() !== '' && form.name_ar.trim() !== '' && form.name_en.trim() !== ''

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{initial.name_en ? t('common.edit') : t('common.new')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label={t('inventory.sku', 'SKU')}
            value={form.sku}
            onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
            required
            fullWidth
            inputProps={{ 'data-testid': 'field-sku' }}
          />
          <TextField
            label={`${t('inventory.name', 'Name')} (AR)`}
            value={form.name_ar}
            onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))}
            required
            fullWidth
            inputProps={{ 'data-testid': 'field-name_ar' }}
          />
          <TextField
            label={`${t('inventory.name', 'Name')} (EN)`}
            value={form.name_en}
            onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
            required
            fullWidth
            inputProps={{ 'data-testid': 'field-name_en' }}
          />
          <TextField
            label={t('inventory.quantity', 'Quantity')}
            type="number"
            value={form.quantity}
            onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
            fullWidth
            inputProps={{ 'data-testid': 'field-quantity' }}
          />
          <TextField
            label={t('inventory.unit', 'Unit')}
            value={form.unit}
            onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
            fullWidth
            inputProps={{ 'data-testid': 'field-unit' }}
          />
          <TextField
            label={t('inventory.warehouse', 'Warehouse')}
            value={form.warehouse}
            onChange={(e) => setForm((f) => ({ ...f, warehouse: e.target.value }))}
            fullWidth
            inputProps={{ 'data-testid': 'field-warehouse' }}
          />
          <TextField
            select
            label={t('inventory.classification', 'Classification')}
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

export function InventoryPage() {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const q = useDebounced(search)
  const [sortField, setSortField] = useState<SortField>('name_en')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const ordering = `${sortDir === 'desc' ? '-' : ''}${sortField}`

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<InventoryListItem | null>(null)
  const [deleting, setDeleting] = useState<InventoryListItem | null>(null)

  const queryKey = ['inventory', q, ordering] as const
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchInventory({ q, ordering }),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['inventory'] })

  const createMutation = useMutation({
    mutationFn: (body: InventoryWriteBody) => createInventoryItem(body),
    onSuccess: () => {
      invalidate()
      setFormOpen(false)
    },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: InventoryWriteBody }) =>
      updateInventoryItem(id, body),
    onSuccess: () => {
      invalidate()
      setFormOpen(false)
      setEditing(null)
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => removeInventoryItem(id),
    onSuccess: () => {
      invalidate()
      setDeleting(null)
    },
  })

  const formInitial: InventoryWriteBody = useMemo(
    () =>
      editing
        ? {
            sku: editing.sku,
            name_ar: editing.name_ar,
            name_en: editing.name_en,
            quantity: editing.quantity,
            unit: editing.unit,
            warehouse: editing.warehouse,
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

  const handleSubmit = (body: InventoryWriteBody) => {
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

  const items: InventoryListItem[] = data ?? []
  const lowStock = items.filter((i) => i.quantity < LOW_STOCK_THRESHOLD).length
  const warehouses = new Set(items.map((i) => i.warehouse).filter((w) => w !== '')).size

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
        <Typography variant="h5">{t('nav.inventory')}</Typography>
        <Chip size="small" label={items.length} variant="outlined" />
      </Stack>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <Box data-testid="kpi-total" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('inventory.total', 'Total Items')}
            value={items.length}
            accent={tokens.gold}
            icon={<Inventory2Icon />}
          />
        </Box>
        <Box data-testid="kpi-low" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('inventory.lowStock', 'Low Stock')}
            value={lowStock}
            accent={tokens.red}
            icon={<WarningAmberIcon />}
          />
        </Box>
        <Box data-testid="kpi-warehouses" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('inventory.warehouses', 'Warehouses')}
            value={warehouses}
            accent={tokens.cyan}
            icon={<WarehouseIcon />}
          />
        </Box>
      </Box>

      <SectionCard
        title={t('nav.inventory')}
        action={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TextField
              size="small"
              placeholder={t('common.searchHere')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              inputProps={{ 'data-testid': 'inventory-search' }}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
              data-testid="inventory-new"
            >
              {t('common.new')}
            </Button>
          </Stack>
        }
      >
        <TableContainer>
          <Table data-testid="inventory-table">
            <TableHead>
              <TableRow>
                <TableCell>{sortHeader('sku', t('inventory.sku', 'SKU'))}</TableCell>
                <TableCell>{sortHeader('name_en', t('inventory.name', 'Name'))}</TableCell>
                <TableCell>{sortHeader('quantity', t('inventory.quantity', 'Quantity'))}</TableCell>
                <TableCell>{sortHeader('unit', t('inventory.unit', 'Unit'))}</TableCell>
                <TableCell>{sortHeader('warehouse', t('inventory.warehouse', 'Warehouse'))}</TableCell>
                <TableCell>
                  {sortHeader('classification', t('inventory.classification', 'Classification'))}
                </TableCell>
                <TableCell align="right">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} data-testid="inventory-row">
                  <TableCell>{item.sku}</TableCell>
                  <TableCell>{ar ? item.name_ar : item.name_en}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={item.quantity < LOW_STOCK_THRESHOLD ? 'error' : 'success'}
                      label={item.quantity}
                    />
                  </TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell>{item.warehouse}</TableCell>
                  <TableCell>
                    <ClassificationBadge level={item.classification} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      aria-label={t('common.edit')}
                      data-testid="inventory-edit"
                      onClick={() => {
                        setEditing(item)
                        setFormOpen(true)
                      }}
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={t('common.delete')}
                      data-testid="inventory-delete"
                      onClick={() => setDeleting(item)}
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

      <InventoryFormDialog
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
