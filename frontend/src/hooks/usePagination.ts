import { useState } from 'react'

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

/** Shared page/pageSize state for paginated admin tables. Resets to page 1
 * whenever the page size changes (otherwise you can land on an out-of-range
 * page, e.g. page 5 of 10-per-page suddenly showing 100-per-page). */
export function usePagination(initialPageSize = 10) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSizeState] = useState(initialPageSize)

  const setPageSize = (size: number) => {
    setPageSizeState(size)
    setPage(1)
  }

  return { page, pageSize, setPage, setPageSize }
}
