import { ProjectProvider } from './state/ProjectProvider'
import { EstimatorPage } from './EstimatorPage'

export default function App() {
  return (
    <ProjectProvider>
      <EstimatorPage />
    </ProjectProvider>
  )
}
