import { Chip } from '@mui/material'
import { useTranslation } from 'react-i18next'

import { classification } from '../theme/tokens'

// Reusable clearance/classification badge (1-4), color-matched to the prototype.
export function ClassificationBadge({ level }: { level: number }) {
  const { t } = useTranslation()
  const meta = classification[level as 1 | 2 | 3 | 4]
  const color = meta?.color ?? '#888'
  return (
    <Chip
      label={t(`clearance.${level}`)}
      size="small"
      variant="outlined"
      sx={{ color, borderColor: color, fontWeight: 600 }}
    />
  )
}
