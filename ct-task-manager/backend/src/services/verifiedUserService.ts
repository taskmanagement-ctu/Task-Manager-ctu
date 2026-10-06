import { Buffer } from 'buffer';
import * as XLSX from 'xlsx';
import {
  COLUMN_MAP,
  REQUIRED_FIELDS,
  normalizeString,
  normalizePhone,
  normalizeUniversityId,
  validateRow,
  ParsedVerifiedUser,
  RowValidationError,
  ImportResult,
} from '../utils/validators';
import VerifiedUser from '../models/VerifiedUser';
import Department from '../models/Department';

export interface ParsedSheet {
  sheetName: string;
  rows: Record<string, unknown>[];
}

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

    const fieldName = COLUMN_MAP[normalizedKey];
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
    const clean = sheetName.trim().toLowerCase();
    for (const dept of existingDepartments) {
      if (dept.name && dept.name.trim().toLowerCase() === clean) {
        return dept.name;
      }
      if (dept.code && dept.code.trim().toLowerCase() === clean) {
        return dept.name;
      }
    }
    return null;
  };

  const resolveUserTypeFromSheetName = (sheetName: string): 'staff' | 'student' | null => {
    const clean = sheetName.trim().toLowerCase();
    if (clean.includes('student')) return 'student';
    if (clean.includes('staff') || clean.includes('faculty') || clean.includes('teacher')) return 'staff';
    return null;
  };

  interface ValidSheetInfo {
    sheetName: string;
    rows: Record<string, unknown>[];
    sheetDepartment: string | null;
    sheetUserType: 'staff' | 'student' | null;
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
    const { sheetName, rows, sheetDepartment, sheetUserType } = sheetData;
    result.totalRows += rows.length;

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2; // 1-indexed + header row
      const mapped = mapHeaders(rows[i]);

      // Normalize specific fields
      mapped.universityId = normalizeUniversityId(mapped.universityId);
      mapped.phone = normalizePhone(mapped.phone);
      mapped.email = (mapped.email || '').toLowerCase().trim();

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

      // Check for duplicate University IDs across the whole workbook
      if (seenIds.has(mapped.universityId)) {
        const firstSeen = seenIds.get(mapped.universityId)!;
        const duplicateMsg = isMultiSheet && firstSeen.sheetName !== sheetName
          ? `Duplicate University ID "${mapped.universityId}" — first seen in [${firstSeen.sheetName}] row ${firstSeen.rowNumber}`
          : `Duplicate University ID "${mapped.universityId}" — first seen in row ${firstSeen.rowNumber}`;

        result.errors.push({
          row: rowNumber,
          sheet: sheetName,
          field: 'ID',
          message: duplicateMsg,
        });
        result.skipped++;
        continue;
      }
      seenIds.set(mapped.universityId, { sheetName, rowNumber });

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

      // Determine department
      const department =
        options?.departmentOverride ||
        mapped.department ||
        sheetDepartment ||
        null;

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
