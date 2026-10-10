import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, User, Department } from '../services/api';
import { 
  Search, 
  MoreVertical, 
  Mail, 
  ChevronLeft, 
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  User as UserIcon,
  Trash2,
  Ban,
  CheckCircle,
  AlertTriangle,
  Pencil,
  X,
  Loader2,
  AlertCircle
} from 'lucide-react';
import ExportDropdownMenu from '../components/ExportDropdownMenu';
import { exportUsers } from '../utils/generalExport';
import './UserManagementPage.css';

const UserManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
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

  const handleExportUsers = async (format: 'excel' | 'pdf' | 'csv') => {
    try {
      setIsExporting(true);
      let dataToExport = users;
      try {
        const fullRes = await api.getUsers({
          limit: 5000,
          search,
          role: roleFilter,
          status: statusFilter,
        });
        if (fullRes.data?.users && fullRes.data.users.length > 0) {
          dataToExport = fullRes.data.users;
        }
      } catch (err) {
        console.warn('Could not fetch all users for export, falling back to current page', err);
      }
      await exportUsers(dataToExport, format, {
        role: roleFilter,
        search,
      });
    } catch (err: any) {
      console.error('Export error', err);
      alert('Failed to export users: ' + (err.message || 'Unknown error'));
    } finally {
      setIsExporting(false);
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
        status: statusFilter,
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
    // eslint-disable-next-line
  }, [page, roleFilter, statusFilter, search]);

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
      fetchUsers();
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
      fetchUsers();
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
        setActionSuccessMessage(`Successfully updated details for ${editForm.name} (${uid}).`);
        setTimeout(() => setActionSuccessMessage(''), 4500);
        handleCloseEdit();
        await fetchUsers();
      }
    } catch (err: any) {
      setEditError(err.message || 'Failed to update user details.');
    } finally {
      setIsEditing(false);
    }
  };

  const getRoleIcon = (role: string) => {
    if (role === 'super_admin') return <ShieldAlert size={14} />;
    if (role === 'department_admin') return <ShieldCheck size={14} />;
    return <UserIcon size={14} />;
  };

  const formatRoleText = (role: string) => {
    if (role === 'super_admin') return 'Super Admin';
    if (role === 'department_admin') return 'Dept Admin';
    return 'Staff';
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

      <div className="um-filters">
        <div className="um-filters-left">
          <div className="um-search-wrapper">
            <Search className="um-search-icon" size={18} />
            <input
              type="text"
              className="um-search-input"
              placeholder="Search users by ID, Name..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          
          <select
            className="um-role-select"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="All">All Roles</option>
            <option value="super_admin">Super Admin</option>
            <option value="department_admin">Department Admin</option>
            <option value="staff">Staff</option>
          </select>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <ExportDropdownMenu
            onExport={handleExportUsers}
            isExporting={isExporting}
          />
          <button 
            className="btn-add-user" 
            onClick={() => navigate('/super-admin/verified-users')}
            title="Open Verified Users Directory"
          >
            <ShieldCheck size={16} /> Verified Users
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
              <th>Status</th>
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
                <td colSpan={7} className="text-center py-4" style={{ padding: '2rem', color: '#6b7280' }}>No users found.</td>
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
                    <span className={`badge-role badge-role-${user.role}`}>
                      {getRoleIcon(user.role)} {formatRoleText(user.role)}
                    </span>
                  </td>
                  <td>
                    <span className={`badge-status ${user.isActive ? 'active' : 'inactive'}`}>
                      <span className="status-dot"></span>
                      {user.isActive ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td className="actions-cell">
                    <button className="btn-icon" onClick={(e) => toggleDropdown(user.id, e)} title="Actions">
                      <MoreVertical size={18} />
                    </button>
                    {activeDropdown === user.id && (
                      <div className="action-dropdown" ref={dropdownRef}>
                        <button 
                          className="dropdown-item" 
                          onClick={() => {
                            handleOpenEdit(user);
                            setActiveDropdown(null);
                          }}
                        >
                          <Pencil size={15} color="#2563eb" />
                          <span>Edit User</span>
                        </button>
                        <button 
                          className="dropdown-item" 
                          onClick={() => {
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
                          onClick={() => {
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
          <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>No users found.</div>
        ) : (
          users.map((user) => (
            <div key={user.id} className={`um-mobile-card ${user.isActive ? 'status-active' : 'status-inactive'}`}>
              <div className="um-card-header">
                <div className="user-info-cell">
                  <div className="user-avatar" style={{ backgroundImage: `url(https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=e2e8f0&color=1e293b)` }}></div>
                  <div>
                    <div className="user-name">{user.name}</div>
                    <div className="user-dept" style={{ fontSize: '0.8rem' }}>{formatRoleText(user.role)}, {user.department || 'N/A'}</div>
                  </div>
                </div>
                <span className={`um-card-status ${user.isActive ? 'active' : 'inactive'}`}>
                  {user.isActive ? 'Active' : 'Deactivated'}
                </span>
              </div>
              
              <div className="um-card-info-row">
                <ShieldAlert size={14} className="um-card-info-icon" />
                <span>{user.universityId}</span>
              </div>
              
              <div className="um-card-info-row">
                <Mail size={14} className="um-card-info-icon" />
                <span>{user.email}</span>
              </div>

              <div className="actions-cell" style={{ position: 'relative' }}>
                <button className="um-card-actions-btn" onClick={(e) => toggleDropdown(`mobile-${user.id}`, e)}>
                  Options <MoreVertical size={16} />
                </button>
                {activeDropdown === `mobile-${user.id}` && (
                  <div className="action-dropdown" ref={dropdownRef} style={{ top: '100%', right: '0', width: '100%' }}>
                    <button 
                      className="dropdown-item" 
                      onClick={() => {
                        handleOpenEdit(user);
                        setActiveDropdown(null);
                      }}
                    >
                      <Pencil size={15} color="#2563eb" />
                      <span>Edit User</span>
                    </button>
                    <button 
                      className="dropdown-item" 
                      onClick={() => {
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
                      onClick={() => {
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
                    onChange={(e) => setEditForm(prev => ({ ...prev, role: e.target.value }))}
                  >
                    <option value="staff">Staff</option>
                    <option value="department_admin">Department Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
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
    </div>
  );
};

export default UserManagementPage;
