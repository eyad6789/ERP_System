import BadgeIcon from '@mui/icons-material/Badge'
import LogoutIcon from '@mui/icons-material/Logout'
import SecurityIcon from '@mui/icons-material/Security'
import WidgetsIcon from '@mui/icons-material/Widgets'
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { fetchMe, logout } from '../../api/auth'
import { ClassificationBadge } from '../../components/ClassificationBadge'
import { SectionCard } from '../../components/SectionCard'
import { StatCard } from '../../components/StatCard'
import i18n, { applyLang, type Lang } from '../../i18n'
import { tokens } from '../../theme/tokens'

// A single label/value row inside the account panel.
function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      spacing={2}
      sx={{ py: 1 }}
    >
      <Typography variant="body2" sx={{ color: tokens.muted }}>
        {label}
      </Typography>
      <Box sx={{ color: tokens.text, textAlign: 'end' }}>{children}</Box>
    </Stack>
  )
}

export function ProfilePage() {
  const { t, i18n: i18next } = useTranslation()
  const ar = i18next.language === 'ar'
  const { data: me, isLoading } = useQuery({ queryKey: ['me'], queryFn: fetchMe })

  if (isLoading || !me) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  const fullName = ar ? me.full_name_ar : me.full_name_en
  const roleName = me.role ? (ar ? me.role.name_ar : me.role.name_en) : '—'
  const lang: Lang = ar ? 'ar' : 'en'

  return (
    <Stack spacing={3}>
      <Typography variant="h5">{t('profile.title')}</Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('profile.clearance')}
            value={me.clearance}
            accent={tokens.gold}
            icon={<BadgeIcon />}
          />
        </Box>
        <Box sx={{ flex: 1, minWidth: 200, display: 'flex' }}>
          <StatCard
            label={t('profile.modules')}
            value={me.modules.length}
            accent={tokens.cyan}
            icon={<WidgetsIcon />}
          />
        </Box>
      </Box>

      <SectionCard title={t('profile.account')}>
        <Stack divider={<Divider sx={{ borderColor: tokens.border }} />}>
          <DetailRow label={t('profile.username')}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {me.username}
            </Typography>
          </DetailRow>
          <DetailRow label={t('profile.fullName')}>
            <Typography variant="body2">{fullName}</Typography>
          </DetailRow>
          <DetailRow label={t('profile.department')}>
            <Typography variant="body2">{me.department}</Typography>
          </DetailRow>
          <DetailRow label={t('profile.role')}>
            <Typography variant="body2">{roleName}</Typography>
          </DetailRow>
          <DetailRow label={t('profile.clearance')}>
            <ClassificationBadge level={me.clearance} />
          </DetailRow>
        </Stack>

        <Box sx={{ mt: 2 }}>
          <Typography variant="overline" sx={{ color: tokens.muted, display: 'block', mb: 1 }}>
            {t('profile.modules')}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            {me.modules.map((m) => (
              <Chip
                key={m}
                size="small"
                variant="outlined"
                label={t(`nav.${m}`)}
                sx={{ color: tokens.gold, borderColor: tokens.borderGold }}
              />
            ))}
          </Stack>
        </Box>
      </SectionCard>

      <SectionCard title={t('profile.security')}>
        <Stack spacing={3}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <SecurityIcon sx={{ fontSize: 18, color: tokens.muted }} />
              <Typography variant="overline" sx={{ color: tokens.muted }}>
                {t('profile.language')}
              </Typography>
            </Stack>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={lang}
              onChange={(_e, next: Lang | null) => {
                if (next) applyLang(next)
              }}
              sx={{
                '& .MuiToggleButton-root': {
                  color: tokens.muted,
                  borderColor: tokens.border,
                  '&.Mui-selected': {
                    color: tokens.gold,
                    borderColor: tokens.borderGold,
                    backgroundColor: tokens.surface3,
                  },
                },
              }}
            >
              <ToggleButton value="en">English</ToggleButton>
              <ToggleButton value="ar">العربية</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Box>
            <Button
              variant="outlined"
              color="error"
              startIcon={<LogoutIcon />}
              onClick={() => {
                void logout()
              }}
            >
              {t('profile.signOut')}
            </Button>
          </Box>
        </Stack>
      </SectionCard>
    </Stack>
  )
}

// Referenced so the i18n singleton is initialized when this page mounts standalone.
void i18n
