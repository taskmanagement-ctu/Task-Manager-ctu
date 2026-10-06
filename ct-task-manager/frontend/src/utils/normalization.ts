/**
 * Frontend normalization utilities for departments and string matching.
 * Equates '&' with 'and', strips superfluous punctuation and spaces.
 */

export const normalizeDepartmentName = (name: string | null | undefined): string => {
  if (!name) return '';
  return (
    name
      .toLowerCase()
      .replace(/&+/g, ' and ')
      .replace(/\bdept\.?\b/gi, 'department')
      .replace(/[^a-z0-9\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
};

export const areDepartmentsEqual = (
  deptA: string | null | undefined,
  deptB: string | null | undefined
): boolean => {
  if (!deptA && !deptB) return true;
  if (!deptA || !deptB) return false;
  return normalizeDepartmentName(deptA) === normalizeDepartmentName(deptB);
};

export const formatDepartmentDisplayName = (name: string | null | undefined): string => {
  if (!name) return '';
  return name
    .replace(/\s*&\s*/g, ' & ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const findMatchingDepartment = <T extends { name: string; code?: string }>(
  departments: T[],
  query: string | null | undefined
): T | undefined => {
  if (!query || !query.trim()) return undefined;

  const rawTrimmed = query.trim();
  const lowerTrimmed = rawTrimmed.toLowerCase();
  const normalizedQuery = normalizeDepartmentName(rawTrimmed);

  // 1. Exact case-insensitive match on name
  let match = departments.find(
    (d) => d.name && d.name.trim().toLowerCase() === lowerTrimmed
  );
  if (match) return match;

  // 2. Normalized match on name ('&' vs 'and' agnostic)
  match = departments.find((d) => normalizeDepartmentName(d.name) === normalizedQuery);
  if (match) return match;

  // 3. Exact code match (e.g. 'SOET' or 'CSE')
  match = departments.find((d) => {
    if (!d.code || !d.code.trim()) return false;
    return d.code.trim().toUpperCase() === rawTrimmed.toUpperCase();
  });
  if (match) return match;

  return undefined;
};
