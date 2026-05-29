import AddIcon from '@mui/icons-material/Add'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import WorkOutlineIcon from '@mui/icons-material/WorkOutline'
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
  createProject,
  fetchProjects,
  removeProject,
  updateProject,
  type ProjectListItem,
  type ProjectStatus,
  type ProjectWriteBody,
} from '../../api/projects'
import { ClassificationBadge } from '../../components/ClassificationBadge'
import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import { tokens } from '../../theme/tokens'

const STATUS_COLOR: Record<ProjectStatus, 'info' | 'success' | 'warning' | 'default'> = {
  planning: 'info',
  active: 'success',
  on_hold: 'warning',
  done: 'default',
}

const STATUSES: ProjectStatus[] = ['planning', 'active', 'on_hold', 'done']
const CLEARANCES: ReadonlyArray<1 | 2 | 3 | 4> = [1, 2, 3, 4]

type SortField = 'name_en' | 'status' | 'progress' | 'start_date' | 'end_date' | 'lead' | 'classification'

const EMPTY_FORM: ProjectWriteBody = {
  name_ar: '',
  name_en: '',
  status: 'planning',
  progress: 0,
  start_date: '',
  end_date: '',
  lead: '',
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

function ProjectFormDialog({
  open,
  initial,
  onClose,
  onSubmit,
  pending,
}: {
  open: boolean
  initial: ProjectWriteBody
  onClose: () => void
  onSubmit: (body: ProjectWriteBody) => void
  pending: boolean
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState<ProjectWriteBody>(initial)

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
            label={`${t('projects.name', 'Name')} (AR)`}
            value={form.name_ar}
            onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))}
            required
            fullWidth
            inputProps={{ 'data-testid': 'field-name_ar' }}
          />
          <TextField
            label={`${t('projects.name', 'Name')} (EN)`}
            value={form.name_en}
            onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
            required
            fullWidth
            inputProps={{ 'data-testid': 'field-name_en' }}
          />
          <TextField
            select
            label={t('projects.status', 'Status')}
            value={form.status}
            onChange={(e) =>
              setForm((f) => ({ ...f, status: e.target.value as ProjectStatus }))
            }
            fullWidth
            inputProps={{ 'data-testid': 'field-status' }}
          >
            {STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {t(`projects.${s}`, s)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            type="number"
            label={t('projects.progress', 'Progress')}
            value={form.progress}
            onChange={(e) =>
              setForm((f) => ({ ...f, progress: Number(e.target.value) }))
            }
            fullWidth
            inputProps={{ min: 0, max: 100, 'data-testid': 'field-progress' }}
          />
          <TextField
            type="date"
            label={t('projects.start_date', 'Start date')}
            value={form.start_date}
            onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
            fullWidth
            InputLabelProps={{ shrink: true }}
            inputProps={{ 'data-testid': 'field-start_date' }}
          />
          <TextField
            type="date"
            label={t('projects.end_date', 'End date')}
            value={form.end_date}
            onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
            fullWidth
            InputLabelProps={{ shrink: true }}
            inputProps={{ 'data-testid': 'field-end_date' }}
          />
          <TextField
            label={t('projects.lead', 'Lead')}
            value={form.lead}
            onChange={(e) => setForm((f) => ({ ...f, lead: e.target.value }))}
            fullWidth
            inputProps={{ 'data-testid': 'field-lead' }}
          />
          <TextField
            select
            label={t('projects.classification', 'Classification')}
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

export function ProjectsPage() {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const q = useDebounced(search)
  const [sortField, setSortField] = useState<SortField>('name_en')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const ordering = `${sortDir === 'desc' ? '-' : ''}${sortField}`

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ProjectListItem | null>(null)
  const [deleting, setDeleting] = useState<ProjectListItem | null>(null)

  const queryKey = ['projects', q, ordering] as const
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchProjects({ q, ordering }),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['projects'] })

  const createMutation = useMutation({
    mutationFn: (body: ProjectWriteBody) => createProject(body),
    onSuccess: () => {
      invalidate()
      setFormOpen(false)
    },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: ProjectWriteBody }) =>
      updateProject(id, body),
    onSuccess: () => {
      invalidate()
      setFormOpen(false)
      setEditing(null)
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => removeProject(id),
    onSuccess: () => {
      invalidate()
      setDeleting(null)
    },
  })

  const formInitial: ProjectWriteBody = useMemo(
    () =>
      editing
        ? {
            name_ar: editing.name_ar,
            name_en: editing.name_en,
            status: editing.status,
            progress: editing.progress,
            start_date: editing.start_date,
            end_date: editing.end_date,
            lead: editing.lead,
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

  const handleSubmit = (body: ProjectWriteBody) => {
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

  const projects: ProjectListItem[] = data ?? []
  const count = (s: ProjectStatus) => projects.filter((p) => p.status === s).length

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
        <Typography variant="h5">{t('nav.projects')}</Typography>
        <Chip size="small" label={projects.length} variant="outlined" />
      </Stack>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <Box data-testid="kpi-total" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('projects.total', 'Total')}
            value={projects.length}
            accent={tokens.gold}
            icon={<WorkOutlineIcon />}
          />
        </Box>
        <Box data-testid="kpi-active" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('projects.active', 'Active')}
            value={count('active')}
            accent={tokens.green}
            icon={<PlayArrowIcon />}
          />
        </Box>
        <Box data-testid="kpi-done" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('projects.done', 'Done')}
            value={count('done')}
            accent={tokens.cyan}
            icon={<CheckCircleIcon />}
          />
        </Box>
      </Box>

      <SectionCard
        title={t('nav.projects')}
        action={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TextField
              size="small"
              placeholder={t('common.searchHere')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              inputProps={{ 'data-testid': 'projects-search' }}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
              data-testid="project-new"
            >
              {t('common.new')}
            </Button>
          </Stack>
        }
      >
        <TableContainer>
          <Table data-testid="projects-table">
            <TableHead>
              <TableRow>
                <TableCell>{sortHeader('name_en', t('projects.name', 'Name'))}</TableCell>
                <TableCell>{sortHeader('status', t('projects.status', 'Status'))}</TableCell>
                <TableCell>{sortHeader('progress', t('projects.progress', 'Progress'))}</TableCell>
                <TableCell>{sortHeader('start_date', t('projects.start_date', 'Start date'))}</TableCell>
                <TableCell>{sortHeader('end_date', t('projects.end_date', 'End date'))}</TableCell>
                <TableCell>{sortHeader('lead', t('projects.lead', 'Lead'))}</TableCell>
                <TableCell>
                  {sortHeader('classification', t('projects.classification', 'Classification'))}
                </TableCell>
                <TableCell align="right">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {projects.map((p) => (
                <TableRow key={p.id} data-testid="project-row">
                  <TableCell>{ar ? p.name_ar : p.name_en}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={STATUS_COLOR[p.status]}
                      label={t(`projects.${p.status}`, p.status)}
                    />
                  </TableCell>
                  <TableCell>{p.progress}%</TableCell>
                  <TableCell>{p.start_date}</TableCell>
                  <TableCell>{p.end_date}</TableCell>
                  <TableCell>{p.lead}</TableCell>
                  <TableCell>
                    <ClassificationBadge level={p.classification} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      aria-label={t('common.edit')}
                      data-testid="project-edit"
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
                      data-testid="project-delete"
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

      <ProjectFormDialog
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
