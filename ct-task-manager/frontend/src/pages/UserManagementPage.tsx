import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, User } from '../services/api';
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
  AlertTriangle
} from 'lucide-react';
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

  // Selected User for actions
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // Status confirm State
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusAction, setStatusAction] = useState<boolean>(true); // true = activate, false = deactivate
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Delete confirm State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
        
        <button 
          className="btn-add-user" 
          onClick={() => navigate('/super-admin/verified-users')}
          title="Open Verified Users Directory"
        >
          <ShieldCheck size={16} /> Verified Users
        </button>
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
    </div>
  );
};

export default UserManagementPage;
