import React, { useState, useEffect, useMemo } from 'react';
import { api, User, Department } from '../services/api';
import './SuperAdminStaffAssignmentsPage.css';
import { Building, ShieldCheck, Mail, Phone, Search, Filter, X, Users, Shield, AlertTriangle, Crown } from 'lucide-react';
import ExportDropdownMenu from '../components/ExportDropdownMenu';
import { exportStaffAssignments } from '../utils/generalExport';

const SuperAdminStaffAssignmentsPage: React.FC = () => {
  const [staff, setStaff] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admins' | 'staff'>('all');

  // Super Task Permission Modal state
  const [superTaskTarget, setSuperTaskTarget] = useState<User | null>(null);
  const [superTaskAction, setSuperTaskAction] = useState<'grant' | 'revoke' | null>(null);
  const [isSuperTaskUpdating, setIsSuperTaskUpdating] = useState(false);

  const openSuperTaskModal = (targetUser: User, action: 'grant' | 'revoke') => {
    setSuperTaskTarget(targetUser);
    setSuperTaskAction(action);
  };

  const handleConfirmSuperTaskPermission = async () => {
    if (!superTaskTarget || !superTaskAction) return;
    try {
      setIsSuperTaskUpdating(true);
      const isGranting = superTaskAction === 'grant';
      const res = await api.toggleSuperTaskPermission(superTaskTarget.id, isGranting);
      if (res.success) {
        setStaff((prevStaff) =>
          prevStaff.map((s) =>
            s.id === superTaskTarget.id
              ? { ...s, canCreateSuperAdminTasks: isGranting }
              : s
          )
        );
        setSuperTaskTarget(null);
        setSuperTaskAction(null);
      } else {
        alert(res.message || 'Failed to update permission.');
      }
    } catch (err: any) {
      console.error('Error toggling super task permission:', err);
      alert(err.message || 'Error updating permission.');
    } finally {
      setIsSuperTaskUpdating(false);
    }
  };

  // Promote Modal state
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<User | null>(null);
  const [departmentName, setDepartmentName] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportAssignments = async (format: 'excel' | 'pdf' | 'csv') => {
    try {
      setIsExporting(true);
      await exportStaffAssignments(filteredStaff, assignments, format, {
        department: selectedDepartment !== 'all' ? selectedDepartment : undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined,
        search: searchQuery || undefined,
      });
    } catch (err: any) {
      console.error('Export error', err);
      alert('Failed to export staff assignments: ' + (err.message || 'Unknown error'));
    } finally {
      setIsExporting(false);
    }
  };

  // Fetch logic
  const fetchStaff = async () => {
    try {
      setLoading(true);
      // Fetch active staff and department admins
      const staffRes = await api.getUsers({ role: 'staff,department_admin', status: 'Active', limit: 1000 });
      if (staffRes.success) {
        setStaff(staffRes.data.users);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = async () => {
    try {
      const res = await api.getAssignments();
      if (res.success) {
        setAssignments(res.data.assignments);
      }
    } catch (err) {
      console.error('Failed to load assignments', err);
    }
  };

  useEffect(() => {
    fetchStaff();
    fetchAssignments();
    const fetchDepartments = async () => {
      try {
        const res = await api.getDepartments();
        if (res.success) {
          setDepartments(res.data.departments);
        }
      } catch (err) {
        console.error('Failed to load departments');
      }
    };
    fetchDepartments();
  }, []);

  // Compute unique department options from departments list + staff records
  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    departments.forEach(d => {
      if (d.name) set.add(d.name.trim());
    });
    staff.forEach(s => {
      if (s.department) set.add(s.department.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [departments, staff]);

  // Counts for role filter tabs
  const totalCount = staff.length;
  const adminCount = useMemo(() => staff.filter(s => s.role === 'department_admin').length, [staff]);
  const regularStaffCount = totalCount - adminCount;

  // Filter and sort staff (Admins ALWAYS on top)
  const filteredStaff = useMemo(() => {
    return staff
      .filter((st) => {
        // Role filter
        if (roleFilter === 'admins' && st.role !== 'department_admin') return false;
        if (roleFilter === 'staff' && st.role === 'department_admin') return false;

        // Department filter
        if (selectedDepartment !== 'all') {
          if (!st.department || st.department.trim().toLowerCase() !== selectedDepartment.trim().toLowerCase()) {
            return false;
          }
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const nameMatch = st.name?.toLowerCase().includes(q);
          const emailMatch = st.email?.toLowerCase().includes(q);
          const idMatch = st.universityId?.toLowerCase().includes(q);
          const phoneMatch = st.phone?.toLowerCase().includes(q);
          const deptMatch = st.department?.toLowerCase().includes(q);
          if (!nameMatch && !emailMatch && !idMatch && !phoneMatch && !deptMatch) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        // ALWAYS put Department Admins on TOP
        const aIsAdmin = a.role === 'department_admin' ? 1 : 0;
        const bIsAdmin = b.role === 'department_admin' ? 1 : 0;
        if (aIsAdmin !== bIsAdmin) {
          return bIsAdmin - aIsAdmin; // 1 before 0
        }
        // Secondary sort: Alphabetical by Name
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [staff, roleFilter, selectedDepartment, searchQuery]);

  const getAdminTeamCount = (adminId: string) => {
    return assignments.filter(
      (a) =>
        (a.adminId?._id === adminId || a.adminId?.id === adminId || a.adminId === adminId) &&
        a.isActive !== false
    ).length;
  };

  // Check if chosen department already has an existing admin
  const existingDeptAdmin = useMemo(() => {
    if (!departmentName || !departmentName.trim()) return null;
    const deptLower = departmentName.trim().toLowerCase();
    return (
      staff.find(
        (s) =>
          s.role === 'department_admin' &&
          s.department &&
          s.department.trim().toLowerCase() === deptLower &&
          s.id !== selectedStaff?.id
      ) || null
    );
  }, [departmentName, staff, selectedStaff]);

  const handlePromoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff || !departmentName.trim()) return;

    try {
      setIsSubmitting(true);
      const res = await api.updateUserRole(selectedStaff.id, 'department_admin', departmentName.trim());
      if (res.message) {
        alert(res.message);
      }
      setShowPromoteModal(false);
      setDepartmentName('');
      setSelectedStaff(null);
      fetchStaff();
      fetchAssignments();
    } catch (err: any) {
      alert(err.message || 'Failed to promote staff member.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemote = async (id: string, name: string) => {
    const teamCount = getAdminTeamCount(id);
    if (teamCount > 0) {
      const confirmed = window.confirm(
        `WARNING: ${name} currently has ${teamCount} active staff member(s) assigned in their team!\n\n` +
        `If you want to replace this admin and keep their team intact, cancel this and use "Promote to Dept Admin" on the new admin candidate instead.\n\n` +
        `Removing admin privileges directly will unassign all ${teamCount} team member(s). Are you sure you want to proceed?`
      );
      if (!confirmed) return;
    } else {
      if (!window.confirm(`Are you sure you want to remove Department Admin privileges from ${name}?`)) return;
    }

    try {
      setLoading(true);
      await api.updateUserRole(id, 'staff', '');
      fetchStaff();
      fetchAssignments();
    } catch (err: any) {
      alert(err.message);
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedDepartment('all');
    setRoleFilter('all');
  };

  const hasActiveFilters = searchQuery !== '' || selectedDepartment !== 'all' || roleFilter !== 'all';

  return (
    <>
      <div className="sa-assignments-container">
        {/* Header */}
        <div className="saa-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="saa-title">Manage Staff</h1>
            <p className="saa-subtitle">View active staff members, filter by department or role, and assign Department Admins.</p>
          </div>
          <ExportDropdownMenu
            onExport={handleExportAssignments}
            isExporting={isExporting}
          />
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {/* Filter Toolbar */}
        <div className="saa-filter-card">
          <div className="saa-filter-row">
            {/* Search Input */}
            <div className="saa-search-box">
              <Search size={16} className="saa-search-icon" />
              <input
                type="text"
                placeholder="Search by name, ID, email, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="saa-search-input"
              />
              {searchQuery && (
                <button 
                  type="button" 
                  onClick={() => setSearchQuery('')} 
                  className="saa-clear-btn"
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Department Filter Dropdown */}
            <div className="saa-dept-select-wrap">
              <Building size={16} className="saa-select-icon" />
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="saa-dept-select"
              >
                <option value="all">All Departments</option>
                {departmentOptions.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            {/* Clear All Filters Button */}
            {hasActiveFilters && (
              <button 
                type="button" 
                onClick={clearFilters}
                className="saa-reset-filter-btn"
                title="Reset all filters"
              >
                <X size={14} /> Reset Filters
              </button>
            )}
          </div>

          {/* Role Segmented Tabs (All / Admins / Staff) */}
          <div className="saa-role-tabs-row">
            <div className="saa-role-tabs">
              <button
                type="button"
                className={`saa-role-tab ${roleFilter === 'all' ? 'active' : ''}`}
                onClick={() => setRoleFilter('all')}
              >
                <Users size={15} />
                <span>All Members</span>
                <span className="saa-tab-count">{totalCount}</span>
              </button>

              <button
                type="button"
                className={`saa-role-tab ${roleFilter === 'admins' ? 'active admin-tab' : ''}`}
                onClick={() => setRoleFilter('admins')}
              >
                <Shield size={15} />
                <span>Department Admins</span>
                <span className="saa-tab-count admin-badge">{adminCount}</span>
              </button>

              <button
                type="button"
                className={`saa-role-tab ${roleFilter === 'staff' ? 'active' : ''}`}
                onClick={() => setRoleFilter('staff')}
              >
                <span>Staff Members</span>
                <span className="saa-tab-count">{regularStaffCount}</span>
              </button>
            </div>

            {/* Result Stats */}
            <div className="saa-results-info">
              Showing <strong>{filteredStaff.length}</strong> of {totalCount} members
              {filteredStaff.length > 0 && adminCount > 0 && roleFilter === 'all' && (
                <span className="saa-top-note">(Admins pinned to top)</span>
              )}
            </div>
          </div>
        </div>

        {/* Staff Grid */}
        <div className="saa-layout">
          <div className="saa-section">
            <div className="saa-card-list">
              {loading ? (
                <div className="saa-loading-state">
                  <p>Loading staff members...</p>
                </div>
              ) : filteredStaff.length === 0 ? (
                <div className="saa-empty-state">
                  <Filter size={36} />
                  <h3>No members found</h3>
                  <p>No staff match your current search or filter criteria.</p>
                  {hasActiveFilters && (
                    <button type="button" onClick={clearFilters} className="btn btn-secondary">
                      Clear Filters
                    </button>
                  )}
                </div>
              ) : (
                filteredStaff.map((st) => {
                  const isAdmin = st.role === 'department_admin';
                  return (
                    <div 
                      key={st.id} 
                      className={`saa-card ${isAdmin ? 'is-admin-card' : ''}`}
                    >
                      <div className="saa-card-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                          <div 
                            className="user-avatar" 
                            style={{ 
                              width: '42px', 
                              height: '42px',
                              borderRadius: '50%',
                              backgroundImage: `url(https://ui-avatars.com/api/?name=${encodeURIComponent(st.name)}&background=${isAdmin ? 'fef3c7' : 'e2e8f0'}&color=${isAdmin ? '92400e' : '1e293b'}&bold=true)`,
                              backgroundSize: 'cover',
                              border: isAdmin ? '2px solid #fbbf24' : '1px solid #cbd5e1',
                              flexShrink: 0
                            }}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{st.name}</strong>
                              {isAdmin && (
                                <span className="saa-admin-pill">
                                  <Shield size={11} /> Admin
                                </span>
                              )}
                            </div>
                            <span className="badge badge-secondary" style={{ marginTop: '0.25rem', display: 'inline-block' }}>
                              ID: {st.universityId}
                            </span>
                          </div>
                        </div>

                        {isAdmin && (
                          <div className="saa-card-top-action">
                            {st.canCreateSuperAdminTasks ? (
                              <button
                                type="button"
                                className="saa-super-task-btn active"
                                title="Super Admin Task Creation Rights Active. Click to revoke."
                                onClick={() => openSuperTaskModal(st, 'revoke')}
                              >
                                <Crown size={12} className="saa-crown-gold" />
                                <span>Super Creator</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="saa-super-task-btn inactive"
                                title="Grant permission to create and assign tasks across all departments as Super Admin"
                                onClick={() => openSuperTaskModal(st, 'grant')}
                              >
                                <Crown size={12} />
                                <span>+ Super Rights</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="saa-card-body">
                        <div className="saa-info-row">
                          <Mail size={14} className="saa-info-icon" /> 
                          <span className="saa-info-text">{st.email}</span>
                        </div>
                        {st.phone && (
                          <div className="saa-info-row">
                            <Phone size={14} className="saa-info-icon" /> 
                            <span className="saa-info-text">{st.phone}</span>
                          </div>
                        )}
                        <div className="saa-info-row">
                          <Building size={14} className="saa-info-icon" /> 
                          <span className={`saa-info-text ${!st.department ? 'text-muted' : ''}`}>
                            {st.department || 'No Department Assigned'}
                          </span>
                        </div>
                      </div>

                      <div className="saa-card-footer">
                        {isAdmin ? (
                          <button 
                            className="btn saa-btn-remove-admin" 
                            onClick={() => handleDemote(st.id, st.name)}
                            title="Remove Dept Admin role"
                          >
                            <ShieldCheck size={16} /> Remove Dept Admin
                          </button>
                        ) : (
                          <button 
                            className="btn btn-primary saa-btn-promote" 
                            onClick={() => {
                              setSelectedStaff(st);
                              setDepartmentName(st.department || '');
                              setShowPromoteModal(true);
                            }}
                          >
                            <ShieldCheck size={16} /> Promote to Dept Admin
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Super Admin Task Rights Confirmation Modal */}
      {superTaskTarget && superTaskAction && (
        <div className="modal-overlay" onClick={() => !isSuperTaskUpdating && setSuperTaskTarget(null)}>
          <div className="modal-content" style={{ maxWidth: '490px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: superTaskAction === 'grant' ? '#f5f3ff' : '#fef2f2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: superTaskAction === 'grant' ? '#7c3aed' : '#dc2626'
                }}>
                  <Crown size={20} />
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  {superTaskAction === 'grant' ? 'Grant Super Admin Task Rights' : 'Revoke Super Admin Task Rights'}
                </h3>
              </div>
              <button
                type="button"
                className="close-btn"
                disabled={isSuperTaskUpdating}
                onClick={() => setSuperTaskTarget(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '0.5rem 0 1rem' }}>
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '0.85rem 1rem',
                marginBottom: '1rem'
              }}>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.98rem' }}>{superTaskTarget.name}</div>
                <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.2rem' }}>
                  {superTaskTarget.department || 'Department Admin'} • ID: {superTaskTarget.universityId}
                </div>
              </div>

              {superTaskAction === 'grant' ? (
                <div style={{ fontSize: '0.88rem', color: '#334155', lineHeight: 1.6 }}>
                  <p style={{ margin: '0 0 0.75rem' }}>
                    Granting Super Admin task rights will allow <strong>{superTaskTarget.name}</strong> to:
                  </p>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#475569' }}>
                    <li style={{ marginBottom: '0.35rem' }}>Create and assign tasks to <strong>ANY department</strong> university-wide.</li>
                    <li style={{ marginBottom: '0.35rem' }}>Assign tasks to any faculty or staff across CT University.</li>
                    <li>Operate with <strong>Direct Super Admin Workflow</strong> for institutional oversight.</li>
                  </ul>
                  <p style={{ margin: '0.75rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                    <em>Note: The user remains a Department Admin and will NOT have access to system settings or user management.</em>
                  </p>
                </div>
              ) : (
                <div style={{ fontSize: '0.88rem', color: '#334155', lineHeight: 1.6 }}>
                  <p style={{ margin: 0 }}>
                    Are you sure you want to revoke Super Admin task creation rights from <strong>{superTaskTarget.name}</strong>?
                  </p>
                  <p style={{ margin: '0.5rem 0 0', color: '#64748b', fontSize: '0.82rem' }}>
                    They will immediately be restricted back to assigning tasks within their own department only.
                  </p>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isSuperTaskUpdating}
                onClick={() => setSuperTaskTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn ${superTaskAction === 'grant' ? 'btn-primary' : 'btn-danger'}`}
                style={superTaskAction === 'grant' ? { background: '#7c3aed', borderColor: '#7c3aed' } : {}}
                disabled={isSuperTaskUpdating}
                onClick={handleConfirmSuperTaskPermission}
              >
                {isSuperTaskUpdating ? (
                  'Updating...'
                ) : superTaskAction === 'grant' ? (
                  <>
                    <Crown size={15} style={{ marginRight: '6px' }} />
                    Grant Permission
                  </>
                ) : (
                  'Revoke Permission'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Promote Staff Modal */}
      {showPromoteModal && selectedStaff && (
        <div className="modal-overlay" onClick={() => setShowPromoteModal(false)}>
          <div className="modal-content" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Promote to Department Admin
              </h3>
              <button
                type="button"
                onClick={() => setShowPromoteModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0.25rem' }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ color: '#4b5563', fontSize: '0.88rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              You are promoting <strong>{selectedStaff.name}</strong> (ID: {selectedStaff.universityId}) to a Department Admin role. Please select which department they will manage.
            </p>

            <form onSubmit={handlePromoteSubmit}>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.85rem', color: '#334155' }}>
                  Assign Department *
                </label>
                <select
                  className="form-control"
                  style={{ width: '100%', padding: '0.65rem 0.85rem', border: '1.5px solid #cbd5e1', borderRadius: '8px', outline: 'none', fontSize: '0.9rem' }}
                  value={departmentName}
                  onChange={(e) => setDepartmentName(e.target.value)}
                  required
                >
                  <option value="">Select a Department...</option>
                  {departmentOptions.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              {/* Warning card when an admin already exists for the chosen department */}
              {existingDeptAdmin && (
                <div className="saa-existing-admin-card">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <AlertTriangle size={22} style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#92400e', marginBottom: '0.35rem' }}>
                        Admin Already Exists for this Department
                      </div>
                      <p style={{ fontSize: '0.85rem', color: '#78350f', margin: '0 0 0.6rem 0', lineHeight: 1.45 }}>
                        <strong>{existingDeptAdmin.name}</strong> (ID: {existingDeptAdmin.universityId}) is currently the Department Admin for <strong>{existingDeptAdmin.department}</strong>.
                      </p>
                      <div style={{ fontSize: '0.82rem', color: '#92400e', background: '#fef3c7', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid #fde68a', lineHeight: 1.45 }}>
                        <strong>Are you sure?</strong> If you confirm, <strong>{existingDeptAdmin.name}</strong> will be removed as Department Admin and will become unassigned staff. <strong>{selectedStaff.name}</strong> will become the new Department Admin, and the existing team will remain intact under {selectedStaff.name}.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowPromoteModal(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn ${existingDeptAdmin ? 'btn-warning' : 'btn-primary'}`}
                  disabled={isSubmitting || !departmentName}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    ...(existingDeptAdmin ? { backgroundColor: '#d97706', borderColor: '#d97706', color: '#ffffff' } : {})
                  }}
                >
                  <ShieldCheck size={16} />
                  {isSubmitting
                    ? 'Promoting...'
                    : existingDeptAdmin
                    ? 'Confirm & Replace Admin'
                    : 'Confirm Promotion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default SuperAdminStaffAssignmentsPage;
