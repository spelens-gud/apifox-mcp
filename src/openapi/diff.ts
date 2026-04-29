export function createJsonDiff(before: unknown, after: unknown): string {
  const beforeLines = stringifyJson(before);
  const afterLines = stringifyJson(after);
  const diffLines = ["--- before", "+++ after"];
  let start = 0;
  while (start < beforeLines.length && start < afterLines.length && beforeLines[start] === afterLines[start]) {
    start += 1;
  }

  let beforeEnd = beforeLines.length - 1;
  let afterEnd = afterLines.length - 1;
  while (beforeEnd >= start && afterEnd >= start && beforeLines[beforeEnd] === afterLines[afterEnd]) {
    beforeEnd -= 1;
    afterEnd -= 1;
  }

  for (let index = start; index <= beforeEnd; index += 1) {
    diffLines.push(`-${beforeLines[index]}`);
  }

  for (let index = start; index <= afterEnd; index += 1) {
    diffLines.push(`+${afterLines[index]}`);
  }

  return diffLines.join("\n");
}

function stringifyJson(value: unknown): string[] {
  return JSON.stringify(value, null, 2).split("\n");
}
