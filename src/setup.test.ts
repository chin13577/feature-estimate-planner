import { describe, expect, it } from 'vitest'

/**
 * M0 smoke test: proves the TypeScript + Vitest toolchain is wired up.
 * Real domain tests arrive with M1.
 */
describe('toolchain', () => {
  it('runs TypeScript tests', () => {
    const value: number = 1 + 1
    expect(value).toBe(2)
  })
})
