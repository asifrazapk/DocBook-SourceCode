/** Convert an array of flat objects to a CSV string and trigger a browser
 * download. No external dependency needed -- a .csv file opens directly in
 * Excel/Google Sheets, which covers "download in Excel/CSV" without adding
 * an xlsx library just for this. */
export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    rows = [{ note: 'No data in the selected range' }]
  }
  const headers = Object.keys(rows[0])
  const escape = (value: unknown) => {
    const str = value === null || value === undefined ? '' : String(value)
    // Quote any field containing a comma, quote, or newline; double up internal quotes.
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const lines = [headers.join(','), ...rows.map((row) => headers.map((h) => escape(row[h])).join(','))]
  const csv = '\uFEFF' + lines.join('\r\n') // BOM so Excel opens UTF-8 correctly

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
