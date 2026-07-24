import { ProjectProvider } from './state/ProjectProvider'
import { ThemeProvider } from './state/ThemeProvider'
import { EstimatorPage } from './EstimatorPage'

export default function App() {
  return (
    <ThemeProvider>
      <ProjectProvider>
        <EstimatorPage />
      </ProjectProvider>
    </ThemeProvider>
  )
}
