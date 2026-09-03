export function parseCandidates(text) {
  const statements = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!statements.length) throw new Error("Enter at least one candidate.");
  if (statements.length > 20)
    throw new Error("Save up to 20 candidates at a time.");
  if (statements.some((statement) => statement.length > 2000))
    throw new Error("Each candidate must be 2,000 characters or fewer.");
  return statements;
}

export function wordingHint(text) {
  return /\?|^(test|investigate|research|interview|build|develop|implement)\b/i.test(
    text.trim(),
  );
}
