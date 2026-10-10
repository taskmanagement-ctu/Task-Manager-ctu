import React, { useEffect, useState, useMemo } from 'react';
import { 
  Users, 
  Award, 
  ClipboardList, 
  Search,
  UserPlus,
  Mail,
  Phone,
  Building2,
  X,
  RotateCcw
} from 'lucide-react';
import { api, User, Department } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './DeptAdminStaffPage.css';

const DeptAdminStaffPage: React.FC = () => {
  const { currentUser: user } = useAuth();
  const [roster, setRoster] = useState<any[]>([]);
  const [directory, setDirectory] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingStaffId, setAddingStaffId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rosterSearch, setRosterSearch] = useState('');
  const [directorySearch, setDirectorySearch] = useState('');
  const [rosterDeptFilter, setRosterDeptFilter] = useState('All');
  const [directoryDeptFilter, setDirectoryDeptFilter] = useState('All');

  const fetchStaff = async () => {
    try {
      if (!user) return;
      
      // 1. Fetch current staff assignments
      const assignmentsRes = await api.getAdminAssignments(user.id);
      const assignments = assignmentsRes.data.assignments || [];
      setRoster(assignments.map((a: any) => a.staffId).filter(Boolean));

      // 2. Fetch all unassigned staff users to populate directory
      const usersRes = await api.getUsers({ role: 'staff', limit: 200, unassignedOnly: true, status: 'Active' });
      let availableStaff = usersRes.data?.users || [];
      setDirectory(availableStaff);

      // 3. Fetch departments
      try {
        const deptRes = await api.getDepartments();
        if (deptRes.success && deptRes.data?.departments) {
          setDepartments(deptRes.data.departments);
        }
      } catch (deptErr) {
        console.error('Failed to load departments', deptErr);
      }

    } catch (err: any) {
      console.error('Failed to load staff data', err);
      setErrorMsg(err.message || 'Failed to load staff data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [user]);

  const handleAddStaff = async (staffId: string) => {
    if (!user) return;
    try {
      setAddingStaffId(staffId);
      await api.createAssignment(user.id, staffId);
      await fetchStaff();
    } catch (err) {
      console.error('Failed to add staff', err);
      alert('Failed to add staff to roster.');
    } finally {
      setAddingStaffId(null);
    }
  };

  // Unique sorted list of departments for directory filter
  const availableDirectoryDepartments = useMemo(() => {
    const set = new Set<string>();
    departments.forEach(d => {
      if (d.name && d.name.trim()) set.add(d.name.trim());
    });
    directory.forEach(u => {
      if (u.department && u.department.trim()) set.add(u.department.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [departments, directory]);

  // Unique sorted list of departments for roster filter
  const availableRosterDepartments = useMemo(() => {
    const set = new Set<string>();
    departments.forEach(d => {
      if (d.name && d.name.trim()) set.add(d.name.trim());
    });
    roster.forEach(r => {
      if (r.department && r.department.trim()) set.add(r.department.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [departments, roster]);

  const filteredRoster = roster.filter(r => {
    const term = rosterSearch.trim().toLowerCase();
    const matchesSearch = !term || (
      (r.name && r.name.toLowerCase().includes(term)) ||
      (r.email && r.email.toLowerCase().includes(term)) ||
      (r.universityId && r.universityId.toLowerCase().includes(term)) ||
      (r.department && r.department.toLowerCase().includes(term))
    );

    const matchesDept = 
      rosterDeptFilter === 'All'
        ? true
        : rosterDeptFilter === 'Unassigned'
          ? (!r.department || r.department.trim() === '' || r.department.toLowerCase() === 'unassigned')
          : (r.department && r.department.toLowerCase() === rosterDeptFilter.toLowerCase());

    return matchesSearch && matchesDept;
  });

  const filteredDirectory = directory.filter(u => {
    const term = directorySearch.trim().toLowerCase();
    const matchesSearch = !term || (
      (u.name && u.name.toLowerCase().includes(term)) ||
      (u.email && u.email.toLowerCase().includes(term)) ||
      (u.universityId && u.universityId.toLowerCase().includes(term)) ||
      (u.department && u.department.toLowerCase().includes(term))
    );

    const matchesDept = 
      directoryDeptFilter === 'All'
        ? true
        : directoryDeptFilter === 'Unassigned'
          ? (!u.department || u.department.trim() === '' || u.department.toLowerCase() === 'unassigned')
          : (u.department && u.department.toLowerCase() === directoryDeptFilter.toLowerCase());

    return matchesSearch && matchesDept;
  });

  const activeCount = roster.filter(r => r.isActive !== false).length;

  return (
    <div className="dept-staff-container">
      {/* Main Content */}
      <div className="dept-staff-main">
        
        {/* Page Header */}
        <div className="dept-staff-header">
          <div>
            <h1 className="dept-staff-title">Manage Team</h1>
            <p className="dept-staff-subtitle">Oversee department roster, assign roles, and recruit university staff.</p>
          </div>
        </div>

        {/* Overview Widgets */}
        <div className="dept-staff-overview">
          <div className="overview-card">
            <div className="overview-card-header">
              <Users className="overview-icon" size={20} />
              <div className="overview-title">Total Staff</div>
            </div>
            <div className="overview-value">
              {roster.length}
            </div>
            <div className="overview-sub">Total assigned</div>
          </div>

          <div className="overview-card">
            <div className="overview-card-header">
              <Award className="overview-icon" size={20} />
              <div className="overview-title">Active Members</div>
            </div>
            <div className="overview-value">
              {activeCount}
            </div>
            <div className="overview-sub">Currently Active</div>
          </div>

          <div className="overview-card">
            <div className="overview-card-header">
              <ClipboardList className="overview-icon" size={20} />
              <div className="overview-title">Directory Pool</div>
            </div>
            <div className="overview-value">
              {directory.length}
            </div>
            <div className="overview-sub">Available to recruit</div>
          </div>
        </div>

        {/* Current Roster Section */}
        <div className="roster-section">
          <div className="roster-header">
            <div>
              <h2 className="roster-title">
                Current Roster
                <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b', marginLeft: '0.5rem' }}>
                  ({filteredRoster.length}{filteredRoster.length !== roster.length ? ` of ${roster.length}` : ''})
                </span>
              </h2>
            </div>
            <div className="roster-controls">
              {availableRosterDepartments.length > 0 && (
                <div className="roster-filter-select-wrapper">
                  <Building2 size={15} className="roster-filter-icon" />
                  <select
                    className="roster-dept-select"
                    value={rosterDeptFilter}
                    onChange={(e) => setRosterDeptFilter(e.target.value)}
                    title="Filter roster by Department"
                  >
                    <option value="All">All Departments</option>
                    {availableRosterDepartments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                    <option value="Unassigned">Unassigned (No Dept)</option>
                  </select>
                </div>
              )}

              <div className="roster-search">
                <Search className="roster-search-icon" size={16} />
                <input 
                  type="text" 
                  placeholder="Filter roster..." 
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                />
                {rosterSearch && (
                  <button
                    type="button"
                    className="roster-search-clear-btn"
                    onClick={() => setRosterSearch('')}
                    title="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {(rosterDeptFilter !== 'All' || rosterSearch) && (
                <button
                  type="button"
                  className="roster-clear-filter-btn"
                  onClick={() => {
                    setRosterDeptFilter('All');
                    setRosterSearch('');
                  }}
                  title="Reset filters"
                >
                  <RotateCcw size={13} />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: '#64748b' }}>
              Loading roster...
            </div>
          ) : filteredRoster.length === 0 ? (
            <div className="roster-empty-state">
              <Users size={40} className="roster-empty-icon" />
              <p className="roster-empty-text">
                {roster.length === 0 
                  ? 'No staff assigned to your department yet. Recruit members from the Directory Pool below.'
                  : 'No staff members match the selected filters.'}
              </p>
            </div>
          ) : (
            <div className="roster-table-container">
              <table className="roster-table">
                <thead>
                  <tr>
                    <th>Staff Member</th>
                    <th>Role / Dept</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRoster.map(staff => (
                    <tr key={staff._id || staff.id}>
                      <td>
                        <div className="staff-member-col">
                          <div 
                            className="staff-avatar" 
                            style={{ backgroundImage: `url(https://ui-avatars.com/api/?name=${encodeURIComponent(staff.name)}&background=e2e8f0)` }}
                          ></div>
                          <div>
                            <div className="staff-name">{staff.name}</div>
                            <div className="staff-id">ID: {staff.universityId || staff._id?.toString().substring(0,6)}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="role-title">Staff</div>
                        {staff.department ? (
                          <span className="dir-card-dept-badge">
                            <Building2 size={11} /> {staff.department}
                          </span>
                        ) : (
                          <span className="dir-card-no-dept-badge">
                            No Dept
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`status-badge ${staff.isActive !== false ? 'active' : 'sabbatical'}`}>
                          <div className="status-dot"></div> {staff.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Directory Pool Section */}
        <div className="roster-section" style={{ marginTop: '2rem' }}>
          <div className="roster-header">
            <div>
              <h2 className="roster-title">
                Directory Pool
                <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b', marginLeft: '0.5rem' }}>
                  ({filteredDirectory.length}{filteredDirectory.length !== directory.length ? ` of ${directory.length}` : ''})
                </span>
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.25rem' }}>Available staff members you can recruit to your team.</p>
            </div>
            <div className="roster-controls">
              {/* Department Filter (Where user specified in screenshot) */}
              <div className="roster-filter-select-wrapper">
                <Building2 size={15} className="roster-filter-icon" />
                <select
                  className="roster-dept-select"
                  value={directoryDeptFilter}
                  onChange={(e) => setDirectoryDeptFilter(e.target.value)}
                  title="Filter directory by Department"
                >
                  <option value="All">All Departments</option>
                  {availableDirectoryDepartments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                  <option value="Unassigned">Unassigned (No Dept)</option>
                </select>
              </div>

              {/* Search */}
              <div className="roster-search">
                <Search className="roster-search-icon" size={16} />
                <input 
                  type="text" 
                  placeholder="Search university staff..." 
                  value={directorySearch}
                  onChange={(e) => setDirectorySearch(e.target.value)}
                />
                {directorySearch && (
                  <button
                    type="button"
                    className="roster-search-clear-btn"
                    onClick={() => setDirectorySearch('')}
                    title="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Reset Button */}
              {(directoryDeptFilter !== 'All' || directorySearch) && (
                <button
                  type="button"
                  className="roster-clear-filter-btn"
                  onClick={() => {
                    setDirectoryDeptFilter('All');
                    setDirectorySearch('');
                  }}
                  title="Reset directory filters"
                >
                  <RotateCcw size={13} />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          <div className="dir-card-list" style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1.5rem',
            padding: '1.5rem',
            backgroundColor: 'white'
          }}>
            {errorMsg ? (
              <div style={{ gridColumn: '1 / -1', padding: '1rem', background: '#fee2e2', color: '#ef4444', borderRadius: '0.5rem' }}>
                <strong>Error: </strong> {errorMsg}
              </div>
            ) : loading ? (
              <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#64748b' }}>Loading available staff...</p>
            ) : filteredDirectory.length === 0 ? (
              <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#64748b' }}>
                {directory.length === 0 
                  ? 'No available staff found.'
                  : (directoryDeptFilter !== 'All' || directorySearch)
                    ? 'No staff members match the selected filters.'
                    : 'No staff members match your search.'}
              </p>
            ) : (
              filteredDirectory.map(u => (
                <div key={u.id || u._id} className="dir-card" style={{ 
                  display: 'flex', flexDirection: 'column', height: '100%',
                  border: '1px solid #e2e8f0', borderRadius: '0.75rem',
                  overflow: 'hidden', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                  <div className="dir-card-header" style={{ padding: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div className="user-avatar" style={{ 
                        width: '40px', 
                        height: '40px',
                        borderRadius: '50%',
                        backgroundImage: `url(https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=e2e8f0&color=1e293b)`,
                        backgroundSize: 'cover'
                      }}></div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <strong style={{ display: 'block', fontSize: '1rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</strong>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                          <span style={{ 
                            fontSize: '0.75rem', padding: '0.125rem 0.5rem', 
                            borderRadius: '9999px', backgroundColor: '#e2e8f0', 
                            color: '#475569', display: 'inline-block',
                            fontWeight: 600
                          }}>ID: {u.universityId || u._id?.toString().substring(0,6)}</span>
                          {u.department ? (
                            <span className="dir-card-dept-badge">
                              <Building2 size={11} /> {u.department}
                            </span>
                          ) : (
                            <span className="dir-card-no-dept-badge">
                              No Dept
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="dir-card-body" style={{ flexGrow: 1, padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: '#4b5563', fontSize: '0.875rem' }}>
                      <Mail size={14} style={{ flexShrink: 0 }} /> 
                      <span style={{ wordBreak: 'break-all' }}>{u.email}</span>
                    </div>
                    {u.phone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: '#4b5563', fontSize: '0.875rem' }}>
                        <Phone size={14} style={{ flexShrink: 0 }} /> {u.phone}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#4b5563', fontSize: '0.875rem' }}>
                      <Building2 size={14} style={{ flexShrink: 0 }} /> 
                      <span style={{ color: u.department ? '#1e293b' : '#94a3b8', fontWeight: u.department ? 500 : 400 }}>
                        {u.department || 'No department assigned'}
                      </span>
                    </div>
                  </div>
                  <div style={{ padding: '1rem', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                    <button 
                      className="btn btn-primary" 
                      style={{ 
                        width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', 
                        gap: '0.5rem', padding: '0.625rem', backgroundColor: '#3b82f6', 
                        color: 'white', border: 'none', borderRadius: '0.375rem', fontWeight: 600,
                        cursor: addingStaffId === (u.id || u._id) ? 'not-allowed' : 'pointer',
                        opacity: addingStaffId === (u.id || u._id) ? 0.7 : 1
                      }}
                      disabled={addingStaffId === (u.id || u._id)}
                      onClick={() => handleAddStaff(u.id || u._id || '')}
                    >
                      <UserPlus size={16} /> 
                      {addingStaffId === (u.id || u._id) ? 'Adding...' : 'Add to Team'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default DeptAdminStaffPage;
