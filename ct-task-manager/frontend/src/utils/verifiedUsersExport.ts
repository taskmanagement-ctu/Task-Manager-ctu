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

  const worksheet = workbook.addWorksheet('Verified Users Directory', {
    views: [{ showGridLines: true }],
  });

  const registeredCount = users.filter((u) => u.isRegistered).length;
  const pendingCount = users.length - registeredCount;

  // Setup Column Widths
  worksheet.columns = [
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

  // 1. Title Banner (Merged A1:J2)
  worksheet.mergeCells('A1:J2');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'CT UNIVERSITY - VERIFIED USERS DIRECTORY';
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF021C3B' } }; // CT Navy
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // 2. Subtitle Bar with metadata (Merged A3:J3)
  worksheet.mergeCells('A3:J3');
  const subCell = worksheet.getCell('A3');
  const filterDesc = [
    filterInfo?.department && filterInfo.department !== 'All' ? `Dept: ${filterInfo.department}` : null,
    filterInfo?.status ? `Status: ${filterInfo.status === 'registered' ? 'Registered' : 'Not Registered'}` : null,
    filterInfo?.search ? `Search: "${filterInfo.search}"` : null,
  ].filter(Boolean).join(' • ');

  subCell.value = `Official Authorized User Records  •  Generated: ${getFormattedDateTime()}${filterDesc ? `  •  Filters: [${filterDesc}]` : ''}`;
  subCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FFCBD5E1' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; // Dark Slate
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(3).height = 20;

  // 3. KPI Summary Row (A5:C5 & A6:C6)
  worksheet.getCell('A5').value = 'Total Records';
  worksheet.getCell('A5').font = { name: 'Arial', size: 9, color: { argb: 'FF64748B' } };
  worksheet.getCell('A6').value = users.length;
  worksheet.getCell('A6').font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FF021C3B' } };

  worksheet.getCell('B5').value = 'Registered Accounts';
  worksheet.getCell('B5').font = { name: 'Arial', size: 9, color: { argb: 'FF64748B' } };
  worksheet.getCell('B6').value = registeredCount;
  worksheet.getCell('B6').font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FF16A34A' } };

  worksheet.getCell('C5').value = 'Pending Registration';
  worksheet.getCell('C5').font = { name: 'Arial', size: 9, color: { argb: 'FF64748B' } };
  worksheet.getCell('C6').value = pendingCount;
  worksheet.getCell('C6').font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFD97706' } };

  worksheet.getRow(5).height = 18;
  worksheet.getRow(6).height = 22;

  // 4. Table Header Row (Row 8)
  const headerRow = worksheet.getRow(8);
  headerRow.values = [
    'S.No',
    'University ID',
    'Full Name',
    'Institutional Email',
    'Phone Number',
    'Department',
    'Designation',
    'Category',
    'Account Status',
    'Added On',
  ];
  headerRow.height = 24;

  const headerBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'medium', color: { argb: 'FF021C3B' } },
    bottom: { style: 'medium', color: { argb: 'FF021C3B' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  };

  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF021C3B' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = headerBorder;
  });

  // Align specific header texts
  headerRow.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };
  headerRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'left' };
  headerRow.getCell(6).alignment = { vertical: 'middle', horizontal: 'left' };
  headerRow.getCell(7).alignment = { vertical: 'middle', horizontal: 'left' };

  // 5. Populate Data Rows
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  };

  users.forEach((u, index) => {
    const rowNumber = 9 + index;
    const row = worksheet.getRow(rowNumber);
    const isEven = index % 2 === 0;

    const formattedDate = u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB') : '-';

    row.values = [
      index + 1,
      u.universityId,
      u.name,
      u.email,
      u.phone,
      u.department || '—',
      u.designation || '—',
      u.category || '—',
      u.isRegistered ? 'Registered' : 'Pending',
      formattedDate,
    ];

    row.height = 20;

    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Arial', size: 9.5 };
      cell.border = thinBorder;
      if (!isEven) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }

      // Center S.No, ID, Phone, Category, Status, Date
      if ([1, 2, 5, 8, 9, 10].includes(colNumber)) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });

    // Color code Status column
    const statusCell = row.getCell(9);
    statusCell.alignment = { vertical: 'middle', horizontal: 'center' };
    if (u.isRegistered) {
      statusCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF15803D' } };
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }; // Light green
    } else {
      statusCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFB45309' } };
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // Light yellow
    }
  });

  // Enable Auto-Filter across table headers
  if (users.length > 0) {
    worksheet.autoFilter = {
      from: { row: 8, column: 1 },
      to: { row: 8 + users.length, column: 9 },
    };
  }

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
