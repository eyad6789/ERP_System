// "Ministry / Sovereign" palette — near-black charcoal with antique gold.
// Token KEYS are stable (other files import them); only values evolve.
export const tokens = {
  bg: '#121212', // page
  bg2: '#161514', // gradient companion (warm shadow)
  surface: '#1c1b19', // cards / paper
  surface2: '#222220', // elevated
  surface3: '#2a2824', // hover / inputs
  border: '#2c2a25', // hairline (warm dark)
  borderGold: 'rgba(201,162,39,0.22)', // gold hairline
  text: '#f1ece1', // warm off-white
  muted: '#9c958a', // warm grey
  gold: '#c9a227', // primary antique gold
  goldBright: '#e6c757', // highlight
  goldDim: '#8c7320', // deep gold
  cyan: '#6fa8c7', // repurposed: "public" steel-blue (cool accent)
  green: '#5aa97f',
  red: '#cf6a5b',
  orange: '#d6993f',
} as const

// Classification level colors (1..4): one cool accent (public) inside a warm
// gold-forward family, escalating toward alarm red at Top Secret.
export const classification = {
  1: { key: 'public', color: '#6fa8c7' }, // steel blue
  2: { key: 'restricted', color: '#c9a227' }, // gold
  3: { key: 'secret', color: '#d6993f' }, // amber
  4: { key: 'topSecret', color: '#cf6a5b' }, // muted red
} as const

// Chart palette (ordered) for Recharts series.
export const chartColors = ['#c9a227', '#d6993f', '#6fa8c7', '#5aa97f', '#cf6a5b'] as const
