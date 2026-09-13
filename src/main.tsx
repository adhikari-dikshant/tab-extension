import { StrictMode } from 'react'
import { IconContext } from '@phosphor-icons/react/dist/lib/context'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/plus-jakarta-sans'
import './index.css'
import NewTab from './pages/NewTab.tsx'
import { ToastProvider } from './components/Toast.tsx'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <IconContext.Provider value={{ weight: 'regular', 'aria-hidden': true }}>
            <ToastProvider>
                <NewTab />
            </ToastProvider>
        </IconContext.Provider>
    </StrictMode>,
)
