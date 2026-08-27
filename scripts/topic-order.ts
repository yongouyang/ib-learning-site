import fs from 'fs';

// Each subject dir carries an order.json: a JSON array of every topic id in
// curated pedagogical order. The registry emits topics in that order, so the
// subject pages, diagnostics pools and mixed-review all see the same sequence.
// Strict: unknown/duplicate/missing ids are errors (generate-registry throws;
// validate:content collects them as failures).
export const ORDER_FILE = 'order.json';

/** Validates order.json against the topic files; returns a list of problems (empty = OK). */
export function checkTopicOrder(
  subjectId: string,
  orderJsonPath: string,
  files: string[],
): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(orderJsonPath, 'utf-8'));
  } catch {
    return [
      `missing or invalid ${ORDER_FILE} — it must list every topic id in pedagogical order`,
    ];
  }
  if (!Array.isArray(parsed) || parsed.some((e) => typeof e !== 'string')) {
    return [`${ORDER_FILE} must be a JSON array of topic id strings`];
  }
  const ids = parsed as string[];
  const errors: string[] = [];

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  if (duplicates.size > 0) {
    errors.push(`${ORDER_FILE} has duplicate ids: ${[...duplicates].join(', ')}`);
  }

  const fileIds = files.map((f) => f.replace(/\.json$/, ''));
  const fileIdSet = new Set(fileIds);
  const unknown = ids.filter((id) => !fileIdSet.has(id));
  if (unknown.length > 0) {
    errors.push(`${ORDER_FILE} lists unknown topic ids: ${unknown.join(', ')}`);
  }
  const orderSet = new Set(ids);
  const missing = fileIds.filter((id) => !orderSet.has(id));
  if (missing.length > 0) {
    errors.push(`${ORDER_FILE} is missing topic ids: ${missing.join(', ')}`);
  }
  return errors;
}

/** Returns the topic files sorted by order.json; throws on any ordering problem. */
export function sortFilesByOrder(
  subjectId: string,
  orderJsonPath: string,
  files: string[],
): string[] {
  const errors = checkTopicOrder(subjectId, orderJsonPath, files);
  if (errors.length > 0) {
    throw new Error(
      `Subject "${subjectId}" topic ordering problems:\n  - ${errors.join('\n  - ')}`,
    );
  }
  const ids = JSON.parse(fs.readFileSync(orderJsonPath, 'utf-8')) as string[];
  const rank = new Map(ids.map((id, i) => [id, i]));
  return [...files].sort(
    (a, b) => rank.get(a.replace(/\.json$/, ''))! - rank.get(b.replace(/\.json$/, ''))!,
  );
}
