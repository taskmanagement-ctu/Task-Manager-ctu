import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  UserCheck, 
  Briefcase, 
  Building, 
  Shield, 
  Users as UsersIcon, 
  ClipboardCheck,
  ClipboardList,
  Clock,
  CheckCircle,
  AlertTriangle,
  Filter,
  ChevronDown,
  ArrowUp,
  ShieldAlert,
  Layers
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { calculateUrgency, getUrgencyCardStyle, getUrgencyColor } from '../utils/taskUrgency';
import TaskModal from '../components/TaskModal';
import TaskChatDrawer from '../components/TaskChatDrawer';
import './SuperAdminDashboard.css';

const SuperAdminPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [chatTask, setChatTask] = useState<any | null>(null);

  const [userStats, setUserStats] = useState<{
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    superAdmins: number;
    departmentAdmins: number;
    staff: number;
    superAdminList?: any[];
  }>({
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    superAdmins: 0,
    departmentAdmins: 0,
    staff: 0,
    superAdminList: []
  });

  const [taskMetrics, setTaskMetrics] = useState({
    total: 0,
    pending: 0,
    completed: 0,
    overdue: 0 // Cannot fetch overdue easily without endpoint
  });

  const [recentTasks, setRecentTasks] = useState<any[]>([]);
  const [tasksAwaitingReview, setTasksAwaitingReview] = useState<any[]>([]);
  const [delegatedAdminTasks, setDelegatedAdminTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Department/School filter
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('All');
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
  const deptDropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  React.useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (deptDropdownRef.current && !deptDropdownRef.current.contains(e.target as Node)) {
        setIsDeptDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        // Fetch User Stats
        const userStatsRes = await api.getUserStats();
        if (userStatsRes.success) {
          setUserStats(userStatsRes.data);
        }

        // Fetch Task Metrics (Counts)
        const [totalRes, pendingRes, completedRes] = await Promise.all([
          api.getTasks({ limit: 1 }),
          api.getTasks({ limit: 1, status: 'pending' }),
          api.getTasks({ limit: 1, status: 'completed' })
        ]);

        setTaskMetrics({
          total: totalRes.data.pagination.total,
          pending: pendingRes.data.pagination.total,
          completed: completedRes.data.pagination.total,
          overdue: 0 // Placeholder
        });

        // Fetch Departments
        try {
          const deptRes = await api.getDepartments();
          if (deptRes.success) {
            setDepartments(deptRes.data.departments || []);
          }
        } catch (e) {
          console.error('Failed to fetch departments:', e);
        }

        // Fetch Tasks Awaiting Review
        const reviewRes = await api.getTasks({ limit: 5, status: 'submitted_for_review' });
        setTasksAwaitingReview(reviewRes.data.tasks);

        // Fetch Recent Activity (Latest tasks — fetch more so filter has enough to show)
        const recentRes = await api.getTasks({ limit: 50 });
        setRecentTasks(recentRes.data.tasks);

        // Fetch Tasks by Delegated Super Admins (for Primary Super Admin 10001 institutional oversight)
        if (currentUser?.universityId === '10001') {
          try {
            const delegatedRes = await api.getTasks({ limit: 10, delegatedAdminOnly: 'true' });
            if (delegatedRes?.data?.tasks) {
              setDelegatedAdminTasks(delegatedRes.data.tasks);
            }
          } catch (err) {
            console.error('Failed to fetch delegated super admin tasks:', err);
          }
        }

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const handleTaskClick = (task: any) => {
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'approved': return 'green';
      case 'rejected': return 'red';
      case 'in_progress':
      case 'submitted_for_review': return 'yellow';
      default: return 'gray';
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'completed':
      case 'approved': return 'approved';
      case 'rejected': return 'rejected';
      case 'in_progress':
      case 'submitted_for_review': return 'inprogress';
      default: return 'pending';
    }
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year}, ${hours}:${mins}`;
  };

  // Filter recent tasks by department
  const filteredRecentTasks = selectedDept === 'All'
    ? recentTasks.slice(0, 10)
    : recentTasks.filter(t => {
        const assigneeDept = t.assignedTo?.department || t.delegatedTo?.department;
        return assigneeDept === selectedDept;
      }).slice(0, 10);

  return (
    <div className="sa-dashboard-container">
      
      {/* TOP ROW METRICS */}
      <div className="sa-metrics-row">
        <div className="sa-metric-card">
          <div className="sa-metric-header">
            <span className="sa-metric-title">Total Users</span>
            <Users className="sa-metric-icon" size={18} />
          </div>
          <div className="sa-metric-value">{loading ? '...' : userStats.totalUsers}</div>
          <div className="sa-metric-trend sa-trend-up">
            <ArrowUp size={14} /> All registered users
          </div>
        </div>
        
        <div className="sa-metric-card">
          <div className="sa-metric-header">
            <span className="sa-metric-title">Active Users</span>
            <UserCheck className="sa-metric-icon" size={18} />
          </div>
          <div className="sa-metric-value">{loading ? '...' : userStats.activeUsers}</div>
          <div className="sa-metric-progress-bar">
            <div className="sa-metric-progress-fill" style={{ width: `${userStats.totalUsers > 0 ? (userStats.activeUsers / userStats.totalUsers) * 100 : 0}%` }}></div>
          </div>
        </div>

        <div className="sa-metric-card">
          <div className="sa-metric-header">
            <span className="sa-metric-title">Staff</span>
            <Briefcase className="sa-metric-icon" size={18} />
          </div>
          <div className="sa-metric-value">{loading ? '...' : userStats.staff}</div>
        </div>

        <div className="sa-metric-card">
          <div className="sa-metric-header">
            <span className="sa-metric-title">Dept Admins</span>
            <Building className="sa-metric-icon" size={18} />
          </div>
          <div className="sa-metric-value">{loading ? '...' : userStats.departmentAdmins}</div>
        </div>

        <div 
          className="sa-metric-card" 
          style={{ cursor: 'pointer' }} 
          onClick={() => navigate('/super-admin/users')}
          title="Manage Super Administrators"
        >
          <div className="sa-metric-header">
            <span className="sa-metric-title">Super Admins</span>
            <Shield className="sa-metric-icon" size={18} />
          </div>
          <div className="sa-metric-value">
            {loading ? '...' : (currentUser?.universityId === '10001' ? userStats.superAdmins : (userStats.superAdmins > 1 ? 1 : userStats.superAdmins))}
          </div>
          <div style={{ color: '#6366f1', fontSize: '0.74rem', marginTop: '0.35rem', fontWeight: 600 }}>
            {currentUser?.universityId === '10001'
              ? (userStats.superAdmins > 1 ? `1 Primary • ${userStats.superAdmins - 1} Delegated` : '1 Primary (10001)')
              : 'Active System Super Admin'}
          </div>
        </div>
      </div>

      {/* MIDDLE ROW */}
      <div className="sa-middle-row" style={{ gridTemplateColumns: '1fr' }}>

        {/* Tasks Awaiting Review */}
        <div className="sa-review-card">
          <div className="sa-review-header">
            <div className="sa-review-title-group">
              <div className="sa-review-title">
                <ClipboardCheck className="sa-review-icon" size={20} /> Tasks Awaiting Review
              </div>
              <div className="sa-review-desc">High priority tasks requiring admin approval.</div>
            </div>
            <div className="sa-review-count">{loading ? '...' : tasksAwaitingReview.length}</div>
          </div>

          <div className="sa-review-list">
            {tasksAwaitingReview.length > 0 ? (
              tasksAwaitingReview.map(task => {
                const urgency = calculateUrgency(task);
                const cardStyle = getUrgencyCardStyle(urgency);
                const urgencyColor = getUrgencyColor(urgency);
                
                return (
                <div 
                  key={task._id} 
                  className="sa-review-item" 
                  style={{ backgroundColor: cardStyle.backgroundColor, borderLeft: cardStyle.borderLeft, cursor: 'pointer' }}
                  onClick={() => handleTaskClick(task)}
                >
                  <div className="sa-review-info">
                    <div className="sa-review-item-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {task.title}
                    </div>
                    <div className="sa-review-meta">
                      <span><UsersIcon size={14} /> Assignee: {task.assignedTo?.name || 'Unassigned'}</span>
                      <span style={{ color: urgencyColor }}><Clock size={14} /> Deadline: {new Date(task.deadline).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <span className="sa-badge-inprogress" style={{ background: '#e0e7ff', color: '#3730a3' }}>Needs Review</span>
                </div>
              )})
            ) : (
              <div style={{ color: '#64748b', fontSize: '0.9rem' }}>No tasks currently awaiting review.</div>
            )}
          </div>

          <a href="#" className="sa-view-all-link" onClick={(e) => { e.preventDefault(); navigate('/super-admin/tasks'); }}>
            View all pending reviews &rarr;
          </a>
        </div>

        {/* Delegated Super Admins' Tasks Oversight Card (Visible to Primary Super Admin 10001) */}
        {currentUser?.universityId === '10001' && (
          <div className="sa-review-card" style={{ marginTop: '1.25rem', borderTop: '3px solid #7c3aed' }}>
            <div className="sa-review-header">
              <div className="sa-review-title-group">
                <div className="sa-review-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#4c1d95' }}>
                  <ShieldAlert size={20} color="#7c3aed" /> Tasks Created &amp; Assigned by Other Super Admins
                </div>
                <div className="sa-review-desc">
                  Institutional oversight of tasks created by delegated Super Administrators across university departments.
                </div>
              </div>
              <div className="sa-review-count" style={{ backgroundColor: '#ede9fe', color: '#6d28d9' }}>
                {loading ? '...' : delegatedAdminTasks.length}
              </div>
            </div>

            <div className="sa-review-list">
              {(() => {
                const parentIds = new Set(delegatedAdminTasks.filter((t: any) => !t.isSubtask).map((t: any) => (t._id || t.id)?.toString()));
                const assembledDelegatedTasks = delegatedAdminTasks.filter((t: any) => {
                  if (!t.isSubtask) return true;
                  const pId = (t.parentTaskId?._id || t.parentTaskId)?.toString();
                  return !parentIds.has(pId);
                });

                if (assembledDelegatedTasks.length === 0) {
                  return (
                    <div style={{ color: '#64748b', fontSize: '0.9rem', padding: '1rem 0' }}>
                      No tasks have been created by delegated super admins yet.
                    </div>
                  );
                }

                return assembledDelegatedTasks.map(task => {
                  const urgency = calculateUrgency(task);
                  const cardStyle = getUrgencyCardStyle(urgency);
                  const urgencyColor = getUrgencyColor(urgency);
                  const subCount = task.subtasks?.length || task.subtaskCount || 0;
                  const isDeck = !task.isSubtask && subCount > 0;

                  return (
                    <div key={task._id} className={`sa-deck-container ${isDeck ? 'is-deck' : ''}`}>
                      {isDeck && (
                        <>
                          <div className="sa-deck-layer-2" />
                          <div className="sa-deck-layer-1" />
                        </>
                      )}
                      <div 
                        className={`sa-review-item ${isDeck ? 'sa-deck-item' : ''}`} 
                        style={{ backgroundColor: cardStyle.backgroundColor, borderLeft: '4px solid #7c3aed', cursor: 'pointer' }}
                        onClick={() => handleTaskClick(task)}
                      >
                        <div className="sa-review-info">
                          <div className="sa-review-item-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, flexWrap: 'wrap' }}>
                            <span style={{ color: '#7c3aed', fontWeight: 700 }}>#{task.taskId || ''}</span>
                            <span>{task.title}</span>
                            {isDeck && (
                              <span className="sa-deck-pill" title={`Assembled Card Deck with ${subCount} subtasks stacked backward`}>
                                <Layers size={11} /> {subCount} Subtasks Deck
                              </span>
                            )}
                          </div>
                          <div className="sa-review-meta" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#5b21b6', fontWeight: 600 }}>
                              <ShieldAlert size={13} /> Created by: {task.createdBy?.name || 'Delegated Admin'} ({task.createdBy?.universityId})
                            </span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                              <UsersIcon size={13} /> Assigned to: {task.assignedTo?.name || 'Unassigned'} {task.assignedTo?.universityId ? `(${task.assignedTo.universityId})` : ''} {task.assignedTo?.department ? `• ${task.assignedTo.department}` : ''}
                            </span>
                            <span style={{ color: urgencyColor, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                              <Clock size={13} /> Due: {new Date(task.deadline).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <span className="sa-badge-inprogress" style={{ background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe', textTransform: 'capitalize' }}>
                          {task.status?.replace('_', ' ') || 'Pending'}
                        </span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            <a 
              href="#" 
              className="sa-view-all-link" 
              style={{ color: '#7c3aed' }}
              onClick={(e) => { e.preventDefault(); navigate('/super-admin/tasks?delegatedAdminOnly=true'); }}
            >
              View all tasks by other Super Admins &rarr;
            </a>
          </div>
        )}
      </div>

      {/* BOTTOM ROW */}
      <div className="sa-bottom-row">
        
        {/* Task Metrics */}
        <div className="sa-task-metrics">
          <div className="sa-tm-card">
            <div className="sa-tm-info">
              <span className="sa-tm-title">Total Tasks</span>
              <span className="sa-tm-value">{loading ? '...' : taskMetrics.total}</span>
            </div>
            <div className="sa-tm-icon"><ClipboardList size={20} /></div>
          </div>

          <div className="sa-tm-card">
            <div className="sa-tm-info">
              <span className="sa-tm-title">Pending</span>
              <span className="sa-tm-value">{loading ? '...' : taskMetrics.pending}</span>
            </div>
            <div className="sa-tm-icon"><Clock size={20} /></div>
          </div>

          <div className="sa-tm-card success">
            <div className="sa-tm-info">
              <span className="sa-tm-title">Completed</span>
              <span className="sa-tm-value">{loading ? '...' : taskMetrics.completed}</span>
            </div>
            <div className="sa-tm-icon"><CheckCircle size={20} /></div>
          </div>

          <div className="sa-tm-card danger">
            <div className="sa-tm-info">
              <span className="sa-tm-title">Overdue</span>
              <span className="sa-tm-value">{loading ? '...' : taskMetrics.overdue}</span>
            </div>
            <div className="sa-tm-icon"><AlertTriangle size={20} /></div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="sa-activity-card">
          <div className="sa-activity-header">
            <h2 className="sa-activity-title">Recent Activity</h2>
            <div className="sa-activity-actions" ref={deptDropdownRef} style={{ position: 'relative' }}>
              <button 
                className="sa-icon-btn" 
                onClick={() => setIsDeptDropdownOpen(!isDeptDropdownOpen)}
                style={{ 
                  width: 'auto', 
                  padding: '0.4rem 0.6rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.4rem',
                  backgroundColor: selectedDept !== 'All' ? '#e0e7ff' : '#f1f5f9',
                  color: selectedDept !== 'All' ? '#3730a3' : '#475569',
                  fontWeight: selectedDept !== 'All' ? 600 : 400,
                  fontSize: '0.8rem',
                  borderRadius: '6px'
                }}
              >
                <Filter size={14} />
                {selectedDept !== 'All' ? selectedDept : 'School'}
                <ChevronDown size={14} style={{ transform: isDeptDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
              
              {isDeptDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '0.4rem',
                  width: '220px',
                  maxHeight: '280px',
                  overflowY: 'auto',
                  backgroundColor: '#ffffff',
                  borderRadius: '8px',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                  border: '1px solid #e2e8f0',
                  zIndex: 100,
                  padding: '0.4rem 0'
                }}>
                  <div 
                    style={{ 
                      padding: '0.5rem 1rem', 
                      cursor: 'pointer', 
                      fontSize: '0.85rem',
                      fontWeight: selectedDept === 'All' ? 600 : 400,
                      color: selectedDept === 'All' ? '#3730a3' : '#334155',
                      backgroundColor: selectedDept === 'All' ? '#e0e7ff' : 'transparent',
                      transition: 'background-color 0.15s'
                    }}
                    onClick={() => { setSelectedDept('All'); setIsDeptDropdownOpen(false); }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = selectedDept === 'All' ? '#e0e7ff' : '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = selectedDept === 'All' ? '#e0e7ff' : 'transparent')}
                  >
                    All Schools
                  </div>
                  {departments.map(dept => (
                    <div 
                      key={dept._id}
                      style={{ 
                        padding: '0.5rem 1rem', 
                        cursor: 'pointer', 
                        fontSize: '0.85rem',
                        fontWeight: selectedDept === dept.name ? 600 : 400,
                        color: selectedDept === dept.name ? '#3730a3' : '#334155',
                        backgroundColor: selectedDept === dept.name ? '#e0e7ff' : 'transparent',
                        transition: 'background-color 0.15s'
                      }}
                      onClick={() => { setSelectedDept(dept.name); setIsDeptDropdownOpen(false); }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = selectedDept === dept.name ? '#e0e7ff' : '#f8fafc')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = selectedDept === dept.name ? '#e0e7ff' : 'transparent')}
                    >
                      {dept.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table className="sa-activity-table">
              <thead>
                <tr>
                  <th>Task Name</th>
                  <th>Assignee</th>
                  <th>Status</th>
                  <th>Deadline</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecentTasks.length > 0 ? (
                  filteredRecentTasks.map(task => {
                    const urgency = calculateUrgency(task);
                    const cardStyle = getUrgencyCardStyle(urgency);
                    
                    return (
                    <tr 
                      key={task._id} 
                      style={{ backgroundColor: cardStyle.backgroundColor, cursor: 'pointer' }}
                      onClick={() => handleTaskClick(task)}
                    >
                      <td className="sa-task-name-cell" style={{ borderLeft: cardStyle.borderLeft, paddingLeft: '1rem' }}>
                        <div className={`sa-status-indicator ${getStatusColor(task.status)}`}></div>
                        <span className="sa-task-name-text">{task.title}</span>
                      </td>
                      <td>
                        <div className="sa-assignee-cell">
                          <div className="sa-assignee-avatar">
                            {task.assignedTo?.name ? task.assignedTo.name.charAt(0) : '?'}
                          </div>
                          <span className="sa-assignee-id">{task.assignedTo?.name || 'Unassigned'} {task.assignedTo?.universityId ? `(${task.assignedTo.universityId})` : ''}</span>
                        </div>
                      </td>
                      <td><span className={`sa-status-badge ${getStatusBadgeClass(task.status)}`}>{task.status.replace(/_/g, ' ')}</span></td>
                      <td className="sa-date-text">{formatDate(task.deadline)}</td>
                    </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: '#64748b' }}>
                      {selectedDept !== 'All' ? `No tasks found for ${selectedDept}` : 'No recent tasks found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {recentTasks.length > 0 && (
            <button className="sa-load-more" onClick={() => navigate('/super-admin/tasks')}>
              View All Tasks <ChevronDown size={16} />
            </button>
          )}
        </div>

      </div>

      {/* Task Modal */}
      {isTaskModalOpen && selectedTask && (
        <TaskModal
          task={selectedTask}
          onClose={() => {
            setIsTaskModalOpen(false);
            setSelectedTask(null);
          }}
          onRefresh={() => {
            // Re-fetch data on refresh
            api.getTasks({ limit: 5, status: 'submitted_for_review' }).then(res => setTasksAwaitingReview(res.data.tasks));
            api.getTasks({ limit: 5 }).then(res => setRecentTasks(res.data.tasks));
            api.getTasks({ limit: 1, status: 'pending' }).then(res => setTaskMetrics(prev => ({ ...prev, pending: res.data.pagination.total })));
            api.getTasks({ limit: 1, status: 'completed' }).then(res => setTaskMetrics(prev => ({ ...prev, completed: res.data.pagination.total })));
          }}
          currentUser={currentUser}
          departments={departments}
          onOpenChat={(t) => setChatTask(t)}
        />
      )}

      {/* Task-Specific Chat Drawer */}
      <TaskChatDrawer
        task={chatTask}
        currentUser={currentUser}
        isOpen={!!chatTask}
        onClose={() => setChatTask(null)}
      />
    </div>
  );
};

export default SuperAdminPage;

