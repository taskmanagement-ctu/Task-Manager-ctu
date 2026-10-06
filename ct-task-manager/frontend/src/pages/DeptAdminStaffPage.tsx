import React, { useEffect, useState } from 'react';
import { 
  Users, 
  Award, 
  ClipboardList, 
  Search,
  UserPlus,
  Mail,
  Phone
} from 'lucide-react';
import { api, User } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './DeptAdminStaffPage.css';

const DeptAdminStaffPage: React.FC = () => {
  const { currentUser: user } = useAuth();
  const [roster, setRoster] = useState<any[]>([]);
  const [directory, setDirectory] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingStaffId, setAddingStaffId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchStaff = async () => {
    try {
      if (!user) return;
      
      // 1. Fetch current staff assignments
      const assignmentsRes = await api.getAdminAssignments(user.id);
      const assignments = assignmentsRes.data.assignments || [];
      setRoster(assignments.map((a: any) => a.staffId).filter(Boolean));

      // 2. Fetch all unassigned staff users to populate directory (filter out those already in any team)
      const usersRes = await api.getUsers({ role: 'staff', limit: 50, unassignedOnly: true });
      let availableStaff = usersRes.data?.users || [];
      
      setDirectory(availableStaff);

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
      // Refresh list after addition
      await fetchStaff();
      // Don't auto-close modal in case they want to add multiple, or maybe we can.
      // We will let it stay open. The user they added will automatically disappear from 'directory' because of the filter in fetchStaff.
    } catch (err) {
      console.error('Failed to add staff', err);
      alert('Failed to add staff to roster.');
    } finally {
      setAddingStaffId(null);
    }
  };

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
            <h2 className="roster-title">Current Roster</h2>
            <div className="roster-controls">
              <div className="roster-search">
                <Search className="roster-search-icon" size={16} />
                <input type="text" placeholder="Filter roster..." />
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: '#64748b' }}>
              Loading roster...
            </div>
          ) : roster.length === 0 ? (
            <div className="roster-empty-state">
              <Users size={40} className="roster-empty-icon" />
              <p className="roster-empty-text">No staff assigned to your department yet. Recruit members from the Directory Pool below.</p>
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
                  {roster.map(staff => (
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
                        <span className="role-tag">{staff.department || 'General'}</span>
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
              <h2 className="roster-title">Directory Pool</h2>
              <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.25rem' }}>Available staff members you can recruit to your team.</p>
            </div>
            <div className="roster-controls">
              <div className="roster-search">
                <Search className="roster-search-icon" size={16} />
                <input type="text" placeholder="Search university staff..." />
              </div>
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
            ) : directory.length === 0 ? (
              <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#64748b' }}>No available staff found.</p>
            ) : (
              directory.map(u => (
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
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <strong style={{ display: 'block', fontSize: '1rem', color: '#0f172a' }}>{u.name}</strong>
                        </div>
                        <span style={{ 
                          fontSize: '0.75rem', padding: '0.125rem 0.5rem', 
                          borderRadius: '9999px', backgroundColor: '#e2e8f0', 
                          color: '#475569', display: 'inline-block', marginTop: '0.25rem',
                          fontWeight: 600
                        }}>ID: {u.universityId || u._id?.toString().substring(0,6)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="dir-card-body" style={{ flexGrow: 1, padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: '#4b5563', fontSize: '0.875rem' }}>
                      <Mail size={14} /> {u.email}
                    </div>
                    {u.phone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: '#4b5563', fontSize: '0.875rem' }}>
                        <Phone size={14} /> {u.phone}
                      </div>
                    )}
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
