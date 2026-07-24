/**
 * Builders for test data.
 *
 * These take explicit IDs so tests read declaratively and assertions can refer
 * to roles by a stable name rather than a generated UUID.
 */

import { SCHEMA_VERSION } from './types'
import type {
  EstimateValue,
  MainFeature,
  Phase,
  ProjectData,
  Role,
  Task,
} from './types'

export function role(id: string, name = id): Role {
  return { id, name }
}

export function task(
  id: string,
  estimates: Record<string, EstimateValue>,
  enabled = true,
): Task {
  return { id, name: id, enabled, estimates }
}

export function feature(
  id: string,
  tasks: Task[],
  enabled = true,
): MainFeature {
  return { id, name: id, enabled, collapsed: false, tasks }
}

export function phase(
  id: string,
  features: MainFeature[],
  enabled = true,
): Phase {
  return { id, name: id, enabled, collapsed: false, note: '', features }
}

export function project(roles: Role[], phases: Phase[]): ProjectData {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: 'project-test',
    name: 'Test Project',
    note: '',
    roles,
    phases,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}
