import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, User, Department, SuperAdminInfo } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Search, 
  MoreVertical, 
  Mail, 
  Phone,
  Building2,
  ChevronLeft, 
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  Crown,
  User as UserIcon,
  Trash2,
  Ban,
  CheckCircle,
  AlertTriangle,
  Pencil,
  X,
  Loader2,
  AlertCircle,
  RotateCcw,
  Users,
  ArrowRightLeft
} from 'lucide-react';
import ExportDropdownMenu from '../components/ExportDropdownMenu';
import { exportUsers } from '../utils/generalExport';
import './UserManagementPage.css';

const UserManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser: authUser, refreshUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [superAdminList, setSuperAdminList] = useState<SuperAdminInfo[]>([]);
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [rosterFilter, setRosterFilter] = useState('All');
  const statusFilter = 'All';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dropdown state
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Selected User for status/delete actions
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // Edit User Modal State
  const [editModalUser, setEditModalUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    universityId: '',
    name: '',
    email: '',
    phone: '',
    department: '',
    role: 'staff',
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState('');

  // Status confirm State
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusAction, setStatusAction] = useState<boolean>(true); // true = activate, false = deactivate
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Delete confirm State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Transfer Super Admin Modal State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTargetUser, setTransferTargetUser] = useState<User | null>(null);
  const [transferCandidateId, setTransferCandidateId] = useState('');
  const [transferSearch, setTransferSearch] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferAllUsersList, setTransferAllUsersList] = useState<User[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  const handleExportUsers = async (format: 'excel' | 'pdf' | 'csv') => {
    try {
      setIsExporting(true);
      let dataToExport = users;
      try {
        const fullRes = await api.getUsers({
          limit: 5000,
          search,
          role: roleFilter,
          department: departmentFilter !== 'All' ? departmentFilter : undefined,
          status: statusFilter,
          rosterStatus: rosterFilter !== 'All' ? rosterFilter : undefined,
        });
        if (fullRes.data?.users && fullRes.data.users.length > 0) {
          dataToExport = fullRes.data.users;
        }
      } catch (err) {
        console.warn('Could not fetch all users for export, falling back to current page', err);
      }
      await exportUsers(dataToExport, format, {
        role: roleFilter,
        department: departmentFilter !== 'All' ? departmentFilter : undefined,
        search,
      });
    } catch (err: any) {
      console.error('Export error', err);
      alert('Failed to export users: ' + (err.message || 'Unknown error'));
    } finally {
      setIsExporting(false);
    }
  };

  const fetchSuperAdminList = async () => {
    try {
      const statsRes = await api.getUserStats();
      if (statsRes.success && statsRes.data?.superAdminList) {
        setSuperAdminList(statsRes.data.superAdminList);
      }
    } catch (err) {
      console.error('Failed to load super admin stats:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.getUsers({
        page,
        limit: 10,
        search,
        role: roleFilter,
        department: departmentFilter !== 'All' ? departmentFilter : undefined,
        status: statusFilter,
        rosterStatus: rosterFilter !== 'All' ? rosterFilter : undefined,
      });
      if (res.success) {
        setUsers(res.data.users);
        setTotalPages(res.data.pagination.totalPages);
        setTotalUsers(res.data.pagination.total);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchSuperAdminList();
    // eslint-disable-next-line
  }, [page, roleFilter, departmentFilter, rosterFilter, statusFilter, search]);

  // Click outside listener for dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleStatusChangeSubmit = async () => {
    if (!selectedUser) return;
    try {
      setIsUpdatingStatus(true);
      await api.updateUserStatus(selectedUser.id, statusAction);
      setShowStatusModal(false);
      setSelectedUser(null);
      await fetchUsers();
      await fetchSuperAdminList();
    } catch (err: any) {
      alert(err.message || 'Failed to update user status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDeleteUserSubmit = async () => {
    if (!selectedUser) return;
    try {
      setIsDeleting(true);
      await api.deleteUser(selectedUser.id);
      setShowDeleteModal(false);
      setSelectedUser(null);
      await fetchUsers();
      await fetchSuperAdminList();
    } catch (err: any) {
      alert(err.message || 'Failed to delete user');
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const res = await api.getDepartments();
        if (res.success && res.data?.departments) {
          setDepartments(res.data.departments);
        }
      } catch (err) {
        console.error('Failed to load departments', err);
      }
    };
    loadDepartments();
  }, []);

  const handleOpenEdit = (user: User) => {
    setEditModalUser(user);
    setEditForm({
      universityId: user.universityId || '',
      name: user.name || '',
      email: user.email || '',
      phone: user.phone && user.phone !== '-' ? user.phone : '',
      department: user.department || '',
      role: user.role || 'staff',
    });
    setEditError(null);
  };

  const handleCloseEdit = () => {
    if (isEditing) return;
    setEditModalUser(null);
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalUser) return;

    const uid = editForm.universityId.trim();
    if (!/^\d{3,5}$/.test(uid)) {
      setEditError('University ID must be between 3 and 5 digits.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editForm.email.trim())) {
      setEditError('Please enter a valid email address.');
      return;
    }

    let finalPhone = '-';
    const rawPhone = editForm.phone.trim();
    if (rawPhone && rawPhone !== '-') {
      const digits = rawPhone.replace(/\D/g, '');
      if (digits.length === 10) {
        finalPhone = digits;
      } else {
        setEditError('Phone number must contain exactly 10 digits.');
        return;
      }
    }

    try {
      setIsEditing(true);
      setEditError(null);
      const targetUserId = editModalUser.id || (editModalUser as any)._id;
      const res = await api.updateUserAdmin(targetUserId, {
        universityId: uid,
        name: editForm.name.trim(),
        email: editForm.email.trim().toLowerCase(),
        phone: finalPhone,
        department: editForm.department.trim() || null,
        role: editForm.role,
      });

      if (res.success) {
        setActionSuccessMessage(res.message || `Successfully updated details for ${editForm.name} (${uid}).`);
        setTimeout(() => setActionSuccessMessage(''), 6000);
        handleCloseEdit();
        await refreshUser();
        await fetchUsers();
        await fetchSuperAdminList();
      }
    } catch (err: any) {
      setEditError(err.message || 'Failed to update user details.');
    } finally {
      setIsEditing(false);
    }
  };

  const handleOpenTransferModal = async (preselectedUser?: User) => {
    setTransferError(null);
    if (preselectedUser) {
      setTransferTargetUser(preselectedUser);
      setTransferCandidateId(preselectedUser.id || (preselectedUser as any)._id);
    } else {
      setTransferTargetUser(null);
      setTransferCandidateId('');
    }
    setTransferSearch('');
    setShowTransferModal(true);

    try {
      setLoadingCandidates(true);
      const res = await api.getUsers({ limit: 1000, status: 'Active' });
      if (res.success && res.data?.users) {
        const eligible = res.data.users.filter((u: User) => u.universityId !== '10001' && u.role !== 'super_admin' && u.isActive);
        setTransferAllUsersList(eligible);
      }
    } catch (err) {
      console.error('Failed to load eligible users for Super Admin transfer', err);
    } finally {
      setLoadingCandidates(false);
    }
  };

  const handleTransferSuperAdminSubmit = async () => {
    const candidateId = transferCandidateId || transferTargetUser?.id || (transferTargetUser as any)?._id;
    if (!candidateId) {
      setTransferError('Please select a user to transfer Super Admin privileges to.');
      return;
    }

    try {
      setIsTransferring(true);
      setTransferError(null);
      const res = await api.transferSuperAdmin(candidateId);
      if (res.success) {
        setActionSuccessMessage(res.message);
        setTimeout(() => setActionSuccessMessage(''), 8000);
        setShowTransferModal(false);
        setTransferTargetUser(null);
        setTransferCandidateId('');
        await refreshUser();
        await fetchUsers();
        await fetchSuperAdminList();
      }
    } catch (err: any) {
      setTransferError(err.message || 'Failed to transfer Super Admin privileges.');
    } finally {
      setIsTransferring(false);
    }
  };

  const getRoleIcon = (u: User) => {
    if (u.role === 'super_admin') {
      return u.universityId === '10001' ? <Crown size={14} color="#d97706" /> : <ShieldAlert size={14} />;
    }
    if (u.role === 'department_admin') return <ShieldCheck size={14} />;
    return <UserIcon size={14} />;
  };

  const availableDepartments = useMemo(() => {
    const set = new Set<string>();
    departments.forEach((d) => {
      if (d && d.name) set.add(d.name.trim());
    });
    users.forEach((u) => {
      if (u && u.department) set.add(u.department.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [departments, users]);

  const hasActiveFilters = Boolean(
    search.trim() || 
    roleFilter !== 'All' || 
    departmentFilter !== 'All' || 
    rosterFilter !== 'All'
  );

  const handleClearFilters = () => {
    setSearch('');
    setRoleFilter('All');
    setDepartmentFilter('All');
    setRosterFilter('All');
    setPage(1);
  };

  const formatRoleText = (u: User) => {
    if (u.role === 'super_admin') {
      return u.universityId === '10001' ? 'Primary Super Admin' : 'Delegated Super Admin';
    }
    if (u.role === 'department_admin') return 'Dept Admin';
    return 'Staff';
  };

  const getRoleBadgeClass = (u: User) => {
    if (u.role === 'super_admin') {
      return u.universityId === '10001' ? 'badge-role badge-role-primary_super_admin' : 'badge-role badge-role-super_admin';
    }
    return `badge-role badge-role-${u.role}`;
  };

  const toggleDropdown = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeDropdown === userId) {
      setActiveDropdown(null);
    } else {
      setActiveDropdown(userId);
    }
  };

  return (
    <div className="um-container">
      <div className="um-header">
        <h1 className="um-title">User Management</h1>
        <p className="um-subtitle">Manage system access and status for all university personnel.</p>
      </div>

      {actionSuccessMessage && (
        <div className="um-action-success-banner">
          <CheckCircle size={18} className="um-action-success-icon" />
          <span>{actionSuccessMessage}</span>
        </div>
      )}

      {/* --- Super Administrator Governance Panel --- */}
      {superAdminList.length > 0 && (
        <div className="um-governance-card">
          <div className="um-governance-header">
            <div className="um-governance-title-row">
              <div className="um-governance-title-icon">
                <Crown size={18} />
              </div>
              <div>
                <h2 className="um-governance-title">Institutional Governance &amp; Super Administrators</h2>
                <p className="um-governance-subtitle">
                  {authUser?.universityId === '10001' 
                    ? 'You are the Primary Super Admin (10001). Overview of active Super Administrators holding system privileges:' 
                    : 'System Super Administrators with university-wide authority:'}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div className="um-governance-tag">
                {superAdminList.length} Active {superAdminList.length === 1 ? 'Super Admin' : 'Super Admins'}
              </div>
              <button
                type="button"
                className="btn-transfer-superadmin"
                onClick={() => handleOpenTransferModal()}
                title="Transfer or appoint a new Super Administrator"
              >
                <ArrowRightLeft size={14} />
                <span>Transfer Super Admin</span>
              </button>
            </div>
          </div>

          <div className="um-governance-grid">
            {/* Primary Super Admin Card */}
            {superAdminList.filter(sa => sa.universityId === '10001').map(sa => (
              <div key={sa.id || sa.universityId} className="um-gov-admin-box primary">
                <div className="um-gov-admin-avatar primary" title="Root Super Administrator">
                  👑
                </div>
                <div className="um-gov-admin-info">
                  <div className="um-gov-admin-name">
                    <span>{sa.name}</span>
                    {authUser?.universityId === '10001' && (
                      <span style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 700 }}>(You)</span>
                    )}
                  </div>
                  <div className="um-gov-admin-meta">
                    <span className="um-gov-admin-tag-primary">Permanent Root</span>
                    <span>• ID: <strong>{sa.universityId}</strong></span>
                    <span>• {sa.email}</span>
                  </div>
                </div>
              </div>
            ))}

            {/* Delegated Super Admins Cards */}
            {superAdminList.filter(sa => sa.universityId !== '10001').length > 0 ? (
              superAdminList.filter(sa => sa.universityId !== '10001').map(sa => (
                <div key={sa.id || sa.universityId} className="um-gov-admin-box">
                  <div className="um-gov-admin-avatar delegated" title="Delegated Super Administrator">
                    <ShieldAlert size={18} />
                  </div>
                  <div className="um-gov-admin-info">
                    <div className="um-gov-admin-name">
                      <span>{sa.name}</span>
                      {authUser?.universityId === sa.universityId && (
                        <span style={{ fontSize: '0.72rem', color: '#4f46e5', fontWeight: 700 }}>(You)</span>
                      )}
                    </div>
                    <div className="um-gov-admin-meta">
                      <span className="um-gov-admin-tag-delegated">Delegated Super Admin</span>
                      <span>• ID: <strong>{sa.universityId}</strong></span>
                      <span>• {sa.email}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="um-gov-locate-btn"
                    onClick={() => {
                      setSearch(sa.universityId);
                      setPage(1);
                    }}
                    title="Find in list"
                  >
                    Locate
                  </button>
                </div>
              ))
            ) : (
              <div className="um-gov-no-delegated">
                <ShieldCheck size={18} color="#94a3b8" />
                <span>No delegated Super Admins currently active. Only Primary Super Admin (10001) holds system administrator access.</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="um-filters">
        <div className="um-filters-left">
          <div className="um-search-wrapper">
            <Search className="um-search-icon" size={18} />
            <input
              type="text"
              className="um-search-input"
              placeholder="Search by ID, Name, Email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            {search && (
              <button
                type="button"
                className="um-search-clear-btn"
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                title="Clear search"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
          
          <div className="um-select-filters-group">
            <div className="um-filter-select-wrapper">
              <select
                className="um-role-select"
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(1);
                }}
                title="Filter by Role"
              >
                <option value="All">All Roles</option>
                <option value="super_admin">Super Admin</option>
                <option value="department_admin">Department Admin</option>
                <option value="staff">Staff</option>
              </select>
            </div>

            <div className="um-filter-select-wrapper um-dept-wrapper">
              <select
                className="um-dept-select"
                value={departmentFilter}
                onChange={(e) => {
                  setDepartmentFilter(e.target.value);
                  setPage(1);
                }}
                title="Filter by Department"
              >
                <option value="All">All Departments</option>
                {availableDepartments.map((deptName) => (
                  <option key={deptName} value={deptName}>
                    {deptName}
                  </option>
                ))}
                <option value="Unassigned">Unassigned (No Dept)</option>
              </select>
            </div>

            <div className="um-filter-select-wrapper">
              <select
                className="um-role-select"
                value={rosterFilter}
                onChange={(e) => {
                  setRosterFilter(e.target.value);
                  setPage(1);
                }}
                title="Filter by Team Roster Status"
              >
                <option value="All">All Roster Status</option>
                <option value="assigned">Assigned Staff</option>
                <option value="unassigned">Unassigned Staff</option>
              </select>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                className="um-clear-filters-btn"
                onClick={handleClearFilters}
                title="Reset all filters"
              >
                <RotateCcw size={13} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
        
        <div className="um-filters-right">
          <ExportDropdownMenu
            onExport={handleExportUsers}
            isExporting={isExporting}
          />
          <button 
            className="btn-add-user" 
            onClick={() => navigate('/super-admin/verified-users')}
            title="Open Verified Users Directory"
          >
            <ShieldCheck size={16} /> <span>Verified Users</span>
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* --- DESKTOP TABLE VIEW --- */}
      <div className="um-table-container">
        <table className="um-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name & Email</th>
              <th>Phone</th>
              <th>Department</th>
              <th>Role</th>
              <th>Roster Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-4" style={{ padding: '2rem', color: '#6b7280' }}>Loading users...</td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-4" style={{ padding: '2.5rem 1rem', color: '#6b7280' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <UserIcon size={32} color="#94a3b8" />
                    <span>No users found matching your filters.</span>
                    {hasActiveFilters && (
                      <button 
                        className="btn-paginate" 
                        onClick={handleClearFilters}
                        style={{ marginTop: '0.25rem' }}
                      >
                        Reset Filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td><span className="user-id">{user.universityId}</span></td>
                  <td>
                    <div className="user-info-cell">
                      <div className="user-avatar" style={{ backgroundImage: `url(https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=e2e8f0&color=1e293b)` }}></div>
                      <div>
                        <div className="user-name">{user.name}</div>
                        <div className="user-email">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="user-phone">{user.phone && user.phone !== '-' ? user.phone.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3') : '-'}</div>
                  </td>
                  <td>
                    <div className="user-dept">{user.department || '-'}</div>
                  </td>
                  <td>
                    <span className={getRoleBadgeClass(user)}>
                      {getRoleIcon(user)} {formatRoleText(user)}
                    </span>
                  </td>
                  <td>
                    {!user.isActive ? (
                      <span className="um-roster-badge um-roster-deactivated" title="Account Deactivated">
                        <span className="status-dot red"></span>
                        Deactivated
                      </span>
                    ) : user.universityId === '10001' ? (
                      <span className="um-roster-badge um-roster-super" title="Primary Root Super Administrator (Permanent)">
                        <Crown size={12} color="#f59e0b" />
                        Primary Root
                      </span>
                    ) : user.role === 'super_admin' ? (
                      <span className="um-roster-badge um-roster-super" title="Delegated Super Administrator">
                        <ShieldAlert size={12} />
                        Delegated Admin
                      </span>
                    ) : user.role === 'department_admin' ? (
                      <span className="um-roster-badge um-roster-lead" title={`Department Team Lead (${user.rosterStaffCount || 0} assigned staff)`}>
                        <Users size={12} />
                        Team Lead {user.rosterStaffCount !== undefined ? `(${user.rosterStaffCount})` : ''}
                      </span>
                    ) : user.assignedAdmin ? (
                      <div className="um-roster-assigned-cell" title={`Assigned to ${user.assignedAdmin.adminName} (${user.assignedAdmin.adminDepartment || 'Dept Lead'})`}>
                        <span className="um-roster-badge um-roster-assigned">
                          <CheckCircle size={12} />
                          Assigned
                        </span>
                        <span className="um-roster-lead-name">
                          to {user.assignedAdmin.adminName}
                        </span>
                      </div>
                    ) : (
                      <span className="um-roster-badge um-roster-unassigned" title="Not assigned to any Department Admin team">
                        <AlertTriangle size={12} />
                        Unassigned
                      </span>
                    )}
                  </td>
                  <td className="actions-cell">
                    <button className="btn-icon" onClick={(e) => toggleDropdown(user.id, e)} title="Actions">
                      <MoreVertical size={18} />
                    </button>
                    {activeDropdown === user.id && (
                      <div className="action-dropdown" ref={dropdownRef}>
                        {user.universityId !== '10001' && user.role !== 'super_admin' && user.isActive && (
                          <button 
                            className="dropdown-item" 
                            onClick={() => {
                              handleOpenTransferModal(user);
                              setActiveDropdown(null);
                            }}
                            title="Transfer Super Admin privileges to this user"
                          >
                            <Crown size={15} color="#d97706" />
                            <span>Transfer Super Admin</span>
                          </button>
                        )}
                        <button 
                          className="dropdown-item" 
                          disabled={user.universityId === '10001' && authUser?.universityId !== '10001'}
                          title={user.universityId === '10001' && authUser?.universityId !== '10001' ? 'Only Primary Super Admin can modify their own account' : undefined}
                          onClick={() => {
                            if (user.universityId === '10001' && authUser?.universityId !== '10001') return;
                            handleOpenEdit(user);
                            setActiveDropdown(null);
                          }}
                        >
                          <Pencil size={15} color="#2563eb" />
                          <span>Edit User</span>
                        </button>
                        <button 
                          className="dropdown-item" 
                          disabled={user.universityId === '10001'}
                          title={user.universityId === '10001' ? 'Primary Super Admin account is permanent and cannot be deactivated' : undefined}
                          onClick={() => {
                            if (user.universityId === '10001') return;
                            setSelectedUser(user);
                            setStatusAction(!user.isActive);
                            setShowStatusModal(true);
                            setActiveDropdown(null);
                          }}
                        >
                          {user.isActive ? <Ban size={15} color="#d97706" /> : <CheckCircle size={15} color="#10b981" />}
                          <span>{user.isActive ? 'Deactivate User' : 'Activate User'}</span>
                        </button>
                        <button 
                          className="dropdown-item danger" 
                          disabled={user.universityId === '10001'}
                          title={user.universityId === '10001' ? 'Primary Super Admin account cannot be deleted' : undefined}
                          onClick={() => {
                            if (user.universityId === '10001') return;
                            setSelectedUser(user);
                            setShowDeleteModal(true);
                            setActiveDropdown(null);
                          }}
                        >
                          <Trash2 size={15} color="#dc2626" />
                          <span>Delete User</span>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="um-pagination-footer">
          <div className="um-pagination-text">
            Showing {users.length > 0 ? (page - 1) * 10 + 1 : 0}-{Math.min(page * 10, totalUsers)} of {totalUsers} users
          </div>
          <div className="um-pagination-controls">
            <button className="btn-paginate" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft size={16} />
            </button>
            <button className="btn-paginate" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* --- MOBILE CARD VIEW --- */}
      <div className="um-mobile-cards">
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Loading users...</div>
        ) : users.length === 0 ? (
          <div className="um-mobile-empty">
            <UserIcon size={36} color="#94a3b8" />
            <p>No users found matching your filters.</p>
            {hasActiveFilters && (
              <button className="btn-paginate" onClick={handleClearFilters} style={{ margin: '0.5rem auto' }}>
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          users.map((user) => (
            <div key={user.id} className={`um-mobile-card ${user.isActive ? 'status-active' : 'status-inactive'}`}>
              <div className="um-card-header">
                <div className="user-info-cell">
                  <div className="user-avatar" style={{ backgroundImage: `url(https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=e2e8f0&color=1e293b)` }}></div>
                  <div>
                    <div className="user-name">{user.name}</div>
                    <div className="user-email">{user.email}</div>
                  </div>
                </div>
                <div className="um-card-status-wrapper">
                  {!user.isActive ? (
                    <span className="um-roster-badge um-roster-deactivated">
                      <span className="status-dot red"></span> Deactivated
                    </span>
                  ) : user.universityId === '10001' ? (
                    <span className="um-roster-badge um-roster-super" title="Primary Root Super Administrator (Permanent)">
                      <Crown size={12} color="#f59e0b" /> Primary Root
                    </span>
                  ) : user.role === 'super_admin' ? (
                    <span className="um-roster-badge um-roster-super" title="Delegated Super Administrator">
                      <ShieldAlert size={12} /> Delegated Admin
                    </span>
                  ) : user.role === 'department_admin' ? (
                    <span className="um-roster-badge um-roster-lead">
                      <Users size={12} /> Team Lead {user.rosterStaffCount ? `(${user.rosterStaffCount})` : ''}
                    </span>
                  ) : user.assignedAdmin ? (
                    <div className="um-roster-assigned-cell">
                      <span className="um-roster-badge um-roster-assigned">
                        <CheckCircle size={12} /> Assigned
                      </span>
                      <span className="um-roster-lead-name">to {user.assignedAdmin.adminName}</span>
                    </div>
                  ) : (
                    <span className="um-roster-badge um-roster-unassigned">
                      <AlertTriangle size={12} /> Unassigned
                    </span>
                  )}
                </div>
              </div>

              <div className="um-card-chips-row">
                <span className={getRoleBadgeClass(user)}>
                  {getRoleIcon(user)} {formatRoleText(user)}
                </span>
                <span className="um-card-id-chip">
                  ID: {user.universityId}
                </span>
              </div>
              
              <div className="um-card-details">
                <div className="um-card-info-row">
                  <Mail size={15} className="um-card-info-icon" />
                  <span className="um-card-info-text">{user.email}</span>
                </div>

                <div className="um-card-info-row">
                  <Building2 size={15} className="um-card-info-icon" />
                  <span className="um-card-info-text">{user.department || 'Unassigned'}</span>
                </div>
                
                {user.phone && user.phone !== '-' && (
                  <div className="um-card-info-row">
                    <Phone size={15} className="um-card-info-icon" />
                    <span className="um-card-info-text">
                      {user.phone.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')}
                    </span>
                  </div>
                )}
              </div>

              <div className="actions-cell" style={{ position: 'relative', marginTop: '0.85rem' }}>
                <button className="um-card-actions-btn" onClick={(e) => toggleDropdown(`mobile-${user.id}`, e)}>
                  <span>Options</span> <MoreVertical size={16} />
                </button>
                {activeDropdown === `mobile-${user.id}` && (
                  <div className="action-dropdown" ref={dropdownRef} style={{ top: '100%', right: '0', width: '100%' }}>
                    {user.universityId !== '10001' && user.role !== 'super_admin' && user.isActive && (
                      <button 
                        className="dropdown-item" 
                        onClick={() => {
                          handleOpenTransferModal(user);
                          setActiveDropdown(null);
                        }}
                        title="Transfer Super Admin privileges to this user"
                      >
                        <Crown size={15} color="#d97706" />
                        <span>Transfer Super Admin</span>
                      </button>
                    )}
                    <button 
                      className="dropdown-item" 
                      disabled={user.universityId === '10001' && authUser?.universityId !== '10001'}
                      title={user.universityId === '10001' && authUser?.universityId !== '10001' ? 'Only Primary Super Admin can modify their own account' : undefined}
                      onClick={() => {
                        if (user.universityId === '10001' && authUser?.universityId !== '10001') return;
                        handleOpenEdit(user);
                        setActiveDropdown(null);
                      }}
                    >
                      <Pencil size={15} color="#2563eb" />
                      <span>Edit User</span>
                    </button>
                    <button 
                      className="dropdown-item" 
                      disabled={user.universityId === '10001'}
                      title={user.universityId === '10001' ? 'Primary Super Admin account is permanent and cannot be deactivated' : undefined}
                      onClick={() => {
                        if (user.universityId === '10001') return;
                        setSelectedUser(user);
                        setStatusAction(!user.isActive);
                        setShowStatusModal(true);
                        setActiveDropdown(null);
                      }}
                    >
                      {user.isActive ? <Ban size={15} color="#d97706" /> : <CheckCircle size={15} color="#10b981" />}
                      <span>{user.isActive ? 'Deactivate User' : 'Activate User'}</span>
                    </button>
                    <button 
                      className="dropdown-item danger" 
                      disabled={user.universityId === '10001'}
                      title={user.universityId === '10001' ? 'Primary Super Admin account cannot be deleted' : undefined}
                      onClick={() => {
                        if (user.universityId === '10001') return;
                        setSelectedUser(user);
                        setShowDeleteModal(true);
                        setActiveDropdown(null);
                      }}
                    >
                      <Trash2 size={15} color="#dc2626" />
                      <span>Delete User</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        
        {/* Mobile Pagination */}
        {totalPages > 1 && (
          <div className="um-pagination-controls" style={{ justifyContent: 'center', marginTop: '1rem' }}>
            <button className="btn-paginate" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft size={16} /> Prev
            </button>
            <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem', color: '#6b7280' }}>
              {page} / {totalPages}
            </span>
            <button className="btn-paginate" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
              Next <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Status Change Modal (Deactivate / Activate) */}
      {showStatusModal && selectedUser && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              {statusAction ? (
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                  <CheckCircle size={22} />
                </div>
              ) : (
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
                  <Ban size={22} />
                </div>
              )}
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#111827' }}>
                {statusAction ? 'Activate User Account' : 'Deactivate User Account'}
              </h3>
            </div>
            
            <p style={{ color: '#4b5563', fontSize: '0.95rem', lineHeight: '1.5', margin: '0 0 1rem 0' }}>
              Are you sure you want to {statusAction ? 'activate' : 'deactivate'}{' '}
              <strong>{selectedUser.name}</strong> ({selectedUser.universityId})?
            </p>

            {!statusAction ? (
              <div style={{ 
                backgroundColor: '#fffbeb', 
                border: '1px solid #fde68a', 
                borderRadius: '6px', 
                padding: '0.85rem 1rem', 
                color: '#92400e', 
                fontSize: '0.85rem', 
                lineHeight: 1.45, 
                marginBottom: '1.5rem' 
              }}>
                <strong>Account Suspension Effect:</strong>
                <ul style={{ margin: '0.35rem 0 0 1.25rem', padding: 0 }}>
                  <li>The user cannot access their dashboard.</li>
                  <li>When they attempt to log in, they will see the message: <em>"Your account has been suspended by super admin."</em></li>
                  <li>You can reactivate their account at any time.</li>
                </ul>
              </div>
            ) : (
              <div style={{ 
                backgroundColor: '#ecfdf5', 
                border: '1px solid #a7f3d0', 
                borderRadius: '6px', 
                padding: '0.85rem 1rem', 
                color: '#065f46', 
                fontSize: '0.85rem', 
                lineHeight: 1.45, 
                marginBottom: '1.5rem' 
              }}>
                Activating this account will restore dashboard access and allow <strong>{selectedUser.name}</strong> to log in normally.
              </div>
            )}

            <div className="modal-actions">
              <button 
                type="button" 
                className="btn-paginate" 
                onClick={() => setShowStatusModal(false)}
                disabled={isUpdatingStatus}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn-add-user" 
                style={{ 
                  backgroundColor: statusAction ? '#10b981' : '#d97706',
                  borderColor: statusAction ? '#10b981' : '#d97706',
                  color: '#fff',
                  cursor: isUpdatingStatus ? 'not-allowed' : 'pointer'
                }} 
                onClick={handleStatusChangeSubmit}
                disabled={isUpdatingStatus}
              >
                {isUpdatingStatus ? 'Updating...' : statusAction ? 'Activate User' : 'Deactivate User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {showDeleteModal && selectedUser && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
                <AlertTriangle size={22} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#111827' }}>
                Delete User Permanently?
              </h3>
            </div>
            
            <p style={{ color: '#4b5563', fontSize: '0.95rem', lineHeight: '1.5', margin: '0 0 1rem 0' }}>
              Are you sure you want to delete <strong>{selectedUser.name}</strong> ({selectedUser.universityId}) directly from the database?
            </p>

            <div style={{ 
              backgroundColor: '#fef2f2', 
              border: '1px solid #fecaca', 
              borderRadius: '6px', 
              padding: '0.85rem 1rem', 
              color: '#991b1b', 
              fontSize: '0.85rem', 
              lineHeight: 1.45, 
              marginBottom: '1.5rem' 
            }}>
              <strong>Permanent Database Deletion:</strong>
              <ul style={{ margin: '0.35rem 0 0 1.25rem', padding: 0 }}>
                <li>This user will be permanently erased from the database.</li>
                <li>All active staff and team assignments for this user will be removed.</li>
                <li>This action is irreversible.</li>
              </ul>
            </div>

            <div className="modal-actions">
              <button 
                type="button" 
                className="btn-paginate" 
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn-add-user" 
                style={{ 
                  backgroundColor: '#dc2626', 
                  borderColor: '#dc2626',
                  color: '#fff',
                  cursor: isDeleting ? 'not-allowed' : 'pointer'
                }} 
                onClick={handleDeleteUserSubmit}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editModalUser && (
        <div 
          className="modal-overlay" 
          onClick={() => !isEditing && handleCloseEdit()}
        >
          <div className="modal-content um-edit-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="um-modal-header">
              <div className="um-modal-icon-edit">
                <Pencil size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 className="um-modal-title">Edit User Account</h3>
                <p className="um-modal-desc">
                  Update registered details and permissions for <strong>{editModalUser.name}</strong> ({editModalUser.universityId}).
                </p>
              </div>
              <button 
                type="button" 
                className="um-modal-close-icon-btn" 
                onClick={handleCloseEdit}
                disabled={isEditing}
                aria-label="Close edit modal"
              >
                <X size={18} />
              </button>
            </div>

            {editError && (
              <div className="um-edit-error-alert">
                <AlertCircle size={16} />
                <span>{editError}</span>
              </div>
            )}

            <div className="um-sync-notice-alert">
              <AlertCircle size={16} className="um-sync-notice-icon" />
              <div className="um-sync-notice-text">
                <strong>Directory Synchronization:</strong>
                <p>Changes saved here will automatically keep their credentials synchronized with the Verified Users Directory.</p>
              </div>
            </div>

            <form onSubmit={handleSaveEdit} className="um-edit-form">
              <div className="um-edit-grid">
                {/* University ID */}
                <div className="um-edit-form-group">
                  <label htmlFor="edit-uid">University ID *</label>
                  <input
                    type="text"
                    id="edit-uid"
                    className="um-edit-input"
                    value={editForm.universityId}
                    onChange={(e) => setEditForm(prev => ({ ...prev, universityId: e.target.value.replace(/\D/g, '').slice(0, 5) }))}
                    placeholder="3-5 digit ID"
                    maxLength={5}
                    required
                  />
                </div>

                {/* Name */}
                <div className="um-edit-form-group">
                  <label htmlFor="edit-name">Full Name *</label>
                  <input
                    type="text"
                    id="edit-name"
                    className="um-edit-input"
                    value={editForm.name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Full Name"
                    required
                  />
                </div>

                {/* Email */}
                <div className="um-edit-form-group">
                  <label htmlFor="edit-email">Email Address *</label>
                  <input
                    type="email"
                    id="edit-email"
                    className="um-edit-input"
                    value={editForm.email}
                    onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="user@ctuniversity.in"
                    required
                  />
                </div>

                {/* Phone */}
                <div className="um-edit-form-group">
                  <label htmlFor="edit-phone">Phone Number</label>
                  <input
                    type="tel"
                    id="edit-phone"
                    className="um-edit-input"
                    value={editForm.phone}
                    onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                    placeholder="10-digit number"
                    maxLength={10}
                  />
                </div>

                {/* Department */}
                <div className="um-edit-form-group">
                  <label htmlFor="edit-dept">Department</label>
                  <select
                    id="edit-dept"
                    className="um-edit-select"
                    value={editForm.department}
                    onChange={(e) => setEditForm(prev => ({ ...prev, department: e.target.value }))}
                  >
                    <option value="">No Department (Unassigned)</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                    {editForm.department && !departments.some(d => d.name.toLowerCase() === editForm.department.toLowerCase()) && (
                      <option value={editForm.department}>{editForm.department}</option>
                    )}
                  </select>
                </div>

                {/* Role */}
                <div className="um-edit-form-group">
                  <label htmlFor="edit-role">System Role *</label>
                  <select
                    id="edit-role"
                    className="um-edit-select"
                    value={editForm.role}
                    disabled={editModalUser.universityId === '10001'}
                    onChange={(e) => setEditForm(prev => ({ ...prev, role: e.target.value }))}
                  >
                    {editModalUser.universityId === '10001' ? (
                      <option value="super_admin">Primary Super Admin (Permanent Root)</option>
                    ) : (
                      <>
                        <option value="staff">Staff</option>
                        <option value="department_admin">Department Admin</option>
                        <option value="super_admin">Super Admin</option>
                      </>
                    )}
                  </select>

                  {editModalUser.universityId === '10001' && (
                    <div className="um-role-primary-notice">
                      <Crown size={16} />
                      <span>Primary Super Admin (10001) has permanent root authority and cannot be modified or demoted.</span>
                    </div>
                  )}

                  {editModalUser.universityId !== '10001' && editForm.role === 'super_admin' && (
                    authUser?.universityId === '10001' ? (
                      <div className="um-role-primary-notice">
                        <Crown size={16} />
                        <span>You are appointing a Delegated Super Admin. You will remain the Primary Super Admin (10001).</span>
                      </div>
                    ) : (
                      <div className="um-role-transfer-notice">
                        <AlertTriangle size={18} />
                        <div>
                          <strong>Super Admin Transfer:</strong> Promoting this user to Super Admin will transfer your Super Admin privileges to them. You will revert to Staff status upon saving, while Primary Super Admin (10001) remains active.
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn-paginate"
                  onClick={handleCloseEdit}
                  disabled={isEditing}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-add-user"
                  disabled={isEditing}
                  style={{
                    backgroundColor: '#2563eb',
                    borderColor: '#2563eb',
                    color: '#ffffff',
                    cursor: isEditing ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isEditing ? (
                    <>
                      <Loader2 size={16} className="um-spin-icon" /> Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Super Admin Modal */}
      {showTransferModal && (
        <div 
          className="modal-overlay" 
          onClick={() => !isTransferring && setShowTransferModal(false)}
        >
          <div 
            className="modal-content um-edit-modal-content" 
            style={{ maxWidth: '580px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="um-modal-header">
              <div 
                className="um-modal-icon-edit" 
                style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#ffffff' }}
              >
                <Crown size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 className="um-modal-title">Transfer Super Admin Privileges</h3>
                <p className="um-modal-desc">
                  Appoint or transfer institution-wide Super Administrator authority to an active user.
                </p>
              </div>
              <button 
                type="button" 
                className="um-modal-close-icon-btn" 
                onClick={() => !isTransferring && setShowTransferModal(false)}
                disabled={isTransferring}
                aria-label="Close transfer modal"
              >
                <X size={18} />
              </button>
            </div>

            {transferError && (
              <div className="um-edit-error-alert" style={{ marginBottom: '1rem' }}>
                <AlertCircle size={16} />
                <span>{transferError}</span>
              </div>
            )}

            {/* Candidate Selector */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
                Select Eligible Candidate *
              </label>
              
              {loadingCandidates ? (
                <div style={{ padding: '0.75rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.85rem', color: '#64748b' }}>
                  Loading eligible users...
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <input
                    type="text"
                    className="um-search-input"
                    style={{ width: '100%', padding: '0.6rem 0.85rem', fontSize: '0.85rem', border: '1px solid #d1d5db', borderRadius: '8px' }}
                    placeholder="Search candidate by name, university ID or department..."
                    value={transferSearch}
                    onChange={(e) => setTransferSearch(e.target.value)}
                  />

                  <select
                    style={{ 
                      width: '100%', 
                      padding: '0.65rem 0.85rem', 
                      fontSize: '0.875rem', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '8px',
                      backgroundColor: '#ffffff',
                      color: '#111827'
                    }}
                    value={transferCandidateId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      setTransferCandidateId(selectedId);
                      const found = transferAllUsersList.find(u => (u.id === selectedId || (u as any)._id === selectedId));
                      setTransferTargetUser(found || null);
                    }}
                  >
                    <option value="">-- Choose User to Appoint --</option>
                    {transferAllUsersList
                      .filter(u => {
                        if (!transferSearch.trim()) return true;
                        const s = transferSearch.toLowerCase();
                        return (
                          u.name?.toLowerCase().includes(s) ||
                          u.universityId?.toLowerCase().includes(s) ||
                          u.email?.toLowerCase().includes(s) ||
                          u.department?.toLowerCase().includes(s)
                        );
                      })
                      .map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} (ID: {u.universityId}) — {u.department || 'No Dept'} ({u.role})
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>

            {/* Selected User Details Card */}
            {transferTargetUser && (
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '0.95rem 1rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem'
              }}>
                <div 
                  className="user-avatar" 
                  style={{ 
                    width: '42px', 
                    height: '42px', 
                    backgroundImage: `url(https://ui-avatars.com/api/?name=${encodeURIComponent(transferTargetUser.name)}&background=e2e8f0&color=1e293b)`,
                    flexShrink: 0
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
                    {transferTargetUser.name} <span style={{ color: '#64748b', fontWeight: 500, fontSize: '0.82rem' }}>({transferTargetUser.universityId})</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.15rem' }}>
                    {transferTargetUser.email} • {transferTargetUser.department || 'Unassigned Dept'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.2rem' }}>
                    Current Role: <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{transferTargetUser.role.replace('_', ' ')}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Contextual Warning & Explanation Notice */}
            {authUser?.universityId === '10001' ? (
              <div className="um-role-primary-notice" style={{ marginBottom: '1.5rem' }}>
                <Crown size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#7c3aed' }} />
                <div>
                  <strong style={{ color: '#6d28d9' }}>Primary Super Admin Delegation:</strong>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.83rem', lineHeight: 1.45, color: '#5b21b6' }}>
                    You are the permanent Primary Super Admin (<strong>10001</strong>). Delegating Super Admin privileges to {transferTargetUser ? <strong>{transferTargetUser.name}</strong> : 'the selected user'} will elevate them to <strong>Delegated Super Admin</strong>. Your root access remains permanent and unaffected.
                  </p>
                </div>
              </div>
            ) : (
              <div className="um-role-transfer-notice" style={{ marginBottom: '1.5rem' }}>
                <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#d97706' }} />
                <div>
                  <strong style={{ color: '#b45309' }}>Privilege Handover &amp; Step-Down:</strong>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.83rem', lineHeight: 1.45, color: '#92400e' }}>
                    You are currently a <strong>Delegated Super Admin</strong>. Transferring Super Admin privileges will promote {transferTargetUser ? <strong>{transferTargetUser.name}</strong> : 'the candidate'} to Super Admin, and <strong>your account will automatically step down to Staff</strong> in your department. The Primary Super Admin (<strong>10001</strong>) will remain unaffected.
                  </p>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="modal-actions">
              <button 
                type="button" 
                className="btn-paginate" 
                onClick={() => setShowTransferModal(false)}
                disabled={isTransferring}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn-add-user" 
                style={{ 
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  borderColor: '#d97706',
                  color: '#ffffff',
                  cursor: (isTransferring || !transferCandidateId) ? 'not-allowed' : 'pointer',
                  opacity: (!transferCandidateId && !isTransferring) ? 0.6 : 1
                }} 
                onClick={handleTransferSuperAdminSubmit}
                disabled={isTransferring || !transferCandidateId}
              >
                {isTransferring ? (
                  <>
                    <Loader2 size={16} className="um-spin-icon" /> Transferring Privileges...
                  </>
                ) : (
                  <>
                    <Crown size={15} /> Confirm &amp; Transfer Super Admin
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

export default UserManagementPage;
