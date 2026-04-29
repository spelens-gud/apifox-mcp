export function createJsonDiff(before: unknown, after: unknown): string {
  const beforeLines = stringifyJson(before);
  const afterLines = stringifyJson(after);
  const diffLines = ["--- before", "+++ after"];
  const lineCount = Math.max(beforeLines.length, afterLines.length);

  for (let index = 0; index < lineCount; index += 1) {
    const beforeLine = beforeLines[index];
    const afterLine = afterLines[index];
    if (beforeLine === afterLine) {
      continue;
    }

    if (beforeLine !== undefined) {
      diffLines.push(`-${beforeLine}`);
    }
    if (afterLine !== undefined) {
      diffLines.push(`+${afterLine}`);
    }
  }

  return diffLines.join("\n");
}

function stringifyJson(value: unknown): string[] {
  return JSON.stringify(value, null, 2).split("\n");
}
