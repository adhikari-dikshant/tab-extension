import { useEffect, useState } from 'react'
import { TimerIcon } from '@phosphor-icons/react/dist/csr/Timer'
import { Offcanvas } from './Offcanvas'
import { useStorageValue } from '../lib/useStorageValue'
import { changeStored, EMPTY_FOCUS, localDate, settleFocus, startFocus } from '../lib/productivity'
import { useToast } from '../lib/useToast'

export default function FocusButton() {
    const [focus] = useStorageValue('focus', EMPTY_FOCUS)
    const [todos] = useStorageValue('todos', [])
    const [open, setOpen] = useState(false)
    const [minutes, setMinutes] = useState(25)
    const [taskId, setTaskId] = useState('')
    const [now, setNow] = useState(Date.now)
    const toast = useToast()
    const session = focus.session
    const running = session?.status === 'running'
    const remaining = running ? Math.min(session.durationMs, Math.max(0, (session.endsAt || now) - now)) : session?.remainingMs || 0
    const seconds = Math.ceil(remaining / 1000)
    const time = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
    useEffect(() => {
        const listener = () => setOpen(true)
        window.addEventListener('dashboard:focus', listener)
        const interval = setInterval(() => setNow(Date.now()), 1000)
        return () => { clearInterval(interval); window.removeEventListener('dashboard:focus', listener) }
    }, [])
    useEffect(() => { if (running && remaining <= 0) void settleFocus().catch(() => toast('Could not save this session. Please try again.')) }, [running, remaining, toast])
    const start = async (mode: 'focus' | 'break') => {
        try { await startFocus(mode === 'break' ? 5 : minutes, todos.find((todo) => todo.id === taskId), mode) }
        catch { toast('Could not start the timer. Please try again.') }
    }
    const pauseResume = () => changeStored('focus', EMPTY_FOCUS, (value) => {
        const active = value.session
        if (!active || active.status === 'finished') return value
        return {
            ...value, session: active.status === 'running'
                ? { ...active, status: 'paused', remainingMs: Math.max(0, (active.endsAt || Date.now()) - Date.now()), endsAt: null }
                : { ...active, status: 'running', endsAt: Date.now() + active.remainingMs }
        }
    })
    const today = focus.history.filter((entry) => localDate(new Date(entry.completedAt)) === localDate())
    return <Offcanvas title="Focus" description="One task at a time. Your timer stays in sync across new tabs." icon={TimerIcon} open={open} onOpenChange={setOpen}
        trigger={<button className="focus-chip" aria-label="Focus timer"><TimerIcon size={15} /><span>{session && session.status !== 'finished' ? `${session.mode === 'break' ? 'Break ' : ''}${time}` : session?.status === 'finished' ? 'Session complete' : 'Start focus'}</span></button>}>
        {session && <div className="focus-session">
            <span className="productivity-muted">{session.mode === 'break' ? 'BREAK' : 'FOCUS SESSION'}</span>
            <strong>{session.label}</strong><time>{session.status === 'finished' ? 'Done' : time}</time>
            <span role="status">{session.status === 'paused' ? 'Paused' : session.status === 'finished' ? 'Session complete. Take a moment to reset.' : 'You have time for this.'}</span>
            <div className="productivity-toolbar">
                {session.status !== 'finished' && <button className="productivity-button mt-5" onClick={() => void pauseResume()}>{running ? 'Pause' : 'Resume'}</button>}
                <button className="productivity-button mt-5" onClick={() => void changeStored('focus', EMPTY_FOCUS, (value) => ({ ...value, session: null }))}>{session.status === 'finished' ? 'Dismiss' : 'Stop session'}</button>
                {session.status === 'finished' && session.mode === 'focus' && <button className="productivity-button mt-5" onClick={() => void start('break')}>Take a 5-minute break</button>}
            </div>
        </div>}
        {(!session || session.status === 'finished') && <div className="productivity-form">
            <label>Task<select aria-label="Focus task" value={taskId} onChange={(e) => setTaskId(e.target.value)}><option value="">Free focus</option>{todos.filter((todo) => !todo.done).map((todo) => <option key={todo.id} value={todo.id}>{todo.text}</option>)}</select></label>
            <label>Duration (minutes)<input type="number" aria-label="Focus duration" min={1} max={180} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} /></label>
            <button className="productivity-button mt-5 primary" disabled={!Number.isFinite(minutes) || minutes < 1 || minutes > 180} onClick={() => void start('focus')}>Start focus session</button>
        </div>}
        <div className="focus-summary"><strong>{today.length} {today.length === 1 ? 'session' : 'sessions'} today</strong><span>{today.reduce((total, entry) => total + entry.minutes, 0)} focused minutes</span></div>
        {focus.history.length > 0 && <ul className="focus-history">{focus.history.slice(0, 20).map((entry) => <li key={entry.id}><span>{entry.label}</span><small>{entry.minutes} min · {new Date(entry.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small></li>)}</ul>}
    </Offcanvas>
}
