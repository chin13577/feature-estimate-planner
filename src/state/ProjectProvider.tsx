/**
 * Wires the reducer to the repository and exposes both to the component tree.
 *
 * Components dispatch actions and read the project from here; none of them
 * touch `localStorage` or the repository directly.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'

import { createDefaultProject, duplicateProject } from '../domain/factories'
import type { ProjectData } from '../domain/types'
import { LocalStorageProjectRepository } from '../storage/LocalStorageProjectRepository'
import type { ProjectRepository } from '../storage/ProjectRepository'
import { useAutosave } from '../storage/useAutosave'
import { projectReducer } from './projectReducer'
import type { ProjectAction } from './projectReducer'

/** Lightweight row for the project switcher — avoids holding every full tree. */
export interface ProjectSummaryEntry {
  id: string
  name: string
  updatedAt: string
}

export interface ProjectContextValue {
  project: ProjectData
  dispatch: (action: ProjectAction) => void
  repository: ProjectRepository
  /** False while the saved project is still being read. */
  ready: boolean
  /** False when localStorage is unavailable and nothing will persist. */
  persistent: boolean
  /** Every saved project, most recently updated first. */
  savedProjects: ProjectSummaryEntry[]
  openProject: (projectId: string) => Promise<void>
  createProject: () => Promise<void>
  /** Copy a saved project (defaults to the open one) and switch to it. */
  copyProject: (projectId?: string) => Promise<void>
  deleteProject: (projectId: string) => Promise<void>
  /** Adopt an imported project as a new saved project. */
  adoptProject: (project: ProjectData) => Promise<void>
  notices: Notice[]
  notify: (notice: Omit<Notice, 'id'>) => void
  dismissNotice: (id: number) => void
}

export interface Notice {
  id: number
  tone: 'info' | 'success' | 'error'
  message: string
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

export interface ProjectProviderProps {
  children: ReactNode
  /** Injectable for tests; defaults to local storage. */
  repository?: ProjectRepository
}

export function ProjectProvider({
  children,
  repository: injectedRepository,
}: ProjectProviderProps) {
  const [notices, setNotices] = useState<Notice[]>([])
  const noticeId = useRef(0)

  const notify = useCallback((notice: Omit<Notice, 'id'>) => {
    noticeId.current += 1
    const id = noticeId.current
    setNotices((current) => [...current, { ...notice, id }])
  }, [])

  const dismissNotice = useCallback((id: number) => {
    setNotices((current) => current.filter((notice) => notice.id !== id))
  }, [])

  // Built once: recreating the repository would restart the load effect.
  const repository = useMemo(
    () =>
      injectedRepository ??
      new LocalStorageProjectRepository({
        onCorruption: (report) => {
          notify({ tone: 'error', message: report.message })
        },
      }),
    [injectedRepository, notify],
  )

  // Seeded with a fresh project so the tree always has data to render; the
  // stored project replaces it once loaded.
  const [project, dispatch] = useReducer(projectReducer, undefined, () =>
    createDefaultProject(),
  )
  const [ready, setReady] = useState(false)
  const [persistent, setPersistent] = useState(true)
  const [savedProjects, setSavedProjects] = useState<ProjectSummaryEntry[]>([])

  const refreshSavedProjects = useCallback(async () => {
    try {
      const all = await repository.listProjects()
      setSavedProjects(
        all.map((entry) => ({
          id: entry.id,
          name: entry.name,
          updatedAt: entry.updatedAt,
        })),
      )
    } catch {
      // The switcher going stale is not worth interrupting the user over.
    }
  }, [repository])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const activeId = await repository.getActiveProjectId()
        const stored =
          activeId === null ? null : await repository.getProject(activeId)

        if (cancelled) return

        if (stored !== null) {
          dispatch({ type: 'project/replace', project: stored })
        } else {
          // Nothing saved yet — persist the seeded project so a refresh
          // returns to the same one rather than generating a new ID.
          const fresh = createDefaultProject()
          dispatch({ type: 'project/replace', project: fresh })
          await repository.saveProject(fresh)
        }

        if (!cancelled) await refreshSavedProjects()
      } catch {
        if (!cancelled) {
          setPersistent(false)
          notify({
            tone: 'error',
            message:
              'Browser storage is unavailable. Your work will not be saved — export a JSON backup before closing.',
          })
        }
      } finally {
        if (!cancelled) setReady(true)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [repository, notify, refreshSavedProjects])

  useAutosave({
    project,
    repository,
    enabled: ready,
    onError: () => {
      notify({
        tone: 'error',
        message:
          'Could not save to browser storage. Export a JSON backup to avoid losing work.',
      })
    },
  })

  // Keep the switcher's names and timestamps current as the open project is
  // edited, without re-reading storage on every keystroke.
  useEffect(() => {
    if (!ready) return
    setSavedProjects((current) => {
      const index = current.findIndex((entry) => entry.id === project.id)
      const next: ProjectSummaryEntry = {
        id: project.id,
        name: project.name,
        updatedAt: project.updatedAt,
      }
      if (index === -1) return [next, ...current]
      if (
        current[index]!.name === next.name &&
        current[index]!.updatedAt === next.updatedAt
      ) {
        return current
      }
      const copy = [...current]
      copy[index] = next
      return copy
    })
  }, [project.id, project.name, project.updatedAt, ready])

  /**
   * Persist the open project before switching away from it.
   * Autosave is debounced, so a fast switch could otherwise drop the last edit.
   */
  const flushCurrent = useCallback(async () => {
    try {
      await repository.saveProject(project)
    } catch {
      notify({
        tone: 'error',
        message: 'Could not save the current project before switching.',
      })
    }
  }, [repository, project, notify])

  const switchTo = useCallback(
    async (next: ProjectData) => {
      await repository.saveProject(next)
      await repository.setActiveProjectId(next.id)
      dispatch({ type: 'project/replace', project: next })
      await refreshSavedProjects()
    },
    [repository, refreshSavedProjects],
  )

  const openProject = useCallback(
    async (projectId: string) => {
      if (projectId === project.id) return

      await flushCurrent()
      const target = await repository.getProject(projectId)

      if (target === null) {
        notify({ tone: 'error', message: 'That project could not be found.' })
        await refreshSavedProjects()
        return
      }

      await repository.setActiveProjectId(target.id)
      dispatch({ type: 'project/replace', project: target })
    },
    [project.id, flushCurrent, repository, notify, refreshSavedProjects],
  )

  const createProject = useCallback(async () => {
    await flushCurrent()
    await switchTo(createDefaultProject())
  }, [flushCurrent, switchTo])

  const copyProject = useCallback(
    async (projectId?: string) => {
      await flushCurrent()

      const source =
        projectId === undefined || projectId === project.id
          ? project
          : await repository.getProject(projectId)

      if (source === null) {
        notify({ tone: 'error', message: 'That project could not be found.' })
        return
      }

      await switchTo(duplicateProject(source))
    },
    [flushCurrent, project, repository, notify, switchTo],
  )

  const deleteProject = useCallback(
    async (projectId: string) => {
      await repository.deleteProject(projectId)

      if (projectId === project.id) {
        // The open project is gone — fall back to whatever storage now
        // considers active, or start fresh if nothing remains.
        const nextId = await repository.getActiveProjectId()
        const next = nextId === null ? null : await repository.getProject(nextId)

        if (next !== null) {
          dispatch({ type: 'project/replace', project: next })
        } else {
          const fresh = createDefaultProject()
          await repository.saveProject(fresh)
          await repository.setActiveProjectId(fresh.id)
          dispatch({ type: 'project/replace', project: fresh })
        }
      }

      await refreshSavedProjects()
    },
    [repository, project.id, refreshSavedProjects],
  )

  const adoptProject = useCallback(
    async (incoming: ProjectData) => {
      await flushCurrent()

      // An imported file may carry the ID of a project already saved here;
      // re-keying it keeps the import additive rather than silently
      // overwriting the existing one.
      const existing = await repository.getProject(incoming.id)
      const adopted =
        existing === null || existing.id === project.id
          ? incoming
          : { ...incoming, id: crypto.randomUUID() }

      await switchTo(adopted)
    },
    [flushCurrent, repository, project.id, switchTo],
  )

  const value = useMemo<ProjectContextValue>(
    () => ({
      project,
      dispatch,
      repository,
      ready,
      persistent,
      savedProjects,
      openProject,
      createProject,
      copyProject,
      deleteProject,
      adoptProject,
      notices,
      notify,
      dismissNotice,
    }),
    [
      project,
      repository,
      ready,
      persistent,
      savedProjects,
      openProject,
      createProject,
      copyProject,
      deleteProject,
      adoptProject,
      notices,
      notify,
      dismissNotice,
    ],
  )

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  )
}

export function useProject(): ProjectContextValue {
  const context = useContext(ProjectContext)
  if (context === null) {
    throw new Error('useProject must be used inside a ProjectProvider')
  }
  return context
}
