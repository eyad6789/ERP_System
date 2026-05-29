import { Box } from '@mui/material'
import type { StyleSpecification } from 'maplibre-gl'
import Map, { Marker, NavigationControl, ScaleControl } from 'react-map-gl/maplibre'

import { classification } from '../theme/tokens'

import 'maplibre-gl/dist/maplibre-gl.css'

export interface MapSite {
  id: number
  name_ar: string
  name_en: string
  site_type: string
  lat: number
  lng: number
  classification: number
}

// Real dark basemap (CARTO dark, OSM data) — no API key. Production self-hosts
// these vector/raster tiles for the air-gapped network (BUILD_PLAN §6).
const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap, © CARTO',
    },
  },
  layers: [{ id: 'carto', type: 'raster', source: 'carto' }],
}

export function LiveMap({
  sites,
  ar,
  onSelect,
}: {
  sites: MapSite[]
  ar: boolean
  onSelect?: (id: number) => void
}) {
  return (
    <Box
      sx={{
        height: 480,
        borderRadius: 2,
        overflow: 'hidden',
        border: '1px solid #2c2a25',
        '& .maplibregl-ctrl-attrib': { fontSize: 9, opacity: 0.5 },
      }}
    >
      <Map
        initialViewState={{ longitude: 43.7, latitude: 33.2, zoom: 5 }}
        mapStyle={MAP_STYLE}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
      >
        <NavigationControl position="top-left" showCompass={false} />
        <ScaleControl />
        {sites.map((s) => {
          const color = classification[s.classification as 1 | 2 | 3 | 4]?.color ?? '#c9a227'
          return (
            <Marker
              key={s.id}
              longitude={s.lng}
              latitude={s.lat}
              onClick={() => onSelect?.(s.id)}
            >
              <div
                data-testid="iraq-marker"
                title={ar ? s.name_ar : s.name_en}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: color,
                  border: '2px solid #16140d',
                  boxShadow: `0 0 0 4px ${color}33, 0 0 12px ${color}`,
                  cursor: 'pointer',
                }}
              />
            </Marker>
          )
        })}
      </Map>
    </Box>
  )
}
