import React, { useEffect, useState, useMemo } from 'react';
import { 
  PieChart, 
  AlertCircle, 
  Activity,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, Task } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { calculateUrgency } from '../utils/taskUrgency';
import TaskCard from '../components/TaskCard';
import TaskModal from '../components/TaskModal';
import TaskChatDrawer from '../components/TaskChatDrawer';
import './AdminPage.css';

const AdminPage: React.FC = () => {
  const { currentUser: user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [chatTask, setChatTask] = useState<any | null>(null);

  const fetchData = async () => {
    try {
      if (!user) return;
      const adminId = user.id || (user as any)._id || '';
      const [tasksRes, teamRes] = await Promise.all([
        api.getTasks({}),
        adminId ? api.getAdminAssignments(adminId) : Promise.resolve({ success: true, data: { assignments: [] } })
      ]);
      
      // Filter tasks that belong to the department
      // For now, if the user is dept admin, they created them or assigned them.
      // The backend might already filter them, but let's be safe if it doesn't.
      setTasks(tasksRes.data.tasks || []);
      
      const assignments = teamRes.data?.assignments || [];
      // Map assignments to staff users
      setTeam(assignments.map(a => a.staffId).filter(Boolean));
    } catch (err) {
      console.error('Failed to fetch dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const assembledTasks = useMemo(() => {
    const parentTaskIds = new Set(
      tasks
        .filter((t: any) => !t.isSubtask && !t.parentTaskId)
        .map((t: any) => (t._id || t.id)?.toString())
    );

    return tasks.filter((t: any) => {
      const isSub = Boolean(t.isSubtask || t.parentTaskId);
      if (!isSub) return true;
      const pId = (t.parentTaskId?._id || t.parentTaskId)?.toString();
      return !parentTaskIds.has(pId);
    });
  }, [tasks]);

  // Calculate real stats
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'approved').length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  const activeTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'approved');
  const highPriorityTasks = activeTasks.filter(t => calculateUrgency(t) === 'RED' || calculateUrgency(t) === 'OVERDUE');
  const pendingReviewTasks = tasks.filter(t => t.status === 'submitted_for_review' && t.reviewStage === 'department_admin');
  const highPriorityPct = activeTasks.length > 0 ? (highPriorityTasks.length / activeTasks.length) * 100 : 0;
  
  return (
    <div className="admin-dashboard">
      <div className="admin-main-column">
        
        {/* Top Widgets */}
        <div className="admin-widgets-grid">
          <div className="admin-widget">
            <div className="admin-widget-header">
              <div className="admin-widget-title">Completion Rate</div>
              <PieChart className="admin-widget-icon" size={20} />
            </div>
            <div className="admin-widget-value">
              {completionRate}% 
            </div>
            <div className="admin-widget-bars">
              <div className="admin-widget-bar" style={{ background: '#0f172a', width: `${completionRate}%` }}></div>
              <div className="admin-widget-bar" style={{ background: '#e2e8f0', width: `${100 - completionRate}%` }}></div>
            </div>
          </div>
          
          <div className="admin-widget">
            <div className="admin-widget-header">
              <div className="admin-widget-title">Active Tasks</div>
              <AlertCircle className="admin-widget-icon" size={20} color={highPriorityTasks.length > 0 ? "#ef4444" : "#3b82f6"} />
            </div>
            <div className="admin-widget-value">
              {activeTasks.length}
            </div>
            <div className="admin-widget-sub">{highPriorityTasks.length} High Priority</div>
            <div className="admin-widget-bars">
              {highPriorityTasks.length > 0 && <div className="admin-widget-bar" style={{ background: '#ef4444', width: `${highPriorityPct}%` }}></div>}
              <div className="admin-widget-bar" style={{ background: '#3b82f6', flex: 1 }}></div>
            </div>
          </div>

          <div className="admin-widget">
            <div className="admin-widget-header">
              <div className="admin-widget-title">Awaiting Review</div>
              <Activity className="admin-widget-icon" size={20} color={pendingReviewTasks.length > 0 ? "#f59e0b" : "#64748b"} />
            </div>
            <div className="admin-widget-value">
              {pendingReviewTasks.length}
            </div>
            <div className="admin-widget-sub">Need your approval</div>
            <div style={{ marginTop: '1rem', height: '30px', position: 'relative' }}>
              <svg viewBox="0 0 100 30" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
                <path d="M0,20 Q10,5 20,20 T40,20 T60,10 T80,25 T100,15 L100,30 L0,30 Z" fill="#fef3c7" />
                <path d="M0,20 Q10,5 20,20 T40,20 T60,10 T80,25 T100,15" fill="none" stroke="#f59e0b" strokeWidth="2" />
              </svg>
            </div>
          </div>
        </div>

        {/* Department Tasks Section */}
        <div className="admin-section" style={{ background: 'transparent', boxShadow: 'none', border: 'none' }}>
          <div className="admin-section-header" style={{ background: '#ffffff', borderRadius: '12px', marginBottom: '1.25rem', padding: '1rem 1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div>
              <h2 className="admin-section-title">Department Tasks</h2>
              <div className="admin-section-subtitle">Recent tasks &amp; card decks</div>
            </div>
            <Link to="/admin/tasks" className="admin-view-all" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontWeight: 600, color: '#021c3b', textDecoration: 'none' }}>
              View All Tasks <ArrowRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              Loading tasks...
            </div>
          ) : assembledTasks.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              No tasks found.
            </div>
          ) : (
            <div className="admin-tasks-deck-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '1.25rem', alignItems: 'start' }}>
              {assembledTasks.slice(0, 6).map((task: any) => (
                <TaskCard 
                  key={task._id || task.id} 
                  task={task} 
                  currentUser={user}
                  onClick={() => setSelectedTask(task)} 
                  onOpenChat={(t) => setChatTask(t)}
                  onSubtaskCreated={fetchData}
                  onTaskDeleted={fetchData}
                />
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Side Column */}
      <div className="admin-side-column">
        
        {/* Team Availability */}
        <div className="admin-section">
          <div className="admin-section-header">
            <h2 className="admin-section-title">Team Availability</h2>
          </div>

          <div className="admin-team-list">
            {loading ? (
              <p style={{ padding: '1rem', color: '#64748b' }}>Loading team...</p>
            ) : team.length === 0 ? (
              <p style={{ padding: '1rem', color: '#64748b' }}>No staff assigned.</p>
            ) : (
              team.map((member: any) => (
                <div className="admin-team-item" key={member._id || member.id}>
                  <div 
                    className="admin-team-avatar" 
                    style={{ backgroundImage: `url(https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=f1f5f9)` }}
                  >
                    <div className={`admin-team-status ${member.isActive !== false ? 'status-green' : 'status-red'}`}></div>
                  </div>
                  <div className="admin-team-info">
                    <div className="admin-team-name">{member.name}</div>
                    <div className="admin-team-role">ID: {member.universityId}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {selectedTask && (
        <TaskModal 
          task={selectedTask} 
          currentUser={user}
          onClose={() => setSelectedTask(null)}
          onRefresh={() => {
            fetchData();
            api.getTaskById(selectedTask._id || selectedTask.id).then(res => setSelectedTask(res.data.task)).catch(() => setSelectedTask(null));
          }}
          onOpenChat={(t) => setChatTask(t)}
        />
      )}

      {/* Task-Specific Chat Drawer */}
      <TaskChatDrawer
        task={chatTask}
        currentUser={user}
        isOpen={!!chatTask}
        onClose={() => setChatTask(null)}
        onMessageSent={() => {
          fetchData();
          if (selectedTask) {
            api.getTaskById(selectedTask._id || selectedTask.id).then(res => setSelectedTask(res.data.task)).catch(() => setSelectedTask(null));
          }
        }}
      />
    </div>
  );
};

export default AdminPage;
