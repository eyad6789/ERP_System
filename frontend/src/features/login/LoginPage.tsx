import { Alert, Box, Button, TextField, Typography } from '@mui/material'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { login } from '../../api/auth'
import { useAuth } from '../../auth/AuthProvider'
import { tokens } from '../../theme/tokens'

// A faint topographic / contour grid rendered as an inline SVG data URI so it
// ships with no extra deps and tints toward warm gold at very low opacity.
const TOPO_GRID =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Cg fill='none' stroke='%23c9a227' stroke-width='0.6'%3E%3Cpath d='M0 60 Q30 30 60 60 T120 60'/%3E%3Cpath d='M0 90 Q30 60 60 90 T120 90'/%3E%3Cpath d='M0 30 Q30 0 60 30 T120 30'/%3E%3C/g%3E%3C/svg%3E\")"

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { refetch } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const mutation = useMutation({
    mutationFn: () => login(username, password),
    onSuccess: () => {
      refetch()
      navigate('/dashboard', { replace: true })
    },
  })

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      bgcolor: tokens.surface3,
      '& fieldset': { borderColor: tokens.border },
      '&:hover fieldset': { borderColor: tokens.borderGold },
      '&.Mui-focused fieldset': { borderColor: tokens.gold },
    },
    '& .MuiInputLabel-root.Mui-focused': { color: tokens.gold },
  }

  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
        background: `radial-gradient(1100px 700px at 50% -10%, ${tokens.surface2} 0%, ${tokens.bg} 55%, ${tokens.bg2} 100%)`,
      }}
    >
      {/* subtle radial gold glow */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(620px 420px at 50% 24%, rgba(201,162,39,0.14), transparent 70%)',
        }}
      />
      {/* faint topographic contour grid */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: 0.05,
          backgroundImage: TOPO_GRID,
          backgroundSize: '180px 180px',
          maskImage: 'radial-gradient(circle at 50% 35%, black, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(circle at 50% 35%, black, transparent 80%)',
        }}
      />

      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault()
          mutation.mutate()
        }}
        sx={{
          position: 'relative',
          width: 'min(420px, calc(100vw - 32px))',
          px: { xs: 3.5, sm: 5 },
          py: 5,
          borderRadius: 3,
          border: `1px solid ${tokens.borderGold}`,
          background: `linear-gradient(180deg, rgba(34,34,32,0.92), rgba(28,27,25,0.92))`,
          backdropFilter: 'blur(8px)',
          boxShadow: '0 30px 80px -20px rgba(0,0,0,0.75), 0 0 0 1px rgba(0,0,0,0.4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {/* gold rhombus crest */}
        <Box sx={{ display: 'grid', placeItems: 'center', mb: 0.5 }}>
          <Box
            sx={{
              width: 52,
              height: 52,
              transform: 'rotate(45deg)',
              borderRadius: 1.5,
              border: `1px solid ${tokens.gold}`,
              display: 'grid',
              placeItems: 'center',
              background: `linear-gradient(135deg, ${tokens.goldBright}, ${tokens.goldDim})`,
              boxShadow: `0 0 28px rgba(201,162,39,0.35)`,
            }}
          >
            <Box
              sx={{
                width: 26,
                height: 26,
                transform: 'rotate(-45deg)',
                borderRadius: 0.5,
                border: `1px solid ${tokens.bg}`,
                opacity: 0.55,
              }}
            />
          </Box>
        </Box>

        <Typography
          align="center"
          sx={{
            fontFamily: '"El Messiri", serif',
            fontWeight: 700,
            fontSize: 15,
            letterSpacing: '0.04em',
            color: tokens.gold,
            textTransform: 'uppercase',
          }}
        >
          {t('appName')}
        </Typography>

        <Box sx={{ textAlign: 'center', mb: 1 }}>
          <Typography
            sx={{
              fontFamily: '"El Messiri", serif',
              fontWeight: 700,
              fontSize: 26,
              color: tokens.text,
            }}
          >
            {t('login.title')}
          </Typography>
          <Typography variant="body2" sx={{ color: tokens.muted, mt: 0.5 }}>
            {t('login.subtitle')}
          </Typography>
        </Box>

        <TextField
          label={t('login.username')}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          fullWidth
          sx={fieldSx}
        />
        <TextField
          label={t('login.password')}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          fullWidth
          sx={fieldSx}
        />

        {mutation.isError && <Alert severity="error">{t('login.invalid')}</Alert>}

        <Button
          type="submit"
          variant="contained"
          disabled={mutation.isPending}
          sx={{
            mt: 0.5,
            py: 1.25,
            fontWeight: 700,
            letterSpacing: '0.03em',
            color: tokens.bg,
            background: `linear-gradient(135deg, ${tokens.goldBright}, ${tokens.gold})`,
            boxShadow: '0 8px 24px -8px rgba(201,162,39,0.6)',
            '&:hover': {
              background: `linear-gradient(135deg, ${tokens.goldBright}, ${tokens.goldDim})`,
            },
            '&.Mui-disabled': { background: tokens.surface3, color: tokens.muted },
          }}
        >
          {t('login.submit')}
        </Button>

        {/* classification-style footer line */}
        <Box
          sx={{
            mt: 1,
            pt: 1.5,
            borderTop: `1px solid ${tokens.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
          }}
        >
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: tokens.gold }} />
          <Typography
            sx={{
              fontSize: 10.5,
              letterSpacing: '0.12em',
              color: tokens.muted,
              textTransform: 'uppercase',
            }}
          >
            {t('classline')}
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
