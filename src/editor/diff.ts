export type DiffLineType = "context" | "add" | "remove";

export interface DiffLine {
  type: DiffLineType;
  value: string;
}

const MAX_LINES = 4000;

export function diffLines(before: string, after: string): DiffLine[] {
  const a = splitLines(before);
  const b = splitLines(after);

  if (a.length > MAX_LINES || b.length > MAX_LINES) {
    return [
      ...a.map<DiffLine>((value) => ({ type: "remove", value })),
      ...b.map<DiffLine>((value) => ({ type: "add", value })),
    ];
  }

  const cols = b.length + 1;
  const table = new Uint32Array((a.length + 1) * cols);

  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      const index = i * cols + j;
      if (a[i] === b[j]) {
        table[index] = (table[(i + 1) * cols + (j + 1)] as number) + 1;
      } else {
        const skipA = table[(i + 1) * cols + j] as number;
        const skipB = table[i * cols + (j + 1)] as number;
        table[index] = skipA > skipB ? skipA : skipB;
      }
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      result.push({ type: "context", value: a[i] as string });
      i += 1;
      j += 1;
    } else if (
      (table[(i + 1) * cols + j] as number) >=
      (table[i * cols + (j + 1)] as number)
    ) {
      result.push({ type: "remove", value: a[i] as string });
      i += 1;
    } else {
      result.push({ type: "add", value: b[j] as string });
      j += 1;
    }
  }

  while (i < a.length) {
    result.push({ type: "remove", value: a[i] as string });
    i += 1;
  }

  while (j < b.length) {
    result.push({ type: "add", value: b[j] as string });
    j += 1;
  }

  return result;
}

function splitLines(value: string): string[] {
  return value.replace(/\r\n/g, "\n").split("\n");
}

export function diffStats(lines: DiffLine[]): {
  added: number;
  removed: number;
} {
  let added = 0;
  let removed = 0;
  for (const line of lines) {
    if (line.type === "add") added += 1;
    if (line.type === "remove") removed += 1;
  }
  return { added, removed };
}
