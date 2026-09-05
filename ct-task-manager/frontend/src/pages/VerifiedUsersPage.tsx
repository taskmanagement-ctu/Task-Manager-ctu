import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  api, 
  VerifiedUser, 
  Pagination, 
  ImportResult, 
  VerifiedUserStats, 
  Department 
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, 
  Trash2, 
  X, 
  UploadCloud, 
  AlertCircle,
  Check
} from 'lucide-react';
import './VerifiedUsersPage.css';

const VerifiedUsersPage = () => {
  const { currentUser } = useAuth();
  const isDeptAdmin = currentUser?.role === 'department_admin';

  // ─── Department Admin Permissions ───────────────────
  const [deptPermissions, setDeptPermissions] = useState<{
    department: string | null;
    verifiedUserAccess: 'none' | 'staff' | 'student' | 'both';
    canAddVerifiedUsers: boolean;
    canUploadVerifiedUsers: boolean;
  } | null>(null);

  // ─── Data State ─────────────────────────────────────
  const [users, setUsers] = useState<VerifiedUser[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [stats, setStats] = useState<VerifiedUserStats | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  
  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [loading, setLoading] = useState(false);

  // ─── Multi-Selection & Bulk Delete State ───────────
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [actionSuccessMessage, setActionSuccessMessage] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    ids: string[];
    names: string[];
    universityId?: string;
    registeredCount: number;
    isBulk: boolean;
  }>({
    isOpen: false,
    ids: [],
    names: [],
    universityId: '',
    registeredCount: 0,
    isBulk: false,
  });

  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  // ─── Upload State ───────────────────────────────────
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Inline Add State ───────────────────────────────
  const [isInlineAdding, setIsInlineAdding] = useState(false);
  const [inlineForm, setInlineForm] = useState({
    universityId: '',
    name: '',
    email: '',
    phone: '',
    department: '',
  });
  const [isAdding, setIsAdding] = useState(false);
  const [inlineError, setInlineError] = useState('');
  const idInputRef = useRef<HTMLInputElement>(null);

  // Debounce timer for search
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Fetch Department Permissions (For Dept Admin) ──
  useEffect(() => {
    if (isDeptAdmin) {
      api.getMyDepartmentPermissions()
        .then(res => {
          if (res.success) {
            setDeptPermissions(res.data);
          }
        })
        .catch(err => console.error('Failed to fetch dept permissions', err));
    } else if (currentUser?.role === 'super_admin') {
      api.getDepartments()
        .then(res => {
          if (res.success) setDepartments(res.data.departments || []);
        })
        .catch(err => console.error('Failed to load departments', err));
    }
  }, [isDeptAdmin, currentUser]);

  // ─── Fetch Users ────────────────────────────────────
  const fetchUsers = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const deptParam = isDeptAdmin
        ? currentUser?.department || undefined
        : (departmentFilter !== 'All' ? departmentFilter : undefined);

      const result = await api.getVerifiedUsers({
        page,
        limit: 20,
        search: search || undefined,
        status: statusFilter || undefined,
        department: deptParam,
        sortBy,
        sortOrder,
      });
      setUsers(result.data.users);
      setPagination(result.data.pagination);
    } catch {
      console.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, departmentFilter, sortBy, sortOrder, isDeptAdmin, currentUser]);

  // ─── Fetch Stats ────────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const result = await api.getVerifiedUserStats();
      setStats(result.data);
    } catch {
      console.error('Failed to fetch stats');
    }
  }, []);

  useEffect(() => {
    fetchUsers(1);
    fetchStats();
  }, [fetchUsers, fetchStats]);

  // ─── Debounced Search ───────────────────────────────
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setSelectedIds([]);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      // triggers fetchUsers via useEffect dependency
    }, 300);
  };

  // ─── Multi-Selection Logic ──────────────────────────
  const currentPageIds = users.map(u => u._id);
  const selectedOnCurrentPage = currentPageIds.filter(id => selectedIds.includes(id));
  const isAllPageSelected = currentPageIds.length > 0 && selectedOnCurrentPage.length === currentPageIds.length;
  const isPartialSelected = selectedOnCurrentPage.length > 0 && !isAllPageSelected;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isPartialSelected;
    }
  }, [isPartialSelected]);

  const handleSelectAllCurrentPage = () => {
    if (isAllPageSelected) {
      // Deselect all on current page
      setSelectedIds(prev => prev.filter(id => !currentPageIds.includes(id)));
    } else {
      // Select all on current page
      setSelectedIds(prev => Array.from(new Set([...prev, ...currentPageIds])));
    }
  };

  const handleToggleSelectUser = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  // ─── Sort Handler ───────────────────────────────────
  const handleToggleNameSort = () => {
    if (sortBy === 'name') {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy('name');
      setSortOrder('asc');
    }
  };

  // ─── File Selection & Upload ────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImportResult(null);
      setUploadError('');
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setImportResult(null);
    setUploadError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadError('');
    setImportResult(null);

    try {
      const result = await api.importVerifiedUsers(selectedFile);
      setImportResult(result.data);
      fetchUsers(1);
      fetchStats();
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSelectedFile(null);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // ─── Toggle Inline Add Row ──────────────────────────
  const handleToggleInlineAdd = () => {
    if (isInlineAdding) {
      setIsInlineAdding(false);
      setInlineError('');
      return;
    }
    const defaultDept = isDeptAdmin 
      ? (currentUser?.department || '') 
      : (departments[0]?.name || '');

    setInlineForm({
      universityId: '',
      name: '',
      email: '',
      phone: '',
      department: defaultDept,
    });
    setInlineError('');
    setIsInlineAdding(true);
    setTimeout(() => {
      idInputRef.current?.focus();
    }, 50);
  };

  const handleCancelInline = () => {
    setIsInlineAdding(false);
    setInlineError('');
    setInlineForm({
      universityId: '',
      name: '',
      email: '',
      phone: '',
      department: '',
    });
  };

  // ─── Handle Inline Submit ───────────────────────────
  const handleInlineSubmit = async () => {
    if (!inlineForm.universityId.trim() || !inlineForm.name.trim() || !inlineForm.email.trim()) {
      setInlineError('University ID, Name, and Email are required.');
      return;
    }

    if (!/^\d{5}$/.test(inlineForm.universityId.trim())) {
      setInlineError('University ID must be exactly 5 digits.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inlineForm.email.trim())) {
      setInlineError('Please enter a valid email address.');
      return;
    }

    // Phone: if 10 or more digits, use last 10; if less, set '-'
    let finalPhone = '-';
    const rawPhone = inlineForm.phone.trim();
    if (rawPhone && rawPhone !== '-') {
      const digits = rawPhone.replace(/\D/g, '');
      if (digits.length >= 10) {
        finalPhone = digits.slice(-10);
      } else {
        finalPhone = '-';
      }
    }

    const dept = isDeptAdmin ? currentUser?.department : (inlineForm.department || departments[0]?.name);
    if (!dept) {
      setInlineError('Please select a valid department.');
      return;
    }

    try {
      setIsAdding(true);
      setInlineError('');
      await api.createVerifiedUser({
        universityId: inlineForm.universityId.trim(),
        name: inlineForm.name.trim(),
        email: inlineForm.email.trim(),
        phone: finalPhone,
        userType: 'staff',
        department: dept,
      });

      setIsInlineAdding(false);
      setInlineForm({
        universityId: '',
        name: '',
        email: '',
        phone: '',
        department: '',
      });
      fetchUsers(1);
      fetchStats();
    } catch (err: any) {
      setInlineError(err.message || 'Failed to add verified staff member');
    } finally {
      setIsAdding(false);
    }
  };

  const handleInlineKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInlineSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelInline();
    }
  };

  // ─── Delete Handlers ────────────────────────────────
  const handleOpenSingleDelete = (user: VerifiedUser) => {
    setDeleteModalState({
      isOpen: true,
      ids: [user._id],
      names: [user.name],
      universityId: user.universityId,
      registeredCount: user.isRegistered ? 1 : 0,
      isBulk: false,
    });
  };

  const handleOpenBulkDelete = () => {
    if (selectedIds.length === 0) return;
    const selectedUsers = users.filter(u => selectedIds.includes(u._id));
    const registeredCount = selectedUsers.filter(u => u.isRegistered).length;
    const names = selectedUsers.map(u => u.name);

    setDeleteModalState({
      isOpen: true,
      ids: [...selectedIds],
      names,
      universityId: '',
      registeredCount,
      isBulk: true,
    });
  };

  const handleConfirmDelete = async () => {
    if (deleteModalState.ids.length === 0) return;
    setIsDeleting(true);
    try {
      const res = await api.bulkDeleteVerifiedUsers(deleteModalState.ids);
      const count = res.data?.deletedCount ?? deleteModalState.ids.length;

      // Filter out deleted IDs from selectedIds
      const deletedSet = new Set(deleteModalState.ids);
      setSelectedIds(prev => prev.filter(id => !deletedSet.has(id)));

      setDeleteModalState({
        isOpen: false,
        ids: [],
        names: [],
        universityId: '',
        registeredCount: 0,
        isBulk: false,
      });

      setActionSuccessMessage(`Successfully deleted ${count} verified staff record${count > 1 ? 's' : ''}.`);
      setTimeout(() => setActionSuccessMessage(''), 4000);

      // Check if current page has items left after deletion
      const currentPageRemaining = users.filter(u => !deletedSet.has(u._id)).length;
      let targetPage = pagination.page;
      if (currentPageRemaining === 0 && pagination.page > 1) {
        targetPage = pagination.page - 1;
      }

      await fetchUsers(targetPage);
      await fetchStats();
    } catch (err: any) {
      alert(err.message || 'Failed to delete user(s)');
    } finally {
      setIsDeleting(false);
    }
  };

  // ─── Pagination ─────────────────────────────────────
  const goToPage = (p: number) => {
    if (p < 1 || p > pagination.totalPages) return;
    fetchUsers(p);
  };

  // Access checks for Department Admin
  const canAdd = isDeptAdmin ? (deptPermissions?.canAddVerifiedUsers ?? false) : true;
  const canUpload = isDeptAdmin ? (deptPermissions?.canUploadVerifiedUsers ?? false) : true;

  return (
    <div className="vu-page">
      {/* Header */}
      <div className="vu-header">
        <div>
          <h1 className="vu-title">
            Verified Users {isDeptAdmin && currentUser?.department ? `• ${currentUser.department}` : ''}
          </h1>
          <p className="vu-description">
            {isDeptAdmin 
              ? `Manage authorized staff for ${currentUser?.department || 'your department'}.`
              : 'Manage university staff members authorized to register accounts.'}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="vu-stats-row">
          <div className="vu-stat-card">
            <div className="vu-stat-value">{stats.total}</div>
            <div className="vu-stat-label">Total Staff</div>
          </div>
          <div className="vu-stat-card">
            <div className="vu-stat-value">{stats.registered}</div>
            <div className="vu-stat-label">Registered Accounts</div>
          </div>
          <div className="vu-stat-card">
            <div className="vu-stat-value">{Math.max(0, stats.total - stats.registered)}</div>
            <div className="vu-stat-label">Pending Registration</div>
          </div>
        </div>
      )}

      {/* Excel / CSV Upload Section */}
      {canUpload && (
        <div className="vu-card">
          <h2 className="vu-card-title">
            <UploadCloud size={18} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
            Bulk Import Staff (Excel / CSV)
          </h2>
          <p className="vu-card-description">
            Upload an Excel (.xlsx) or CSV file containing verified staff records (columns: ID, Name, Email, Phone No, Department).
          </p>

          <div className="vu-upload-area">
            <div className="vu-upload-actions">
              <label className="btn btn-primary vu-file-label" style={{ cursor: 'pointer' }}>
                Select File
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
              </label>
              <a href={api.downloadTemplate()} className="btn btn-secondary" download>
                Download Sample Template
              </a>
            </div>

            {selectedFile && (
              <div className="vu-selected-file">
                <div className="vu-file-info">
                  <span className="vu-file-icon">📄</span>
                  <div>
                    <div className="vu-file-name">{selectedFile.name}</div>
                    <div className="vu-file-size">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                </div>
                <div className="vu-file-actions">
                  <button className="btn btn-secondary btn-sm" onClick={clearFile} disabled={uploading}>
                    Cancel
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={handleUpload} disabled={uploading}>
                    {uploading ? 'Uploading...' : 'Upload & Import'}
                  </button>
                </div>
              </div>
            )}

            {uploadError && (
              <div className="vu-alert vu-alert-error">
                <strong>Error:</strong> {uploadError}
              </div>
            )}

            {importResult && (
              <div className="vu-alert vu-alert-success">
                <strong>Import completed successfully.</strong>
                <div className="vu-import-summary">
                  <span>{importResult.totalRows} rows processed</span>
                  <span>{importResult.inserted} new staff added</span>
                  <span>{importResult.updated} updated</span>
                  <span>{importResult.skipped} skipped</span>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="vu-import-errors">
                    <strong>Row Errors:</strong>
                    <ul>
                      {importResult.errors.map((err, i) => (
                        <li key={i}>
                          Row {err.row}: {err.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Users Table Section */}
      <div className="vu-card">
        <div className="vu-table-header">
          <h2 className="vu-card-title">Verified Users Directory</h2>
          <div className="vu-table-controls">
            <input
              type="text"
              className="vu-search-input"
              placeholder="Search by name, email, ID..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />

            {!isDeptAdmin && departments.length > 0 && (
              <select
                className="vu-filter-select"
                value={departmentFilter}
                onChange={(e) => {
                  setDepartmentFilter(e.target.value);
                  setSelectedIds([]);
                }}
              >
                <option value="All">All Departments</option>
                {departments.map(d => (
                  <option key={d._id} value={d.name}>{d.name}</option>
                ))}
              </select>
            )}

            <select
              className="vu-filter-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setSelectedIds([]);
              }}
            >
              <option value="">All Status</option>
              <option value="registered">Registered</option>
              <option value="not-registered">Not Registered</option>
            </select>

            {canAdd && (
              <button
                type="button"
                className="btn btn-primary vu-add-user-btn"
                onClick={handleToggleInlineAdd}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}
                title="Add staff member directly in the table"
              >
                <Plus size={16} /> Add User
              </button>
            )}

            {selectedIds.length > 0 && (
              <button
                type="button"
                className="btn btn-danger vu-add-user-btn vu-header-delete-btn"
                onClick={handleOpenBulkDelete}
                disabled={isDeleting}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}
                title={`Delete ${selectedIds.length} selected staff member${selectedIds.length > 1 ? 's' : ''}`}
              >
                <Trash2 size={16} /> Delete ({selectedIds.length})
              </button>
            )}
          </div>
        </div>

        {/* Bulk Selection Action Bar */}
        {selectedIds.length > 0 && (
          <div className="vu-bulk-banner">
            <div className="vu-bulk-banner-left">
              <span className="vu-bulk-badge">{selectedIds.length}</span>
              <span className="vu-bulk-counter-text">
                {selectedIds.length === 1 ? 'staff member selected' : 'staff members selected'}
              </span>
              {isAllPageSelected && users.length > 0 && (
                <span className="vu-bulk-page-info">
                  (All {users.length} on this page)
                </span>
              )}
            </div>
            <div className="vu-bulk-banner-right">
              <button
                type="button"
                className="btn btn-secondary btn-sm vu-bulk-clear-btn"
                onClick={handleClearSelection}
              >
                <X size={14} /> Clear Selection
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm vu-bulk-delete-btn"
                onClick={handleOpenBulkDelete}
                disabled={isDeleting}
              >
                <Trash2 size={15} /> Delete Selected ({selectedIds.length})
              </button>
            </div>
          </div>
        )}

        {actionSuccessMessage && (
          <div className="vu-action-success-banner">
            <Check size={16} className="vu-action-success-icon" />
            <span>{actionSuccessMessage}</span>
            <button 
              className="vu-inline-error-close" 
              onClick={() => setActionSuccessMessage('')}
              type="button"
              title="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {inlineError && (
          <div className="vu-inline-error-banner">
            <AlertCircle size={16} />
            <span>{inlineError}</span>
            <button 
              className="vu-inline-error-close" 
              onClick={() => setInlineError('')}
              type="button"
              title="Dismiss error"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {loading ? (
          <div className="vu-loading">Loading users...</div>
        ) : users.length === 0 && !isInlineAdding ? (
          <div className="vu-empty">
            No verified staff users found. {canAdd ? 'Click "+ Add User" above to add one directly.' : ''}
          </div>
        ) : (
          <>
            <div className="vu-table-wrapper">
              <table className="vu-table">
                <thead>
                  <tr>
                    <th style={{ width: '46px', textAlign: 'center' }}>
                      <input
                        ref={headerCheckboxRef}
                        type="checkbox"
                        className="vu-table-checkbox"
                        checked={isAllPageSelected}
                        onChange={handleSelectAllCurrentPage}
                        title={isAllPageSelected ? 'Deselect all on this page' : 'Select all on this page'}
                        aria-label="Select all staff on this page"
                      />
                    </th>
                    <th style={{ width: '130px' }}>University ID</th>
                    <th 
                      style={{ minWidth: '160px', cursor: 'pointer', userSelect: 'none' }}
                      onClick={handleToggleNameSort}
                      title="Click to toggle Name sort (A-Z / Z-A)"
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>Name</span>
                        {sortBy === 'name' && (
                          <span className="vu-sort-indicator">
                            {sortOrder === 'asc' ? 'A → Z' : 'Z → A'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th style={{ minWidth: '200px' }}>Email</th>
                    <th style={{ width: '140px' }}>Phone</th>
                    <th style={{ minWidth: '150px' }}>Department</th>
                    <th style={{ width: '130px' }}>Status</th>
                    <th style={{ width: '90px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Inline Add Row */}
                  {isInlineAdding && (
                    <tr className="vu-inline-add-row">
                      <td style={{ textAlign: 'center' }}>
                        <span className="vu-inline-add-dot">•</span>
                      </td>
                      <td>
                        <input
                          ref={idInputRef}
                          type="text"
                          className="vu-inline-input"
                          placeholder="5-digit ID"
                          maxLength={5}
                          value={inlineForm.universityId}
                          onChange={(e) => setInlineForm(prev => ({ ...prev, universityId: e.target.value.replace(/\D/g, '') }))}
                          onKeyDown={handleInlineKeyDown}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="vu-inline-input"
                          placeholder="Full Name"
                          value={inlineForm.name}
                          onChange={(e) => setInlineForm(prev => ({ ...prev, name: e.target.value }))}
                          onKeyDown={handleInlineKeyDown}
                        />
                      </td>
                      <td>
                        <input
                          type="email"
                          className="vu-inline-input"
                          placeholder="user@ctuniversity.in"
                          value={inlineForm.email}
                          onChange={(e) => setInlineForm(prev => ({ ...prev, email: e.target.value }))}
                          onKeyDown={handleInlineKeyDown}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="vu-inline-input"
                          placeholder="10-digit Phone"
                          maxLength={10}
                          value={inlineForm.phone}
                          onChange={(e) => setInlineForm(prev => ({ ...prev, phone: e.target.value.replace(/\D/g, '') }))}
                          onKeyDown={handleInlineKeyDown}
                        />
                      </td>
                      <td>
                        {isDeptAdmin ? (
                          <span className="vu-inline-dept-badge">{currentUser?.department || '—'}</span>
                        ) : (
                          <select
                            className="vu-inline-select"
                            value={inlineForm.department}
                            onChange={(e) => setInlineForm(prev => ({ ...prev, department: e.target.value }))}
                            onKeyDown={handleInlineKeyDown}
                          >
                            <option value="">Select Dept</option>
                            {departments.map((d) => (
                              <option key={d._id} value={d.name}>{d.name}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td>
                        <span className="vu-status-badge vu-status-new">New</span>
                      </td>
                      <td>
                        <div className="vu-inline-actions">
                          <button
                            type="button"
                            className="vu-inline-save-btn"
                            onClick={handleInlineSubmit}
                            disabled={isAdding}
                            title="Save User (Enter)"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            type="button"
                            className="vu-inline-cancel-btn"
                            onClick={handleCancelInline}
                            disabled={isAdding}
                            title="Cancel / Remove Row (Esc)"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Existing Users Rows */}
                  {users.map((user) => {
                    const isSelected = selectedIds.includes(user._id);
                    return (
                      <tr 
                        key={user._id}
                        className={isSelected ? 'vu-row-selected' : ''}
                      >
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            className="vu-table-checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectUser(user._id)}
                            aria-label={`Select ${user.name}`}
                          />
                        </td>
                        <td className="vu-id-cell">{user.universityId}</td>
                        <td style={{ fontWeight: 600 }}>{user.name}</td>
                        <td>{user.email}</td>
                        <td>{user.phone}</td>
                        <td>{user.department || '—'}</td>
                        <td>
                          <span
                            className={`vu-status-badge ${
                              user.isRegistered ? 'vu-status-registered' : 'vu-status-not-registered'
                            }`}
                          >
                            {user.isRegistered ? 'Registered' : 'Not Registered'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button 
                            className="vu-delete-btn"
                            onClick={() => handleOpenSingleDelete(user)}
                            title="Delete user"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="vu-pagination">
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={pagination.page <= 1}
                  onClick={() => goToPage(pagination.page - 1)}
                >
                  ← Previous
                </button>
                <span className="vu-pagination-info">
                  Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => goToPage(pagination.page + 1)}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalState.isOpen && (
        <div 
          className="vu-modal-overlay" 
          onClick={() => !isDeleting && setDeleteModalState(prev => ({ ...prev, isOpen: false }))}
        >
          <div className="vu-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="vu-modal-header">
              <div className="vu-modal-icon-danger">
                <Trash2 size={22} />
              </div>
              <div>
                <h3 className="vu-modal-title">
                  {deleteModalState.isBulk
                    ? `Delete ${deleteModalState.ids.length} Verified Staff Member${deleteModalState.ids.length > 1 ? 's' : ''}?`
                    : `Delete Verified Staff Member?`}
                </h3>
                <p className="vu-modal-desc">
                  {deleteModalState.isBulk ? (
                    <>You are about to delete <strong>{deleteModalState.ids.length}</strong> selected verified records from the staff directory.</>
                  ) : (
                    <>Are you sure you want to delete <strong>{deleteModalState.names[0]}</strong> {deleteModalState.universityId ? `(ID: ${deleteModalState.universityId})` : ''}?</>
                  )}
                </p>
              </div>
            </div>

            {deleteModalState.registeredCount > 0 && (
              <div className="vu-modal-alert">
                <AlertCircle size={18} className="vu-modal-alert-icon" />
                <div className="vu-modal-alert-text">
                  <strong>Registered Account Notice:</strong>
                  <p>
                    {deleteModalState.isBulk ? (
                      <>
                        <strong>{deleteModalState.registeredCount}</strong> of the selected staff member{deleteModalState.registeredCount > 1 ? 's have' : ' has'} already registered an account.
                      </>
                    ) : (
                      <>This staff member has already registered an account.</>
                    )}
                    {' '}Removing from this directory deletes pre-authorization, but does not delete their existing login account (manage that in Users & Permissions).
                  </p>
                </div>
              </div>
            )}

            <div className="vu-modal-body">
              <p className="vu-modal-warning-text">
                This action cannot be undone. Are you sure you wish to proceed?
              </p>
            </div>

            <div className="vu-modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeleteModalState(prev => ({ ...prev, isOpen: false }))}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger vu-modal-delete-btn"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  'Deleting...'
                ) : (
                  <>
                    <Trash2 size={16} />
                    {deleteModalState.isBulk
                      ? `Delete ${deleteModalState.ids.length} Users`
                      : 'Delete User'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VerifiedUsersPage;
