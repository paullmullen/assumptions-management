export const insightClassifications = [
  "Evidence",
  "Revised judgment",
  "Mitigation / project change",
];

export function isSourceUrl(value) {
  if (!value) return true;
  return /^https?:\/\/[^\s/?#]+[^\s]*$/.test(value);
}

export function normalizeInsight(
  values,
  { allowEmptyDescription = false } = {},
) {
  const description = values.description?.trim() ?? "";
  const sourceUrl = values.sourceUrl?.trim() ?? "";
  const classification = values.classification || "";
  if ((!description && !allowEmptyDescription) || description.length > 4000)
    throw new Error("Enter a description of up to 4,000 characters.");
  if (sourceUrl.length > 2000 || !isSourceUrl(sourceUrl))
    throw new Error("Enter an http:// or https:// source URL.");
  if (classification && !insightClassifications.includes(classification))
    throw new Error("Choose a listed classification or leave it blank.");
  return {
    ...(description && { description }),
    ...(sourceUrl && { sourceUrl }),
    ...(classification && { classification }),
  };
}
