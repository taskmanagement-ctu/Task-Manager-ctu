/**
 * Utility functions for robust string and department normalization.
 * Handles variations between '&' and 'and', inconsistent spacing,
 * abbreviations (Dept. vs Department), and special characters to prevent data conflicts.
 */

/**
 * Normalizes a department name into a canonical lowercase search/comparison key.
 * 
 * Examples:
 * - "School of Engineering & Technology" -> "school of engineering and technology"
 * - "School of Engineering and Technology" -> "school of engineering and technology"
 * - "Research&Development" -> "research and development"
 * - "Dept. of Computer Science" -> "department of computer science"
 */
export const normalizeDepartmentName = (name: string | null | undefined): string => {
  if (!name) return '';

  return (
    name
      .toLowerCase()
      // Replace '&' (with or without spaces) with ' and '
      .replace(/&+/g, ' and ')
      // Expand 'dept.' or 'dept' abbreviation to 'department'
      .replace(/\bdept\.?\b/gi, 'department')
      // Replace other non-alphanumeric characters with space
      .replace(/[^a-z0-9\s]/gi, ' ')
      // Collapse multiple whitespace characters into a single space
      .replace(/\s+/g, ' ')
      .trim()
  );
};

/**
 * Compares two department strings for equivalence, treating '&' and 'and',
 * casing, and spacing variations as identical.
 */
export const areDepartmentsEqual = (
  deptA: string | null | undefined,
  deptB: string | null | undefined
): boolean => {
  if (!deptA && !deptB) return true;
  if (!deptA || !deptB) return false;
  return normalizeDepartmentName(deptA) === normalizeDepartmentName(deptB);
};

/**
 * Formats a department name for clean presentation:
 * - Ensures single spaces around '&' (e.g., "A&B" -> "A & B")
 * - Cleans up multiple spaces
 * - Trims leading/trailing whitespace
 */
export const formatDepartmentDisplayName = (name: string | null | undefined): string => {
  if (!name) return '';
  return name
    .replace(/\s*&\s*/g, ' & ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Finds a matching department from an array of departments.
 * Checks in order of priority:
 * 1. Exact name match (case-insensitive)
 * 2. Normalized name match ('&' and 'and' agnostic)
 * 3. Exact uppercase code match (e.g. 'SOET')
 * 4. Code match with trimmed lowercase
 */
export const findMatchingDepartment = <T extends { name: string; code?: string; normalizedName?: string }>(
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
  match = departments.find((d) => {
    const dNorm = d.normalizedName || normalizeDepartmentName(d.name);
    return dNorm === normalizedQuery;
  });
  if (match) return match;

  // 3. Exact code match (e.g. 'SOET' or 'CSE')
  match = departments.find((d) => {
    if (!d.code || !d.code.trim()) return false;
    return d.code.trim().toUpperCase() === rawTrimmed.toUpperCase();
  });
  if (match) return match;

  // 4. Normalized code match
  match = departments.find((d) => {
    if (!d.code || !d.code.trim()) return false;
    return normalizeDepartmentName(d.code) === normalizedQuery;
  });
  if (match) return match;

  return undefined;
};
