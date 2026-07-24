/**
 * Tri-state derivation for parent checkboxes.
 *
 * A phase or feature checkbox reflects its own `enabled` flag, but when it is
 * enabled and its children disagree with each other the checkbox renders as
 * indeterminate. This is display state only — it never feeds calculations,
 * which read the `enabled` flags directly.
 */

import type { MainFeature, Phase } from './types'

export type EnabledState = 'enabled' | 'disabled' | 'partial'

/**
 * Derive a parent's checkbox state from its own flag and its children's.
 *
 * A parent that is itself disabled reads as `disabled` regardless of children —
 * nothing under it contributes, so showing `partial` would misrepresent it.
 * A childless parent simply reflects its own flag.
 *
 * Children are passed as full tri-states rather than booleans so a partially
 * enabled child makes its parent partial too: a phase whose one feature has
 * some tasks off is not fully enabled, even though the feature's own flag is.
 */
function deriveState(
  ownEnabled: boolean,
  childStates: EnabledState[],
): EnabledState {
  if (!ownEnabled) return 'disabled'
  if (childStates.length === 0) return 'enabled'

  if (childStates.every((state) => state === 'enabled')) return 'enabled'
  if (childStates.every((state) => state === 'disabled')) return 'disabled'
  return 'partial'
}

/** Checkbox state for a feature, derived from its tasks. */
export function getFeatureEnabledState(feature: MainFeature): EnabledState {
  return deriveState(
    feature.enabled,
    feature.tasks.map((task) => (task.enabled ? 'enabled' : 'disabled')),
  )
}

/**
 * Checkbox state for a phase, derived from its features.
 *
 * A phase reads as `disabled` when every feature under it contributes nothing —
 * whether because the features are off or because all their tasks are —
 * matching what the totals will show.
 */
export function getPhaseEnabledState(phase: Phase): EnabledState {
  return deriveState(phase.enabled, phase.features.map(getFeatureEnabledState))
}
