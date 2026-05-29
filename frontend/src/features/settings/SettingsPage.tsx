import LanguageIcon from '@mui/icons-material/Language'
import Filter1Icon from '@mui/icons-material/LooksOne'
import TableRowsIcon from '@mui/icons-material/TableRows'
import { Box, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionCard } from '../../components/SectionCard'
import i18n, { applyLang, type Lang } from '../../i18n'
import { tokens } from '../../theme/tokens'

type Density = 'comfortable' | 'compact'
type Numerals = 'latin' | 'arabic'

const DENSITY_KEY = 'erp.density'
const NUMERALS_KEY = 'erp.numerals'

function readDensity(): Density {
  return localStorage.getItem(DENSITY_KEY) === 'compact' ? 'compact' : 'comfortable'
}

function readNumerals(): Numerals {
  return localStorage.getItem(NUMERALS_KEY) === 'arabic' ? 'arabic' : 'latin'
}

const toggleSx = {
  '& .MuiToggleButton-root': {
    color: tokens.muted,
    borderColor: tokens.border,
    '&.Mui-selected': {
      color: tokens.gold,
      borderColor: tokens.borderGold,
      backgroundColor: tokens.surface3,
    },
  },
} as const

// A labelled preference row: gold icon + overline heading above its control.
function PrefRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Box sx={{ color: tokens.muted, display: 'flex', '& svg': { fontSize: 18 } }}>{icon}</Box>
        <Typography variant="overline" sx={{ color: tokens.muted }}>
          {label}
        </Typography>
      </Stack>
      {children}
    </Box>
  )
}

export function SettingsPage() {
  const { t, i18n: i18next } = useTranslation()
  const lang: Lang = i18next.language === 'ar' ? 'ar' : 'en'

  const [density, setDensity] = useState<Density>(readDensity)
  const [numerals, setNumerals] = useState<Numerals>(readNumerals)

  return (
    <Stack spacing={3}>
      <Typography variant="h5">{t('settings.title')}</Typography>

      <SectionCard title={t('settings.language')}>
        <PrefRow icon={<LanguageIcon />} label={t('settings.language')}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={lang}
            onChange={(_e, next: Lang | null) => {
              if (next) applyLang(next)
            }}
            data-testid="settings-language"
            sx={toggleSx}
          >
            <ToggleButton value="en">English</ToggleButton>
            <ToggleButton value="ar">العربية</ToggleButton>
          </ToggleButtonGroup>
        </PrefRow>
      </SectionCard>

      <SectionCard title={t('settings.density')}>
        <Stack spacing={3}>
          <PrefRow icon={<TableRowsIcon />} label={t('settings.density')}>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={density}
              onChange={(_e, next: Density | null) => {
                if (!next) return
                setDensity(next)
                localStorage.setItem(DENSITY_KEY, next)
              }}
              data-testid="settings-density"
              sx={toggleSx}
            >
              <ToggleButton value="comfortable">{t('settings.comfortable')}</ToggleButton>
              <ToggleButton value="compact">{t('settings.compact')}</ToggleButton>
            </ToggleButtonGroup>
          </PrefRow>

          <PrefRow icon={<Filter1Icon />} label={t('settings.numerals')}>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={numerals}
              onChange={(_e, next: Numerals | null) => {
                if (!next) return
                setNumerals(next)
                localStorage.setItem(NUMERALS_KEY, next)
              }}
              data-testid="settings-numerals"
              sx={toggleSx}
            >
              <ToggleButton value="latin">123</ToggleButton>
              <ToggleButton value="arabic">١٢٣</ToggleButton>
            </ToggleButtonGroup>
          </PrefRow>
        </Stack>
      </SectionCard>
    </Stack>
  )
}

// Referenced so the i18n singleton is initialized when this page mounts standalone.
void i18n
