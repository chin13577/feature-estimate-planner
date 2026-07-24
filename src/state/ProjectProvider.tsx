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

import { createDefaultProject } from '../domain/factories'
import type { ProjectData } from '../domain/types'
import { LocalStorageProjectRepository } from '../storage/LocalStorageProjectRepository'
import type { ProjectRepository } from '../storage/ProjectRepository'
import { useAutosave } from '../storage/useAutosave'
import { projectReducer } from './projectReducer'
import type { ProjectAction } from './projectReducer'

export interface ProjectContextValue {
  project: ProjectData
  dispatch: (action: ProjectAction) => void
  repository: ProjectRepository
  /** False while the saved project is still being read. */
  ready: boolean
  /** False when localStorage is unavailable and nothing will persist. */
  persistent: boolean
  /** Transient messages for the toast layer. */
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
  }, [repository, notify])

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

  const value = useMemo<ProjectContextValue>(
    () => ({
      project,
      dispatch,
      repository,
      ready,
      persistent,
      notices,
      notify,
      dismissNotice,
    }),
    [project, repository, ready, persistent, notices, notify, dismissNotice],
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
