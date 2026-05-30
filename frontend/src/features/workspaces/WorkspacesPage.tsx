import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined'
import WorkspacesOutlinedIcon from '@mui/icons-material/WorkspacesOutlined'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  fetchWorkspaces,
  updateWorkspace,
  type Workspace,
  type WorkspacePatch,
} from '../../api/workspaces'
import { useAuth } from '../../auth/AuthProvider'
import { StatCard } from '../../components/StatCard'
import { NAV_GROUPS } from '../../nav/groups'
import { tokens } from '../../theme/tokens'

interface EditForm {
  name_ar: string
  name_en: string
  description_ar: string
  description_en: string
  mission_ar: string
  mission_en: string
  head_name: string
  accent_color: string
  featured: string
}

function toForm(ws: Workspace): EditForm {
  return {
    name_ar: ws.name_ar,
    name_en: ws.name_en,
    description_ar: ws.description_ar,
    description_en: ws.description_en,
    mission_ar: ws.mission_ar,
    mission_en: ws.mission_en,
    head_name: ws.head_name,
    accent_color: ws.accent_color,
    featured: ws.featured.join(', '),
  }
}

function toPatch(form: EditForm): WorkspacePatch {
  return {
    name_ar: form.name_ar,
    name_en: form.name_en,
    description_ar: form.description_ar,
    description_en: form.description_en,
    mission_ar: form.mission_ar,
    mission_en: form.mission_en,
    head_name: form.head_name,
    accent_color: form.accent_color,
    featured: form.featured
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  }
}

// Stable display order mirrors the sidebar taxonomy.
function orderByNav(workspaces: Workspace[]): Workspace[] {
  const rank = new Map(NAV_GROUPS.map((g, i) => [g.key, i]))
  return [...workspaces].sort(
    (a, b) => (rank.get(a.key) ?? 99) - (rank.get(b.key) ?? 99),
  )
}

function formatDate(iso: string): string | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString()
}

function WorkspaceCard({
  ws,
  isOwn,
  onEdit,
}: {
  ws: Workspace
  isOwn: boolean
  onEdit: () => void
}) {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const group = NAV_GROUPS.find((g) => g.key === ws.key)
  const accent = ws.accent_color || tokens.gold
  const updated = ws.updated_at ? formatDate(ws.updated_at) : null

  const editBtn = (
    <Button
      size="small"
      variant="outlined"
      startIcon={ws.can_edit ? <EditOutlinedIcon /> : <LockOutlinedIcon />}
      disabled={!ws.can_edit}
      onClick={onEdit}
      data-testid={`ws-edit-${ws.key}`}
    >
      {t('common.edit', 'Edit')}
    </Button>
  )

  return (
    <Card
      sx={{
        flex: 1,
        minWidth: 340,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
      }}
    >
      {/* leading accent bar tinted with the workspace color */}
      <Box sx={{ width: 4, background: accent, flexShrink: 0 }} />
      <CardContent sx={{ flex: 1 }}>
        <Stack spacing={1.5}>
          <Stack direction="row" alignItems="flex-start" spacing={1.5}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1.5,
                display: 'grid',
                placeItems: 'center',
                color: accent,
                bgcolor: `${accent}1f`,
                border: `1px solid ${accent}55`,
                flexShrink: 0,
                '& svg': { fontSize: 22 },
              }}
            >
              <WorkspacesOutlinedIcon />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" sx={{ color: tokens.text, fontWeight: 700 }}>
                {ar ? ws.name_ar : ws.name_en}
              </Typography>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                <Chip
                  size="small"
                  variant="outlined"
                  label={ws.owner_department}
                  data-testid={`ws-owner-${ws.key}`}
                />
                {isOwn && (
                  <Chip
                    size="small"
                    icon={<VerifiedUserOutlinedIcon />}
                    label={t('workspaces.yours', 'Your department')}
                    data-testid={`ws-yours-${ws.key}`}
                    sx={{
                      color: tokens.gold,
                      borderColor: tokens.borderGold,
                      bgcolor: `${tokens.gold}1f`,
                      border: `1px solid ${tokens.borderGold}`,
                      '& .MuiChip-icon': { color: tokens.gold },
                    }}
                  />
                )}
              </Stack>
            </Box>
          </Stack>

          <Typography variant="body2" sx={{ color: tokens.muted }}>
            {ar ? ws.description_ar : ws.description_en}
          </Typography>

          {(ar ? ws.mission_ar : ws.mission_en) && (
            <Box>
              <Typography
                variant="overline"
                sx={{ color: tokens.muted, fontSize: 10, display: 'block' }}
              >
                {t('workspaces.mission', 'Mission')}
              </Typography>
              <Typography variant="body2" sx={{ color: tokens.text }}>
                {ar ? ws.mission_ar : ws.mission_en}
              </Typography>
            </Box>
          )}

          {ws.head_name && (
            <Typography variant="body2" sx={{ color: tokens.muted }}>
              {t('workspaces.head', 'Department head')}:{' '}
              <Box component="span" sx={{ color: tokens.text }}>
                {ws.head_name}
              </Box>
            </Typography>
          )}

          <Box>
            <Typography
              variant="overline"
              sx={{ color: tokens.muted, fontSize: 10, display: 'block', mb: 0.5 }}
            >
              {t('workspaces.pages', 'Pages')}
            </Typography>
            <Stack
              direction="row"
              spacing={0.75}
              flexWrap="wrap"
              useFlexGap
              data-testid={`ws-items-${ws.key}`}
            >
              {(group?.items ?? []).map((item) => (
                <Chip
                  key={item}
                  size="small"
                  variant="outlined"
                  label={t(`nav.${item}`, item)}
                  sx={{ borderColor: tokens.border }}
                />
              ))}
            </Stack>
          </Box>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              pt: 1,
              borderTop: `1px solid ${tokens.border}`,
            }}
          >
            <Typography variant="caption" sx={{ color: tokens.muted }}>
              {updated
                ? t('workspaces.updatedBy', 'Updated by {{who}} on {{when}}', {
                    who: ws.updated_by ?? '—',
                    when: updated,
                  })
                : t('workspaces.neverUpdated', 'Not yet customized')}
            </Typography>
            {ws.can_edit ? (
              editBtn
            ) : (
              <Tooltip
                title={t(
                  'workspaces.lockHint',
                  'Only the owning department can edit this workspace.',
                )}
              >
                <span>{editBtn}</span>
              </Tooltip>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
}

export function WorkspacesPage() {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const { me } = useAuth()
  const queryClient = useQueryClient()

  const [editing, setEditing] = useState<Workspace | null>(null)
  const [form, setForm] = useState<EditForm | null>(null)
  const [toast, setToast] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: fetchWorkspaces,
  })

  const updateMutation = useMutation({
    mutationFn: ({ key, body }: { key: string; body: WorkspacePatch }) =>
      updateWorkspace(key, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
      setEditing(null)
      setForm(null)
      setToast(true)
    },
  })

  useEffect(() => {
    setForm(editing ? toForm(editing) : null)
  }, [editing])

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  const workspaces = orderByNav(data ?? [])
  const editable = workspaces.filter((w) => w.can_edit).length
  const myDept = me?.department ?? null

  const setField = (k: keyof EditForm, v: string) =>
    setForm((f) => (f ? { ...f, [k]: v } : f))

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5">{t('workspaces.title', 'Department Workspaces')}</Typography>
        <Typography variant="body2" sx={{ color: tokens.muted, mt: 0.5 }}>
          {t(
            'workspaces.subtitle',
            'Each department curates and edits its own workspace',
          )}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <Box data-testid="ws-kpi-total" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('workspaces.totalDepartments', 'Departments')}
            value={workspaces.length}
            accent={tokens.gold}
            icon={<WorkspacesOutlinedIcon />}
          />
        </Box>
        <Box data-testid="ws-kpi-editable" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('workspaces.youCanEdit', 'You can edit')}
            value={editable}
            accent={tokens.green}
            icon={<EditOutlinedIcon />}
          />
        </Box>
        <Box data-testid="ws-kpi-mine" sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('workspaces.yourDepartment', 'Your department')}
            value={myDept ?? '—'}
            accent={tokens.cyan}
            icon={<VerifiedUserOutlinedIcon />}
          />
        </Box>
      </Box>

      {workspaces.length === 0 ? (
        <Alert severity="info" data-testid="ws-empty">
          {t('workspaces.empty', 'No workspaces are available.')}
        </Alert>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {workspaces.map((ws) => (
            <WorkspaceCard
              key={ws.key}
              ws={ws}
              isOwn={!!myDept && myDept === ws.owner_department}
              onEdit={() => setEditing(ws)}
            />
          ))}
        </Box>
      )}

      <Dialog
        open={editing !== null && form !== null}
        onClose={() => setEditing(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {t('workspaces.editTitle', 'Edit workspace')}
          {editing ? ` · ${ar ? editing.name_ar : editing.name_en}` : ''}
        </DialogTitle>
        <DialogContent>
          {form && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              {updateMutation.isError && (
                <Alert severity="error" data-testid="ws-dialog-error">
                  {t(
                    'workspaces.saveError',
                    'Could not save. You may not be permitted to edit this workspace.',
                  )}
                </Alert>
              )}
              <TextField
                label={`${t('workspaces.name', 'Name')} (EN)`}
                value={form.name_en}
                onChange={(e) => setField('name_en', e.target.value)}
                fullWidth
                inputProps={{ 'data-testid': 'ws-field-name_en' }}
              />
              <TextField
                label={`${t('workspaces.name', 'Name')} (AR)`}
                value={form.name_ar}
                onChange={(e) => setField('name_ar', e.target.value)}
                fullWidth
                inputProps={{ 'data-testid': 'ws-field-name_ar' }}
              />
              <TextField
                label={`${t('workspaces.description', 'Description')} (EN)`}
                value={form.description_en}
                onChange={(e) => setField('description_en', e.target.value)}
                fullWidth
                multiline
                minRows={2}
                inputProps={{ 'data-testid': 'ws-field-description_en' }}
              />
              <TextField
                label={`${t('workspaces.description', 'Description')} (AR)`}
                value={form.description_ar}
                onChange={(e) => setField('description_ar', e.target.value)}
                fullWidth
                multiline
                minRows={2}
                inputProps={{ 'data-testid': 'ws-field-description_ar' }}
              />
              <TextField
                label={`${t('workspaces.mission', 'Mission')} (EN)`}
                value={form.mission_en}
                onChange={(e) => setField('mission_en', e.target.value)}
                fullWidth
                inputProps={{ 'data-testid': 'ws-field-mission_en' }}
              />
              <TextField
                label={`${t('workspaces.mission', 'Mission')} (AR)`}
                value={form.mission_ar}
                onChange={(e) => setField('mission_ar', e.target.value)}
                fullWidth
                inputProps={{ 'data-testid': 'ws-field-mission_ar' }}
              />
              <TextField
                label={t('workspaces.head', 'Department head')}
                value={form.head_name}
                onChange={(e) => setField('head_name', e.target.value)}
                fullWidth
                inputProps={{ 'data-testid': 'ws-field-head_name' }}
              />
              <TextField
                type="color"
                label={t('workspaces.accent', 'Accent color')}
                value={form.accent_color}
                onChange={(e) => setField('accent_color', e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
                inputProps={{ 'data-testid': 'ws-field-accent' }}
              />
              <TextField
                label={t('workspaces.featured', 'Featured pages (comma separated)')}
                value={form.featured}
                onChange={(e) => setField('featured', e.target.value)}
                fullWidth
                helperText={t(
                  'workspaces.featuredHint',
                  'Nav keys to pin, e.g. dashboard, reports',
                )}
                inputProps={{ 'data-testid': 'ws-field-featured' }}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setEditing(null)}
            color="inherit"
            data-testid="ws-dialog-cancel"
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="contained"
            disabled={!form || updateMutation.isPending}
            onClick={() => {
              if (editing && form) {
                updateMutation.mutate({ key: editing.key, body: toPatch(form) })
              }
            }}
            data-testid="ws-dialog-save"
          >
            {t('common.save', 'Save')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast}
        autoHideDuration={3000}
        onClose={() => setToast(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setToast(false)} data-testid="ws-toast">
          {t('workspaces.saved', 'Workspace updated')}
        </Alert>
      </Snackbar>
    </Stack>
  )
}
