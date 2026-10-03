import { useState } from 'react'
import { BrowsersIcon } from '@phosphor-icons/react/dist/csr/Browsers'
import { Offcanvas } from './Offcanvas'
import WorkspacesPanel from './WorkspacesPanel'

export default function WorkspacesButton() {
    const [open, setOpen] = useState(false)
    return <Offcanvas title="Workspaces" description="Save the tabs you're working with and reopen them together later." icon={BrowsersIcon} open={open} onOpenChange={setOpen}
        trigger={<button type="button" aria-label="Saved workspaces"><BrowsersIcon size={20} /></button>}>
        <WorkspacesPanel />
    </Offcanvas>
}
