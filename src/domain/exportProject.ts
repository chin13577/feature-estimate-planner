/**
 * JSON export.
 *
 * Only source data is serialised — derived totals are never written, so an
 * exported file re-imports to exactly the same state it left.
 */

import { SCHEMA_VERSION } from './types'
import type { ProjectData } from './types'

const FILENAME_PREFIX = 'manday-estimate'
const FALLBACK_SLUG = 'untitled-project'

/**
 * Cap the slug so the full filename stays well inside the ~255-byte limit
 * common to Windows, macOS, and Linux filesystems.
 */
const MAX_SLUG_LENGTH = 80

/** Characters Windows forbids in filenames. */
const ILLEGAL_FILENAME_CHARS = /[\\/:*?"<>|]/g

/** C0 and C7F control characters — legal in a JS string, not in a filename. */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g

/**
 * Convert a project name into a filesystem-safe slug.
 *
 * Lowercased, spaces to hyphens, characters illegal on Windows removed.
 * Non-ASCII letters are kept: they are valid in filenames on every target
 * platform, and stripping them would turn a Thai or Japanese project name into
 * an empty string.
 */
export function slugifyProjectName(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(ILLEGAL_FILENAME_CHARS, '')
    .replace(CONTROL_CHARS, '')
    // Collapse any whitespace run to a single hyphen.
    .replace(/\s+/g, '-')
    // Dots would create a misleading extension; leading dots hide the file.
    .replace(/\.+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    // Trimming to length can leave a trailing hyphen behind.
    .replace(/-+$/, '')

  return slug.length > 0 ? slug : FALLBACK_SLUG
}

/** Local calendar date as YYYY-MM-DD — the user's date, not UTC. */
export function formatDateStamp(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** e.g. `manday-estimate-my-rpg-game-2026-07-24.json` */
export function buildExportFilename(
  project: ProjectData,
  date: Date = new Date(),
): string {
  return `${FILENAME_PREFIX}-${slugifyProjectName(project.name)}-${formatDateStamp(date)}.json`
}

/**
 * Build the export payload: source data plus an export timestamp.
 *
 * Field order here is what a user sees when they open the file, so metadata
 * leads and the bulky phase tree comes last.
 */
export function buildExportPayload(
  project: ProjectData,
  exportedAt: Date = new Date(),
): ProjectData {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: project.id,
    name: project.name,
    note: project.note,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    exportedAt: exportedAt.toISOString(),
    roles: project.roles,
    phases: project.phases,
  }
}

/** Serialise a project to indented JSON, as the spec requires. */
export function serializeProject(
  project: ProjectData,
  exportedAt: Date = new Date(),
): string {
  return JSON.stringify(buildExportPayload(project, exportedAt), null, 2)
}

/**
 * Trigger a browser download of the project as a `.json` file.
 *
 * The object URL is revoked after the click so the blob is not retained for
 * the lifetime of the page.
 */
export function exportProjectAsJson(
  project: ProjectData,
  now: Date = new Date(),
): void {
  const json = serializeProject(project, now)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = buildExportFilename(project, now)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}
