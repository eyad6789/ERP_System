import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  createRole,
  createUser,
  fetchRoles,
  fetchUsers,
  updateRole,
  updateUser,
  type AdminUser,
  type Role,
} from '../../api/admin'
import { ClassificationBadge } from '../../components/ClassificationBadge'
import { SectionCard } from '../../components/SectionCard'
import { tokens } from '../../theme/tokens'

// The nine ERP modules a role may be authorized for; labelled via t('nav.<m>').
const MODULE_KEYS = [
  'dashboard',
  'personnel',
  'documents',
  'finance',
  'operations',
  'assets',
  'gis',
  'incidents',
  'audit',
] as const

const CLEARANCE_LEVELS = [1, 2, 3, 4] as const

function ClearanceSelect({
  value,
  onChange,
  label,
}: {
  value: number
  onChange: (v: number) => void
  label: string
}) {
  const { t } = useTranslation()
  return (
    <FormControl fullWidth size="small">
      <InputLabel>{label}</InputLabel>
      <Select
        label={label}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {CLEARANCE_LEVELS.map((n) => (
          <MenuItem key={n} value={n}>
            {t(`clearance.${n}`)}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

function UserDialog({
  user,
  roles,
  onClose,
}: {
  user: AdminUser | null
  roles: Role[]
  onClose: () => void
}) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const editing = user !== null

  const [username, setUsername] = useState(user?.username ?? '')
  const [password, setPassword] = useState('')
  const [roleId, setRoleId] = useState<number | ''>(user?.role ?? '')
  const [clearance, setClearance] = useState<number>(user?.clearance ?? 1)
  const [department, setDepartment] = useState(user?.department ?? '')
  const [fullNameAr, setFullNameAr] = useState(user?.full_name_ar ?? '')
  const [fullNameEn, setFullNameEn] = useState(user?.full_name_en ?? '')
  const [isActive, setIsActive] = useState(user?.is_active ?? true)

  const mutation = useMutation({
    mutationFn: () =>
      editing
        ? updateUser(user.id, {
            role: roleId === '' ? null : roleId,
            clearance,
            department,
            is_active: isActive,
          })
        : createUser({
            username,
            password,
            role: roleId === '' ? null : roleId,
            clearance,
            department,
            full_name_ar: fullNameAr,
            full_name_en: fullNameEn,
          }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      onClose()
    },
  })

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {editing ? t('common.edit') : t('admin.addUser')}
        <IconButton
          size="small"
          onClick={onClose}
          aria-label={t('common.close')}
          sx={{ color: tokens.muted }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {!editing && (
            <>
              <TextField
                label={t('profile.username')}
                size="small"
                fullWidth
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                inputProps={{ 'data-testid': 'user-username' }}
              />
              <TextField
                label={t('login.password')}
                size="small"
                type="password"
                fullWidth
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <TextField
                label={t('profile.fullName')}
                size="small"
                fullWidth
                value={fullNameEn}
                onChange={(e) => setFullNameEn(e.target.value)}
              />
              <TextField
                label={`${t('profile.fullName')} (AR)`}
                size="small"
                fullWidth
                value={fullNameAr}
                onChange={(e) => setFullNameAr(e.target.value)}
              />
            </>
          )}
          <FormControl fullWidth size="small">
            <InputLabel>{t('profile.role')}</InputLabel>
            <Select
              label={t('profile.role')}
              value={roleId === '' ? '' : String(roleId)}
              onChange={(e) => setRoleId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <MenuItem value="">—</MenuItem>
              {roles.map((r) => (
                <MenuItem key={r.id} value={String(r.id)}>
                  {r.code}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <ClearanceSelect value={clearance} onChange={setClearance} label={t('personnel.clearance')} />
          <TextField
            label={t('personnel.department')}
            size="small"
            fullWidth
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          />
          {editing && (
            <FormControlLabel
              control={<Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />}
              label={t('admin.active')}
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || (!editing && (!username || !password))}
          data-testid="user-save"
        >
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function UsersCard({ users, roles }: { users: AdminUser[]; roles: Role[] }) {
  const { t } = useTranslation()
  const [dialog, setDialog] = useState<{ open: boolean; user: AdminUser | null }>({
    open: false,
    user: null,
  })
  const roleCode = (id: number | null): string =>
    id === null ? '—' : (roles.find((r) => r.id === id)?.code ?? '—')

  return (
    <SectionCard
      title={t('admin.users')}
      action={
        <Button
          size="small"
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialog({ open: true, user: null })}
          data-testid="add-user"
        >
          {t('admin.addUser')}
        </Button>
      }
    >
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('profile.username')}</TableCell>
            <TableCell>{t('profile.role')}</TableCell>
            <TableCell>{t('personnel.clearance')}</TableCell>
            <TableCell>{t('personnel.department')}</TableCell>
            <TableCell>{t('admin.active')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {users.map((u) => (
            <TableRow
              key={u.id}
              hover
              sx={{ cursor: 'pointer' }}
              onClick={() => setDialog({ open: true, user: u })}
              data-testid="user-row"
            >
              <TableCell sx={{ color: tokens.text }}>{u.username}</TableCell>
              <TableCell>{roleCode(u.role)}</TableCell>
              <TableCell>
                <ClassificationBadge level={u.clearance} />
              </TableCell>
              <TableCell>{u.department || '—'}</TableCell>
              <TableCell>
                <Chip
                  size="small"
                  variant="outlined"
                  color={u.is_active ? 'success' : 'default'}
                  label={u.is_active ? t('admin.active') : t('admin.deactivate')}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {dialog.open && (
        <UserDialog
          user={dialog.user}
          roles={roles}
          onClose={() => setDialog({ open: false, user: null })}
        />
      )}
    </SectionCard>
  )
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

function RoleDialog({ role, onClose }: { role: Role | null; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const editing = role !== null

  const [code, setCode] = useState(role?.code ?? '')
  const [nameAr, setNameAr] = useState(role?.name_ar ?? '')
  const [nameEn, setNameEn] = useState(role?.name_en ?? '')
  const [clearance, setClearance] = useState<number>(role?.clearance ?? 1)
  const [modules, setModules] = useState<string[]>(role?.modules ?? [])

  const mutation = useMutation({
    mutationFn: () =>
      editing
        ? updateRole(role.id, { name_ar: nameAr, name_en: nameEn, clearance, modules })
        : createRole({ code, name_ar: nameAr, name_en: nameEn, clearance, modules }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'roles'] })
      onClose()
    },
  })

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {editing ? t('common.edit') : t('admin.addRole')}
        <IconButton
          size="small"
          onClick={onClose}
          aria-label={t('common.close')}
          sx={{ color: tokens.muted }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label={t('admin.code')}
            size="small"
            fullWidth
            required
            disabled={editing}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputProps={{ 'data-testid': 'role-code-input' }}
          />
          <TextField
            label={`${t('personnel.name')} (AR)`}
            size="small"
            fullWidth
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
          />
          <TextField
            label={`${t('personnel.name')} (EN)`}
            size="small"
            fullWidth
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
          />
          <ClearanceSelect
            value={clearance}
            onChange={setClearance}
            label={t('personnel.clearance')}
          />
          <FormControl fullWidth size="small">
            <InputLabel>{t('admin.modules')}</InputLabel>
            <Select
              multiple
              label={t('admin.modules')}
              value={modules}
              onChange={(e) =>
                setModules(
                  typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value,
                )
              }
              input={<OutlinedInput label={t('admin.modules')} />}
              renderValue={(selected) => selected.map((m) => t(`nav.${m}`)).join(', ')}
            >
              {MODULE_KEYS.map((m) => (
                <MenuItem key={m} value={m}>
                  <Checkbox checked={modules.includes(m)} />
                  <ListItemText primary={t(`nav.${m}`)} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || (!editing && !code)}
          data-testid="role-save"
        >
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function RolesCard({ roles }: { roles: Role[] }) {
  const { t, i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const [dialog, setDialog] = useState<{ open: boolean; role: Role | null }>({
    open: false,
    role: null,
  })

  return (
    <SectionCard
      title={t('admin.roles')}
      action={
        <Button
          size="small"
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialog({ open: true, role: null })}
          data-testid="add-role"
        >
          {t('admin.addRole')}
        </Button>
      }
    >
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('admin.code')}</TableCell>
            <TableCell>{t('personnel.name')}</TableCell>
            <TableCell>{t('personnel.clearance')}</TableCell>
            <TableCell>{t('admin.modules')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {roles.map((r) => (
            <TableRow
              key={r.id}
              hover
              sx={{ cursor: 'pointer' }}
              onClick={() => setDialog({ open: true, role: r })}
              data-testid="role-row"
            >
              <TableCell sx={{ color: tokens.text }}>{r.code}</TableCell>
              <TableCell>{ar ? r.name_ar : r.name_en}</TableCell>
              <TableCell>
                <ClassificationBadge level={r.clearance} />
              </TableCell>
              <TableCell>{r.modules.length}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {dialog.open && (
        <RoleDialog role={dialog.role} onClose={() => setDialog({ open: false, role: null })} />
      )}
    </SectionCard>
  )
}

// ---------------------------------------------------------------------------

export function AdminPage() {
  const { t } = useTranslation()
  const usersQuery = useQuery({ queryKey: ['admin', 'users'], queryFn: fetchUsers })
  const rolesQuery = useQuery({ queryKey: ['admin', 'roles'], queryFn: fetchRoles })

  if (usersQuery.isLoading || rolesQuery.isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  const users: AdminUser[] = usersQuery.data ?? []
  const roles: Role[] = rolesQuery.data ?? []

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Typography variant="h5">{t('admin.title')}</Typography>
        <Chip size="small" label={users.length} sx={{ fontWeight: 600 }} />
      </Stack>
      <UsersCard users={users} roles={roles} />
      <RolesCard roles={roles} />
    </Stack>
  )
}
