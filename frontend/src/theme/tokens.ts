// Palette lifted from the prototype's :root CSS variables so the React app
// keeps the exact dark/gold/cyan institutional look.
export const tokens = {
  bg: '#0a1019',
  bg2: '#0d1524',
  surface: '#111c30',
  surface2: '#16233b',
  border: '#243450',
  text: '#e7edf7',
  muted: '#8ea0bf',
  gold: '#cda434',
  cyan: '#46b4dd',
  green: '#34c98a',
  red: '#e35b5b',
  orange: '#e09236',
} as const

// Classification level colors (1..4) — matches the prototype badge classes.
export const classification = {
  1: { key: 'public', color: '#46b4dd' },
  2: { key: 'restricted', color: '#cda434' },
  3: { key: 'secret', color: '#e09236' },
  4: { key: 'topSecret', color: '#e35b5b' },
} as const
