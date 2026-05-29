import AddIcon from '@mui/icons-material/Add'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import BuildIcon from '@mui/icons-material/Build'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import Inventory2Icon from '@mui/icons-material/Inventory2'
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
  createAsset,
  fetchAssets,
  removeAsset,
  updateAsset,
  type AssetCondition,
  type AssetListItem,
  type AssetWriteBody,
} from '../../api/assets'
import { ClassificationBadge } from '../../components/ClassificationBadge'
import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import { tokens } from '../../theme/tokens'

const CONDITION_COLOR: Record<AssetCondition, 'success' | 'warning' | 'error'> = {
  operational: 'success',
  maintenance: 'warning',
  down: 'error',
}

const CONDITIONS: AssetCondition[] = ['operational', 'maintenance', 'down']
const CLEARANCES: ReadonlyArray<1 | 2 | 3 | 4> = [1, 2, 3, 4]

type SortField = 'name_en' | 'asset_type' | 'location' | 'condition' | 'classification'

const EMPTY_FORM: AssetWriteBody = {
  name_ar: '',
  name_en: '',
  asset_type: '',
  location: '',
  condition: 'operational',
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

function AssetFormDialog({
  open,
  initial,
  onClose,
  onSubmit,
  pending,
}: {
  open: boolean
  initial: AssetWriteBody
  onClose: () => void
  onSubmit: (body: AssetWriteBody) => void
  pending: boolean
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState<AssetWriteBody>(initial)

  useEffect(() => {
    if (open) setForm(initial)
  }, [open, initial])

  const valid = form.name_ar.trim() !== '' && form.name_en.trim() !== ''

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{initial.name_en ? t('common.edit') : t('common.new')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label={`${t('assets.name')} (AR)`}
            value={form.name_ar}
            onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))}
            required
            fullWidth
            inputProps={{ 'data-testid': 'field-name_ar' }}
          />
          <TextField
            label={`${t('assets.name')} (EN)`}
            value={form.name_en}
            onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
            required
            fullWidth
            inputProps={{ 'data-testid': 'field-name_en' }}
          />
          <TextField
            label={t('assets.type')}
            value={form.asset_type}
            onChange={(e) => setForm((f) => ({ ...f, asset_type: e.target.value }))}
            fullWidth
            inputProps={{ 'data-testid': 'field-asset_type' }}
          />
          <TextField
            label={t('assets.location')}
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            fullWidth
            inputProps={{ 'data-testid': 'field-location' }}
          />
          <TextField
            select
            label={t('assets.condition')}
            value={form.condition}
            onChange={(e) =>
              setForm((f) => ({ ...f, condition: e.target.value as AssetCondition }))
            }
            fullWidth
            inputProps={{ 'data-testid': 'field-condition' }}
          >
            {CONDITIONS.map((c) => (
              <MenuItem key={c} value={c}>
                {t(`assets.${c}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={t('assets.classification')}
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

export function AssetsPage() {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const q = useDebounced(search)
  const [sortField, setSortField] = useState<SortField>('name_en')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const ordering = `${sortDir === 'desc' ? '-' : ''}${sortField}`

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AssetListItem | null>(null)
  const [deleting, setDeleting] = useState<AssetListItem | null>(null)

  const queryKey = ['assets', q, ordering] as const
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchAssets({ q, ordering }),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['assets'] })

  const createMutation = useMutation({
    mutationFn: (body: AssetWriteBody) => createAsset(body),
    onSuccess: () => {
      invalidate()
      setFormOpen(false)
    },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: AssetWriteBody }) => updateAsset(id, body),
    onSuccess: () => {
      invalidate()
      setFormOpen(false)
      setEditing(null)
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => removeAsset(id),
    onSuccess: () => {
      invalidate()
      setDeleting(null)
    },
  })

  const formInitial: AssetWriteBody = useMemo(
    () =>
      editing
        ? {
            name_ar: editing.name_ar,
            name_en: editing.name_en,
            asset_type: editing.asset_type,
            location: editing.location,
            condition: editing.condition,
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

  const handleSubmit = (body: AssetWriteBody) => {
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

  const assets: AssetListItem[] = data ?? []
  const count = (c: AssetCondition) => assets.filter((a) => a.condition === c).length

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
        <Typography variant="h5">{t('nav.assets')}</Typography>
        <Chip size="small" label={assets.length} variant="outlined" />
      </Stack>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <Box data-testid="kpi-total" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('assets.total')}
            value={assets.length}
            accent={tokens.gold}
            icon={<Inventory2Icon />}
          />
        </Box>
        <Box data-testid="kpi-operational" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('assets.operational')}
            value={count('operational')}
            accent={tokens.green}
            icon={<CheckCircleIcon />}
          />
        </Box>
        <Box data-testid="kpi-maintenance" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('assets.maintenance')}
            value={count('maintenance')}
            accent={tokens.orange}
            icon={<BuildIcon />}
          />
        </Box>
        <Box data-testid="kpi-down" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('assets.down')}
            value={count('down')}
            accent={tokens.red}
            icon={<ErrorOutlineIcon />}
          />
        </Box>
      </Box>

      <SectionCard
        title={t('nav.assets')}
        action={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TextField
              size="small"
              placeholder={t('common.searchHere')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              inputProps={{ 'data-testid': 'assets-search' }}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
              data-testid="asset-new"
            >
              {t('common.new')}
            </Button>
          </Stack>
        }
      >
        <TableContainer>
          <Table data-testid="assets-table">
            <TableHead>
              <TableRow>
                <TableCell>{sortHeader('name_en', t('assets.name'))}</TableCell>
                <TableCell>{sortHeader('asset_type', t('assets.type'))}</TableCell>
                <TableCell>{sortHeader('location', t('assets.location'))}</TableCell>
                <TableCell>{sortHeader('condition', t('assets.condition'))}</TableCell>
                <TableCell>{sortHeader('classification', t('assets.classification'))}</TableCell>
                <TableCell align="right">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {assets.map((a) => (
                <TableRow key={a.id} data-testid="asset-row">
                  <TableCell>{ar ? a.name_ar : a.name_en}</TableCell>
                  <TableCell>{a.asset_type}</TableCell>
                  <TableCell>{a.location}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={CONDITION_COLOR[a.condition]}
                      label={t(`assets.${a.condition}`)}
                    />
                  </TableCell>
                  <TableCell>
                    <ClassificationBadge level={a.classification} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      aria-label={t('common.edit')}
                      data-testid="asset-edit"
                      onClick={() => {
                        setEditing(a)
                        setFormOpen(true)
                      }}
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={t('common.delete')}
                      data-testid="asset-delete"
                      onClick={() => setDeleting(a)}
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

      <AssetFormDialog
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
