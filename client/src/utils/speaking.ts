export function fillerWordBases(items: string[]): string[] {
  return items
    .map((raw) => raw.split(/\s+/)[0]?.replace(/[^a-z']/g, ""))
    .filter((word): word is string => Boolean(word));
}

export function transcriptIsFiller(part: string, fillerBases: string[]): boolean {
  const word = part.toLowerCase().replace(/[^a-z']/g, "");
  return word.length > 1 && fillerBases.includes(word);
}