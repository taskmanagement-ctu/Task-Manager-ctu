import React, { useState, useEffect, useRef } from 'react';
import { api, Department } from '../services/api';
import './SuperAdminDepartmentsPage.css';
import { 
  Building, 
  Trash2, 
  Plus, 
  MoreVertical, 
  Shield, 
  UserCheck, 
  FileSpreadsheet, 
  UserPlus, 
  Check, 
  X,
  Edit2
} from 'lucide-react';

const SuperAdminDepartmentsPage: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add Department Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Department Modal state
  const [editModalDept, setEditModalDept] = useState<Department | null>(null);
  const [editDeptName, setEditDeptName] = useState('');
  const [editDeptCode, setEditDeptCode] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Three-dots menu state
  const [activeMenuDeptId, setActiveMenuDeptId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Permissions Modal state
  const [permModalDept, setPermModalDept] = useState<Department | null>(null);
  const [permAccess, setPermAccess] = useState<'none' | 'staff' | 'student' | 'both'>('none');
  const [permCanAdd, setPermCanAdd] = useState(true);
  const [permCanUpload, setPermCanUpload] = useState(true);
  const [savingPerms, setSavingPerms] = useState(false);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const res = await api.getDepartments();
      if (res.success) {
        setDepartments(res.data.departments);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  // Close three dots menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuDeptId(null);
      }
    };
    if (activeMenuDeptId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeMenuDeptId]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;

    try {
      setIsSubmitting(true);
      await api.createDepartment(newDeptName.trim(), newDeptCode.trim().toUpperCase());
      setShowAddModal(false);
      setNewDeptName('');
      setNewDeptCode('');
      fetchDepartments();
    } catch (err: any) {
      alert(err.message || 'Failed to create department');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (dept: Department) => {
    setActiveMenuDeptId(null);
    setEditModalDept(dept);
    setEditDeptName(dept.name || '');
    setEditDeptCode(dept.code || '');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalDept || !editDeptName.trim()) return;

    try {
      setIsSavingEdit(true);
      await api.updateDepartment(editModalDept._id, {
        name: editDeptName.trim(),
        code: editDeptCode.trim().toUpperCase()
      });
      setEditModalDept(null);
      fetchDepartments();
    } catch (err: any) {
      alert(err.message || 'Failed to update department');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    setActiveMenuDeptId(null);
    if (!window.confirm(`Are you sure you want to delete the department "${name}"?`)) return;

    try {
      await api.deleteDepartment(id);
      fetchDepartments();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openPermissionsModal = (dept: Department) => {
    setActiveMenuDeptId(null);
    setPermModalDept(dept);
    const access = dept.verifiedUserAccess === 'none' ? 'none' : 'staff';
    setPermAccess(access);
    setPermCanAdd(dept.canAddVerifiedUsers ?? true);
    setPermCanUpload(dept.canUploadVerifiedUsers ?? true);
  };

  const handleSavePermissions = async () => {
    if (!permModalDept) return;
    try {
      setSavingPerms(true);
      await api.updateDepartmentPermissions(permModalDept._id, {
        verifiedUserAccess: permAccess,
        canAddVerifiedUsers: permCanAdd,
        canUploadVerifiedUsers: permCanUpload,
      });
      setPermModalDept(null);
      fetchDepartments();
    } catch (err: any) {
      alert(err.message || 'Failed to update department permissions');
    } finally {
      setSavingPerms(false);
    }
  };

  const getAccessBadge = (access?: string) => {
    switch (access) {
      case 'staff':
      case 'both':
        return (
          <span className="dept-perm-badge badge-staff">
            <UserCheck size={12} /> Staff Access
          </span>
        );
      default:
        return (
          <span className="dept-perm-badge badge-none">
            <X size={12} /> No Access
          </span>
        );
    }
  };

  return (
    <>
      <div className="dept-container">
        <div className="dept-header">
          <div>
            <h1 className="dept-title">Departments</h1>
            <p className="dept-subtitle">Manage university departments available for registration and staff assignments.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={16} /> Add Department
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="dept-grid">
          {loading ? (
            <p>Loading departments...</p>
          ) : departments.length === 0 ? (
            <p className="text-muted" style={{ gridColumn: '1 / -1' }}>No departments found. Add one to get started.</p>
          ) : (
            departments.map((dept) => (
              <div 
                key={dept._id} 
                className={`dept-card ${activeMenuDeptId === dept._id ? 'menu-active' : ''}`}
              >
                <div className="dept-card-main">
                  <div className="dept-icon-wrapper">
                    <Building size={24} className="dept-icon" />
                  </div>
                  <div className="dept-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                      <h3 className="dept-card-title" style={{ margin: 0 }}>{dept.name}</h3>
                      {dept.code && (
                        <span className="dept-code-badge" title={`Short Code: ${dept.code}`}>
                          {dept.code}
                        </span>
                      )}
                    </div>
                    <div className="dept-badge-row">
                      {getAccessBadge(dept.verifiedUserAccess)}
                      {dept.verifiedUserAccess !== 'none' && (
                        <>
                          {dept.canAddVerifiedUsers && (
                            <span className="dept-sub-badge" title="Can add user info manually">
                              +Add
                            </span>
                          )}
                          {dept.canUploadVerifiedUsers && (
                            <span className="dept-sub-badge" title="Can upload Excel/CSV">
                              Excel
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="dept-card-actions">
                  {/* Three dots menu container */}
                  <div className="dept-menu-wrapper" ref={activeMenuDeptId === dept._id ? menuRef : null}>
                    <button 
                      className={`dept-dots-btn ${activeMenuDeptId === dept._id ? 'active' : ''}`}
                      onClick={() => setActiveMenuDeptId(activeMenuDeptId === dept._id ? null : dept._id)}
                      title="Options"
                    >
                      <MoreVertical size={18} />
                    </button>

                    {activeMenuDeptId === dept._id && (
                      <div className="dept-dropdown-menu">
                        <button 
                          className="dept-dropdown-item"
                          onClick={() => openEditModal(dept)}
                        >
                          <Edit2 size={15} className="dept-item-icon blue" />
                          <span>Edit Department</span>
                        </button>
                        <button 
                          className="dept-dropdown-item"
                          onClick={() => openPermissionsModal(dept)}
                        >
                          <Shield size={15} className="dept-item-icon blue" />
                          <span>Admin Permissions</span>
                        </button>
                        <button 
                          className="dept-dropdown-item danger"
                          onClick={() => handleDelete(dept._id, dept.name)}
                        >
                          <Trash2 size={15} className="dept-item-icon red" />
                          <span>Delete Department</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ─── Add Department Modal ─── */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>Add Department</h3>
              <button 
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className="form-group" style={{ marginBottom: '1.2rem' }}>
                <label style={{ display: 'block', marginBottom: '0.45rem', fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                  Department Full Name *
                </label>
                <input 
                  type="text"
                  className="form-control"
                  style={{ width: '100%', padding: '0.625rem 0.8rem', border: '1.5px solid #cbd5e1', borderRadius: '8px', fontSize: '0.9rem', outline: 'none' }}
                  placeholder="e.g., School Of Engineering And Technology"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.45rem', fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                  Short Name / Code
                </label>
                <input 
                  type="text"
                  className="form-control"
                  style={{ width: '100%', padding: '0.625rem 0.8rem', border: '1.5px solid #cbd5e1', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', textTransform: 'uppercase' }}
                  placeholder="e.g., SOET"
                  value={newDeptCode}
                  onChange={(e) => setNewDeptCode(e.target.value.toUpperCase())}
                />
                <span style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.35rem', display: 'block' }}>
                  Short code for quick identification (e.g., SOET, SMS).
                </span>
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setShowAddModal(false);
                    setNewDeptName('');
                    setNewDeptCode('');
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={!newDeptName.trim() || isSubmitting}
                >
                  {isSubmitting ? 'Adding...' : 'Add Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Edit Department Modal ─── */}
      {editModalDept && (
        <div className="modal-overlay" onClick={() => setEditModalDept(null)}>
          <div className="modal-content" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>Edit Department</h3>
              <button 
                type="button"
                onClick={() => setEditModalDept(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="form-group" style={{ marginBottom: '1.2rem' }}>
                <label style={{ display: 'block', marginBottom: '0.45rem', fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                  Department Full Name *
                </label>
                <input 
                  type="text"
                  className="form-control"
                  style={{ width: '100%', padding: '0.625rem 0.8rem', border: '1.5px solid #cbd5e1', borderRadius: '8px', fontSize: '0.9rem', outline: 'none' }}
                  placeholder="e.g., School Of Engineering And Technology"
                  value={editDeptName}
                  onChange={(e) => setEditDeptName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.45rem', fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                  Short Name / Code
                </label>
                <input 
                  type="text"
                  className="form-control"
                  style={{ width: '100%', padding: '0.625rem 0.8rem', border: '1.5px solid #cbd5e1', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', textTransform: 'uppercase' }}
                  placeholder="e.g., SOET"
                  value={editDeptCode}
                  onChange={(e) => setEditDeptCode(e.target.value.toUpperCase())}
                />
                <span style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.35rem', display: 'block' }}>
                  Short code for quick identification (e.g., SOET, SMS).
                </span>
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setEditModalDept(null)}
                  disabled={isSavingEdit}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={!editDeptName.trim() || isSavingEdit}
                >
                  {isSavingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Department Admin Permissions Modal ─── */}
      {permModalDept && (
        <div className="modal-overlay">
          <div className="dept-perms-modal">
            <div className="dept-perms-header">
              <div className="dept-perms-icon-box">
                <Shield size={22} />
              </div>
              <div>
                <h3 className="dept-perms-title">Admin Permissions</h3>
                <p className="dept-perms-subtitle">{permModalDept.name}</p>
              </div>
              <button 
                className="dept-perms-close-btn"
                onClick={() => setPermModalDept(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="dept-perms-body">
              <div className="dept-perms-section">
                <label className="dept-perms-section-label">
                  Verified Users Directory Access
                </label>
                <p className="dept-perms-help">
                  Select whether Department Admins of this department are permitted to access verified staff users.
                </p>

                <div className="dept-perms-options-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div 
                    className={`dept-perm-option-card ${permAccess === 'staff' || permAccess === 'both' ? 'selected' : ''}`}
                    onClick={() => setPermAccess('staff')}
                  >
                    <div className="dept-option-radio">
                      {(permAccess === 'staff' || permAccess === 'both') && <Check size={14} />}
                    </div>
                    <div className="dept-option-content">
                      <div className="dept-option-title">
                        <UserCheck size={16} /> Staff Directory Access
                      </div>
                      <p className="dept-option-desc">
                        Admins can view and access the verified list of Department Staff.
                      </p>
                    </div>
                  </div>

                  <div 
                    className={`dept-perm-option-card ${permAccess === 'none' ? 'selected' : ''}`}
                    onClick={() => setPermAccess('none')}
                  >
                    <div className="dept-option-radio">
                      {permAccess === 'none' && <Check size={14} />}
                    </div>
                    <div className="dept-option-content">
                      <div className="dept-option-title">
                        <X size={16} /> No Access
                      </div>
                      <p className="dept-option-desc">
                        Admins cannot access the verified users directory.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {permAccess !== 'none' && (
                <div className="dept-perms-section" style={{ marginTop: '1.25rem' }}>
                  <label className="dept-perms-section-label">
                    Information Addition Privileges
                  </label>
                  <p className="dept-perms-help">
                    Allow Admins to add staff details whose information is not yet in the verified list.
                  </p>

                  <div className="dept-perms-checkboxes">
                    <label className="dept-toggle-row">
                      <input 
                        type="checkbox" 
                        checked={permCanAdd} 
                        onChange={(e) => setPermCanAdd(e.target.checked)} 
                      />
                      <div className="dept-toggle-text">
                        <span className="dept-toggle-title">
                          <UserPlus size={15} /> Allow Adding Info Directly
                        </span>
                        <span className="dept-toggle-desc">
                          Admins can add staff info directly through the directory table.
                        </span>
                      </div>
                    </label>

                    <label className="dept-toggle-row">
                      <input 
                        type="checkbox" 
                        checked={permCanUpload} 
                        onChange={(e) => setPermCanUpload(e.target.checked)} 
                      />
                      <div className="dept-toggle-text">
                        <span className="dept-toggle-title">
                          <FileSpreadsheet size={15} /> Allow Excel / CSV Upload
                        </span>
                        <span className="dept-toggle-desc">
                          Admins can bulk upload spreadsheets of staff for this department.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="dept-perms-footer">
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => setPermModalDept(null)}
                disabled={savingPerms}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={handleSavePermissions}
                disabled={savingPerms}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                {savingPerms ? 'Saving...' : 'Save Permissions'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SuperAdminDepartmentsPage;
