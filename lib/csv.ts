const FORMULA_PREFIXES = new Set(["=", "+", "-", "@", "\t", "\r"])

export function csvEscape(value: string): string {
    let result = value
    if (result.length > 0 && FORMULA_PREFIXES.has(result[0])) {
        result = `'${result}`
    }
    if (/[",\n\r]/.test(result)) {
        return `"${result.replace(/"/g, '""')}"`
    }
    return result
}

export function toCsv(rows: Array<Array<string | number | boolean | null>>): string {
    return rows
        .map((row) => row.map((cell) => csvEscape(cell === null ? "" : String(cell))).join(","))
        .join("\r\n")
}
