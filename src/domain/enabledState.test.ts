import { describe, expect, it } from 'vitest'

import { getFeatureEnabledState, getPhaseEnabledState } from './enabledState'
import { feature, phase, task } from './testFixtures'

describe('getFeatureEnabledState', () => {
  it('is enabled when the feature and all tasks are on', () => {
    const f = feature('f', [task('a', {}), task('b', {})])
    expect(getFeatureEnabledState(f)).toBe('enabled')
  })

  it('is partial when some tasks are off', () => {
    const f = feature('f', [task('a', {}), task('b', {}, false)])
    expect(getFeatureEnabledState(f)).toBe('partial')
  })

  it('is disabled when every task is off', () => {
    const f = feature('f', [task('a', {}, false), task('b', {}, false)])
    expect(getFeatureEnabledState(f)).toBe('disabled')
  })

  it('is disabled when the feature itself is off, whatever the tasks say', () => {
    const f = feature('f', [task('a', {}), task('b', {})], false)
    expect(getFeatureEnabledState(f)).toBe('disabled')
  })

  it('reflects its own flag when it has no tasks', () => {
    expect(getFeatureEnabledState(feature('f', []))).toBe('enabled')
    expect(getFeatureEnabledState(feature('f', [], false))).toBe('disabled')
  })
})

describe('getPhaseEnabledState', () => {
  it('is enabled when the phase and all features are fully on', () => {
    const p = phase('p', [
      feature('f1', [task('a', {})]),
      feature('f2', [task('b', {})]),
    ])
    expect(getPhaseEnabledState(p)).toBe('enabled')
  })

  it('is partial when one feature is off', () => {
    const p = phase('p', [
      feature('f1', [task('a', {})]),
      feature('f2', [task('b', {})], false),
    ])
    expect(getPhaseEnabledState(p)).toBe('partial')
  })

  it('is partial when a feature is itself only partially enabled', () => {
    const p = phase('p', [
      feature('f1', [task('a', {})]),
      feature('f2', [task('b', {}), task('c', {}, false)]),
    ])
    expect(getPhaseEnabledState(p)).toBe('partial')
  })

  it('is disabled when the phase itself is off', () => {
    const p = phase('p', [feature('f1', [task('a', {})])], false)
    expect(getPhaseEnabledState(p)).toBe('disabled')
  })

  it('is disabled when every feature is hollowed out by disabled tasks', () => {
    // Features are enabled but contribute nothing, so the checkbox should not
    // claim the phase is fully enabled.
    const p = phase('p', [
      feature('f1', [task('a', {}, false)]),
      feature('f2', [task('b', {}, false)]),
    ])
    expect(getPhaseEnabledState(p)).toBe('disabled')
  })

  it('reflects its own flag when it has no features', () => {
    expect(getPhaseEnabledState(phase('p', []))).toBe('enabled')
    expect(getPhaseEnabledState(phase('p', [], false))).toBe('disabled')
  })
})
