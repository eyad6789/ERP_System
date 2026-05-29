import AddIcon from '@mui/icons-material/Add'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import BlockIcon from '@mui/icons-material/Block'
import BuildIcon from '@mui/icons-material/Build'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
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
  createVehicle,
  fetchVehicles,
  removeVehicle,
  updateVehicle,
  type VehicleListItem,
  type VehicleStatus,
  type VehicleWriteBody,
} from '../../api/fleet'
import { ClassificationBadge } from '../../components/ClassificationBadge'
import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import { tokens } from '../../theme/tokens'

const STATUS_COLOR: Record<VehicleStatus, 'success' | 'warning' | 'default'> = {
  active: 'success',
  maintenance: 'warning',
  retired: 'default',
}

const STATUSES: VehicleStatus[] = ['active', 'maintenance', 'retired']
const CLEARANCES: ReadonlyArray<1 | 2 | 3 | 4> = [1, 2, 3, 4]

type SortField = 'plate' | 'vtype' | 'make' | 'status' | 'odometer' | 'classification'

const EMPTY_FORM: VehicleWriteBody = {
  plate: '',
  vtype: '',
  make: '',
  status: 'active',
  odometer: 0,
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

function VehicleFormDialog({
  open,
  initial,
  editing,
  onClose,
  onSubmit,
  pending,
}: {
  open: boolean
  initial: VehicleWriteBody
  editing: boolean
  onClose: () => void
  onSubmit: (body: VehicleWriteBody) => void
  pending: boolean
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState<VehicleWriteBody>(initial)

  useEffect(() => {
    if (open) setForm(initial)
  }, [open, initial])

  const valid = form.plate.trim() !== '' && form.vtype.trim() !== ''

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? t('common.edit') : t('common.new')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label={t('fleet.plate', 'Plate')}
            value={form.plate}
            onChange={(e) => setForm((f) => ({ ...f, plate: e.target.value }))}
            required
            fullWidth
            inputProps={{ 'data-testid': 'field-plate' }}
          />
          <TextField
            label={t('fleet.vtype', 'Vehicle Type')}
            value={form.vtype}
            onChange={(e) => setForm((f) => ({ ...f, vtype: e.target.value }))}
            required
            fullWidth
            inputProps={{ 'data-testid': 'field-vtype' }}
          />
          <TextField
            label={t('fleet.make', 'Make')}
            value={form.make}
            onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))}
            fullWidth
            inputProps={{ 'data-testid': 'field-make' }}
          />
          <TextField
            select
            label={t('fleet.status', 'Status')}
            value={form.status}
            onChange={(e) =>
              setForm((f) => ({ ...f, status: e.target.value as VehicleStatus }))
            }
            fullWidth
            inputProps={{ 'data-testid': 'field-status' }}
          >
            {STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {t(`fleet.${s}`, s)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            type="number"
            label={t('fleet.odometer', 'Odometer')}
            value={form.odometer}
            onChange={(e) => setForm((f) => ({ ...f, odometer: Number(e.target.value) }))}
            fullWidth
            inputProps={{ 'data-testid': 'field-odometer' }}
          />
          <TextField
            select
            label={t('fleet.classification', 'Classification')}
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

export function FleetPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const q = useDebounced(search)
  const [sortField, setSortField] = useState<SortField>('plate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const ordering = `${sortDir === 'desc' ? '-' : ''}${sortField}`

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<VehicleListItem | null>(null)
  const [deleting, setDeleting] = useState<VehicleListItem | null>(null)

  const queryKey = ['fleet', q, ordering] as const
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchVehicles({ q, ordering }),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['fleet'] })

  const createMutation = useMutation({
    mutationFn: (body: VehicleWriteBody) => createVehicle(body),
    onSuccess: () => {
      invalidate()
      setFormOpen(false)
    },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: VehicleWriteBody }) =>
      updateVehicle(id, body),
    onSuccess: () => {
      invalidate()
      setFormOpen(false)
      setEditing(null)
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => removeVehicle(id),
    onSuccess: () => {
      invalidate()
      setDeleting(null)
    },
  })

  const formInitial: VehicleWriteBody = useMemo(
    () =>
      editing
        ? {
            plate: editing.plate,
            vtype: editing.vtype,
            make: editing.make,
            status: editing.status,
            odometer: editing.odometer,
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

  const handleSubmit = (body: VehicleWriteBody) => {
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

  const vehicles: VehicleListItem[] = data ?? []
  const count = (s: VehicleStatus) => vehicles.filter((v) => v.status === s).length

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
        <Typography variant="h5">{t('nav.fleet')}</Typography>
        <Chip size="small" label={vehicles.length} variant="outlined" />
      </Stack>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <Box data-testid="kpi-total" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('fleet.total', 'Total')}
            value={vehicles.length}
            accent={tokens.gold}
            icon={<DirectionsCarIcon />}
          />
        </Box>
        <Box data-testid="kpi-active" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('fleet.active', 'Active')}
            value={count('active')}
            accent={tokens.green}
            icon={<CheckCircleIcon />}
          />
        </Box>
        <Box data-testid="kpi-maintenance" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('fleet.maintenance', 'Maintenance')}
            value={count('maintenance')}
            accent={tokens.orange}
            icon={<BuildIcon />}
          />
        </Box>
        <Box data-testid="kpi-retired" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('fleet.retired', 'Retired')}
            value={count('retired')}
            accent={tokens.muted}
            icon={<BlockIcon />}
          />
        </Box>
      </Box>

      <SectionCard
        title={t('nav.fleet')}
        action={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TextField
              size="small"
              placeholder={t('common.searchHere')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              inputProps={{ 'data-testid': 'fleet-search' }}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
              data-testid="vehicle-new"
            >
              {t('common.new')}
            </Button>
          </Stack>
        }
      >
        <TableContainer>
          <Table data-testid="fleet-table">
            <TableHead>
              <TableRow>
                <TableCell>{sortHeader('plate', t('fleet.plate', 'Plate'))}</TableCell>
                <TableCell>{sortHeader('vtype', t('fleet.vtype', 'Vehicle Type'))}</TableCell>
                <TableCell>{sortHeader('make', t('fleet.make', 'Make'))}</TableCell>
                <TableCell>{sortHeader('status', t('fleet.status', 'Status'))}</TableCell>
                <TableCell align="right">
                  {sortHeader('odometer', t('fleet.odometer', 'Odometer'))}
                </TableCell>
                <TableCell>
                  {sortHeader('classification', t('fleet.classification', 'Classification'))}
                </TableCell>
                <TableCell align="right">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {vehicles.map((v) => (
                <TableRow key={v.id} data-testid="vehicle-row">
                  <TableCell>{v.plate}</TableCell>
                  <TableCell>{v.vtype}</TableCell>
                  <TableCell>{v.make}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={STATUS_COLOR[v.status]}
                      label={t(`fleet.${v.status}`, v.status)}
                    />
                  </TableCell>
                  <TableCell align="right">{v.odometer.toLocaleString()}</TableCell>
                  <TableCell>
                    <ClassificationBadge level={v.classification} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      aria-label={t('common.edit')}
                      data-testid="vehicle-edit"
                      onClick={() => {
                        setEditing(v)
                        setFormOpen(true)
                      }}
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={t('common.delete')}
                      data-testid="vehicle-delete"
                      onClick={() => setDeleting(v)}
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

      <VehicleFormDialog
        open={formOpen}
        initial={formInitial}
        editing={editing !== null}
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
