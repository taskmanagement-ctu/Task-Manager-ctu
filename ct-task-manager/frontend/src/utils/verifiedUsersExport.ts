import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { VerifiedUser } from '../services/api';

export interface VerifiedUsersExportFilterInfo {
  department?: string;
  status?: string;
  search?: string;
  userType?: string;
}

const getFormattedDateTime = (): string => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  return `${day}-${month}-${year} ${hours}:${mins}`;
};

const getFileDateStamp = (): string => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${year}${month}${day}`;
};

/**
 * Downloads a generated file blob in the browser
 */
const downloadBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

/**
 * Export verified users directory to Excel (.xlsx) with CT University styling
 */
export const exportVerifiedUsersToExcel = async (
  users: VerifiedUser[],
  filterInfo?: VerifiedUsersExportFilterInfo
) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CT University TaskDesk';
  workbook.created = new Date();

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  };

  const mediumTopBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'medium', color: { argb: 'FF021C3B' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'double', color: { argb: 'FF021C3B' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  };

  // Helper: Sanitize & truncate sheet names for Excel compatibility (max 31 chars, no invalid chars)
  const usedSheetNames = new Set<string>();
  const getSafeSheetName = (name: string): string => {
    let clean = (name || 'Unassigned')
      .replace(/[\\/?*[\]:]/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
    if (!clean) clean = 'Unassigned';
    if (clean.length > 31) clean = clean.slice(0, 31).trim();

    let unique = clean;
    let counter = 2;
    while (usedSheetNames.has(unique.toLowerCase())) {
      const suffix = ` (${counter})`;
      const base = clean.slice(0, 31 - suffix.length).trim();
      unique = `${base}${suffix}`;
      counter++;
    }
    usedSheetNames.add(unique.toLowerCase());
    return unique;
  };

  // Pre-reserve 'Summary' and 'All Verified Users'
  usedSheetNames.add('summary');
  usedSheetNames.add('all verified users');

  // 1. Group users by department
  const deptMap = new Map<string, VerifiedUser[]>();
  users.forEach((u) => {
    const deptName = u.department && String(u.department).trim() !== '' && String(u.department).trim() !== '—'
      ? String(u.department).trim()
      : 'Unassigned';
    if (!deptMap.has(deptName)) {
      deptMap.set(deptName, []);
    }
    deptMap.get(deptName)!.push(u);
  });

  // Sort department groups alphabetically, placing 'Unassigned' at the end
  const sortedDeptEntries = Array.from(deptMap.entries()).sort(([deptA], [deptB]) => {
    if (deptA === 'Unassigned') return 1;
    if (deptB === 'Unassigned') return -1;
    return deptA.localeCompare(deptB, undefined, { sensitivity: 'base' });
  });

  interface VerifiedDeptGroupSummary {
    department: string;
    safeSheetName: string;
    users: VerifiedUser[];
    totalUsers: number;
    registeredCount: number;
    pendingCount: number;
    teachingCount: number;
    nonTeachingCount: number;
  }

  const deptGroups: VerifiedDeptGroupSummary[] = sortedDeptEntries.map(([department, deptUsers]) => {
    const registeredCount = deptUsers.filter((u) => u.isRegistered).length;
    const pendingCount = deptUsers.length - registeredCount;
    const teachingCount = deptUsers.filter((u) => (u.category || '').toLowerCase() === 'teaching').length;
    const nonTeachingCount = deptUsers.filter((u) => (u.category || '').toLowerCase() === 'non-teaching').length;

    return {
      department,
      safeSheetName: getSafeSheetName(department),
      users: deptUsers,
      totalUsers: deptUsers.length,
      registeredCount,
      pendingCount,
      teachingCount,
      nonTeachingCount,
    };
  });

  // Institutional Totals
  const totalUsersCount = users.length;
  const totalDeptsCount = deptGroups.filter((g) => g.department !== 'Unassigned').length;
  const totalRegisteredCount = users.filter((u) => u.isRegistered).length;
  const totalPendingCount = totalUsersCount - totalRegisteredCount;
  const totalTeachingCount = users.filter((u) => (u.category || '').toLowerCase() === 'teaching').length;
  const totalNonTeachingCount = users.filter((u) => (u.category || '').toLowerCase() === 'non-teaching').length;

  const filterDesc = [
    filterInfo?.department && filterInfo.department !== 'All' ? `Dept: ${filterInfo.department}` : null,
    filterInfo?.status ? `Status: ${filterInfo.status === 'registered' ? 'Registered' : 'Not Registered'}` : null,
    filterInfo?.search ? `Search: "${filterInfo.search}"` : null,
  ].filter(Boolean).join(' • ');

  // Helper: Auto-fit columns based on cell content with safety padding (ignoring top banner)
  const autoFitWorksheetColumns = (ws: ExcelJS.Worksheet, headerRowIndex = 6) => {
    if (!ws.columns) return;
    ws.columns.forEach((column) => {
      if (!column) return;
      let maxLen = 0;
      if (typeof column.eachCell === 'function') {
        column.eachCell({ includeEmpty: false }, (cell, rowNumber) => {
          if (rowNumber < headerRowIndex) return;
          let cellText = '';
          if (cell.value !== null && cell.value !== undefined) {
            if (typeof cell.value === 'object') {
              if ('text' in cell.value) cellText = String((cell.value as any).text);
              else if ('result' in cell.value) cellText = String((cell.value as any).result);
            } else {
              cellText = String(cell.value);
            }
          }
          if (cellText.length > maxLen) {
            maxLen = cellText.length;
          }
        });
      }
      const currentWidth = (column.width as number) || 12;
      const calculated = Math.max(maxLen + 4, currentWidth);
      column.width = Math.min(calculated, 55);
    });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 1: 📊 Summary (Navigation Hub & Department Breakdown)
  // ═══════════════════════════════════════════════════════════════════════════
  const summaryWs = workbook.addWorksheet('Summary', { views: [{ showGridLines: true }] });

  summaryWs.columns = [
    { key: 'sno', width: 10 },
    { key: 'dept', width: 38 },
    { key: 'total', width: 18 },
    { key: 'registered', width: 18 },
    { key: 'pending', width: 18 },
    { key: 'teaching', width: 18 },
    { key: 'nonTeaching', width: 20 },
    { key: 'link', width: 20 },
  ];

  // 1. Title Banner
  summaryWs.mergeCells('A1:H2');
  const sumTitle = summaryWs.getCell('A1');
  sumTitle.value = 'CT UNIVERSITY — VERIFIED USERS DIRECTORY';
  sumTitle.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  sumTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF021C3B' } }; // Deep Navy
  sumTitle.alignment = { vertical: 'middle', horizontal: 'center' };

  // 2. Subtitle Bar
  summaryWs.mergeCells('A3:H3');
  const sumSubtitle = summaryWs.getCell('A3');
  sumSubtitle.value = `Official Authorized Personnel Registry  •  Generated: ${getFormattedDateTime()}  •  Total Records: ${totalUsersCount}${filterDesc ? `  •  Filters: [${filterDesc}]` : ''}`;
  sumSubtitle.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FFCBD5E1' } };
  sumSubtitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  sumSubtitle.alignment = { vertical: 'middle', horizontal: 'center' };
  summaryWs.getRow(3).height = 20;

  // 3. Top KPI Summary Cards (Rows 5 & 6)
  summaryWs.mergeCells('A5:B5');
  summaryWs.getCell('A5').value = 'Total Verified Records';
  summaryWs.getCell('A5').font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF64748B' } };
  summaryWs.getCell('A5').alignment = { horizontal: 'center', vertical: 'middle' };
  summaryWs.mergeCells('A6:B6');
  summaryWs.getCell('A6').value = totalUsersCount;
  summaryWs.getCell('A6').font = { name: 'Arial', size: 15, bold: true, color: { argb: 'FF0284C7' } };
  summaryWs.getCell('A6').alignment = { horizontal: 'center', vertical: 'middle' };

  summaryWs.mergeCells('C5:D5');
  summaryWs.getCell('C5').value = 'Active Academic Units';
  summaryWs.getCell('C5').font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF64748B' } };
  summaryWs.getCell('C5').alignment = { horizontal: 'center', vertical: 'middle' };
  summaryWs.mergeCells('C6:D6');
  summaryWs.getCell('C6').value = totalDeptsCount;
  summaryWs.getCell('C6').font = { name: 'Arial', size: 15, bold: true, color: { argb: 'FF021C3B' } };
  summaryWs.getCell('C6').alignment = { horizontal: 'center', vertical: 'middle' };

  summaryWs.mergeCells('E5:F5');
  summaryWs.getCell('E5').value = 'Registered / Pending Accounts';
  summaryWs.getCell('E5').font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF64748B' } };
  summaryWs.getCell('E5').alignment = { horizontal: 'center', vertical: 'middle' };
  summaryWs.mergeCells('E6:F6');
  summaryWs.getCell('E6').value = `${totalRegisteredCount} Registered  |  ${totalPendingCount} Pending`;
  summaryWs.getCell('E6').font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FF16A34A' } };
  summaryWs.getCell('E6').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

  summaryWs.mergeCells('G5:H5');
  summaryWs.getCell('G5').value = 'Teaching / Non-Teaching';
  summaryWs.getCell('G5').font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF64748B' } };
  summaryWs.getCell('G5').alignment = { horizontal: 'center', vertical: 'middle' };
  summaryWs.mergeCells('G6:H6');
  summaryWs.getCell('G6').value = `${totalTeachingCount} Teaching  |  ${totalNonTeachingCount} Non-Teaching`;
  summaryWs.getCell('G6').font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FF7C3AED' } };
  summaryWs.getCell('G6').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

  ['A5', 'B5', 'C5', 'D5', 'E5', 'F5', 'G5', 'H5', 'A6', 'B6', 'C6', 'D6', 'E6', 'F6', 'G6', 'H6'].forEach((cell) => {
    summaryWs.getCell(cell).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    summaryWs.getCell(cell).border = thinBorder;
  });
  summaryWs.getRow(5).height = 20;
  summaryWs.getRow(6).height = 30;

  // 4. Department Table Header (Row 8)
  const sumHeaderRow = summaryWs.getRow(8);
  sumHeaderRow.values = [
    'S.No',
    'Department Name',
    'Total Verified',
    'Registered',
    'Pending Reg.',
    'Teaching',
    'Non-Teaching',
    'Open Department',
  ];
  sumHeaderRow.height = 25;
  sumHeaderRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = thinBorder;
  });

  // 5. Populate Department Rows with Hyperlinks
  deptGroups.forEach((group, idx) => {
    const rowIdx = 9 + idx;
    const row = summaryWs.getRow(rowIdx);
    const linkTarget = `#'${group.safeSheetName.replace(/'/g, "''")}'!A1`;

    row.getCell(1).value = idx + 1;
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // Department name with internal sheet link
    const deptCell = row.getCell(2);
    deptCell.value = {
      text: group.department,
      hyperlink: linkTarget,
      tooltip: `Click to view ${group.department} verified roster`,
    };
    deptCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF1D4ED8' }, underline: true };
    deptCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    row.getCell(3).value = group.totalUsers;
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(3).font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };

    row.getCell(4).value = group.registeredCount;
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(4).font = { name: 'Arial', size: 9.5, color: { argb: 'FF15803D' } };

    row.getCell(5).value = group.pendingCount;
    row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
    if (group.pendingCount > 0) {
      row.getCell(5).font = { name: 'Arial', size: 9.5, color: { argb: 'FFB45309' } };
    }

    row.getCell(6).value = group.teachingCount;
    row.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };

    row.getCell(7).value = group.nonTeachingCount;
    row.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };

    // Action button / link
    const actionCell = row.getCell(8);
    actionCell.value = {
      text: 'View Roster →',
      hyperlink: linkTarget,
      tooltip: `Open ${group.safeSheetName}`,
    };
    actionCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF2563EB' }, underline: true };
    actionCell.alignment = { vertical: 'middle', horizontal: 'center' };

    row.height = 22;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = thinBorder;
      if (idx % 2 === 1 && !cell.fill) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    });
  });

  // 6. Grand Total Row
  const totalRowIdx = 9 + deptGroups.length;
  const totalRow = summaryWs.getRow(totalRowIdx);
  totalRow.values = [
    '',
    'Institutional Total Across All Departments',
    totalUsersCount,
    totalRegisteredCount,
    totalPendingCount,
    totalTeachingCount,
    totalNonTeachingCount,
    '',
  ];
  totalRow.height = 24;
  totalRow.eachCell((cell, colNum) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    cell.border = mediumTopBorder;
    if (colNum >= 3 && colNum <= 7) {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    } else {
      cell.alignment = { vertical: 'middle', horizontal: 'left', indent: colNum === 2 ? 1 : 0 };
    }
  });

  // Enable AutoFilter on department summary table
  if (deptGroups.length > 0) {
    summaryWs.autoFilter = {
      from: { row: 8, column: 1 },
      to: { row: 8 + deptGroups.length, column: 8 },
    };
  }

  // Auto-fit columns on Summary sheet based on content
  autoFitWorksheetColumns(summaryWs, 8);

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 2: 👥 All Verified Users (Master Dataset)
  // ═══════════════════════════════════════════════════════════════════════════
  const allVerifiedWs = workbook.addWorksheet('All Verified Users', { views: [{ showGridLines: true }] });
  allVerifiedWs.columns = [
    { key: 'sno', width: 8 },
    { key: 'universityId', width: 16 },
    { key: 'name', width: 26 },
    { key: 'email', width: 32 },
    { key: 'phone', width: 18 },
    { key: 'department', width: 30 },
    { key: 'designation', width: 24 },
    { key: 'category', width: 18 },
    { key: 'status', width: 18 },
    { key: 'dateAdded', width: 18 },
  ];

  // Navigation Link to Summary
  allVerifiedWs.mergeCells('A1:J1');
  const allNavCell = allVerifiedWs.getCell('A1');
  allNavCell.value = {
    text: '← Back to Department Summary Dashboard',
    hyperlink: "#'Summary'!A1",
    tooltip: 'Return to Summary sheet',
  };
  allNavCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF2563EB' }, underline: true };
  allNavCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  allNavCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  allVerifiedWs.getRow(1).height = 22;

  allVerifiedWs.mergeCells('A2:J3');
  const allTitleCell = allVerifiedWs.getCell('A2');
  allTitleCell.value = 'CT UNIVERSITY — MASTER VERIFIED USERS DIRECTORY';
  allTitleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  allTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF021C3B' } };
  allTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  allVerifiedWs.mergeCells('A4:J4');
  const allSubCell = allVerifiedWs.getCell('A4');
  allSubCell.value = `Official Authorized Personnel Records Across All Units  •  Generated: ${getFormattedDateTime()}  •  Total Records: ${totalUsersCount}`;
  allSubCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FFCBD5E1' } };
  allSubCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  allSubCell.alignment = { vertical: 'middle', horizontal: 'center' };
  allVerifiedWs.getRow(4).height = 20;

  const allHeaderRow = allVerifiedWs.getRow(6);
  allHeaderRow.values = [
    'S.No', 'University ID', 'Full Name', 'Institutional Email', 'Phone Number',
    'Department', 'Designation', 'Category', 'Account Status', 'Added On'
  ];
  allHeaderRow.height = 24;
  allHeaderRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = thinBorder;
  });

  users.forEach((u, i) => {
    const formattedDate = u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB') : '-';
    const row = allVerifiedWs.addRow({
      sno: i + 1,
      universityId: u.universityId,
      name: u.name,
      email: u.email,
      phone: u.phone,
      department: u.department || '—',
      designation: u.designation || '—',
      category: u.category || '—',
      status: u.isRegistered ? 'Registered' : 'Pending',
      dateAdded: formattedDate,
    });
    row.height = 20;
    row.eachCell((cell, colNumber) => {
      cell.border = thinBorder;
      if (i % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
      if ([1, 2, 5, 8, 9, 10].includes(colNumber)) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
      if (colNumber === 9) {
        if (u.isRegistered) {
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF15803D' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
        } else {
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFB45309' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
        }
      }
    });
  });

  if (users.length > 0) {
    allVerifiedWs.autoFilter = {
      from: { row: 6, column: 1 },
      to: { row: 6 + users.length, column: 10 },
    };
  }

  // Auto-fit columns on Master sheet based on content
  autoFitWorksheetColumns(allVerifiedWs, 6);

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEETS 3...N: 🏛️ Individual Department Dedicated Sheets
  // ═══════════════════════════════════════════════════════════════════════════
  deptGroups.forEach((group) => {
    const ws = workbook.addWorksheet(group.safeSheetName, { views: [{ showGridLines: true }] });

    ws.columns = [
      { key: 'sno', width: 8 },
      { key: 'universityId', width: 16 },
      { key: 'name', width: 26 },
      { key: 'email', width: 32 },
      { key: 'phone', width: 18 },
      { key: 'department', width: 30 },
      { key: 'designation', width: 24 },
      { key: 'category', width: 18 },
      { key: 'status', width: 18 },
      { key: 'dateAdded', width: 18 },
    ];

    // 1. Navigation Link Bar back to Summary
    ws.mergeCells('A1:J1');
    const navCell = ws.getCell('A1');
    navCell.value = {
      text: '← Back to Department Summary Dashboard',
      hyperlink: "#'Summary'!A1",
      tooltip: 'Return to Summary dashboard',
    };
    navCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF2563EB' }, underline: true };
    navCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    navCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.getRow(1).height = 22;

    // 2. Department Title Banner
    ws.mergeCells('A2:J3');
    const deptTitleCell = ws.getCell('A2');
    deptTitleCell.value = `CT UNIVERSITY — ${group.department.toUpperCase()} DIRECTORY`;
    deptTitleCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    deptTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF021C3B' } }; // Deep Navy
    deptTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // 3. Department Subtitle / Stats Bar
    ws.mergeCells('A4:J4');
    const deptSubCell = ws.getCell('A4');
    deptSubCell.value = `Department: ${group.department}  •  Total Records: ${group.totalUsers} (Registered: ${group.registeredCount}, Pending: ${group.pendingCount} | Teaching: ${group.teachingCount}, Non-Teaching: ${group.nonTeachingCount})  •  Generated: ${getFormattedDateTime()}`;
    deptSubCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FFCBD5E1' } };
    deptSubCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    deptSubCell.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(4).height = 20;

    // 4. Table Header Row (Row 6)
    const headerRow = ws.getRow(6);
    headerRow.values = [
      'S.No', 'University ID', 'Full Name', 'Institutional Email', 'Phone Number',
      'Department', 'Designation', 'Category', 'Account Status', 'Added On'
    ];
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = thinBorder;
    });

    // 5. Populate Department User Rows
    group.users.forEach((u, i) => {
      const formattedDate = u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB') : '-';
      const row = ws.addRow({
        sno: i + 1,
        universityId: u.universityId,
        name: u.name,
        email: u.email,
        phone: u.phone,
        department: u.department || '—',
        designation: u.designation || '—',
        category: u.category || '—',
        status: u.isRegistered ? 'Registered' : 'Pending',
        dateAdded: formattedDate,
      });
      row.height = 20;
      row.eachCell((cell, colNumber) => {
        cell.border = thinBorder;
        if (i % 2 === 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        }
        if ([1, 2, 5, 8, 9, 10].includes(colNumber)) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
        if (colNumber === 9) {
          if (u.isRegistered) {
            cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF15803D' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
          } else {
            cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFB45309' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
          }
        }
      });
    });

    // 6. Enable AutoFilter on this department's sheet
    if (group.users.length > 0) {
      ws.autoFilter = {
        from: { row: 6, column: 1 },
        to: { row: 6 + group.users.length, column: 10 },
      };
    }

    // Auto-fit columns on this department sheet based on content
    autoFitWorksheetColumns(ws, 6);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, `CTU_Verified_Users_${getFileDateStamp()}.xlsx`);
};

/**
 * Export verified users directory to PDF with official CT University header
 */
export const exportVerifiedUsersToPdf = (
  users: VerifiedUser[],
  filterInfo?: VerifiedUsersExportFilterInfo
) => {
  // Use Landscape for comfortable display of all 7 columns
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  const registeredCount = users.filter((u) => u.isRegistered).length;
  const pendingCount = users.length - registeredCount;

  // Title Banner
  doc.setFillColor(2, 28, 59); // Deep Navy #021C3B
  doc.rect(40, 30, doc.internal.pageSize.getWidth() - 80, 48, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text('CT UNIVERSITY - VERIFIED USERS DIRECTORY', 55, 54);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(`Official Authorized User Registry  •  Generated on: ${getFormattedDateTime()}`, 55, 68);

  // Filter & Stats Sub-Bar
  doc.setFillColor(241, 245, 249); // Slate-100
  doc.rect(40, 84, doc.internal.pageSize.getWidth() - 80, 24, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  const filterDesc = [
    filterInfo?.department && filterInfo.department !== 'All' ? `Dept: ${filterInfo.department}` : null,
    filterInfo?.status ? `Status: ${filterInfo.status === 'registered' ? 'Registered' : 'Not Registered'}` : null,
    filterInfo?.search ? `Search: "${filterInfo.search}"` : null,
  ].filter(Boolean).join(' | ');

  doc.text(`Total Records: ${users.length}   •   Registered: ${registeredCount}   •   Pending: ${pendingCount}${filterDesc ? `   •   [${filterDesc}]` : ''}`, 50, 99);

  // Table Data
  const tableData = users.map((u, i) => [
    i + 1,
    u.universityId,
    u.name,
    u.email,
    u.phone,
    u.department || '—',
    u.designation || '—',
    u.category || '—',
    u.isRegistered ? 'Registered' : 'Pending',
  ]);

  autoTable(doc, {
    startY: 116,
    head: [['#', 'ID', 'Name', 'Email Address', 'Phone No.', 'Department', 'Designation', 'Category', 'Status']],
    body: tableData,
    margin: { left: 30, right: 30 },
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 4,
      font: 'helvetica',
    },
    headStyles: {
      fillColor: [2, 28, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' },
      1: { cellWidth: 44, halign: 'center' },
      2: { cellWidth: 105 },
      3: { cellWidth: 145 },
      4: { cellWidth: 70, halign: 'center' },
      5: { cellWidth: 115 },
      6: { cellWidth: 95 },
      7: { cellWidth: 65, halign: 'center' },
      8: { cellWidth: 65, halign: 'center' },
    },
    didDrawCell: (data) => {
      // Highlight status column
      if (data.section === 'body' && data.column.index === 8) {
        const text = data.cell.raw as string;
        if (text === 'Registered') {
          doc.setTextColor(21, 128, 61); // Green
        } else {
          doc.setTextColor(180, 83, 9); // Amber
        }
      }
    },
    didDrawPage: (data) => {
      // Footer on every page
      const pageNumber = (data as any).pageNumber || 1;
      const totalPages = (doc.internal as any).getNumberOfPages() || 1;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${pageNumber} of ${totalPages}  •  Confidential  •  CT University Task Management System`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 18,
        { align: 'center' }
      );
    },
  });

  doc.save(`CTU_Verified_Users_${getFileDateStamp()}.pdf`);
};

/**
 * Export verified users directory to CSV (UTF-8 with BOM for Excel compatibility)
 */
export const exportVerifiedUsersToCsv = (users: VerifiedUser[]) => {
  const headers = ['S.No', 'University ID', 'Name', 'Email', 'Phone', 'Department', 'Designation', 'Category', 'Status', 'Added Date'];
  
  const escapeCsv = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = users.map((u, i) => [
    i + 1,
    escapeCsv(u.universityId),
    escapeCsv(u.name),
    escapeCsv(u.email),
    escapeCsv(u.phone),
    escapeCsv(u.department || ''),
    escapeCsv(u.designation || ''),
    escapeCsv(u.category || ''),
    escapeCsv(u.isRegistered ? 'Registered' : 'Pending'),
    escapeCsv(u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB') : ''),
  ].join(','));

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `CTU_Verified_Users_${getFileDateStamp()}.csv`);
};
