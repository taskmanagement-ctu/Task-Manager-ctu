import React, { useEffect, useState, useMemo } from 'react';
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
import { calculateUrgency, getUrgencyLabel } from '../utils/taskUrgency';
import TaskCard from '../components/TaskCard';
import TaskModal from '../components/TaskModal';
import TaskCalendarModal from '../components/TaskCalendarModal';
import TaskChatDrawer from '../components/TaskChatDrawer';
import './StaffPage.css';

const StaffPage: React.FC = () => {
  const { currentUser: user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [chatTask, setChatTask] = useState<any | null>(null);
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
        <div className="staff-section" style={{ background: 'transparent', boxShadow: 'none', border: 'none' }}>
          <div className="staff-section-header" style={{ background: '#ffffff', borderRadius: '12px', marginBottom: '1.25rem', padding: '1rem 1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div>
              <h2 className="staff-section-title">Recent Tasks</h2>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.15rem' }}>
                Your active tasks &amp; card decks
              </div>
            </div>
            <Link to="/staff/tasks" className="staff-view-all">View All Tasks <ArrowRight size={14} /></Link>
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
            <div className="staff-tasks-deck-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '1.25rem', alignItems: 'start' }}>
              {assembledTasks.slice(0, 6).map((task: any) => (
                <TaskCard 
                  key={task._id || task.id} 
                  task={task} 
                  currentUser={user}
                  onClick={() => setSelectedTask(task)} 
                  onOpenChat={(t) => setChatTask(t)}
                  onSubtaskCreated={fetchTasks}
                  onTaskDeleted={fetchTasks}
                />
              ))}
            </div>
          )}
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
                <div 
                  className="staff-deadline-item" 
                  key={task._id || task.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedTask(task)}
                >
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
          onClose={() => setSelectedTask(null)}
          onRefresh={() => {
            fetchTasks();
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
          fetchTasks();
          if (selectedTask) {
            api.getTaskById(selectedTask._id || selectedTask.id).then(res => setSelectedTask(res.data.task)).catch(() => setSelectedTask(null));
          }
        }}
      />

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
