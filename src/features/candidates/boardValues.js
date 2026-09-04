export const candidateGroup = (item) => item.groupId ?? "ungrouped";
export const candidateRank = (item) =>
  item.rank ?? item.createdAt?.toMillis?.() ?? 0;
export function orderedCandidates(items) {
  return [...items].sort(
    (a, b) => candidateRank(a) - candidateRank(b) || a.id.localeCompare(b.id),
  );
}
export function moveOrder(items, groupId, moving, beforeId = null) {
  const rows = orderedCandidates(
    items.filter(
      (row) =>
        row.status === "pending" &&
        candidateGroup(row) === groupId &&
        row.id !== moving.id,
    ),
  );
  const index = beforeId
    ? rows.findIndex((row) => row.id === beforeId)
    : rows.length;
  if (index < 0)
    throw new Error(
      "The destination changed. Refresh candidates and try again.",
    );
  rows.splice(index, 0, moving);
  return rows;
}
export function validateCombination(items, statement) {
  if (
    items.length < 2 ||
    items.length > 8 ||
    new Set(items.map((row) => row.id)).size !== items.length
  )
    throw new Error(
      "Select between two and eight different pending candidates.",
    );
  if (items.some((row) => row.status !== "pending"))
    throw new Error("Only pending candidates can be combined.");
  const text = statement.trim();
  if (!text || text.length > 2000)
    throw new Error("Enter combined wording of 1–2,000 characters.");
  return text;
}
