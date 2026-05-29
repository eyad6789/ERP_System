import '@testing-library/jest-dom/vitest'

import '../i18n'

// jsdom lacks ResizeObserver, which Recharts' ResponsiveContainer requires.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? (ResizeObserverStub as never)
