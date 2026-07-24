/**
 * Zod schema for the persisted project shape.
 *
 * This defines the *structural* contract only. Cross-cutting rules that zod
 * cannot express cleanly — ID uniqueness across siblings, duplicate role names,
 * estimates keyed by roles that do not exist — are checked afterwards in
 * `validateImportedProject.ts`, which owns the user-facing error messages.
 *
 * Optional fields fall back to the spec's safe defaults so a hand-written or
 * older file still imports rather than being rejected outright.
 */

import { z } from 'zod'

import { SCHEMA_VERSION } from './types'

/**
 * A stored estimate: blank, or a non-negative finite number.
 *
 * `z.number()` already rejects NaN, but Infinity passes it — `.finite()` is
 * what excludes that, and `.nonnegative()` enforces the spec's rule that
 * negative man-days are never valid.
 */
export const estimateValueSchema = z.union([
  z.null(),
  z
    .number()
    .finite('Estimate must be a finite number.')
    .nonnegative('Estimate cannot be negative.'),
])

/** Non-empty after trimming — whitespace is not a name. */
const nonEmptyName = z
  .string()
  .refine((value) => value.trim().length > 0, 'Name cannot be empty.')

export const roleSchema = z.object({
  id: z.string().min(1),
  name: nonEmptyName,
  burnRate: z
    .number()
    .finite('Burn rate must be a finite number.')
    .positive('Burn rate must be greater than zero.')
    .optional(),
})

export const taskSchema = z.object({
  id: z.string().min(1),
  name: z.string().default(''),
  enabled: z.boolean().default(true),
  estimates: z.record(z.string(), estimateValueSchema).default({}),
})

export const mainFeatureSchema = z.object({
  id: z.string().min(1),
  name: z.string().default(''),
  enabled: z.boolean().default(true),
  collapsed: z.boolean().default(false),
  note: z.string().optional(),
  tasks: z.array(taskSchema).default([]),
})

export const phaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().default(''),
  enabled: z.boolean().default(true),
  collapsed: z.boolean().default(false),
  note: z.string().default(''),
  features: z.array(mainFeatureSchema).default([]),
})

export const projectDataSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string().min(1),
  name: z.string(),
  note: z.string().default(''),
  roles: z.array(roleSchema),
  phases: z.array(phaseSchema),
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
  exportedAt: z.string().optional(),
})

export type ParsedProject = z.infer<typeof projectDataSchema>
