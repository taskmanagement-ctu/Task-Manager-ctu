import React, { useEffect, useState } from 'react';
import { 
  ListTodo, 
  CheckCircle2, 
  ClipboardList, 
  AlertTriangle,
  ArrowRight,
  Check,
  UserPlus
} from 'lucide-react';
import { api, Task } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { calculateUrgency, getUrgencyCardStyle, getUrgencyLabel, getUrgencyColor } from '../utils/taskUrgency';
import TaskModal from '../components/TaskModal';
import TaskCalendarModal from '../components/TaskCalendarModal';
import './StaffPage.css';

const StaffPage: React.FC = () => {
  const { currentUser: user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const fetchTasks = async () => {
    try {
      const res = await api.getTasks({});
      setTasks(res.data.tasks || []);
    } catch (err) {
      console.error('Failed to fetch tasks', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'approved').length;
  const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
  
  // A task is overdue if deadline < now and not completed
  const now = new Date();
  const overdueTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'approved' && t.deadline && new Date(t.deadline) < now);


  const upcomingDeadlines = tasks
    .filter(t => t.status !== 'completed' && t.status !== 'approved' && t.deadline)
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
    .slice(0, 3);

  const recentNotifications = tasks
    .slice()
    // Ideally we would sort by updatedAt, assuming _id exists we can just take the last 3 for now, or just tasks.slice(0, 3)
    .slice(0, 3)
    .map(t => {
      const isOverdue = t.deadline && new Date(t.deadline) < now && t.status !== 'completed' && t.status !== 'approved';
      if (t.status === 'completed' || t.status === 'approved') {
        return { type: 'success', title: t.title, text: `Task was completed.`, time: 'Recently' };
      }
      if (isOverdue) {
        return { type: 'overdue', title: t.title, text: `Task is overdue. Please action.`, time: 'Recently' };
      }
      return { type: 'assigned', title: t.title, text: `You have an active task.`, time: 'Recently' };
    });

  return (
    <div className="staff-dashboard">
      {/* Main Content */}
      <div className="staff-main-col">
        <div className="staff-page-header">
          <h1 className="staff-page-title">Staff Dashboard</h1>
          <p className="staff-page-subtitle">Overview of your academic and administrative tasks.</p>
        </div>

        {/* Top Widgets */}
        <div className="staff-widgets">
          <div className="staff-widget">
            <div className="staff-widget-header">
              <div className="staff-widget-title">Total Tasks</div>
              <ListTodo className="staff-widget-icon" size={18} />
            </div>
            <div className="staff-widget-value">{totalTasks}</div>
            <div className="staff-widget-trend">↗ +12% <span className="staff-widget-sub">from last month</span></div>
          </div>

          <div className="staff-widget">
            <div className="staff-widget-header">
              <div className="staff-widget-title">Completed</div>
              <CheckCircle2 className="staff-widget-icon" size={18} color="#10b981" />
            </div>
            <div className="staff-widget-value">{completedTasks}</div>
            <div className="staff-widget-bars">
              <div className="staff-widget-bar" style={{ background: '#10b981', width: totalTasks > 0 ? `${(completedTasks/totalTasks)*100}%` : '0%' }}></div>
              <div className="staff-widget-bar" style={{ background: '#e2e8f0', flex: 1 }}></div>
            </div>
          </div>

          <div className="staff-widget">
            <div className="staff-widget-header">
              <div className="staff-widget-title">Pending</div>
              <ClipboardList className="staff-widget-icon" size={18} />
            </div>
            <div className="staff-widget-value">{pendingTasks}</div>
            <div className="staff-widget-sub">Awaiting action</div>
          </div>

          <div className="staff-widget overdue">
            <div className="staff-widget-header">
              <div className="staff-widget-title" style={{ color: '#b91c1c' }}>Overdue</div>
              <AlertTriangle className="staff-widget-icon" size={18} />
            </div>
            <div className="staff-widget-value">{overdueTasks.length}</div>
            <div className="staff-widget-sub">Requires immediate attention</div>
          </div>
        </div>

        {/* Tasks Section */}
        <div className="staff-section">
          <div className="staff-section-header">
            <h2 className="staff-section-title">Recent Tasks</h2>
            <Link to="/staff/tasks" className="staff-view-all">View All <ArrowRight size={14} /></Link>
          </div>

          <table className="staff-task-table">
            <thead>
              <tr>
                <th>Task Name</th>
                <th>Deadline</th>
                <th>Priority</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}>Loading tasks...</td></tr>
              ) : tasks.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}>No tasks!</td></tr>
              ) : (
                tasks.slice(0, 5).map((task) => {
                  const isOverdue = task.deadline && new Date(task.deadline) < now;
                  
                  const urgency = calculateUrgency(task);
                  const cardStyle = getUrgencyCardStyle(urgency);
                  const urgencyLabel = getUrgencyLabel(urgency);
                  const urgencyColor = getUrgencyColor(urgency);
                  
                  return (
                    <tr 
                      key={task._id || task.id} 
                      style={{ backgroundColor: cardStyle.backgroundColor, cursor: 'pointer' }}
                      onClick={() => setSelectedTask(task)}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td style={{ borderLeft: cardStyle.borderLeft, paddingLeft: '1rem' }}>
                        <div className="staff-task-name">{task.title}</div>
                        <div className="staff-task-sub">ID: {task._id?.substring(0,5) || task.id?.substring(0,5)}</div>
                      </td>
                      <td>
                        <div className={`staff-task-deadline ${isOverdue ? 'overdue' : ''}`} style={{ color: isOverdue ? '#dc2626' : urgencyColor }}>
                          {task.deadline ? new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No date'}
                        </div>
                      </td>
                      <td>
                        <span className="staff-badge" style={{ background: urgencyColor + '20', color: urgencyColor, border: `1px solid ${urgencyColor}40` }}>
                          {urgencyLabel}
                        </span>
                      </td>
                      <td>
                        <span className="staff-badge" style={{ 
                          background: task.status === 'approved' || task.status === 'completed' ? '#d1fae5' : 
                                      task.status === 'rejected' ? '#fee2e2' : 
                                      task.status === 'in_progress' || task.status === 'submitted_for_review' ? '#e0e7ff' : '#f1f5f9', 
                          color: task.status === 'approved' || task.status === 'completed' ? '#059669' : 
                                 task.status === 'rejected' ? '#b91c1c' : 
                                 task.status === 'in_progress' || task.status === 'submitted_for_review' ? '#4338ca' : '#475569' 
                        }}>
                          {task.status.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Banner */}
        <div className="staff-banner">
          <div className="staff-banner-content">
            <h3 className="staff-banner-title">End of Semester Audit</h3>
            <p className="staff-banner-desc">Prepare all departmental reports and finalize faculty evaluations before the upcoming audit cycle begins next month.</p>
            <button className="staff-banner-btn">Start Preparation</button>
          </div>
          <div 
            className="staff-banner-img"
            style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&q=80&w=400)' }}
          ></div>
        </div>

      </div>

      {/* Side Panels */}
      <div className="staff-side-col">
        
        {/* Deadlines */}
        <div className="staff-side-panel">
          <h2 className="staff-side-title">Upcoming Deadlines</h2>
          <div className="staff-deadline-list">
            {upcomingDeadlines.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '0.875rem' }}>No upcoming deadlines.</p>
            ) : (
              upcomingDeadlines.map((task) => (
                <div className="staff-deadline-item" key={task._id || task.id}>
                  <div className="deadline-date">
                    <div className="deadline-month">
                      {new Date(task.deadline!).toLocaleDateString('en-US', { month: 'short' })}
                    </div>
                    <div className="deadline-day">
                      {new Date(task.deadline!).toLocaleDateString('en-US', { day: '2-digit' })}
                    </div>
                  </div>
                  <div className="deadline-info">
                    <div className="deadline-name">{task.title}</div>
                    <div className="deadline-sub">{getUrgencyLabel(calculateUrgency(task))}</div>
                  </div>
                </div>
              ))
            )}
          </div>
          <button 
            type="button" 
            className="btn-full-outline"
            onClick={() => setIsCalendarOpen(true)}
          >
            View Calendar
          </button>
        </div>

        {/* Notifications */}
        <div className="staff-side-panel">
          <h2 className="staff-side-title">Recent Notifications</h2>
          <div className="staff-notif-list">
            {recentNotifications.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '0.875rem' }}>No new notifications.</p>
            ) : (
              recentNotifications.map((notif, idx) => (
                <div className="staff-notif-item" key={idx}>
                  <div className={`notif-icon ${notif.type === 'success' ? 'green' : notif.type === 'overdue' ? 'red' : 'blue'}`}>
                    {notif.type === 'success' ? <Check size={16} /> : notif.type === 'overdue' ? <AlertTriangle size={16} /> : <UserPlus size={16} />}
                  </div>
                  <div>
                    <div className="notif-content"><b>{notif.title}</b>: {notif.text}</div>
                    <div className="notif-time">{notif.time}</div>
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
          availableAssignees={[]}
          onClose={() => setSelectedTask(null)}
          onRefresh={() => {
            fetchTasks();
            api.getTaskById(selectedTask._id || selectedTask.id).then(res => setSelectedTask(res.data.task)).catch(() => setSelectedTask(null));
          }}
        />
      )}

      {/* Task & Deadline Calendar Modal */}
      <TaskCalendarModal 
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        tasks={tasks}
        onSelectTask={(task) => setSelectedTask(task)}
      />
    </div>
  );
};

export default StaffPage;
