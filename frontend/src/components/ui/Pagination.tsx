import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

const PAGE_SIZES = [10, 20, 50, 100]

interface Props {
  page: number
  pageSize: number
  total: number
  totalPages: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

export default function Pagination({ page, pageSize, total, totalPages, onPageChange, onPageSizeChange }: Props) {
  const { colors } = useTheme()
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-xs text-slate-500">
      <div className="flex items-center gap-2">
        <span>Rows per page</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="border border-slate-200 rounded-md px-2 py-1 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-teal-600/30"
        >
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <span>
          {total === 0 ? '0 results' : `${from}–${to} of ${total}`}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 disabled:opacity-30 hover:bg-slate-50"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="px-2 font-semibold" style={{ color: colors.primary }}>
            {page} / {Math.max(1, totalPages)}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 disabled:opacity-30 hover:bg-slate-50"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
