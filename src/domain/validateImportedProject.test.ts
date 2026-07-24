import { describe, expect, it } from 'vitest'

import { calculateProjectGrandTotal } from './calculations'
import { createDefaultProject } from './factories'
import { serializeProject } from './exportProject'
import {
  ProjectValidationError,
  importProjectFromText,
  parseProjectJson,
  validateImportedProject,
  validateImportedProjectDetailed,
} from './validateImportedProject'
import { feature, phase, project, role, task } from './testFixtures'

const DEV = 'role-dev'
const ARTIST = 'role-artist'

/** A minimal valid payload that individual tests mutate. */
function validPayload(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    id: 'project-001',
    name: 'My RPG Game',
    note: '',
    roles: [
      { id: DEV, name: 'Developer' },
      { id: ARTIST, name: 'Artist' },
    ],
    phases: [
      {
        id: 'phase-1',
        name: 'Pre-Production',
        enabled: true,
        collapsed: false,
        note: 'Scope excludes third-party login.',
        features: [
          {
            id: 'feature-1',
            name: 'Authentication',
            enabled: true,
            collapsed: false,
            tasks: [
              {
                id: 'task-1',
                name: 'Login',
                enabled: true,
                estimates: { [DEV]: 2, [ARTIST]: null },
              },
            ],
          },
        ],
      },
    ],
    createdAt: '2026-07-24T02:00:00.000Z',
    updatedAt: '2026-07-24T02:30:00.000Z',
  }
}

/** Assert that validating `value` throws with exactly `message`. */
function expectRejection(value: unknown, message: string): void {
  expect(() => validateImportedProject(value)).toThrowError(
    ProjectValidationError,
  )
  expect(() => validateImportedProject(value)).toThrowError(message)
}

describe('parseProjectJson', () => {
  it('reports malformed JSON with the spec wording', () => {
    expect(() => parseProjectJson('{ not json')).toThrowError(
      'The selected file is not valid JSON.',
    )
  })

  it('parses well-formed JSON', () => {
    expect(parseProjectJson('{"a":1}')).toEqual({ a: 1 })
  })
})

describe('schema version', () => {
  it('rejects an unsupported version with its number', () => {
    const payload = { ...validPayload(), schemaVersion: 3 }
    expectRejection(payload, 'Unsupported schema version: 3.')
  })

  it('reports a missing version as a missing field', () => {
    const payload = validPayload()
    delete payload['schemaVersion']
    expectRejection(payload, 'Missing required field: schemaVersion.')
  })

  it('checks the version before other structural problems', () => {
    // A v3 file with a missing `phases` should complain about the version,
    // not send the user hunting for a field their format may not even have.
    const payload: Record<string, unknown> = {
      ...validPayload(),
      schemaVersion: 3,
    }
    delete payload['phases']
    expectRejection(payload, 'Unsupported schema version: 3.')
  })

  it('accepts version 1', () => {
    expect(validateImportedProject(validPayload()).schemaVersion).toBe(1)
  })
})

describe('required fields', () => {
  it('reports a missing phases array', () => {
    const payload = validPayload()
    delete payload['phases']
    expectRejection(payload, 'Missing required field: phases.')
  })

  it('reports a missing roles array', () => {
    const payload = validPayload()
    delete payload['roles']
    expectRejection(payload, 'Missing required field: roles.')
  })

  it('rejects a non-array phases field', () => {
    expectRejection({ ...validPayload(), phases: 'nope' }, 'phases')
  })

  it('rejects a non-string project name', () => {
    expectRejection({ ...validPayload(), name: 42 }, 'name')
  })

  it('rejects a non-object payload', () => {
    expectRejection([], 'The file does not contain a project object.')
    expectRejection(null, 'The file does not contain a project object.')
    expectRejection('a string', 'The file does not contain a project object.')
  })
})

describe('roles', () => {
  it('rejects an empty role name', () => {
    const payload = validPayload()
    payload['roles'] = [{ id: DEV, name: '   ' }]
    expectRejection(payload, 'Name cannot be empty.')
  })

  it('reports duplicate role names after trimming', () => {
    const payload = validPayload()
    payload['roles'] = [
      { id: 'r1', name: 'Developer' },
      { id: 'r2', name: '  developer  ' },
    ]
    expectRejection(payload, 'Duplicate role name: developer.')
  })

  it('reports duplicate role IDs', () => {
    const payload = validPayload()
    payload['roles'] = [
      { id: 'r1', name: 'Developer' },
      { id: 'r1', name: 'Artist' },
    ]
    expectRejection(payload, 'Duplicate role ID: r1.')
  })
})

describe('unique IDs', () => {
  it('reports duplicate phase IDs', () => {
    const payload = validPayload()
    const phases = payload['phases'] as Record<string, unknown>[]
    payload['phases'] = [phases[0], { ...phases[0], name: 'Copy' }]
    expectRejection(payload, 'Duplicate phase ID: phase-1.')
  })

  it('reports feature IDs duplicated across different phases', () => {
    const payload = validPayload()
    const phases = payload['phases'] as Record<string, unknown>[]
    payload['phases'] = [
      phases[0],
      { ...phases[0], id: 'phase-2', name: 'Production' },
    ]
    expectRejection(payload, 'Duplicate feature ID: feature-1.')
  })
})

describe('estimates', () => {
  it('rejects a negative estimate', () => {
    const payload = validPayload()
    const phases = payload['phases'] as any[]
    phases[0].features[0].tasks[0].estimates[DEV] = -1
    expectRejection(payload, 'Estimate cannot be negative.')
  })

  it('rejects a non-finite estimate', () => {
    const payload = validPayload()
    const phases = payload['phases'] as any[]
    // JSON has no Infinity literal, but a hand-built object can carry one.
    phases[0].features[0].tasks[0].estimates[DEV] = Number.POSITIVE_INFINITY
    expectRejection(payload, 'Estimate must be a finite number.')
  })

  it('rejects a string estimate', () => {
    const payload = validPayload()
    const phases = payload['phases'] as any[]
    phases[0].features[0].tasks[0].estimates[DEV] = '2'
    expect(() => validateImportedProject(payload)).toThrowError(
      ProjectValidationError,
    )
  })

  it('accepts null, zero, and decimals', () => {
    const payload = validPayload()
    const phases = payload['phases'] as any[]
    phases[0].features[0].tasks[0].estimates = {
      [DEV]: 0,
      [ARTIST]: 2.25,
    }
    const result = validateImportedProject(payload)
    const estimates = result.phases[0]!.features[0]!.tasks[0]!.estimates
    expect(estimates[DEV]).toBe(0)
    expect(estimates[ARTIST]).toBe(2.25)
  })

  it('drops estimates for unknown roles and warns', () => {
    const payload = validPayload()
    const phases = payload['phases'] as any[]
    phases[0].features[0].tasks[0].estimates['role-ghost'] = 99

    const { project: imported, warnings } =
      validateImportedProjectDetailed(payload)
    const estimates = imported.phases[0]!.features[0]!.tasks[0]!.estimates

    expect(Object.keys(estimates).sort()).toEqual([ARTIST, DEV].sort())
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('1 estimate')
    // The dropped value must not reach any total.
    expect(calculateProjectGrandTotal(imported)).toBe(2)
  })

  it('pluralises the dropped-estimate warning', () => {
    const payload = validPayload()
    const phases = payload['phases'] as any[]
    phases[0].features[0].tasks[0].estimates['ghost-1'] = 1
    phases[0].features[0].tasks[0].estimates['ghost-2'] = 2

    const { warnings } = validateImportedProjectDetailed(payload)
    expect(warnings[0]).toContain('2 estimates')
  })
})

describe('safe defaults', () => {
  it('fills in missing optional fields', () => {
    const payload = {
      schemaVersion: 1,
      id: 'p1',
      name: 'Minimal',
      roles: [{ id: DEV, name: 'Developer' }],
      phases: [
        {
          id: 'phase-1',
          features: [{ id: 'feature-1', tasks: [{ id: 'task-1' }] }],
        },
      ],
    }

    const result = validateImportedProject(payload)
    const p = result.phases[0]!
    const f = p.features[0]!
    const t = f.tasks[0]!

    expect(result.note).toBe('')
    expect(p.enabled).toBe(true)
    expect(p.collapsed).toBe(false)
    expect(p.note).toBe('')
    expect(f.enabled).toBe(true)
    expect(t.enabled).toBe(true)
    expect(t.estimates).toEqual({})
    expect(typeof result.createdAt).toBe('string')
    expect(typeof result.updatedAt).toBe('string')
  })

  it('rejects a non-boolean enabled rather than defaulting it', () => {
    const payload = validPayload()
    const phases = payload['phases'] as any[]
    phases[0].enabled = 'yes'
    expectRejection(payload, 'enabled')
  })
})

describe('all-or-nothing behaviour', () => {
  it('never returns partial data when validation fails', () => {
    const payload = validPayload()
    const phases = payload['phases'] as any[]
    phases[0].features[0].tasks[0].estimates[DEV] = -5

    let returned: unknown = 'not-called'
    try {
      returned = validateImportedProject(payload)
    } catch {
      // expected
    }
    expect(returned).toBe('not-called')
  })

  it('does not mutate the input payload', () => {
    const payload = validPayload()
    const before = JSON.stringify(payload)
    validateImportedProject(payload)
    expect(JSON.stringify(payload)).toBe(before)
  })
})

describe('round trip', () => {
  it('re-imports an exported project unchanged', () => {
    const original = project(
      [role(DEV, 'Developer'), role(ARTIST, 'Artist')],
      [
        phase('phase-1', [
          feature('feature-1', [
            task('task-1', { [DEV]: 2, [ARTIST]: null }),
            task('task-2', { [DEV]: 1.5, [ARTIST]: 0 }, false),
          ]),
        ]),
      ],
    )
    original.phases[0]!.note = 'Multi\nline\nnote.'

    const text = serializeProject(original, new Date('2026-07-24T02:35:00Z'))
    const { project: reimported, warnings } = importProjectFromText(text)

    expect(warnings).toEqual([])
    expect(reimported.roles).toEqual(original.roles)
    expect(reimported.phases).toEqual(original.phases)
    expect(reimported.exportedAt).toBe('2026-07-24T02:35:00.000Z')
    expect(calculateProjectGrandTotal(reimported)).toBe(
      calculateProjectGrandTotal(original),
    )
  })

  it('round-trips a freshly created default project', () => {
    const original = createDefaultProject()
    const { project: reimported } = importProjectFromText(
      serializeProject(original),
    )

    expect(reimported.name).toBe('Untitled Project')
    expect(reimported.roles).toEqual(original.roles)
    expect(reimported.phases).toEqual(original.phases)
  })

  it('preserves disabled items and their estimates through a round trip', () => {
    const original = project(
      [role(DEV, 'Developer')],
      [phase('p1', [feature('f1', [task('t1', { [DEV]: 5 }, false)])], false)],
    )

    const { project: reimported } = importProjectFromText(
      serializeProject(original),
    )
    const t = reimported.phases[0]!.features[0]!.tasks[0]!

    expect(reimported.phases[0]!.enabled).toBe(false)
    expect(t.enabled).toBe(false)
    expect(t.estimates[DEV]).toBe(5)
    expect(calculateProjectGrandTotal(reimported)).toBe(0)
  })
})
