import { Box, Card, CardContent, Typography } from '@mui/material'
import type { ReactNode } from 'react'

import { tokens } from '../theme/tokens'

// Titled panel with a gold tick + hairline rule beneath the heading.
export function SectionCard({
  title,
  action,
  children,
  sx,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  sx?: object
}) {
  return (
    <Card sx={{ flex: 1, minWidth: 320, ...sx }}>
      <CardContent>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2,
            pb: 1.25,
            borderBottom: `1px solid ${tokens.border}`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 3, height: 16, background: tokens.gold, borderRadius: 2 }} />
            <Typography variant="subtitle1" sx={{ color: tokens.text }}>
              {title}
            </Typography>
          </Box>
          {action}
        </Box>
        {children}
      </CardContent>
    </Card>
  )
}
