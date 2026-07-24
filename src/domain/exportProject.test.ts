import { describe, expect, it } from 'vitest'

import {
  buildExportFilename,
  buildExportPayload,
  formatDateStamp,
  serializeProject,
  slugifyProjectName,
} from './exportProject'
import { feature, phase, project, role, task } from './testFixtures'

const DEV = 'role-dev'

function named(name: string) {
  const p = project([role(DEV, 'Developer')], [])
  p.name = name
  return p
}

describe('slugifyProjectName', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(slugifyProjectName('My RPG Game')).toBe('my-rpg-game')
  })

  it('removes characters Windows forbids in filenames', () => {
    expect(slugifyProjectName('Q1/Q2: "Alpha" <build>?*|')).toBe('q1q2-alpha-build')
  })

  it('collapses whitespace runs and trims', () => {
    expect(slugifyProjectName('  Space    Marine  ')).toBe('space-marine')
  })

  it('replaces dots so no misleading extension is created', () => {
    expect(slugifyProjectName('v1.2.3 release')).toBe('v1-2-3-release')
  })

  it('never produces a leading or trailing hyphen', () => {
    expect(slugifyProjectName('---edge---')).toBe('edge')
    expect(slugifyProjectName('...')).toBe('untitled-project')
  })

  it('falls back when the name has no usable characters', () => {
    expect(slugifyProjectName('')).toBe('untitled-project')
    expect(slugifyProjectName('   ')).toBe('untitled-project')
    expect(slugifyProjectName('///')).toBe('untitled-project')
  })

  it('keeps non-ASCII letters rather than emptying the name', () => {
    // Stripping these would reduce a Thai or Japanese name to the fallback.
    expect(slugifyProjectName('เกม RPG')).toBe('เกม-rpg')
    expect(slugifyProjectName('ゲーム')).toBe('ゲーム')
  })

  it('strips control characters', () => {
    expect(slugifyProjectName('game'+'\u0007'+'name')).toBe('gamename')
  })

  it('caps very long names', () => {
    const slug = slugifyProjectName('a'.repeat(300))
    expect(slug.length).toBe(80)
  })

  it('does not leave a trailing hyphen after truncation', () => {
    // 80th character lands on a space, which would become a trailing hyphen.
    const slug = slugifyProjectName(`${'a'.repeat(79)} tail`)
    expect(slug.endsWith('-')).toBe(false)
  })
})

describe('formatDateStamp', () => {
  it('formats as YYYY-MM-DD with zero padding', () => {
    expect(formatDateStamp(new Date(2026, 6, 24))).toBe('2026-07-24')
    expect(formatDateStamp(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('uses the local calendar date, not UTC', () => {
    // Late-evening local time can already be the next day in UTC; the filename
    // should match the date the user sees on their own calendar.
    const localDate = new Date(2026, 6, 24, 23, 30)
    expect(formatDateStamp(localDate)).toBe('2026-07-24')
  })
})

describe('buildExportFilename', () => {
  it('matches the spec example', () => {
    expect(buildExportFilename(named('My RPG Game'), new Date(2026, 6, 24))).toBe(
      'manday-estimate-my-rpg-game-2026-07-24.json',
    )
  })

  it('always ends in .json', () => {
    expect(buildExportFilename(named('anything'))).toMatch(/\.json$/)
  })

  it('uses the fallback slug for an unusable name', () => {
    expect(buildExportFilename(named('***'), new Date(2026, 6, 24))).toBe(
      'manday-estimate-untitled-project-2026-07-24.json',
    )
  })
})

describe('buildExportPayload', () => {
  const source = project(
    [role(DEV, 'Developer')],
    [phase('p1', [feature('f1', [task('t1', { [DEV]: 2 })])])],
  )

  it('stamps exportedAt as an ISO timestamp', () => {
    const payload = buildExportPayload(source, new Date('2026-07-24T02:35:00Z'))
    expect(payload.exportedAt).toBe('2026-07-24T02:35:00.000Z')
  })

  it('preserves createdAt and updatedAt from the source', () => {
    const payload = buildExportPayload(source)
    expect(payload.createdAt).toBe(source.createdAt)
    expect(payload.updatedAt).toBe(source.updatedAt)
  })

  it('carries the schema version', () => {
    expect(buildExportPayload(source).schemaVersion).toBe(1)
  })

  it('stores no derived totals', () => {
    const serialized = serializeProject(source)
    // Any of these appearing would mean a computed value leaked into the file.
    expect(serialized).not.toMatch(/total/i)
    expect(serialized).not.toMatch(/grandTotal/i)
  })

  it('does not mutate the source project', () => {
    const before = JSON.stringify(source)
    buildExportPayload(source)
    serializeProject(source)
    expect(JSON.stringify(source)).toBe(before)
  })
})

describe('serializeProject', () => {
  const source = project(
    [role(DEV, 'Developer')],
    [phase('p1', [feature('f1', [task('t1', { [DEV]: 2 })])])],
  )

  it('indents the output', () => {
    const text = serializeProject(source)
    expect(text).toContain('\n  "schemaVersion": 1')
  })

  it('produces parseable JSON', () => {
    expect(() => JSON.parse(serializeProject(source))).not.toThrow()
  })

  it('preserves blank estimates as null rather than dropping them', () => {
    const withBlank = project(
      [role(DEV, 'Developer')],
      [phase('p1', [feature('f1', [task('t1', { [DEV]: null })])])],
    )
    const parsed = JSON.parse(serializeProject(withBlank))
    expect(parsed.phases[0].features[0].tasks[0].estimates[DEV]).toBeNull()
  })
})
