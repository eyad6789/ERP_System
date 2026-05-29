import { Alert, Box, Button, Paper, TextField, Typography } from '@mui/material'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { login } from '../../api/auth'
import { useAuth } from '../../auth/AuthProvider'

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

  return (
    <Box sx={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
      <Paper sx={{ p: 5, width: 380 }} elevation={6}>
        <Typography variant="h6" align="center">
          {t('login.title')}
        </Typography>
        <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 3 }}>
          {t('login.subtitle')}
        </Typography>
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault()
            mutation.mutate()
          }}
          sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          <TextField
            label={t('login.username')}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
          <TextField
            label={t('login.password')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {mutation.isError && <Alert severity="error">{t('login.invalid')}</Alert>}
          <Button type="submit" variant="contained" disabled={mutation.isPending}>
            {t('login.submit')}
          </Button>
        </Box>
      </Paper>
    </Box>
  )
}
