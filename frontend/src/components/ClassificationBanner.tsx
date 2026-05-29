import { Box } from '@mui/material'
import { useTranslation } from 'react-i18next'

// The red 45° striped classification bar shown top & bottom of the shell.
export function ClassificationBanner() {
  const { t } = useTranslation()
  return (
    <Box
      role="banner"
      aria-label="classification"
      sx={{
        height: 22,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: '#1a0f0f',
        backgroundImage:
          'repeating-linear-gradient(45deg,#e35b5b,#e35b5b 14px,#c44 14px,#c44 28px)',
      }}
    >
      {t('classline')}
    </Box>
  )
}
