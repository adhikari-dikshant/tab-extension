import { RobotIcon as Bot } from '@phosphor-icons/react/dist/csr/Robot'
import { Offcanvas } from './Offcanvas'
import { ShortcutIcon } from './ShortcutIcon'
import { useStorageValue } from '../lib/useStorageValue'

export default function AiToolsButton() {
    const [tools] = useStorageValue('aiTools', [])

    return (
        <Offcanvas
            title="AI tools"
            description="Your saved tools for thinking, making, and exploring."
            icon={Bot}
            trigger={<button type="button" aria-label="AI tools"><Bot size={20} /></button>}
        >
            {tools.length ? <div className="launcher-grid">
                {tools.map((tool) => (
                    <a key={tool.id} href={tool.url} target="_blank" rel="noreferrer" className="launcher-tile">
                        <span className="launcher-icon"><ShortcutIcon url={tool.url} label={tool.label} icon={tool.icon} className="h-8 w-8 rounded-lg" /></span>
                        <span>{tool.label}</span>
                    </a>
                ))}
            </div> : <div className="offcanvas-empty">No tools saved yet. Add them in Settings → Personalization.</div>}
        </Offcanvas>
    )
}
