import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

const escapeCsv = (val: any): string => {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
};

// ═══════════════════════════════════════════════════════════════════════════
// 1. TASKS EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export interface TasksExportFilterInfo {
  status?: string;
  department?: string;
  search?: string;
  taskType?: string;
}

export const exportTasks = async (
  tasks: any[],
  format: 'excel' | 'pdf' | 'csv',
  filterInfo?: TasksExportFilterInfo
) => {
  if (!tasks || tasks.length === 0) {
    alert('No tasks available to export.');
    return;
  }

  const filenameBase = `CTU_Tasks_Report_${getFileDateStamp()}`;

  if (format === 'csv') {
    const headers = [
      'S.No', 'Task ID', 'Title', 'Description', 'Created By', 'Assigned To',
      'Department', 'Deadline', 'Status', 'Workflow Type', 'Rating', 'Feedback', 'Created Date'
    ];
    const rows = tasks.map((t, i) => [
      i + 1,
      escapeCsv(t.taskId || t._id),
      escapeCsv(t.title),
      escapeCsv(t.description),
      escapeCsv(t.createdBy?.name || 'Super Admin'),
      escapeCsv(t.assignedTo?.name || 'Unassigned'),
      escapeCsv(t.department || t.assignedTo?.department || '—'),
      escapeCsv(t.deadline ? new Date(t.deadline).toLocaleDateString('en-GB') : '—'),
      escapeCsv((t.status || 'pending').toUpperCase()),
      escapeCsv(t.workflowType || 'Standard'),
      escapeCsv(t.review?.rating ? `${t.review.rating}/5` : 'N/A'),
      escapeCsv(t.review?.feedback || '—'),
      escapeCsv(t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-GB') : '—'),
    ].join(','));

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    downloadBlob(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }), `${filenameBase}.csv`);
    return;
  }

  if (format === 'pdf') {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Title Header
    doc.setFillColor(2, 28, 59); // Deep Navy
    doc.rect(40, 30, pageWidth - 80, 48, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text('CT UNIVERSITY — TASK MANAGEMENT REPORT', 55, 54);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(203, 213, 225);
    doc.text(`Official Academic & Operational Tasks Registry  •  Generated: ${getFormattedDateTime()}`, 55, 68);

    // Filter sub-bar
    doc.setFillColor(241, 245, 249);
    doc.rect(40, 84, pageWidth - 80, 24, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    const filterDesc = [
      filterInfo?.status && filterInfo.status !== 'All' ? `Status: ${filterInfo.status}` : null,
      filterInfo?.department && filterInfo.department !== 'All' ? `Dept: ${filterInfo.department}` : null,
      filterInfo?.search ? `Search: "${filterInfo.search}"` : null,
    ].filter(Boolean).join(' | ');
    doc.text(`Total Tasks: ${tasks.length}${filterDesc ? `   •   [${filterDesc}]` : ''}`, 50, 99);

    const tableData = tasks.map((t, i) => [
      i + 1,
      t.taskId || (String(t._id).slice(-6)),
      t.title || 'Untitled',
      t.assignedTo?.name || 'Unassigned',
      t.department || t.assignedTo?.department || '—',
      t.deadline ? new Date(t.deadline).toLocaleDateString('en-GB') : '—',
      (t.status || 'pending').replace(/_/g, ' ').toUpperCase(),
      t.review?.rating ? `${t.review.rating}/5` : '—',
    ]);

    autoTable(doc, {
      startY: 116,
      head: [['#', 'Task ID', 'Task Title', 'Assignee', 'Department', 'Deadline', 'Status', 'Rating']],
      body: tableData,
      margin: { left: 40, right: 40 },
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 4.5, font: 'helvetica' },
      headStyles: { fillColor: [2, 28, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 26, halign: 'center' },
        1: { cellWidth: 70 },
        2: { cellWidth: 220 },
        3: { cellWidth: 120 },
        4: { cellWidth: 110 },
        5: { cellWidth: 70, halign: 'center' },
        6: { cellWidth: 90, halign: 'center' },
        7: { cellWidth: 45, halign: 'center' },
      },
      didDrawPage: (data) => {
        const pageNumber = (data as any).pageNumber || 1;
        const totalPages = (doc.internal as any).getNumberOfPages() || 1;
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Page ${pageNumber} of ${totalPages}  •  Confidential  •  CT University TaskDesk`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 18,
          { align: 'center' }
        );
      },
    });

    doc.save(`${filenameBase}.pdf`);
    return;
  }

  // Excel Format (.xlsx)
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CT University TaskDesk';
  const worksheet = workbook.addWorksheet('Tasks Register', { views: [{ showGridLines: true }] });

  worksheet.columns = [
    { key: 'sno', width: 8 },
    { key: 'taskId', width: 16 },
    { key: 'title', width: 34 },
    { key: 'description', width: 40 },
    { key: 'creator', width: 22 },
    { key: 'assignee', width: 24 },
    { key: 'dept', width: 26 },
    { key: 'deadline', width: 16 },
    { key: 'status', width: 18 },
    { key: 'rating', width: 12 },
    { key: 'feedback', width: 30 },
  ];

  // Header Title
  worksheet.mergeCells('A1:K2');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'CT UNIVERSITY — TASKS REGISTER & WORKLOAD MATRIX';
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF021C3B' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Subtitle
  worksheet.mergeCells('A3:K3');
  const subCell = worksheet.getCell('A3');
  subCell.value = `Official Task Audit  •  Generated: ${getFormattedDateTime()}  •  Total Tasks: ${tasks.length}`;
  subCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FFCBD5E1' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(3).height = 20;

  // Table Column Headers
  const headerRow = worksheet.getRow(5);
  headerRow.values = [
    'S.No', 'Task ID', 'Title', 'Description', 'Created By', 'Assigned To',
    'Department', 'Deadline', 'Status', 'Rating', 'Feedback'
  ];
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
    };
  });

  tasks.forEach((t, i) => {
    const row = worksheet.addRow({
      sno: i + 1,
      taskId: t.taskId || String(t._id).slice(-6),
      title: t.title || 'Untitled',
      description: t.description || '',
      creator: t.createdBy?.name || 'Super Admin',
      assignee: t.assignedTo?.name || 'Unassigned',
      dept: t.department || t.assignedTo?.department || '—',
      deadline: t.deadline ? new Date(t.deadline).toLocaleDateString('en-GB') : '—',
      status: (t.status || 'pending').replace(/_/g, ' ').toUpperCase(),
      rating: t.review?.rating ? `${t.review.rating}/5` : '—',
      feedback: t.review?.feedback || '—',
    });
    row.height = 20;
    if (i % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }
  });

  if (tasks.length > 0) {
    worksheet.autoFilter = {
      from: { row: 5, column: 1 },
      to: { row: 5 + tasks.length, column: 11 },
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${filenameBase}.xlsx`);
};

// ═══════════════════════════════════════════════════════════════════════════
// 2. USERS EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export interface UsersExportFilterInfo {
  role?: string;
  department?: string;
  search?: string;
  status?: string;
}

export const exportUsers = async (
  users: any[],
  format: 'excel' | 'pdf' | 'csv',
  filterInfo?: UsersExportFilterInfo
) => {
  if (!users || users.length === 0) {
    alert('No users available to export.');
    return;
  }

  const filenameBase = `CTU_Users_Directory_${getFileDateStamp()}`;

  if (format === 'csv') {
    const headers = ['S.No', 'University ID', 'Full Name', 'Email', 'Phone', 'Role', 'Department', 'Base Department', 'Status', 'Registered Date'];
    const rows = users.map((u, i) => [
      i + 1,
      escapeCsv(u.universityId),
      escapeCsv(u.name),
      escapeCsv(u.email),
      escapeCsv(u.phone),
      escapeCsv((u.role || 'staff').toUpperCase()),
      escapeCsv(u.department || '—'),
      escapeCsv(u.baseDepartment || u.department || '—'),
      escapeCsv(u.isActive !== false ? 'Active' : 'Inactive'),
      escapeCsv(u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB') : '—'),
    ].join(','));

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    downloadBlob(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }), `${filenameBase}.csv`);
    return;
  }

  if (format === 'pdf') {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFillColor(2, 28, 59);
    doc.rect(40, 30, pageWidth - 80, 48, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text('CT UNIVERSITY — REGISTERED USERS DIRECTORY', 55, 54);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(203, 213, 225);
    doc.text(`Authorized Campus Personnel Registry  •  Generated: ${getFormattedDateTime()}`, 55, 68);

    doc.setFillColor(241, 245, 249);
    doc.rect(40, 84, pageWidth - 80, 24, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    const filterDesc = [
      filterInfo?.role && filterInfo.role !== 'All' ? `Role: ${filterInfo.role}` : null,
      filterInfo?.department && filterInfo.department !== 'All' ? `Dept: ${filterInfo.department}` : null,
      filterInfo?.search ? `Search: "${filterInfo.search}"` : null,
    ].filter(Boolean).join(' | ');
    doc.text(`Total Users: ${users.length}${filterDesc ? `   •   [${filterDesc}]` : ''}`, 50, 99);

    const tableData = users.map((u, i) => [
      i + 1,
      u.universityId,
      u.name,
      u.email,
      u.phone,
      (u.role || 'staff').toUpperCase(),
      u.department || '—',
      u.isActive !== false ? 'Active' : 'Inactive',
    ]);

    autoTable(doc, {
      startY: 116,
      head: [['#', 'ID', 'Full Name', 'Email Address', 'Phone No.', 'Role', 'Department', 'Status']],
      body: tableData,
      margin: { left: 40, right: 40 },
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 4.5, font: 'helvetica' },
      headStyles: { fillColor: [2, 28, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 26, halign: 'center' },
        1: { cellWidth: 55, halign: 'center' },
        2: { cellWidth: 130 },
        3: { cellWidth: 175 },
        4: { cellWidth: 80, halign: 'center' },
        5: { cellWidth: 80, halign: 'center' },
        6: { cellWidth: 135 },
        7: { cellWidth: 60, halign: 'center' },
      },
      didDrawPage: (data) => {
        const pageNumber = (data as any).pageNumber || 1;
        const totalPages = (doc.internal as any).getNumberOfPages() || 1;
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Page ${pageNumber} of ${totalPages}  •  Confidential  •  CT University TaskDesk`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 18,
          { align: 'center' }
        );
      },
    });

    doc.save(`${filenameBase}.pdf`);
    return;
  }

  // Excel Format (.xlsx) - Multi-tab with Department Summary & Department-wise sheets
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

  // Pre-reserve 'Summary' and 'All Users'
  usedSheetNames.add('summary');
  usedSheetNames.add('all users');

  // 1. Group users by department
  const deptMap = new Map<string, any[]>();
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

  interface DeptGroupSummary {
    department: string;
    safeSheetName: string;
    users: any[];
    adminNames: string[];
    staffCount: number;
    adminCount: number;
    activeCount: number;
    inactiveCount: number;
    totalUsers: number;
  }

  const deptGroups: DeptGroupSummary[] = sortedDeptEntries.map(([department, deptUsers]) => {
    const adminNames = deptUsers
      .filter((u) => u.role === 'department_admin')
      .map((u) => u.name)
      .filter(Boolean);
    const staffCount = deptUsers.filter((u) => (u.role || 'staff') === 'staff').length;
    const adminCount = deptUsers.filter((u) => u.role === 'department_admin').length;
    const activeCount = deptUsers.filter((u) => u.isActive !== false).length;
    const inactiveCount = deptUsers.filter((u) => u.isActive === false).length;

    return {
      department,
      safeSheetName: getSafeSheetName(department),
      users: deptUsers,
      adminNames,
      staffCount,
      adminCount,
      activeCount,
      inactiveCount,
      totalUsers: deptUsers.length,
    };
  });

  // Institutional Totals
  const totalUsersCount = users.length;
  const totalDeptsCount = deptGroups.filter((g) => g.department !== 'Unassigned').length;
  const totalDeptAdminsCount = users.filter((u) => u.role === 'department_admin').length;
  const totalStaffCount = users.filter((u) => (u.role || 'staff') === 'staff').length;
  const totalActiveCount = users.filter((u) => u.isActive !== false).length;
  const totalInactiveCount = users.filter((u) => u.isActive === false).length;

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 1: 📊 Summary (Navigation Hub & Department Breakdown)
  // ═══════════════════════════════════════════════════════════════════════════
  const summaryWs = workbook.addWorksheet('Summary', { views: [{ showGridLines: true }] });

  summaryWs.columns = [
    { key: 'sno', width: 8 },
    { key: 'dept', width: 34 },
    { key: 'admins', width: 28 },
    { key: 'staff', width: 14 },
    { key: 'active', width: 14 },
    { key: 'inactive', width: 14 },
    { key: 'total', width: 16 },
    { key: 'link', width: 18 },
  ];

  // 1. Title Banner
  summaryWs.mergeCells('A1:H2');
  const sumTitle = summaryWs.getCell('A1');
  sumTitle.value = 'CT UNIVERSITY — REGISTERED USERS DIRECTORY';
  sumTitle.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  sumTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF021C3B' } }; // Deep Navy
  sumTitle.alignment = { vertical: 'middle', horizontal: 'center' };

  // 2. Subtitle Bar
  summaryWs.mergeCells('A3:H3');
  const sumSubtitle = summaryWs.getCell('A3');
  sumSubtitle.value = `Institutional Personnel Summary & Department Navigation  •  Generated: ${getFormattedDateTime()}  •  Total Records: ${totalUsersCount}`;
  sumSubtitle.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FFCBD5E1' } };
  sumSubtitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  sumSubtitle.alignment = { vertical: 'middle', horizontal: 'center' };
  summaryWs.getRow(3).height = 20;

  // 3. Top KPI Summary Cards (Rows 5 & 6)
  summaryWs.mergeCells('A5:B5');
  summaryWs.getCell('A5').value = 'Total Registered Personnel';
  summaryWs.getCell('A5').font = { name: 'Arial', size: 8.5, color: { argb: 'FF64748B' } };
  summaryWs.getCell('A5').alignment = { horizontal: 'center', vertical: 'middle' };
  summaryWs.mergeCells('A6:B6');
  summaryWs.getCell('A6').value = totalUsersCount;
  summaryWs.getCell('A6').font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF0284C7' } };
  summaryWs.getCell('A6').alignment = { horizontal: 'center', vertical: 'middle' };

  summaryWs.mergeCells('C5:D5');
  summaryWs.getCell('C5').value = 'Active Academic Departments';
  summaryWs.getCell('C5').font = { name: 'Arial', size: 8.5, color: { argb: 'FF64748B' } };
  summaryWs.getCell('C5').alignment = { horizontal: 'center', vertical: 'middle' };
  summaryWs.mergeCells('C6:D6');
  summaryWs.getCell('C6').value = totalDeptsCount;
  summaryWs.getCell('C6').font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF021C3B' } };
  summaryWs.getCell('C6').alignment = { horizontal: 'center', vertical: 'middle' };

  summaryWs.mergeCells('E5:F5');
  summaryWs.getCell('E5').value = 'Department Administrators';
  summaryWs.getCell('E5').font = { name: 'Arial', size: 8.5, color: { argb: 'FF64748B' } };
  summaryWs.getCell('E5').alignment = { horizontal: 'center', vertical: 'middle' };
  summaryWs.mergeCells('E6:F6');
  summaryWs.getCell('E6').value = totalDeptAdminsCount;
  summaryWs.getCell('E6').font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF7C3AED' } };
  summaryWs.getCell('E6').alignment = { horizontal: 'center', vertical: 'middle' };

  summaryWs.mergeCells('G5:H5');
  summaryWs.getCell('G5').value = 'Active / Inactive Staff';
  summaryWs.getCell('G5').font = { name: 'Arial', size: 8.5, color: { argb: 'FF64748B' } };
  summaryWs.getCell('G5').alignment = { horizontal: 'center', vertical: 'middle' };
  summaryWs.mergeCells('G6:H6');
  summaryWs.getCell('G6').value = `${totalActiveCount} Active  /  ${totalInactiveCount} Inactive`;
  summaryWs.getCell('G6').font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FF059669' } };
  summaryWs.getCell('G6').alignment = { horizontal: 'center', vertical: 'middle' };

  ['A5', 'B5', 'C5', 'D5', 'E5', 'F5', 'G5', 'H5', 'A6', 'B6', 'C6', 'D6', 'E6', 'F6', 'G6', 'H6'].forEach((cell) => {
    summaryWs.getCell(cell).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    summaryWs.getCell(cell).border = thinBorder;
  });
  summaryWs.getRow(5).height = 18;
  summaryWs.getRow(6).height = 24;

  // 4. Department Table Header (Row 8)
  const sumHeaderRow = summaryWs.getRow(8);
  sumHeaderRow.values = [
    'S.No',
    'Department Name',
    'Department Admin(s)',
    'Staff Count',
    'Active Staff',
    'Inactive Staff',
    'Total Personnel',
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
      tooltip: `Click to view ${group.department} roster`,
    };
    deptCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF1D4ED8' }, underline: true };
    deptCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    row.getCell(3).value = group.adminNames.length > 0 ? group.adminNames.join(', ') : '—';
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };

    row.getCell(4).value = group.staffCount;
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };

    row.getCell(5).value = group.activeCount;
    row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(5).font = { name: 'Arial', size: 9.5, color: { argb: 'FF15803D' } };

    row.getCell(6).value = group.inactiveCount;
    row.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };
    if (group.inactiveCount > 0) {
      row.getCell(6).font = { name: 'Arial', size: 9.5, color: { argb: 'FFDC2626' } };
    }

    row.getCell(7).value = group.totalUsers;
    row.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(7).font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };

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
    `Total Depts: ${totalDeptsCount}`,
    totalStaffCount,
    totalActiveCount,
    totalInactiveCount,
    totalUsersCount,
    '',
  ];
  totalRow.height = 24;
  totalRow.eachCell((cell, colNum) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    cell.border = mediumTopBorder;
    if (colNum >= 4 && colNum <= 7) {
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

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 2: 👥 All Users (Master Dataset for Global Search / Pivot Tables)
  // ═══════════════════════════════════════════════════════════════════════════
  const allUsersWs = workbook.addWorksheet('All Users', { views: [{ showGridLines: true }] });
  allUsersWs.columns = [
    { key: 'sno', width: 8 },
    { key: 'id', width: 16 },
    { key: 'name', width: 26 },
    { key: 'email', width: 32 },
    { key: 'phone', width: 18 },
    { key: 'role', width: 18 },
    { key: 'dept', width: 28 },
    { key: 'baseDept', width: 28 },
    { key: 'status', width: 14 },
    { key: 'regDate', width: 16 },
  ];

  // Navigation Link to Summary
  allUsersWs.mergeCells('A1:J1');
  const allNavCell = allUsersWs.getCell('A1');
  allNavCell.value = {
    text: '← Back to Department Summary Dashboard',
    hyperlink: "#'Summary'!A1",
    tooltip: 'Return to Summary sheet',
  };
  allNavCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF2563EB' }, underline: true };
  allNavCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  allNavCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  allUsersWs.getRow(1).height = 22;

  allUsersWs.mergeCells('A2:J3');
  const allTitleCell = allUsersWs.getCell('A2');
  allTitleCell.value = 'CT UNIVERSITY — MASTER REGISTERED USERS DIRECTORY';
  allTitleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  allTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF021C3B' } };
  allTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  allUsersWs.mergeCells('A4:J4');
  const allSubCell = allUsersWs.getCell('A4');
  allSubCell.value = `Complete Personnel Registry Across All Units  •  Generated: ${getFormattedDateTime()}  •  Total Records: ${totalUsersCount}`;
  allSubCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FFCBD5E1' } };
  allSubCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  allSubCell.alignment = { vertical: 'middle', horizontal: 'center' };
  allUsersWs.getRow(4).height = 20;

  const allHeaderRow = allUsersWs.getRow(6);
  allHeaderRow.values = [
    'S.No', 'University ID', 'Full Name', 'Email Address', 'Phone No.',
    'System Role', 'Current Department', 'Base Department', 'Status', 'Registered Date'
  ];
  allHeaderRow.height = 24;
  allHeaderRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = thinBorder;
  });

  users.forEach((u, i) => {
    const row = allUsersWs.addRow({
      sno: i + 1,
      id: u.universityId,
      name: u.name,
      email: u.email,
      phone: u.phone || '—',
      role: (u.role || 'staff').toUpperCase(),
      dept: u.department || '—',
      baseDept: u.baseDepartment || u.department || '—',
      status: u.isActive !== false ? 'Active' : 'Inactive',
      regDate: u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB') : '—',
    });
    row.height = 20;
    row.eachCell((cell, colNumber) => {
      cell.border = thinBorder;
      if (i % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
      if (colNumber === 1 || colNumber === 2 || colNumber === 5 || colNumber === 6 || colNumber === 9 || colNumber === 10) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
      if (colNumber === 9) {
        cell.font = {
          name: 'Arial',
          size: 9.5,
          color: { argb: u.isActive !== false ? 'FF15803D' : 'FFDC2626' },
        };
      }
    });
  });

  if (users.length > 0) {
    allUsersWs.autoFilter = {
      from: { row: 6, column: 1 },
      to: { row: 6 + users.length, column: 10 },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEETS 3...N: 🏛️ Individual Department Dedicated Sheets
  // ═══════════════════════════════════════════════════════════════════════════
  deptGroups.forEach((group) => {
    const ws = workbook.addWorksheet(group.safeSheetName, { views: [{ showGridLines: true }] });

    ws.columns = [
      { key: 'sno', width: 8 },
      { key: 'id', width: 16 },
      { key: 'name', width: 26 },
      { key: 'email', width: 32 },
      { key: 'phone', width: 18 },
      { key: 'role', width: 18 },
      { key: 'dept', width: 28 },
      { key: 'baseDept', width: 28 },
      { key: 'status', width: 14 },
      { key: 'regDate', width: 16 },
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
    const adminStr = group.adminNames.length > 0 ? group.adminNames.join(', ') : 'Unassigned';
    deptSubCell.value = `Department Admin: ${adminStr}  •  Total Personnel: ${group.totalUsers} (Staff: ${group.staffCount}, Admins: ${group.adminCount})  •  Generated: ${getFormattedDateTime()}`;
    deptSubCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FFCBD5E1' } };
    deptSubCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    deptSubCell.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(4).height = 20;

    // 4. Table Header Row (Row 6)
    const headerRow = ws.getRow(6);
    headerRow.values = [
      'S.No', 'University ID', 'Full Name', 'Email Address', 'Phone No.',
      'System Role', 'Current Department', 'Base Department', 'Status', 'Registered Date'
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
      const row = ws.addRow({
        sno: i + 1,
        id: u.universityId,
        name: u.name,
        email: u.email,
        phone: u.phone || '—',
        role: (u.role || 'staff').toUpperCase(),
        dept: u.department || '—',
        baseDept: u.baseDepartment || u.department || '—',
        status: u.isActive !== false ? 'Active' : 'Inactive',
        regDate: u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB') : '—',
      });
      row.height = 20;
      row.eachCell((cell, colNumber) => {
        cell.border = thinBorder;
        if (i % 2 === 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        }
        if (colNumber === 1 || colNumber === 2 || colNumber === 5 || colNumber === 6 || colNumber === 9 || colNumber === 10) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
        if (colNumber === 6 && u.role === 'department_admin') {
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF7C3AED' } };
        } else if (colNumber === 6 && u.role === 'super_admin') {
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFDC2626' } };
        }
        if (colNumber === 9) {
          cell.font = {
            name: 'Arial',
            size: 9.5,
            color: { argb: u.isActive !== false ? 'FF15803D' : 'FFDC2626' },
          };
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
  });

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${filenameBase}.xlsx`);
};

// ═══════════════════════════════════════════════════════════════════════════
// 3. STAFF ASSIGNMENTS EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export const exportStaffAssignments = async (
  staffList: any[],
  assignmentList: any[],
  format: 'excel' | 'pdf' | 'csv',
  filterInfo?: { department?: string; role?: string; search?: string }
) => {
  if (!staffList || staffList.length === 0) {
    alert('No staff assignment records available to export.');
    return;
  }

  const filenameBase = `CTU_Staff_Reporting_Matrix_${getFileDateStamp()}`;

  // Build mapping of staff -> assigned admin
  const adminMap: Record<string, any> = {};
  assignmentList.forEach((a) => {
    if (a.isActive && a.staffId && a.adminId) {
      const sId = typeof a.staffId === 'object' ? a.staffId._id || a.staffId.id : a.staffId;
      adminMap[String(sId)] = typeof a.adminId === 'object' ? a.adminId : { _id: a.adminId };
    }
  });

  const matrixData = staffList.map((s, i) => {
    const assignedAdmin = adminMap[String(s._id || s.id)];
    const isDeptAdmin = s.role === 'department_admin';
    return {
      sno: i + 1,
      staffId: s.universityId,
      name: s.name,
      email: s.email,
      phone: s.phone,
      dept: s.department || '—',
      role: isDeptAdmin ? 'Dept Admin' : 'Staff',
      reportingAdmin: isDeptAdmin ? 'Self (Head of Dept)' : (assignedAdmin?.name || 'Unassigned'),
      adminId: isDeptAdmin ? s.universityId : (assignedAdmin?.universityId || '—'),
    };
  });

  if (format === 'csv') {
    const headers = ['S.No', 'Staff ID', 'Name', 'Email', 'Phone', 'Department', 'Role', 'Reports To (Admin)', 'Admin ID'];
    const rows = matrixData.map(m => [
      m.sno,
      escapeCsv(m.staffId),
      escapeCsv(m.name),
      escapeCsv(m.email),
      escapeCsv(m.phone),
      escapeCsv(m.dept),
      escapeCsv(m.role),
      escapeCsv(m.reportingAdmin),
      escapeCsv(m.adminId),
    ].join(','));

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    downloadBlob(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }), `${filenameBase}.csv`);
    return;
  }

  if (format === 'pdf') {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFillColor(2, 28, 59);
    doc.rect(40, 30, pageWidth - 80, 48, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text('CT UNIVERSITY — STAFF REPORTING & ALLOCATION MATRIX', 55, 54);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(203, 213, 225);
    doc.text(`Department Leadership & Staff Supervision Matrix  •  Generated: ${getFormattedDateTime()}`, 55, 68);

    doc.setFillColor(241, 245, 249);
    doc.rect(40, 84, pageWidth - 80, 24, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`Total Records: ${matrixData.length}   •   Dept: ${filterInfo?.department || 'All'}`, 50, 99);

    const tableData = matrixData.map(m => [
      m.sno,
      m.staffId,
      m.name,
      m.dept,
      m.role,
      m.reportingAdmin,
      m.email,
    ]);

    autoTable(doc, {
      startY: 116,
      head: [['#', 'Staff ID', 'Staff Name', 'Department', 'Role', 'Reports To (Admin)', 'Email Address']],
      body: tableData,
      margin: { left: 40, right: 40 },
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 4.5, font: 'helvetica' },
      headStyles: { fillColor: [2, 28, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 26, halign: 'center' },
        1: { cellWidth: 55, halign: 'center' },
        2: { cellWidth: 140 },
        3: { cellWidth: 140 },
        4: { cellWidth: 75, halign: 'center' },
        5: { cellWidth: 140 },
        6: { cellWidth: 160 },
      },
      didDrawPage: (data) => {
        const pageNumber = (data as any).pageNumber || 1;
        const totalPages = (doc.internal as any).getNumberOfPages() || 1;
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Page ${pageNumber} of ${totalPages}  •  Confidential  •  CT University TaskDesk`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 18,
          { align: 'center' }
        );
      },
    });

    doc.save(`${filenameBase}.pdf`);
    return;
  }

  // Excel Format (.xlsx)
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CT University TaskDesk';
  const worksheet = workbook.addWorksheet('Staff Reporting Matrix', { views: [{ showGridLines: true }] });

  worksheet.columns = [
    { key: 'sno', width: 8 },
    { key: 'staffId', width: 16 },
    { key: 'name', width: 26 },
    { key: 'dept', width: 28 },
    { key: 'role', width: 18 },
    { key: 'reportingAdmin', width: 28 },
    { key: 'adminId', width: 16 },
    { key: 'email', width: 32 },
    { key: 'phone', width: 18 },
  ];

  worksheet.mergeCells('A1:I2');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'CT UNIVERSITY — STAFF REPORTING & ALLOCATION MATRIX';
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF021C3B' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  worksheet.mergeCells('A3:I3');
  const subCell = worksheet.getCell('A3');
  subCell.value = `Official Supervision Hierarchy  •  Generated: ${getFormattedDateTime()}  •  Total Records: ${matrixData.length}`;
  subCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FFCBD5E1' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(3).height = 20;

  const headerRow = worksheet.getRow(5);
  headerRow.values = [
    'S.No', 'Staff ID', 'Staff Name', 'Department', 'Role',
    'Reporting Admin (Supervisor)', 'Admin ID', 'Email Address', 'Phone No.'
  ];
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  matrixData.forEach((m, i) => {
    const row = worksheet.addRow({
      sno: m.sno,
      staffId: m.staffId,
      name: m.name,
      dept: m.dept,
      role: m.role,
      reportingAdmin: m.reportingAdmin,
      adminId: m.adminId,
      email: m.email,
      phone: m.phone,
    });
    row.height = 20;
    if (i % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }
  });

  if (matrixData.length > 0) {
    worksheet.autoFilter = {
      from: { row: 5, column: 1 },
      to: { row: 5 + matrixData.length, column: 9 },
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${filenameBase}.xlsx`);
};

// ═══════════════════════════════════════════════════════════════════════════
// 4. DEPARTMENTS EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export const exportDepartments = async (
  departments: any[],
  format: 'excel' | 'pdf' | 'csv'
) => {
  if (!departments || departments.length === 0) {
    alert('No department records available to export.');
    return;
  }

  const filenameBase = `CTU_Departments_Master_${getFileDateStamp()}`;

  if (format === 'csv') {
    const headers = ['S.No', 'Department Name', 'Code', 'Access Level', 'Manual Add Access', 'Excel Upload Access', 'Created Date'];
    const rows = departments.map((d, i) => [
      i + 1,
      escapeCsv(d.name),
      escapeCsv(d.code || '—'),
      escapeCsv((d.verifiedUserAccess || 'none').toUpperCase()),
      escapeCsv(d.canAddVerifiedUsers ? 'Yes' : 'No'),
      escapeCsv(d.canUploadVerifiedUsers ? 'Yes' : 'No'),
      escapeCsv(d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-GB') : '—'),
    ].join(','));

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    downloadBlob(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }), `${filenameBase}.csv`);
    return;
  }

  if (format === 'pdf') {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFillColor(2, 28, 59);
    doc.rect(40, 30, pageWidth - 80, 48, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text('CT UNIVERSITY — DEPARTMENTS MASTER DIRECTORY', 55, 54);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(203, 213, 225);
    doc.text(`Official Academic & Operational Units Master  •  Generated: ${getFormattedDateTime()}`, 55, 68);

    doc.setFillColor(241, 245, 249);
    doc.rect(40, 84, pageWidth - 80, 24, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`Total Registered Departments: ${departments.length}`, 50, 99);

    const tableData = departments.map((d, i) => [
      i + 1,
      d.name,
      d.code || '—',
      (d.verifiedUserAccess || 'None').toUpperCase(),
      d.canAddVerifiedUsers ? 'Enabled' : 'Disabled',
      d.canUploadVerifiedUsers ? 'Enabled' : 'Disabled',
    ]);

    autoTable(doc, {
      startY: 116,
      head: [['#', 'Department Name', 'Code', 'Staff Access', 'Add User', 'Upload Excel']],
      body: tableData,
      margin: { left: 40, right: 40 },
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 5, font: 'helvetica' },
      headStyles: { fillColor: [2, 28, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 30, halign: 'center' },
        1: { cellWidth: 200 },
        2: { cellWidth: 60, halign: 'center' },
        3: { cellWidth: 85, halign: 'center' },
        4: { cellWidth: 70, halign: 'center' },
        5: { cellWidth: 70, halign: 'center' },
      },
      didDrawPage: (data) => {
        const pageNumber = (data as any).pageNumber || 1;
        const totalPages = (doc.internal as any).getNumberOfPages() || 1;
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Page ${pageNumber} of ${totalPages}  •  Confidential  •  CT University TaskDesk`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 18,
          { align: 'center' }
        );
      },
    });

    doc.save(`${filenameBase}.pdf`);
    return;
  }

  // Excel Format (.xlsx)
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CT University TaskDesk';
  const worksheet = workbook.addWorksheet('Departments Master', { views: [{ showGridLines: true }] });

  worksheet.columns = [
    { key: 'sno', width: 8 },
    { key: 'name', width: 34 },
    { key: 'code', width: 14 },
    { key: 'access', width: 20 },
    { key: 'canAdd', width: 18 },
    { key: 'canUpload', width: 18 },
    { key: 'createdDate', width: 18 },
  ];

  worksheet.mergeCells('A1:G2');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'CT UNIVERSITY — DEPARTMENTS MASTER DIRECTORY';
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF021C3B' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  worksheet.mergeCells('A3:G3');
  const subCell = worksheet.getCell('A3');
  subCell.value = `Official Institutional Units Register  •  Generated: ${getFormattedDateTime()}  •  Total Departments: ${departments.length}`;
  subCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FFCBD5E1' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(3).height = 20;

  const headerRow = worksheet.getRow(5);
  headerRow.values = ['S.No', 'Department Name', 'Short Code', 'Staff Access Level', 'Manual Add Access', 'Excel Upload Access', 'Created Date'];
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  departments.forEach((d, i) => {
    const row = worksheet.addRow({
      sno: i + 1,
      name: d.name,
      code: d.code || '—',
      access: (d.verifiedUserAccess || 'none').toUpperCase(),
      canAdd: d.canAddVerifiedUsers ? 'Yes' : 'No',
      canUpload: d.canUploadVerifiedUsers ? 'Yes' : 'No',
      createdDate: d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-GB') : '—',
    });
    row.height = 20;
    if (i % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }
  });

  if (departments.length > 0) {
    worksheet.autoFilter = {
      from: { row: 5, column: 1 },
      to: { row: 5 + departments.length, column: 7 },
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${filenameBase}.xlsx`);
};
