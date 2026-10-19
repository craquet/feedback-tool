import { describe, expect, it } from "vitest"
import { csvEscape, toCsv } from "./csv"

describe("csvEscape", () => {
    it("leaves simple values untouched", () => {
        expect(csvEscape("hello world")).toBe("hello world")
    })

    it("quotes values containing commas, quotes or newlines", () => {
        expect(csvEscape("a,b")).toBe('"a,b"')
        expect(csvEscape('say "hi"')).toBe('"say ""hi"""')
        expect(csvEscape("line1\nline2")).toBe('"line1\nline2"')
    })

    it("prefixes formula-looking values with an apostrophe", () => {
        for (const prefix of ["=", "+", "-", "@"]) {
            expect(csvEscape(`${prefix}cmd`)).toBe(`'${prefix}cmd`)
        }
        expect(csvEscape("\tcmd")).toBe("'\tcmd")
    })

    it("prefixes and quotes when both are needed", () => {
        expect(csvEscape('=a,"b"')).toBe(`"'=a,""b"""`)
    })
})

describe("toCsv", () => {
    it("joins cells with commas and rows with CRLF", () => {
        expect(toCsv([["a", "b"], ["c", "d"]])).toBe("a,b\r\nc,d")
    })

    it("stringifies non-string cells", () => {
        expect(toCsv([[1, true, null]])).toBe("1,true,")
    })
})
