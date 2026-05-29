import { Box, Card, CardContent, Typography } from '@mui/material'
import type { ReactNode } from 'react'

import { tokens } from '../theme/tokens'

interface StatCardProps {
  label: string
  value: ReactNode
  accent?: string
  icon?: ReactNode
}

// Refined KPI tile: a gold-tinted top rule, an oversized accent watermark icon,
// and a large display numeral. Premium/institutional without clutter.
export function StatCard({ label, value, accent = tokens.gold, icon }: StatCardProps) {
  return (
    <Card sx={{ flex: 1, minWidth: 200, position: 'relative', overflow: 'hidden' }}>
      {/* full-width top rule in the accent color */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          insetInline: 0,
          height: 3,
          background: `linear-gradient(90deg, ${accent}, transparent 85%)`,
        }}
      />
      {/* small accent icon chip in the corner */}
      {icon && (
        <Box
          sx={{
            position: 'absolute',
            insetInlineEnd: 12,
            top: 12,
            width: 34,
            height: 34,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            color: accent,
            bgcolor: 'rgba(255,255,255,0.04)',
            border: `1px solid ${accent}33`,
            '& svg': { fontSize: 19 },
          }}
        >
          {icon}
        </Box>
      )}
      <CardContent sx={{ py: 2.5, position: 'relative' }}>
        <Typography
          variant="overline"
          sx={{ color: tokens.muted, display: 'block', mb: 0.75, fontSize: 11 }}
        >
          {label}
        </Typography>
        <Typography
          sx={{
            fontFamily: '"El Messiri", serif',
            fontWeight: 700,
            fontSize: 36,
            lineHeight: 1.05,
            color: tokens.text,
            textShadow: `0 0 24px ${accent}22`,
          }}
        >
          {value}
        </Typography>
      </CardContent>
    </Card>
  )
}
