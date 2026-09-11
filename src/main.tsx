import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import NewTab from './pages/NewTab.tsx'
import { ToastProvider } from './components/Toast.tsx'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ToastProvider>
            <NewTab />
        </ToastProvider>
    </StrictMode>,
)
