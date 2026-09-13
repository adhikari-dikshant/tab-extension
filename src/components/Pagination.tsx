import { ArrowLeftIcon as ArrowLeft } from '@phosphor-icons/react/dist/csr/ArrowLeft'
import { ArrowRightIcon as ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight'

export function Pagination({ page, count, onChange, label }: {
    page: number
    count: number
    onChange: (page: number) => void
    label: string
}) {
    if (count <= 1) return null
    return (
        <nav className="pagination" aria-label={`${label} pages`}>
            <button type="button" aria-label={`Previous ${label}`} disabled={page === 0} onClick={() => onChange(page - 1)}>
                <ArrowLeft size={14} />
            </button>
            <span aria-live="polite">{page + 1} / {count}</span>
            <button type="button" aria-label={`Next ${label}`} disabled={page + 1 === count} onClick={() => onChange(page + 1)}>
                <ArrowRight size={14} />
            </button>
        </nav>
    )
}
