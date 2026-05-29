import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { fetchTask, fetchTasks, type Task, type TaskPriority, type TaskStatus } from '../../api/operations'
import { ClassificationBadge } from '../../components/ClassificationBadge'

const COLUMNS: TaskStatus[] = ['open', 'active', 'closed']

const PRIORITY_COLOR: Record<TaskPriority, 'error' | 'warning' | 'default'> = {
  high: 'error',
  medium: 'warning',
  low: 'default',
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
              <Chip size="small" variant="outlined" label={t(`operations.statusValue.${data.status}`)} />
            </Stack>
            <Row label={t('operations.assignee')} value={data.assignee || '-'} />
            <Row label={t('operations.dueDate')} value={data.due_date ?? '-'} />
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography color="text.secondary">{label}</Typography>
      <Typography>{value}</Typography>
    </Stack>
  )
}

function TaskCard({ task, onOpen }: { task: Task; onOpen: (id: number) => void }) {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  return (
    <Card data-testid="task-card">
      <CardActionArea onClick={() => onOpen(task.id)}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <ClassificationBadge level={task.classification} />
            <Chip
              size="small"
              color={PRIORITY_COLOR[task.priority]}
              label={t(`operations.priorityValue.${task.priority}`)}
            />
          </Stack>
          <Typography variant="subtitle1">{ar ? task.title_ar : task.title_en}</Typography>
          {task.assignee && (
            <Typography variant="caption" color="text.secondary">
              {task.assignee}
            </Typography>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  )
}

export function OperationsPage() {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<number | null>(null)
  const { data, isLoading } = useQuery({ queryKey: ['operations'], queryFn: fetchTasks })

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  const tasks: Task[] = data ?? []

  return (
    <Stack spacing={2}>
      <Typography variant="h5">{t('nav.operations')}</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
        {COLUMNS.map((col) => (
          <Stack key={col} spacing={1.5} data-testid={`column-${col}`}>
            <Typography variant="subtitle2" color="text.secondary">
              {t(`operations.statusValue.${col}`)}
            </Typography>
            {tasks
              .filter((task) => task.status === col)
              .map((task) => (
                <TaskCard key={task.id} task={task} onOpen={setSelected} />
              ))}
          </Stack>
        ))}
      </Box>
      {selected !== null && <DetailDialog id={selected} onClose={() => setSelected(null)} />}
    </Stack>
  )
}
