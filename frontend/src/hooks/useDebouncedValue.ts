import { useEffect, useState } from 'react'

/** Returns a debounced copy of `value`, updated `delay` ms after the last
 * change. Used to turn a search input into a server-side query without
 * firing a request on every keystroke. */
export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timeout)
  }, [value, delay])

  return debounced
}
