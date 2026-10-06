import React, { useEffect, useState } from 'react';
import { 
  Users, 
  Award, 
  ClipboardList, 
  Search,
  UserPlus,
  Mail,
  Phone,
  UserMinus
} from 'lucide-react';
import { api, User } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './DeptAdminStaffPage.css';

interface TeamAssignment {
  _id: string; // Assignment ID
  staffId: User;
  assignedBy?: { name: string };
  isActive: boolean;
  createdAt: string;
}

const SuperAdminTeamPage: React.FC = () => {
  const { currentUser: user } = useAuth();
  const [assignments, setAssignments] = useState<TeamAssignment[]>([]);
  const [directory, setDirectory] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingStaffId, setAddingStaffId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rosterSearch, setRosterSearch] = useState('');
  const [directorySearch, setDirectorySearch] = useState('');

  const fetchTeamData = async () => {
    try {
      if (!user) return;
      setLoading(true);
      setErrorMsg(null);

      // 1. Fetch current staff assignments for Super Admin
      const assignmentsRes = await api.getAdminAssignments(user.id);
      const activeAssignments = (assignmentsRes.data?.assignments || []).filter(
        (a: any) => a.staffId && a.isActive !== false
      );
      setAssignments(activeAssignments);

      // 2. Fetch all unassigned staff users to populate directory pool
      const usersRes = await api.getUsers({ role: 'staff', limit: 100, unassignedOnly: true, status: 'Active' });
      const availableStaff = usersRes.data?.users || [];
      setDirectory(availableStaff);
    } catch (err: any) {
      console.error('Failed to load Super Admin team data', err);
      setErrorMsg(err.message || 'Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamData();
  }, [user]);

  const handleAddStaff = async (staffId: string) => {
    if (!user) return;
    try {
      setAddingStaffId(staffId);
      await api.createAssignment(user.id, staffId);
      await fetchTeamData();
    } catch (err: any) {
      console.error('Failed to recruit staff member', err);
      alert(err.message || 'Failed to recruit staff to Super Admin team.');
    } finally {
      setAddingStaffId(null);
    }
  };

  const handleRemoveStaff = async (assignmentId: string, staffName: string) => {
    if (!window.confirm(`Are you sure you want to remove "${staffName}" from the Super Admin team?`)) {
      return;
    }
    try {
      setRemovingId(assignmentId);
      await api.updateAssignmentStatus(assignmentId, false);
      await fetchTeamData();
    } catch (err: any) {
      console.error('Failed to remove staff from team', err);
      alert(err.message || 'Failed to remove staff from team.');
    } finally {
      setRemovingId(null);
    }
  };

  const filteredRoster = assignments.filter(a => {
    const s = a.staffId;
    if (!s) return false;
    const term = rosterSearch.toLowerCase();
    return (
      (s.name && s.name.toLowerCase().includes(term)) ||
      (s.email && s.email.toLowerCase().includes(term)) ||
      (s.universityId && s.universityId.toLowerCase().includes(term))
    );
  });

  const filteredDirectory = directory.filter(u => {
    const term = directorySearch.toLowerCase();
    return (
      (u.name && u.name.toLowerCase().includes(term)) ||
      (u.email && u.email.toLowerCase().includes(term)) ||
      (u.universityId && u.universityId.toLowerCase().includes(term))
    );
  });

  const activeCount = assignments.filter(a => a.staffId?.isActive !== false).length;

  return (
    <div className="dept-staff-container">
      <div className="dept-staff-main">
        {/* Page Header */}
        <div className="dept-staff-header">
          <div>
            <h1 className="dept-staff-title">Manage Team</h1>
            <p className="dept-staff-subtitle">
              Oversee your dedicated Super Admin team roster, recruit university staff, and coordinate team tasks.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div style={{ padding: '1rem', background: '#fee2e2', color: '#ef4444', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
            <strong>Error: </strong> {errorMsg}
          </div>
        )}

        {/* Overview Widgets */}
        <div className="dept-staff-overview">
          <div className="overview-card">
            <div className="overview-card-header">
              <Users className="overview-icon" size={20} />
              <div className="overview-title">Team Staff</div>
            </div>
            <div className="overview-value">{assignments.length}</div>
            <div className="overview-sub">In Super Admin Team</div>
          </div>

          <div className="overview-card">
            <div className="overview-card-header">
              <Award className="overview-icon" size={20} />
              <div className="overview-title">Active Members</div>
            </div>
            <div className="overview-value">{activeCount}</div>
            <div className="overview-sub">Currently Active</div>
          </div>

          <div className="overview-card">
            <div className="overview-card-header">
              <ClipboardList className="overview-icon" size={20} />
              <div className="overview-title">Directory Pool</div>
            </div>
            <div className="overview-value">{directory.length}</div>
            <div className="overview-sub">Available to recruit</div>
          </div>
        </div>

        {/* Current Roster Section */}
        <div className="roster-section">
          <div className="roster-header">
            <div>
              <h2 className="roster-title">Super Admin Team Roster</h2>
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.2rem 0 0' }}>
                Staff members directly reporting to Super Admin.
              </p>
            </div>
            <div className="roster-controls">
              <div className="roster-search">
                <Search className="roster-search-icon" size={16} />
                <input 
                  type="text" 
                  placeholder="Filter team roster..."
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: '#64748b' }}>
              Loading team roster...
            </div>
          ) : filteredRoster.length === 0 ? (
            <div className="roster-empty-state">
              <Users size={40} className="roster-empty-icon" />
              <p className="roster-empty-text">
                {assignments.length === 0 
                  ? 'No staff assigned to Super Admin team yet. Recruit members from the Directory Pool below.' 
                  : 'No team members matching your search filter.'}
              </p>
            </div>
          ) : (
            <div className="roster-table-container">
              <table className="roster-table">
                <thead>
                  <tr>
                    <th>Staff Member</th>
                    <th>Team & Contact</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRoster.map(assignment => {
                    const staff = assignment.staffId;
                    if (!staff) return null;
                    return (
                      <tr key={assignment._id}>
                        <td>
                          <div className="staff-member-col">
                            <div 
                              className="staff-avatar" 
                              style={{ backgroundImage: `url(https://ui-avatars.com/api/?name=${encodeURIComponent(staff.name)}&background=0f172a&color=ffffff)` }}
                            ></div>
                            <div>
                              <div className="staff-name">{staff.name}</div>
                              <div className="staff-id">ID: {staff.universityId || staff._id?.toString().substring(0, 6)}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                            <span className="role-tag" style={{ background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}>
                              Super Admin Team
                            </span>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{staff.email}</div>
                          {staff.phone && <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{staff.phone}</div>}
                        </td>
                        <td>
                          <span className={`status-badge ${staff.isActive !== false ? 'active' : 'sabbatical'}`}>
                            <div className="status-dot"></div> {staff.isActive !== false ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn-danger-sm"
                            style={{
                              background: '#fee2e2',
                              color: '#dc2626',
                              border: '1px solid #fca5a5',
                              padding: '0.35rem 0.75rem',
                              borderRadius: '6px',
                              cursor: removingId === assignment._id ? 'not-allowed' : 'pointer',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              transition: 'all 0.15s ease'
                            }}
                            disabled={removingId === assignment._id}
                            onClick={() => handleRemoveStaff(assignment._id, staff.name)}
                            title="Remove staff member from Super Admin team"
                          >
                            <UserMinus size={14} />
                            {removingId === assignment._id ? 'Removing...' : 'Remove'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Directory Pool Section */}
        <div className="roster-section" style={{ marginTop: '2rem' }}>
          <div className="roster-header">
            <div>
              <h2 className="roster-title">Directory Pool</h2>
              <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                University staff members currently unassigned and available to recruit to your team.
              </p>
            </div>
            <div className="roster-controls">
              <div className="roster-search">
                <Search className="roster-search-icon" size={16} />
                <input 
                  type="text" 
                  placeholder="Search available staff..." 
                  value={directorySearch}
                  onChange={(e) => setDirectorySearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="dir-card-list" style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
            gap: '1.25rem',
            padding: '1.5rem',
            backgroundColor: 'white'
          }}>
            {loading ? (
              <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#64748b' }}>Loading available staff...</p>
            ) : filteredDirectory.length === 0 ? (
              <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#64748b' }}>
                {directory.length === 0 
                  ? 'No unassigned staff available in the university directory.' 
                  : 'No staff members match your search.'}
              </p>
            ) : (
              filteredDirectory.map(u => (
                <div key={u.id || u._id} className="dir-card" style={{ 
                  display: 'flex', flexDirection: 'column', height: '100%',
                  border: '1px solid #e2e8f0', borderRadius: '0.75rem',
                  overflow: 'hidden', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                }}>
                  <div className="dir-card-header" style={{ padding: '1.25rem', paddingBottom: '0.9rem', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div className="user-avatar" style={{ 
                        width: '42px', 
                        height: '42px',
                        borderRadius: '50%',
                        backgroundImage: `url(https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=e2e8f0&color=1e293b)`,
                        backgroundSize: 'cover'
                      }}></div>
                      <div>
                        <strong style={{ display: 'block', fontSize: '0.98rem', color: '#0f172a' }}>{u.name}</strong>
                        <span style={{ 
                          fontSize: '0.73rem', padding: '0.1rem 0.45rem', 
                          borderRadius: '6px', backgroundColor: '#f1f5f9', 
                          color: '#475569', display: 'inline-block', marginTop: '0.2rem',
                          fontWeight: 600
                        }}>ID: {u.universityId || u._id?.toString().substring(0, 6)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="dir-card-body" style={{ flexGrow: 1, padding: '1.1rem 1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.45rem', color: '#4b5563', fontSize: '0.85rem' }}>
                      <Mail size={14} style={{ color: '#94a3b8' }} /> {u.email}
                    </div>
                    {u.phone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#4b5563', fontSize: '0.85rem' }}>
                        <Phone size={14} style={{ color: '#94a3b8' }} /> {u.phone}
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
                    <button 
                      type="button"
                      className="btn btn-primary" 
                      style={{ 
                        width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', 
                        gap: '0.45rem', padding: '0.55rem', backgroundColor: '#0f172a', 
                        color: 'white', border: 'none', borderRadius: '0.375rem', fontWeight: 600,
                        fontSize: '0.85rem',
                        cursor: addingStaffId === (u.id || u._id) ? 'not-allowed' : 'pointer',
                        opacity: addingStaffId === (u.id || u._id) ? 0.7 : 1
                      }}
                      disabled={addingStaffId === (u.id || u._id)}
                      onClick={() => handleAddStaff(u.id || u._id || '')}
                    >
                      <UserPlus size={15} /> 
                      {addingStaffId === (u.id || u._id) ? 'Recruiting...' : 'Recruit to Team'}
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

export default SuperAdminTeamPage;
