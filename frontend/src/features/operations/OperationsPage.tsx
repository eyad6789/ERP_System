import AddIcon from '@mui/icons-material/Add'
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import EventIcon from '@mui/icons-material/Event'
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  createTask,
  fetchTask,
  fetchTasks,
  removeTask,
  updateTask,
  type Task,
  type TaskInput,
  type TaskPriority,
  type TaskStatus,
} from '../../api/operations'
import { ClassificationBadge } from '../../components/ClassificationBadge'
import { SectionCard } from '../../components/SectionCard'
import { tokens } from '../../theme/tokens'

const COLUMNS: TaskStatus[] = ['open', 'active', 'closed']
const PRIORITIES: TaskPriority[] = ['high', 'medium', 'low']
const CLEARANCES: Array<1 | 2 | 3 | 4> = [1, 2, 3, 4]

const ORDERINGS = [
  'updated_at',
  '-updated_at',
  'due_date',
  '-due_date',
  'priority',
  'classification',
] as const
type Ordering = (typeof ORDERINGS)[number]

const PRIORITY_COLOR: Record<TaskPriority, 'error' | 'warning' | 'default'> = {
  high: 'error',
  medium: 'warning',
  low: 'default',
}

const COLUMN_ACCENT: Record<TaskStatus, string> = {
  open: tokens.cyan,
  active: tokens.gold,
  closed: tokens.green,
}

const EMPTY_FORM: TaskInput = {
  title_ar: '',
  title_en: '',
  assignee: '',
  priority: 'medium',
  due_date: null,
  status: 'open',
  classification: 1,
}

function DetailDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  // Opening a task hits the IDOR-safe detail endpoint, which audits the view.
  const { data, isLoading } = useQuery({ queryKey: ['task', id], queryFn: () => fetchTask(id) })

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {isLoading || !data ? t('common.loading') : ar ? data.title_ar : data.title_en}
      </DialogTitle>
      <DialogContent>
        {isLoading || !data ? (
          <CircularProgress />
        ) : (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <ClassificationBadge level={data.classification} />
              <Chip
                size="small"
                color={PRIORITY_COLOR[data.priority]}
                label={t(`operations.priorityValue.${data.priority}`)}
              />
              <Chip
                size="small"
                variant="outlined"
                label={t(`operations.statusValue.${data.status}`)}
              />
            </Stack>
            <Row
              icon={<AssignmentIndIcon sx={{ fontSize: 16 }} />}
              label={t('operations.assignee')}
              value={data.assignee || '-'}
            />
            <Row
              icon={<EventIcon sx={{ fontSize: 16 }} />}
              label={t('operations.dueDate')}
              value={data.due_date ?? '-'}
            />
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: tokens.muted }}>
        {icon}
        <Typography color="text.secondary">{label}</Typography>
      </Stack>
      <Typography sx={{ color: tokens.text }}>{value}</Typography>
    </Stack>
  )
}

function TaskFormDialog({
  task,
  onClose,
}: {
  task: Task | null // null => create mode
  onClose: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isEdit = task !== null
  const [form, setForm] = useState<TaskInput>(
    task
      ? {
          title_ar: task.title_ar,
          title_en: task.title_en,
          assignee: task.assignee,
          priority: task.priority,
          due_date: task.due_date,
          status: task.status,
          classification: task.classification,
        }
      : EMPTY_FORM,
  )

  const mutation = useMutation({
    mutationFn: (body: TaskInput) =>
      isEdit ? updateTask(task.id, body) : createTask(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['operations'] })
      onClose()
    },
  })

  const setField = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const valid = form.title_ar.trim() !== '' && form.title_en.trim() !== ''

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{isEdit ? t('common.edit') : t('common.new')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }} data-testid="task-form">
          <TextField
            label={`${t('operations.title')} (AR)`}
            value={form.title_ar}
            onChange={(e) => setField('title_ar', e.target.value)}
            required
            fullWidth
            inputProps={{ 'data-testid': 'field-title_ar', dir: 'rtl' }}
          />
          <TextField
            label={`${t('operations.title')} (EN)`}
            value={form.title_en}
            onChange={(e) => setField('title_en', e.target.value)}
            required
            fullWidth
            inputProps={{ 'data-testid': 'field-title_en' }}
          />
          <TextField
            label={t('operations.assignee')}
            value={form.assignee}
            onChange={(e) => setField('assignee', e.target.value)}
            fullWidth
            inputProps={{ 'data-testid': 'field-assignee' }}
          />
          <TextField
            select
            label={t('operations.priority')}
            value={form.priority}
            onChange={(e) => setField('priority', e.target.value as TaskPriority)}
            fullWidth
            SelectProps={{ inputProps: { 'data-testid': 'field-priority' } }}
          >
            {PRIORITIES.map((p) => (
              <MenuItem key={p} value={p}>
                {t(`operations.priorityValue.${p}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            type="date"
            label={t('operations.dueDate')}
            value={form.due_date ?? ''}
            onChange={(e) => setField('due_date', e.target.value === '' ? null : e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
            inputProps={{ 'data-testid': 'field-due_date' }}
          />
          <TextField
            select
            label={t('operations.status')}
            value={form.status}
            onChange={(e) => setField('status', e.target.value as TaskStatus)}
            fullWidth
            SelectProps={{ inputProps: { 'data-testid': 'field-status' } }}
          >
            {COLUMNS.map((s) => (
              <MenuItem key={s} value={s}>
                {t(`operations.statusValue.${s}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={t('operations.classification')}
            value={form.classification}
            onChange={(e) => setField('classification', Number(e.target.value))}
            fullWidth
            SelectProps={{ inputProps: { 'data-testid': 'field-classification' } }}
          >
            {CLEARANCES.map((c) => (
              <MenuItem key={c} value={c}>
                {t(`clearance.${c}`)}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ color: tokens.muted }}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          disabled={!valid || mutation.isPending}
          onClick={() => mutation.mutate(form)}
          data-testid="task-form-save"
        >
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function ConfirmDeleteDialog({ task, onClose }: { task: Task; onClose: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => removeTask(task.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['operations'] })
      onClose()
    },
  })

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t('common.delete')}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ color: tokens.muted }}>
          {t('common.confirmDelete')}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ color: tokens.muted }}>
          {t('common.cancel')}
        </Button>
        <Button
          color="error"
          variant="contained"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
          data-testid="confirm-delete"
        >
          {t('common.confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function TaskCard({
  task,
  onOpen,
  onEdit,
  onDelete,
}: {
  task: Task
  onOpen: (id: number) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
}) {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  return (
    <Card
      data-testid="task-card"
      sx={{
        position: 'relative',
        overflow: 'hidden',
        '&:hover': { borderColor: tokens.borderGold },
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          insetInlineStart: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: `linear-gradient(180deg, ${COLUMN_ACCENT[task.status]}, transparent)`,
        }}
      />
      <CardActionArea onClick={() => onOpen(task.id)}>
        <CardContent sx={{ pl: 2.5 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 1 }}
          >
            <ClassificationBadge level={task.classification} />
            <Chip
              size="small"
              color={PRIORITY_COLOR[task.priority]}
              label={t(`operations.priorityValue.${task.priority}`)}
            />
          </Stack>
          <Typography variant="subtitle1" sx={{ color: tokens.text }}>
            {ar ? task.title_ar : task.title_en}
          </Typography>
          {task.assignee && (
            <Stack
              direction="row"
              spacing={0.5}
              alignItems="center"
              sx={{ mt: 0.5, color: tokens.muted }}
            >
              <AssignmentIndIcon sx={{ fontSize: 14 }} />
              <Typography variant="caption" color="text.secondary">
                {task.assignee}
              </Typography>
            </Stack>
          )}
        </CardContent>
      </CardActionArea>
      <Stack
        direction="row"
        spacing={0.5}
        justifyContent="flex-end"
        sx={{ px: 1, pb: 0.5 }}
      >
        <IconButton
          size="small"
          aria-label={t('common.edit')}
          onClick={() => onEdit(task)}
          sx={{ color: tokens.muted }}
        >
          <EditIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          aria-label={t('common.delete')}
          onClick={() => onDelete(task)}
          sx={{ color: tokens.muted }}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Card>
  )
}

export function OperationsPage() {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [ordering, setOrdering] = useState<Ordering>('-updated_at')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [deleting, setDeleting] = useState<Task | null>(null)

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQ(search), 300)
    return () => clearTimeout(handle)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['operations', debouncedQ, ordering],
    queryFn: () => fetchTasks({ q: debouncedQ, ordering }),
  })

  const tasks: Task[] = useMemo(() => data ?? [], [data])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (task: Task) => {
    setEditing(task)
    setFormOpen(true)
  }

  return (
    <Stack spacing={3}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.5}
        flexWrap="wrap"
        useFlexGap
      >
        <Typography variant="h5">{t('nav.operations')}</Typography>
        <Chip size="small" label={tasks.length} sx={{ fontWeight: 600 }} />
        <Box sx={{ flexGrow: 1 }} />
        <TextField
          size="small"
          placeholder={t('common.searchHere')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          inputProps={{ 'data-testid': 'operations-search' }}
        />
        <TextField
          select
          size="small"
          label={t('operations.sortBy')}
          value={ordering}
          onChange={(e) => setOrdering(e.target.value as Ordering)}
          sx={{ minWidth: 160 }}
          SelectProps={{ inputProps: { 'data-testid': 'operations-ordering' } }}
        >
          {ORDERINGS.map((o) => (
            <MenuItem key={o} value={o}>
              {t(`operations.ordering.${o}`)}
            </MenuItem>
          ))}
        </TextField>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
          data-testid="operations-new"
        >
          {t('common.new')}
        </Button>
      </Stack>

      {isLoading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', height: '50vh' }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
          {COLUMNS.map((col) => {
            const colTasks = tasks.filter((task) => task.status === col)
            return (
              <SectionCard
                key={col}
                title={t(`operations.statusValue.${col}`)}
                action={
                  <Chip
                    size="small"
                    variant="outlined"
                    label={colTasks.length}
                    sx={{ color: COLUMN_ACCENT[col], borderColor: COLUMN_ACCENT[col] }}
                  />
                }
              >
                <Stack spacing={1.5} data-testid={`column-${col}`}>
                  {colTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onOpen={setSelected}
                      onEdit={openEdit}
                      onDelete={setDeleting}
                    />
                  ))}
                </Stack>
              </SectionCard>
            )
          })}
        </Box>
      )}

      {selected !== null && <DetailDialog id={selected} onClose={() => setSelected(null)} />}
      {formOpen && (
        <TaskFormDialog task={editing} onClose={() => setFormOpen(false)} />
      )}
      {deleting !== null && (
        <ConfirmDeleteDialog task={deleting} onClose={() => setDeleting(null)} />
      )}
    </Stack>
  )
}
