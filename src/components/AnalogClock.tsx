import { useMemo, type CSSProperties } from 'react'

const SIZE = 96 // px

function getSecondsToday(): number {
    const now = new Date()
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return (now.getTime() - midnight.getTime()) / 1000
}

function Hand({
    length,
    marginTop,
    duration,
    delay,
    ticking,
    className,
}: {
    length: number
    marginTop: number
    duration: number
    delay: number
    ticking?: boolean
    className: string
}) {
    const style: CSSProperties = {
        position: 'absolute',
        left: '50%',
        top: marginTop,
        width: 2,
        height: length,
        marginLeft: -1,
        transformOrigin: 'bottom center',
        animationName: 'clock-hand-rotate',
        animationDuration: `${duration}s`,
        animationTimingFunction: ticking ? 'steps(60)' : 'linear',
        animationIterationCount: 'infinite',
        animationDelay: `${delay}s`,
    }
    return <div className={`rounded-full ${className}`} style={style} />
}

/** Ported from a CSS-only analog clock design: hands and ticks are pure CSS animations with a
 * negative animation-delay computed once on mount, so the clock keeps moving without any JS
 * timer re-rendering this component every second. */
export default function AnalogClock() {
    const { secondDelay, minuteDelay, hourDelay } = useMemo(() => {
        const secToday = getSecondsToday()
        return {
            secondDelay: -(secToday % 60),
            minuteDelay: -(secToday % 3600),
            hourDelay: -(secToday % 43200),
        }
    }, [])

    return (
        <div className="relative shrink-0" style={{ height: SIZE, width: SIZE }}>
            {Array.from({ length: 60 }, (_, i) => {
                const isMajor = (i + 1) % 5 === 0
                const style: CSSProperties = {
                    position: 'absolute',
                    left: '50%',
                    top: 0,
                    width: 2,
                    marginLeft: -1,
                    height: isMajor ? SIZE / 2 - 7 : SIZE / 2 - 2,
                    borderTop: isMajor ? '7px solid currentColor' : '2px solid currentColor',
                    transformOrigin: 'bottom center',
                    transform: `rotateZ(${(i + 1) * 6}deg)`,
                }
                return (
                    <div
                        key={i}
                        className={isMajor ? 'text-neutral-900 dark:text-neutral-100' : 'text-(--accent)/50'}
                        style={style}
                    />
                )
            })}

            <Hand
                length={SIZE / 2 - 40}
                marginTop={40}
                duration={43200}
                delay={hourDelay}
                className="bg-neutral-900 dark:bg-neutral-100"
            />
            <Hand
                length={SIZE / 2 - 20}
                marginTop={20}
                duration={3600}
                delay={minuteDelay}
                className="bg-neutral-900/80 dark:bg-neutral-100/80"
            />
            <Hand
                length={SIZE / 2 - 10}
                marginTop={10}
                duration={60}
                delay={secondDelay}
                ticking
                className="bg-(--accent)"
            />

            <div
                className="absolute rounded-full bg-(--accent)"
                style={{ left: '50%', top: '50%', width: 5, height: 5, transform: 'translate(-50%, -50%)' }}
            />
        </div>
    )
}
