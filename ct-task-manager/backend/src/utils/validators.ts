/**
 * Validation utilities for verified user data.
 */

export const isValidUniversityId = (id: string): boolean => {
  return /^\d{5}$/.test(id);
};

export const isValidPhone = (phone: string): boolean => {
  return phone === '-' || /^\d{10}$/.test(phone);
};

export const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === 'string' && value.trim().length > 0;
};

/**
 * Normalize a raw string value — trim whitespace and convert to string.
 */
export const normalizeString = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

/**
 * Normalize a phone number:
 * - If the column has 10 or more digits, extract the last 10 digits.
 * - If the numbers are less (or missing/empty), skip the phone number and add a "-".
 */
export const normalizePhone = (value: unknown): string => {
  if (value === null || value === undefined) return '-';
  const raw = normalizeString(value);
  if (!raw || raw === '-') return '-';

  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return '-';
};

/**
 * Normalize university ID — pad with leading zeros if numeric and < 5 chars.
 */
export const normalizeUniversityId = (value: unknown): string => {
  const raw = normalizeString(value);
  // If it's purely numeric, pad to 5 digits
  if (/^\d+$/.test(raw) && raw.length < 5) {
    return raw.padStart(5, '0');
  }
  return raw;
};

/**
 * Required column mappings from Excel/CSV headers → internal field names.
 */
export const COLUMN_MAP: Record<string, string> = {
  'id': 'universityId',
  'university id': 'universityId',
  'universityid': 'universityId',
  'name': 'name',
  'email': 'email',
  'e-mail': 'email',
  'email id': 'email',
  'phone': 'phone',
  'phone no': 'phone',
  'phone no.': 'phone',
  'phone number': 'phone',
  'phoneno': 'phone',
  'mobile': 'phone',
  'mobile no': 'phone',
  'mobile no.': 'phone',
  'department': 'department',
  'dept': 'department',
  'dept.': 'department',
  'type': 'userType',
  'user type': 'userType',
  'usertype': 'userType',
  'role': 'userType',
  'category': 'userType',
};

export const REQUIRED_FIELDS = ['universityId', 'name', 'email', 'phone'];

export interface RowValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ParsedVerifiedUser {
  universityId: string;
  name: string;
  email: string;
  phone: string;
  department: string | null;
  userType: 'staff' | 'student';
}

export interface ImportResult {
  totalRows: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: RowValidationError[];
}

/**
 * Validate a single parsed row and return errors if any.
 */
export const validateRow = (
  row: Record<string, string>,
  rowNumber: number
): RowValidationError[] => {
  const errors: RowValidationError[] = [];

  if (!isNonEmptyString(row.universityId)) {
    errors.push({ row: rowNumber, field: 'ID', message: 'University ID is required' });
  } else if (!isValidUniversityId(row.universityId)) {
    errors.push({
      row: rowNumber,
      field: 'ID',
      message: `Invalid University ID "${row.universityId}". Expected exactly 5 digits`,
    });
  }

  if (!isNonEmptyString(row.name)) {
    errors.push({ row: rowNumber, field: 'Name', message: 'Name is required' });
  }

  if (!isNonEmptyString(row.email)) {
    errors.push({ row: rowNumber, field: 'Email', message: 'Email is required' });
  } else if (!isValidEmail(row.email)) {
    errors.push({
      row: rowNumber,
      field: 'Email',
      message: `Invalid email format "${row.email}"`,
    });
  }

  // Phone handling: do not skip row; take last 10 digits if >= 10, or set to '-' if less
  if (!isNonEmptyString(row.phone) || row.phone === '-') {
    row.phone = '-';
  } else {
    const digits = row.phone.replace(/\D/g, '');
    if (digits.length >= 10) {
      row.phone = digits.slice(-10);
    } else {
      row.phone = '-';
    }
  }

  return errors;
};
