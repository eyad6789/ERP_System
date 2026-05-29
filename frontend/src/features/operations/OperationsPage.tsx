import AssignmentIndIcon from '@mui/icons-material/AssignmentInd'
import EventIcon from '@mui/icons-material/Event'
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

import {
  fetchTask,
  fetchTasks,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from '../../api/operations'
import { ClassificationBadge } from '../../components/ClassificationBadge'
import { SectionCard } from '../../components/SectionCard'
import { tokens } from '../../theme/tokens'

const COLUMNS: TaskStatus[] = ['open', 'active', 'closed']

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

function TaskCard({ task, onOpen }: { task: Task; onOpen: (id: number) => void }) {
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
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Typography variant="h5">{t('nav.operations')}</Typography>
        <Chip size="small" label={tasks.length} sx={{ fontWeight: 600 }} />
      </Stack>
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
                  <TaskCard key={task.id} task={task} onOpen={setSelected} />
                ))}
              </Stack>
            </SectionCard>
          )
        })}
      </Box>
      {selected !== null && <DetailDialog id={selected} onClose={() => setSelected(null)} />}
    </Stack>
  )
}
