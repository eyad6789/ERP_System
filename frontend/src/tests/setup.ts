import '@testing-library/jest-dom/vitest'

import '../i18n'

// jsdom lacks ResizeObserver, which Recharts' ResponsiveContainer requires.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? (ResizeObserverStub as never)

// jsdom lacks URL.createObjectURL / revokeObjectURL, which maplibre-gl touches at
// import time and the invoice scanner uses to preview a chosen image file.
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = (() => 'blob:stub') as typeof URL.createObjectURL
  URL.revokeObjectURL = (() => {}) as typeof URL.revokeObjectURL
}
