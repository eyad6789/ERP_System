/// <reference types="vite/client" />

// stylis ships no bundled types; declare the named export we use.
declare module 'stylis' {
  export const prefixer: (element: unknown, index: number, children: unknown[]) => string | void
}
