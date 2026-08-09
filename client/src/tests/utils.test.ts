import { describe, it, expect } from "vitest";
import { cn, formatDuration, titleCase, countWords, initialOf } from "../utils";

describe("utils", () => {
  it("cn merges className strings and filters falsy values", () => {
    const noop = false;
    expect(cn("a", "b", noop && "c", null, "d")).toBe("a b d");
  });

  it("formatDuration renders human-readable durations", () => {
    expect(formatDuration(3661)).toBe("1h 1m");
    expect(formatDuration(65)).toBe("1m 5s");
    expect(formatDuration(0)).toBe("—");
  });

  it("titleCase converts snake/underscore labels to title case", () => {
    expect(titleCase("IELTS_READING")).toBe("Ielts Reading");
    expect(titleCase("hello_world")).toBe("Hello World");
  });

  it("countWords counts words including punctuation", () => {
    expect(countWords("hello world")).toBe(2);
    expect(countWords("")).toBe(0);
  });

  it("initialOf returns first letter of first name", () => {
    expect(initialOf("John Doe")).toBe("J");
    expect(initialOf(undefined)).toBe("?");
  });
});