import React, { useState, useEffect, useMemo } from 'react';
import { api, User, Department } from '../services/api';
import './SuperAdminStaffAssignmentsPage.css';
import { Building, ShieldCheck, Mail, Phone, Search, Filter, X, Users, Shield, AlertTriangle } from 'lucide-react';

const SuperAdminStaffAssignmentsPage: React.FC = () => {
  const [staff, setStaff] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admins' | 'staff'>('all');

  // Promote Modal state
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<User | null>(null);
  const [departmentName, setDepartmentName] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        <div className="saa-header">
          <div>
            <h1 className="saa-title">Manage Staff</h1>
            <p className="saa-subtitle">View active staff members, filter by department or role, and assign Department Admins.</p>
          </div>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div 
                            className="user-avatar" 
                            style={{ 
                              width: '42px', 
                              height: '42px',
                              borderRadius: '50%',
                              backgroundImage: `url(https://ui-avatars.com/api/?name=${encodeURIComponent(st.name)}&background=${isAdmin ? 'fef3c7' : 'e2e8f0'}&color=${isAdmin ? '92400e' : '1e293b'}&bold=true)`,
                              backgroundSize: 'cover',
                              border: isAdmin ? '2px solid #fbbf24' : '1px solid #cbd5e1'
                            }}
                          />
                          <div>
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
