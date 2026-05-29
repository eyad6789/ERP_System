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

// Real satellite basemap (Esri World Imagery) — no API key. Note Esri uses
// {z}/{y}/{x} tile order. Production self-hosts the tiles for the air-gapped
// network (BUILD_PLAN §6). A labels overlay adds place names.
const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    imagery: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
    },
    labels: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
    },
  },
  layers: [
    { id: 'imagery', type: 'raster', source: 'imagery' },
    { id: 'labels', type: 'raster', source: 'labels' },
  ],
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
