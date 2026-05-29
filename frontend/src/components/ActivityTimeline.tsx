import { Box, Chip, CircularProgress, Stack, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { fetchActivity } from '../api/activity'
import { tokens } from '../theme/tokens'

interface ActivityTimelineProps {
  targetType: string
  targetId: string
}

// Vertical, target-scoped audit feed: one node per recorded action with its
// timestamp, action name, and a granted/denied result chip.
export function ActivityTimeline({ targetType, targetId }: ActivityTimelineProps) {
  const { t } = useTranslation()
  const { data, isLoading } = useQuery({
    queryKey: ['activity', targetType, targetId],
    queryFn: () => fetchActivity(targetType, targetId),
  })

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}>
        <CircularProgress size={24} />
      </Box>
    )
  }

  const rows = data?.results ?? []

  if (rows.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: tokens.muted, py: 2 }}>
        {t('audit.noResults')}
      </Typography>
    )
  }

  return (
    <Box data-testid="activity-timeline" sx={{ position: 'relative', pl: 2 }}>
      {/* the gold spine */}
      <Box
        sx={{
          position: 'absolute',
          insetInlineStart: 4,
          top: 8,
          bottom: 8,
          width: 2,
          bgcolor: tokens.borderGold,
        }}
      />
      <Stack spacing={2.5}>
        {rows.map((row) => (
          <Box key={row.id} sx={{ position: 'relative', pl: 2.5 }}>
            {/* node dot */}
            <Box
              sx={{
                position: 'absolute',
                insetInlineStart: -4,
                top: 4,
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: row.result === 'GRANTED' ? tokens.green : tokens.red,
                border: `2px solid ${tokens.surface}`,
              }}
            />
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              justifyContent="space-between"
            >
              <Typography variant="body2" sx={{ color: tokens.text, fontWeight: 600 }}>
                {row.action}
              </Typography>
              <Chip
                size="small"
                color={row.result === 'GRANTED' ? 'success' : 'error'}
                label={row.result === 'GRANTED' ? t('audit.granted') : t('audit.denied')}
              />
            </Stack>
            <Typography
              variant="caption"
              sx={{ color: tokens.muted, fontFamily: 'monospace', display: 'block', mt: 0.25 }}
            >
              {row.ts}
            </Typography>
            <Typography variant="caption" sx={{ color: tokens.muted }}>
              {row.actor_label}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  )
}
