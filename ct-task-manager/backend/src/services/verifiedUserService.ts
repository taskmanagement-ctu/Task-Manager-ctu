import { Buffer } from 'buffer';
import * as XLSX from 'xlsx';
import {
  COLUMN_MAP,
  REQUIRED_FIELDS,
  normalizeString,
  normalizePhone,
  normalizeUniversityId,
  validateRow,
  isValidUniversityId,
  ParsedVerifiedUser,
  RowValidationError,
  ImportResult,
} from '../utils/validators';
import VerifiedUser from '../models/VerifiedUser';
import Department from '../models/Department';
import {
  findMatchingDepartment,
  formatDepartmentDisplayName,
} from '../utils/normalization';

export interface ParsedSheet {
  sheetName: string;
  rows: Record<string, unknown>[];
}

/**
 * Propagate merged cell values across the entire merge range.
 * In Excel (.xlsx), merged cells only store their value in the top-left cell.
 * All subsequent cells in that merge block are left blank/undefined by SheetJS.
 * This function replicates the top-left cell's value across all rows/cols within
 * each merge range so that every row (e.g. Department spanning multiple users)
 * properly inherits its value.
 */
export const fillMergedCells = (sheet: XLSX.WorkSheet): void => {
  if (!sheet || !sheet['!merges'] || !Array.isArray(sheet['!merges'])) {
    return;
  }

  for (const merge of sheet['!merges']) {
    const startAddr = XLSX.utils.encode_cell(merge.s);
    const startCell = sheet[startAddr];

    // If start cell is empty or doesn't exist, nothing to propagate
    if (!startCell || startCell.v === undefined || startCell.v === null || startCell.v === '') {
      continue;
    }

    // Populate all cells in the merge range with the start cell's value and metadata
    for (let r = merge.s.r; r <= merge.e.r; r++) {
      for (let c = merge.s.c; c <= merge.e.c; c++) {
        // Skip the start cell itself
        if (r === merge.s.r && c === merge.s.c) {
          continue;
        }

        // Avoid horizontal propagation on row 0 to prevent duplicating distinct column headers
        if (merge.s.r === 0 && merge.s.c !== merge.e.c) {
          continue;
        }

        const cellAddr = XLSX.utils.encode_cell({ r, c });
        // Assign cell value while preserving formatting/type
        sheet[cellAddr] = {
          t: startCell.t,
          v: startCell.v,
          w: startCell.w !== undefined ? startCell.w : String(startCell.v),
        };
      }
    }
  }
};

/**
 * Parse an uploaded file buffer into an array of sheets with their raw row objects.
 * Supports .xlsx (multiple sheets/tabs) and .csv formats.
 */
export const parseAllSheets = (
  buffer: Buffer,
  originalName: string
): ParsedSheet[] => {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('The uploaded file contains no sheets');
  }

  const sheets: ParsedSheet[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    // Expand merged cells so every row inside a merged cell inherits the value
    fillMergedCells(sheet);

    const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
      defval: '',
    });

    if (rawRows.length > 0) {
      sheets.push({
        sheetName,
        rows: rawRows,
      });
    }
  }

  if (sheets.length === 0) {
    throw new Error(`The uploaded file "${originalName}" contains no data rows in any sheet`);
  }

  return sheets;
};

/**
 * Backwards-compatible parser returning flat array of rows from all sheets.
 */
export const parseFile = (
  buffer: Buffer,
  originalName: string
): Record<string, unknown>[] => {
  const sheets = parseAllSheets(buffer, originalName);
  return sheets.flatMap(s => s.rows);
};

/**
 * Map raw Excel/CSV headers to normalized internal field names.
 */
const mapHeaders = (
  rawRow: Record<string, unknown>
): Record<string, string> => {
  const mapped: Record<string, string> = {};

  for (const [rawKey, rawValue] of Object.entries(rawRow)) {
    const normalizedKey = rawKey.toLowerCase().trim().replace(/\s+/g, ' ');

    // Skip "sr. no." and "sr no" — they're not needed
    if (
      normalizedKey === 'sr. no.' ||
      normalizedKey === 'sr no' ||
      normalizedKey === 'sr. no' ||
      normalizedKey === 'sno' ||
      normalizedKey === 's. no.' ||
      normalizedKey === 's.no.' ||
      normalizedKey === 's no' ||
      normalizedKey === 'serial no' ||
      normalizedKey === 'serial no.' ||
      normalizedKey === '#'
    ) {
      continue;
    }

    let fieldName = COLUMN_MAP[normalizedKey];

    // Smart fallback pattern matching for resilient header detection
    if (!fieldName) {
      if (
        normalizedKey.includes('deapr') ||
        normalizedKey.includes('depart') ||
        normalizedKey.includes('dept') ||
        normalizedKey.startsWith('school')
      ) {
        fieldName = 'department';
      } else if (
        normalizedKey.includes('mobile') ||
        normalizedKey.includes('phone') ||
        normalizedKey.includes('contact')
      ) {
        fieldName = 'phone';
      } else if (
        normalizedKey.includes('email') ||
        normalizedKey.includes('mail')
      ) {
        fieldName = 'email';
      } else if (
        normalizedKey === 'id' ||
        normalizedKey.endsWith(' id') ||
        normalizedKey.startsWith('id ') ||
        normalizedKey.includes('university id') ||
        normalizedKey.includes('emp id') ||
        normalizedKey.includes('roll no')
      ) {
        fieldName = 'universityId';
      } else if (
        normalizedKey.includes('designat') ||
        normalizedKey.includes('job') ||
        normalizedKey.includes('post') ||
        normalizedKey.includes('position')
      ) {
        fieldName = 'designation';
      } else if (
        normalizedKey.includes('categor')
      ) {
        fieldName = 'category';
      } else if (
        normalizedKey.includes('name') &&
        !normalizedKey.includes('dept') &&
        !normalizedKey.includes('school') &&
        !normalizedKey.includes('institution')
      ) {
        fieldName = 'name';
      }
    }

    if (fieldName) {
      mapped[fieldName] = normalizeString(rawValue);
    }
  }

  return mapped;
};

/**
 * Validate that the file contains all required column headers.
 */
const validateHeaders = (rawRow: Record<string, unknown>): string[] => {
  const mapped = mapHeaders(rawRow);
  const missing: string[] = [];

  for (const field of REQUIRED_FIELDS) {
    if (!(field in mapped)) {
      missing.push(field);
    }
  }

  return missing;
};

/**
 * Process the parsed rows: validate, normalize, and import into MongoDB across all workbook sheets/tabs.
 */
export const importVerifiedUsers = async (
  buffer: Buffer,
  originalName: string,
  options?: { departmentOverride?: string; defaultUserType?: 'staff' | 'student' }
): Promise<ImportResult> => {
  const sheets = parseAllSheets(buffer, originalName);

  // Fetch departments to smartly resolve sheet names matching department name or code
  let existingDepartments: { name: string; code?: string }[] = [];
  try {
    existingDepartments = await Department.find({}, 'name code').lean();
  } catch {
    // If DB query fails, proceed without department name inference
  }

  const resolveDepartmentFromSheetName = (sheetName: string): string | null => {
    const matched = findMatchingDepartment(existingDepartments, sheetName);
    return matched ? matched.name : null;
  };

  const resolveUserTypeFromSheetName = (sheetName: string): 'staff' | 'student' | null => {
    const clean = sheetName.trim().toLowerCase();
    if (clean.includes('student')) return 'student';
    if (clean.includes('staff') || clean.includes('faculty') || clean.includes('teacher') || clean.includes('admin')) return 'staff';
    return null;
  };

  const resolveCategoryFromSheetName = (sheetName: string): string | null => {
    const clean = sheetName.trim();
    const lower = clean.toLowerCase();

    // Ignore generic sheet names
    if (
      /^sheet\s*\d+$/i.test(lower) ||
      lower === 'data' ||
      lower === 'template' ||
      lower === 'verified users' ||
      lower === 'users' ||
      lower === 'export'
    ) {
      return null;
    }

    // Faculty is Teaching, Admin/Staff is Non-Teaching
    if (lower.includes('facult') || lower.includes('teach')) return 'Teaching';
    if (lower.includes('admin') || lower.includes('staff') || lower.includes('non')) return 'Non-Teaching';
    if (lower.includes('student')) return 'Student';

    // Title case the sheet name for custom tabs
    return clean.replace(/\b\w/g, l => l.toUpperCase());
  };

  interface ValidSheetInfo {
    sheetName: string;
    rows: Record<string, unknown>[];
    sheetDepartment: string | null;
    sheetUserType: 'staff' | 'student' | null;
    sheetCategory: string | null;
  }

  const validSheets: ValidSheetInfo[] = [];

  for (const sheet of sheets) {
    const firstRow = sheet.rows[0];
    const mappedFirstRow = mapHeaders(firstRow);
    const hasAnyRecognizedColumn = Object.keys(mappedFirstRow).length > 0;

    // If a sheet has zero recognized columns, skip it (e.g. Instructions, Summary tab)
    if (!hasAnyRecognizedColumn) {
      continue;
    }

    // Check required columns
    const missingHeaders = validateHeaders(firstRow);
    if (missingHeaders.length > 0) {
      throw new Error(
        `Sheet "${sheet.sheetName}" is missing required columns: ${missingHeaders.join(', ')}. ` +
        `Required columns are: ID, Name, Email, Phone No.`
      );
    }

    validSheets.push({
      sheetName: sheet.sheetName,
      rows: sheet.rows,
      sheetDepartment: resolveDepartmentFromSheetName(sheet.sheetName),
      sheetUserType: resolveUserTypeFromSheetName(sheet.sheetName),
      sheetCategory: resolveCategoryFromSheetName(sheet.sheetName),
    });
  }

  if (validSheets.length === 0) {
    throw new Error(
      `The uploaded file "${originalName}" contains no sheets with valid columns. ` +
      `Required columns are: ID, Name, Email, Phone No.`
    );
  }

  const result: ImportResult = {
    totalRows: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    sheetsProcessed: validSheets.map(s => s.sheetName),
  };

  const isMultiSheet = validSheets.length > 1;
  const seenIds = new Map<string, { sheetName: string; rowNumber: number }>();
  const parsedRows: {
    sheetName: string;
    rowNumber: number;
    data: ParsedVerifiedUser;
  }[] = [];

  // Phase 1: Parse, normalize, and validate all rows across all sheets
  for (const sheetData of validSheets) {
    const { sheetName, rows, sheetDepartment, sheetUserType, sheetCategory } = sheetData;
    result.totalRows += rows.length;

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2; // 1-indexed + header row
      const mapped = mapHeaders(rows[i]);

      // Normalize specific fields
      mapped.universityId = normalizeUniversityId(mapped.universityId);
      mapped.phone = normalizePhone(mapped.phone);
      mapped.email = (mapped.email || '').toLowerCase().trim();

      // Check if this row is a section divider row (e.g. "Academic Support Staff")
      if (
        !isValidUniversityId(mapped.universityId) &&
        /academic|support|staff|faculty|admin|department|school|section|designation/i.test(mapped.universityId) &&
        (!mapped.email || mapped.email === '-') &&
        (!mapped.phone || mapped.phone === '-')
      ) {
        // Gracefully ignore divider / section header row
        result.skipped++;
        continue;
      }

      // Validate row
      const rowErrors = validateRow(mapped, rowNumber);
      if (rowErrors.length > 0) {
        for (const err of rowErrors) {
          err.sheet = sheetName;
          result.errors.push(err);
        }
        result.skipped++;
        continue;
      }

      // Determine userType
      const rawType = (mapped.userType || '').toLowerCase().trim();
      let userType: 'staff' | 'student';
      if (rawType) {
        userType = rawType.includes('student') ? 'student' : 'staff';
      } else if (sheetUserType) {
        userType = sheetUserType;
      } else {
        userType = options?.defaultUserType || 'staff';
      }

      // Determine designation (e.g. "Assistant Professor", "Trainer")
      const designation = mapped.designation ? mapped.designation.trim() : null;

      // Determine category (Teaching vs Non-Teaching)
      let category = mapped.category || sheetCategory || null;
      if (category) {
        const cleanCat = category.trim();
        const lowerCat = cleanCat.toLowerCase();
        if (lowerCat.includes('facult') || lowerCat.includes('teach')) {
          category = 'Teaching';
        } else if (lowerCat.includes('admin') || lowerCat.includes('non') || lowerCat.includes('staff')) {
          category = 'Non-Teaching';
        } else if (lowerCat.includes('student')) {
          category = 'Student';
        } else {
          category = cleanCat.replace(/\b\w/g, l => l.toUpperCase());
        }
      }

      // If category is not explicitly determined yet, check sheetCategory or designation
      if (!category && sheetCategory) {
        category = sheetCategory;
      }
      if (!category && designation) {
        const lowerDesig = designation.toLowerCase();
        if (
          lowerDesig.includes('professor') ||
          lowerDesig.includes('lecturer') ||
          lowerDesig.includes('faculty') ||
          lowerDesig.includes('teacher') ||
          lowerDesig.includes('trainer') ||
          lowerDesig.includes('instructor') ||
          lowerDesig.includes('dean') ||
          lowerDesig.includes('hod') ||
          lowerDesig.includes('chancellor')
        ) {
          category = 'Teaching';
        } else if (
          lowerDesig.includes('admin') ||
          lowerDesig.includes('clerk') ||
          lowerDesig.includes('accountant') ||
          lowerDesig.includes('manager') ||
          lowerDesig.includes('assistant') ||
          lowerDesig.includes('attendant') ||
          lowerDesig.includes('librarian') ||
          lowerDesig.includes('officer')
        ) {
          category = 'Non-Teaching';
        }
      }

      // Determine department
      let department =
        options?.departmentOverride ||
        mapped.department ||
        sheetDepartment ||
        null;

      if (department) {
        const matched = findMatchingDepartment(existingDepartments, department);
        department = matched ? matched.name : formatDepartmentDisplayName(department);
      }

      // Check for duplicate University IDs across the whole workbook (e.g. same person in Faculty & Admin tabs)
      if (seenIds.has(mapped.universityId)) {
        const existingRow = parsedRows.find(p => p.data.universityId === mapped.universityId);
        if (existingRow) {
          // Merge categories (e.g. Teaching + Non-Teaching -> "Teaching, Non-Teaching")
          if (category && existingRow.data.category) {
            if (!existingRow.data.category.includes(category)) {
              existingRow.data.category = `${existingRow.data.category}, ${category}`;
            }
          } else if (category && !existingRow.data.category) {
            existingRow.data.category = category;
          }

          if (designation && !existingRow.data.designation) {
            existingRow.data.designation = designation;
          }

          // If current row has email/phone/department and previous row was empty, populate them
          if ((!existingRow.data.email || existingRow.data.email === '-') && mapped.email && mapped.email !== '-') {
            existingRow.data.email = mapped.email;
          }
          if ((!existingRow.data.phone || existingRow.data.phone === '-') && mapped.phone && mapped.phone !== '-') {
            existingRow.data.phone = mapped.phone;
          }
          if (!existingRow.data.department && department) {
            existingRow.data.department = department;
          }

          // Successfully merged across sheets, no error
          continue;
        }
      }
      seenIds.set(mapped.universityId, { sheetName, rowNumber });

      parsedRows.push({
        sheetName,
        rowNumber,
        data: {
          universityId: mapped.universityId,
          name: mapped.name,
          email: mapped.email,
          phone: mapped.phone,
          department,
          userType,
          category,
          designation,
        },
      });
    }
  }

  // Phase 2: Upsert valid rows into MongoDB
  for (const { sheetName, rowNumber, data } of parsedRows) {
    try {
      const existing = await VerifiedUser.findOne({
        universityId: data.universityId,
      });

      if (existing) {
        // Update existing — preserve isRegistered and registeredUserId
        existing.name = data.name;
        existing.email = data.email;
        existing.phone = data.phone;
        existing.department = data.department;
        existing.userType = data.userType;
        if (data.category !== undefined) existing.category = data.category;
        if (data.designation !== undefined) existing.designation = data.designation;
        await existing.save();
        result.updated++;
      } else {
        // Insert new
        await VerifiedUser.create(data);
        result.inserted++;
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unknown database error';
      result.errors.push({
        row: rowNumber,
        sheet: sheetName,
        field: 'database',
        message: `${isMultiSheet ? `[${sheetName}] ` : ''}Failed to save University ID "${data.universityId}": ${message}`,
      });
      result.skipped++;
    }
  }

  return result;
};
