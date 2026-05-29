import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
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
  changePassword,
  fetchSessions,
  mfaDisable,
  mfaSetup,
  mfaVerify,
  revokeSession,
  type MfaSetup,
  type SessionInfo,
} from '../../api/security'
import { SectionCard } from '../../components/SectionCard'
import i18n from '../../i18n'
import { tokens } from '../../theme/tokens'

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: tokens.surface3,
    '& fieldset': { borderColor: tokens.border },
    '&:hover fieldset': { borderColor: tokens.borderGold },
    '&.Mui-focused fieldset': { borderColor: tokens.gold },
  },
  '& .MuiInputLabel-root.Mui-focused': { color: tokens.gold },
}

const goldButtonSx = {
  fontWeight: 700,
  color: tokens.bg,
  background: `linear-gradient(135deg, ${tokens.goldBright}, ${tokens.gold})`,
  '&:hover': {
    background: `linear-gradient(135deg, ${tokens.goldBright}, ${tokens.goldDim})`,
  },
  '&.Mui-disabled': { background: tokens.surface3, color: tokens.muted },
}

// (1) Change-password panel.
function PasswordCard() {
  const { t } = useTranslation()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const mutation = useMutation({
    mutationFn: () => changePassword({ old_password: oldPassword, new_password: newPassword }),
    onSuccess: () => {
      setOldPassword('')
      setNewPassword('')
    },
  })

  return (
    <SectionCard title={t('security.password')}>
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault()
          mutation.mutate()
        }}
      >
        <Stack spacing={2}>
          <TextField
            label={t('security.oldPassword')}
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            autoComplete="current-password"
            fullWidth
            sx={fieldSx}
            inputProps={{ 'data-testid': 'old-password' }}
          />
          <TextField
            label={t('security.newPassword')}
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            fullWidth
            sx={fieldSx}
            inputProps={{ 'data-testid': 'new-password' }}
          />
          {mutation.isSuccess && <Alert severity="success">{t('common.saved')}</Alert>}
          {mutation.isError && (
            <Alert severity="error">
              {mutation.error instanceof Error ? mutation.error.message : t('common.required')}
            </Alert>
          )}
          <Box>
            <Button
              type="submit"
              variant="contained"
              disabled={mutation.isPending || !oldPassword || !newPassword}
              sx={goldButtonSx}
              data-testid="change-password"
            >
              {t('security.change')}
            </Button>
          </Box>
        </Stack>
      </Box>
    </SectionCard>
  )
}

// (2) MFA / TOTP panel.
function MfaCard() {
  const { t } = useTranslation()
  const [setup, setSetup] = useState<MfaSetup | null>(null)
  const [code, setCode] = useState('')

  const setupMutation = useMutation({
    mutationFn: mfaSetup,
    onSuccess: (data) => setSetup(data),
  })

  const verifyMutation = useMutation({
    mutationFn: () => mfaVerify(code),
    onSuccess: () => {
      setSetup(null)
      setCode('')
    },
  })

  const disableMutation = useMutation({
    mutationFn: mfaDisable,
    onSuccess: () => {
      setSetup(null)
      setCode('')
    },
  })

  return (
    <SectionCard title={t('security.mfa')}>
      <Stack spacing={2}>
        <Typography variant="body2" sx={{ color: tokens.muted }}>
          {t('security.mfaHint')}
        </Typography>

        {setup && (
          <Stack spacing={1.5}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 1,
                border: `1px solid ${tokens.border}`,
                bgcolor: tokens.surface2,
                fontFamily: 'monospace',
                fontSize: 13,
                color: tokens.text,
                wordBreak: 'break-all',
              }}
              data-testid="mfa-secret"
            >
              {setup.secret}
            </Box>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 1,
                border: `1px solid ${tokens.border}`,
                bgcolor: tokens.surface2,
                fontFamily: 'monospace',
                fontSize: 12,
                color: tokens.muted,
                wordBreak: 'break-all',
              }}
              data-testid="mfa-uri"
            >
              {setup.otpauth_uri}
            </Box>
            <TextField
              label={t('security.code')}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputProps={{ maxLength: 6, inputMode: 'numeric', 'data-testid': 'mfa-code' }}
              sx={{ ...fieldSx, maxWidth: 200 }}
            />
            {verifyMutation.isSuccess && <Alert severity="success">{t('common.saved')}</Alert>}
            {verifyMutation.isError && (
              <Alert severity="error">
                {verifyMutation.error instanceof Error
                  ? verifyMutation.error.message
                  : t('common.required')}
              </Alert>
            )}
          </Stack>
        )}

        <Stack direction="row" spacing={1.5}>
          {setup ? (
            <Button
              variant="contained"
              disabled={verifyMutation.isPending || code.length !== 6}
              onClick={() => verifyMutation.mutate()}
              sx={goldButtonSx}
              data-testid="mfa-verify"
            >
              {t('security.verify')}
            </Button>
          ) : (
            <Button
              variant="contained"
              disabled={setupMutation.isPending}
              onClick={() => setupMutation.mutate()}
              sx={goldButtonSx}
              data-testid="mfa-enable"
            >
              {t('security.enable')}
            </Button>
          )}
          <Button
            variant="outlined"
            color="error"
            disabled={disableMutation.isPending}
            onClick={() => disableMutation.mutate()}
            data-testid="mfa-disable"
          >
            {t('security.disable')}
          </Button>
        </Stack>
      </Stack>
    </SectionCard>
  )
}

// (3) Active sessions panel.
function SessionsCard() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['sessions'], queryFn: fetchSessions })

  const revokeMutation = useMutation({
    mutationFn: (key: string) => revokeSession(key),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
  })

  const sessions: SessionInfo[] = data ?? []

  return (
    <SectionCard title={t('security.sessions')}>
      {isLoading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('security.sessions')}</TableCell>
              <TableCell />
              <TableCell align="right">{t('common.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sessions.map((s) => (
              <TableRow key={s.key} data-testid="session-row">
                <TableCell sx={{ color: tokens.text }}>{s.user_agent}</TableCell>
                <TableCell sx={{ color: tokens.muted }}>
                  {s.current ? `(${t('security.current')})` : s.ip}
                </TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    disabled={s.current || revokeMutation.isPending}
                    onClick={() => revokeMutation.mutate(s.key)}
                  >
                    {t('security.revoke')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  )
}

export function SecurityPage() {
  const { t } = useTranslation()

  return (
    <Stack spacing={3}>
      <Typography variant="h5">{t('security.title')}</Typography>
      <PasswordCard />
      <MfaCard />
      <SessionsCard />
    </Stack>
  )
}

// Referenced so the i18n singleton is initialized when this page mounts standalone.
void i18n
