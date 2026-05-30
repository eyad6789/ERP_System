import AddIcon from '@mui/icons-material/Add'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import HowToRegIcon from '@mui/icons-material/HowToReg'
import PeopleIcon from '@mui/icons-material/People'
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
  type ApplicantListItem,
  type ApplicantStage,
  type ApplicantWriteBody,
} from '../../api/recruitment'
import { ClassificationBadge } from '../../components/ClassificationBadge'
import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import { tokens } from '../../theme/tokens'

const STAGE_COLOR: Record<
  ApplicantStage,
  'default' | 'info' | 'primary' | 'warning' | 'success' | 'error'
> = {
  applied: 'default',
  screening: 'info',
  interview: 'primary',
  offer: 'warning',
  hired: 'success',
  rejected: 'error',
}

const STAGES: ApplicantStage[] = [
  'applied',
  'screening',
  'interview',
  'offer',
  'hired',
  'rejected',
]
const CLEARANCES: ReadonlyArray<1 | 2 | 3 | 4> = [1, 2, 3, 4]

type SortField = 'name' | 'position' | 'email' | 'stage' | 'classification'

const EMPTY_FORM: ApplicantWriteBody = {
  name: '',
  position: '',
  email: '',
  stage: 'applied',
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

function ApplicantFormDialog({
  open,
  initial,
  editing,
  onClose,
  onSubmit,
  pending,
}: {
  open: boolean
  initial: ApplicantWriteBody
  editing: boolean
  onClose: () => void
  onSubmit: (body: ApplicantWriteBody) => void
  pending: boolean
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState<ApplicantWriteBody>(initial)

  useEffect(() => {
    if (open) setForm(initial)
  }, [open, initial])

  const valid = form.name.trim() !== '' && form.position.trim() !== ''

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? t('common.edit') : t('common.new')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label={t('recruitment.name', 'Name')}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
            fullWidth
            inputProps={{ 'data-testid': 'field-name' }}
          />
          <TextField
            label={t('recruitment.position', 'Position')}
            value={form.position}
            onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
            required
            fullWidth
            inputProps={{ 'data-testid': 'field-position' }}
          />
          <TextField
            label={t('recruitment.email', 'Email')}
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            fullWidth
            inputProps={{ 'data-testid': 'field-email' }}
          />
          <TextField
            select
            label={t('recruitment.stage', 'Stage')}
            value={form.stage}
            onChange={(e) =>
              setForm((f) => ({ ...f, stage: e.target.value as ApplicantStage }))
            }
            fullWidth
            inputProps={{ 'data-testid': 'field-stage' }}
          >
            {STAGES.map((s) => (
              <MenuItem key={s} value={s}>
                {t(`recruitment.${s}`, s)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={t('recruitment.classification', 'Classification')}
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

export function RecruitmentPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const q = useDebounced(search)
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const ordering = `${sortDir === 'desc' ? '-' : ''}${sortField}`

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ApplicantListItem | null>(null)
  const [deleting, setDeleting] = useState<ApplicantListItem | null>(null)

  const queryKey = ['recruitment', q, ordering] as const
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchList({ q, ordering }),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['recruitment'] })

  const createMutation = useMutation({
    mutationFn: (body: ApplicantWriteBody) => create(body),
    onSuccess: () => {
      invalidate()
      setFormOpen(false)
    },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: ApplicantWriteBody }) => update(id, body),
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

  const formInitial: ApplicantWriteBody = useMemo(
    () =>
      editing
        ? {
            name: editing.name,
            position: editing.position,
            email: editing.email,
            stage: editing.stage,
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

  const handleSubmit = (body: ApplicantWriteBody) => {
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

  const applicants: ApplicantListItem[] = data ?? []
  const hiredCount = applicants.filter((a) => a.stage === 'hired').length

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
        <Typography variant="h5">{t('nav.recruitment')}</Typography>
        <Chip size="small" label={applicants.length} variant="outlined" />
      </Stack>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <Box data-testid="kpi-total" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('recruitment.total', 'Total')}
            value={applicants.length}
            accent={tokens.gold}
            icon={<PeopleIcon />}
          />
        </Box>
        <Box data-testid="kpi-hired" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('recruitment.hired', 'Hired')}
            value={hiredCount}
            accent={tokens.green}
            icon={<HowToRegIcon />}
          />
        </Box>
      </Box>

      <SectionCard
        title={t('nav.recruitment')}
        action={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TextField
              size="small"
              placeholder={t('common.searchHere')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              inputProps={{ 'data-testid': 'recruitment-search' }}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
              data-testid="recruitment-new"
            >
              {t('common.new')}
            </Button>
          </Stack>
        }
      >
        <TableContainer>
          <Table data-testid="recruitment-table">
            <TableHead>
              <TableRow>
                <TableCell>{sortHeader('name', t('recruitment.name', 'Name'))}</TableCell>
                <TableCell>
                  {sortHeader('position', t('recruitment.position', 'Position'))}
                </TableCell>
                <TableCell>{sortHeader('email', t('recruitment.email', 'Email'))}</TableCell>
                <TableCell>{sortHeader('stage', t('recruitment.stage', 'Stage'))}</TableCell>
                <TableCell>
                  {sortHeader('classification', t('recruitment.classification', 'Classification'))}
                </TableCell>
                <TableCell align="right">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {applicants.map((a) => (
                <TableRow key={a.id} data-testid="recruitment-row">
                  <TableCell>{a.name}</TableCell>
                  <TableCell>{a.position}</TableCell>
                  <TableCell>{a.email}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={STAGE_COLOR[a.stage]}
                      label={t(`recruitment.${a.stage}`, a.stage)}
                    />
                  </TableCell>
                  <TableCell>
                    <ClassificationBadge level={a.classification} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      aria-label={t('common.edit')}
                      data-testid="recruitment-edit"
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
                      data-testid="recruitment-delete"
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

      <ApplicantFormDialog
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
