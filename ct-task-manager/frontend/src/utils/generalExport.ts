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

  // Excel Format (.xlsx)
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CT University TaskDesk';
  const worksheet = workbook.addWorksheet('Users Directory', { views: [{ showGridLines: true }] });

  worksheet.columns = [
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

  worksheet.mergeCells('A1:J2');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'CT UNIVERSITY — REGISTERED USERS DIRECTORY';
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF021C3B' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  worksheet.mergeCells('A3:J3');
  const subCell = worksheet.getCell('A3');
  subCell.value = `Official Personnel Registry  •  Generated: ${getFormattedDateTime()}  •  Total Records: ${users.length}`;
  subCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FFCBD5E1' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(3).height = 20;

  const headerRow = worksheet.getRow(5);
  headerRow.values = [
    'S.No', 'University ID', 'Full Name', 'Email Address', 'Phone No.',
    'System Role', 'Current Department', 'Base Department', 'Status', 'Registered Date'
  ];
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  users.forEach((u, i) => {
    const row = worksheet.addRow({
      sno: i + 1,
      id: u.universityId,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: (u.role || 'staff').toUpperCase(),
      dept: u.department || '—',
      baseDept: u.baseDepartment || u.department || '—',
      status: u.isActive !== false ? 'Active' : 'Inactive',
      regDate: u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB') : '—',
    });
    row.height = 20;
    if (i % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }
  });

  if (users.length > 0) {
    worksheet.autoFilter = {
      from: { row: 5, column: 1 },
      to: { row: 5 + users.length, column: 10 },
    };
  }

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
