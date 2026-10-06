import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import TaskCard from '../components/TaskCard';
import TaskModal from '../components/TaskModal';
import CreateTaskView from '../components/CreateTaskView';
import TaskChatDrawer from '../components/TaskChatDrawer';
import { Search, Plus, SlidersHorizontal, Maximize2, Minimize2 } from 'lucide-react';
import { calculateUrgency } from '../utils/taskUrgency';
import './TasksPage.css';

const TasksPage: React.FC = () => {
  const { currentUser: user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [pendingReviewsCount, setPendingReviewsCount] = useState<number | null>(null);

  // Filters
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All'); // Color/Priority filter
  const [schoolFilter, setSchoolFilter] = useState('All');     // Department/School filter
  const [taskTypeFilter, setTaskTypeFilter] = useState('All');
  const [teamOnlyFilter, setTeamOnlyFilter] = useState(false); // Super Admin Team Tasks toggle
  
  // View & Mobile Filter Controls
  const [forceExpandedAll, setForceExpandedAll] = useState<boolean | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false);
  
  // Departments list for school filter
  const [departments, setDepartments] = useState<any[]>([]);
  
  // Available Assignees (for Dept Admin & Super Admin)
  const [availableAssignees, setAvailableAssignees] = useState<any[]>([]);

  // Modals & Views
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [chatTask, setChatTask] = useState<any | null>(null);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [creatingSubtaskFor, setCreatingSubtaskFor] = useState<string | null>(null);
  
  const loadTasks = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.getTasks({
        page,
        limit: 50, // Fetch a larger batch to support client-side priority/sorting
        search,
        status: statusFilter !== 'All' ? statusFilter : undefined,
        taskType: taskTypeFilter !== 'All' ? taskTypeFilter : undefined,
        department: (!teamOnlyFilter && schoolFilter !== 'All') ? schoolFilter : undefined,
        teamOnly: teamOnlyFilter ? 'true' : undefined,
      });
      setTasks(res.data.tasks);
      setTotalPages(res.data.pagination.totalPages);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingCount = async () => {
    if (!user) return;
    try {
      if (user.role === 'staff') {
        const res = await api.getTasks({ limit: 1, status: 'submitted_for_review' });
        setPendingReviewsCount(res.data.pagination.total);
      } else {
        const res = await api.getTasks({ limit: 1, status: 'submitted_for_review', reviewStage: user.role });
        setPendingReviewsCount(res.data.pagination.total);
      }
    } catch (err) {
      console.error('Failed to load pending reviews count', err);
    }
  };

  const loadAssignees = async () => {
    if (user?.role === 'staff') return;
    
    try {
      if (user?.role === 'super_admin') {
        const [usersRes, teamRes] = await Promise.all([
          api.getUsers({ limit: 1000, status: 'Active' }),
          api.getAdminAssignments(user.id).catch(() => ({ data: { assignments: [] } }))
        ]);

        const myTeamStaffIds = new Set(
          (teamRes.data?.assignments || []).map((a: any) => a.staffId?._id || a.staffId?.id)
        );

        const allUsers = usersRes.data.users.filter((u: any) => u._id !== user.id && u.id !== user.id);

        const prioritized = allUsers.map((u: any) => {
          const isTeam = myTeamStaffIds.has(u._id || u.id);
          return {
            ...u,
            isSuperAdminTeamMember: isTeam
          };
        }).sort((a: any, b: any) => {
          if (a.isSuperAdminTeamMember && !b.isSuperAdminTeamMember) return -1;
          if (!a.isSuperAdminTeamMember && b.isSuperAdminTeamMember) return 1;
          return 0;
        });

        setAvailableAssignees(prioritized);
      } else if (user?.role === 'department_admin') {
        const res = await api.getAdminAssignments(user.id);
        const myStaff = res.data.assignments.map(a => a.staffId);
        setAvailableAssignees([...myStaff]);
      }
    } catch (err) {
      console.error('Failed to load assignees', err);
    }
  };

  const loadDepartments = async () => {
    if (user?.role !== 'super_admin') return;
    try {
      const res = await api.getDepartments();
      if (res.success) {
        setDepartments(res.data.departments || []);
      }
    } catch (err) {
      console.error('Failed to load departments', err);
    }
  };

  useEffect(() => {
    if (user) {
      loadAssignees();
      loadPendingCount();
      loadDepartments();
    }
  }, [user]);

  useEffect(() => {
    if (user && !isCreatingTask) {
      loadTasks();
    }
  }, [page, statusFilter, schoolFilter, taskTypeFilter, teamOnlyFilter, user, search, isCreatingTask]);

  // Handle openTask / openChat from notification popup click
  useEffect(() => {
    const openTaskId = searchParams.get('openTask');
    const openChat = searchParams.get('openChat') === 'true';

    if (openTaskId) {
      const found = tasks.find(t => t._id === openTaskId);
      if (found) {
        if (openChat) {
          setChatTask(found);
        } else {
          setSelectedTask(found);
        }
        searchParams.delete('openTask');
        searchParams.delete('openChat');
        setSearchParams(searchParams, { replace: true });
      } else {
        api.getTaskById(openTaskId)
          .then(res => {
            if (res.data?.task) {
              if (openChat) {
                setChatTask(res.data.task);
              } else {
                setSelectedTask(res.data.task);
              }
            }
          })
          .catch(err => console.error('Error fetching target task from notification:', err))
          .finally(() => {
            searchParams.delete('openTask');
            searchParams.delete('openChat');
            setSearchParams(searchParams, { replace: true });
          });
      }
    }
  }, [searchParams, tasks]);

  // Client-side filtering & sorting
  const getFilteredAndSortedTasks = () => {
    let filtered = [...tasks];

    // Priority/Color filter (client-side based on urgency calculation)
    if (priorityFilter !== 'All') {
      filtered = filtered.filter(t => {
        const urgency = calculateUrgency(t);
        return urgency === priorityFilter;
      });
    }

    // School/Department filter fallback
    if (schoolFilter !== 'All') {
      filtered = filtered.filter(t => {
        const dept = t.assignedTo?.department || t.delegatedTo?.department;
        return dept === schoolFilter;
      });
    }

    // Default sort: New + Incomplete first (newest createdAt first), then completed (latest completed first)
    const completedStatuses = ['completed', 'approved'];
    
    filtered.sort((a, b) => {
      const aCompleted = completedStatuses.includes(a.status);
      const bCompleted = completedStatuses.includes(b.status);

      // Incomplete tasks come before completed
      if (!aCompleted && bCompleted) return -1;
      if (aCompleted && !bCompleted) return 1;

      // If both are completed: sort by completedAt or updatedAt/createdAt descending (latest completed first)
      if (aCompleted && bCompleted) {
        const aTime = a.completedAt ? new Date(a.completedAt).getTime() : new Date(a.updatedAt || a.createdAt).getTime();
        const bTime = b.completedAt ? new Date(b.completedAt).getTime() : new Date(b.updatedAt || b.createdAt).getTime();
        return bTime - aTime;
      }

      // If both are incomplete: sort by createdAt descending (newest tasks first)
      const aCreated = new Date(a.createdAt).getTime();
      const bCreated = new Date(b.createdAt).getTime();
      return bCreated - aCreated;
    });

    return filtered;
  };

  const displayTasks = getFilteredAndSortedTasks();

  const handleCreateTaskSubmit = async (taskData: FormData | FormData[]) => {
    setError('');
    try {
      if (Array.isArray(taskData)) {
        await Promise.all(taskData.map(data => api.createTask(data)));
      } else {
        await api.createTask(taskData);
      }
      loadTasks();
      setIsCreatingTask(false);
      setCreatingSubtaskFor(null);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const handleCreateSubtaskForTask = (taskId: string) => {
    setCreatingSubtaskFor(taskId);
    setIsCreatingTask(true);
    setSelectedTask(null);
  };

  if (isCreatingTask) {
    return (
      <CreateTaskView 
        onSubmit={handleCreateTaskSubmit}
        onCancel={() => {
          setIsCreatingTask(false);
          setCreatingSubtaskFor(null);
        }}
        availableAssignees={availableAssignees}
        departments={departments}
        preselectedParentTask={creatingSubtaskFor}
        currentUser={user}
      />
    );
  }

  return (
    <>
      <div className="tasks-page-container" style={{ maxWidth: '1200px' }}>
        
        {/* Desktop Header */}
        <div className="tasks-page-header">
          <div className="tasks-page-title">
            <h1>Task Management</h1>
            <p>Monitor and assign tasks across the university network. Track urgency, manage workloads, and ensure timely completion of critical institutional objectives.</p>
          </div>
          
          {user?.role !== 'staff' && (
            <button className="tasks-create-btn" onClick={() => setIsCreatingTask(true)}>
              <Plus size={18} /> CREATE TASK
            </button>
          )}
        </div>

        {/* Mobile Filter Pills */}
        <div className="mobile-filter-pills d-md-none">
          <button className={`mobile-pill ${statusFilter === 'All' ? 'active' : ''}`} onClick={() => setStatusFilter('All')}>All Tasks</button>
          <button className={`mobile-pill ${statusFilter === 'pending' ? 'active' : ''}`} onClick={() => setStatusFilter('pending')}>Pending Action</button>
          <button className={`mobile-pill ${statusFilter === 'submitted_for_review' ? 'active' : ''}`} onClick={() => setStatusFilter('submitted_for_review')}>In Review</button>
        </div>

        {/* Mobile Action Required Section */}
        {pendingReviewsCount !== null && pendingReviewsCount > 0 && (
          <div className="mobile-action-header d-md-none">
            <div className="mobile-action-title">
              Action Required <span className="mobile-badge">{pendingReviewsCount}</span>
            </div>
            <a href="#" className="mobile-mark-read" onClick={(e) => { e.preventDefault(); setStatusFilter('submitted_for_review'); }}>
              View all
            </a>
          </div>
        )}

        {/* Desktop & Mobile Filters Bar */}
        <div className="tasks-filters-bar">
          <div className="tasks-search-row">
            <div className="tasks-search-wrapper">
              <Search className="tasks-search-icon" size={18} />
              <input 
                type="text" 
                className="tasks-search-input" 
                placeholder="Search by title, ID, or content..." 
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>

            {/* Mobile Filter Toggle Button */}
            <button 
              type="button" 
              className={`mobile-filter-toggle-btn ${showMobileFilters ? 'active' : ''}`}
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              aria-label="Toggle secondary filters"
            >
              <SlidersHorizontal size={14} />
              <span>Filters</span>
              {(
                (priorityFilter !== 'All' ? 1 : 0) +
                (schoolFilter !== 'All' ? 1 : 0) +
                (taskTypeFilter !== 'All' ? 1 : 0) +
                (teamOnlyFilter ? 1 : 0)
              ) > 0 && (
                <span className="mobile-filter-badge">
                  {(priorityFilter !== 'All' ? 1 : 0) + (schoolFilter !== 'All' ? 1 : 0) + (taskTypeFilter !== 'All' ? 1 : 0) + (teamOnlyFilter ? 1 : 0)}
                </span>
              )}
            </button>
          </div>

          <div className={`tasks-dropdowns-group ${showMobileFilters ? 'mobile-show' : 'mobile-hide'}`}>
            {/* Scope Selector: All Tasks vs My Team Tasks (Super Admin) */}
            {user?.role === 'super_admin' && (
              <select 
                className="tasks-filter-select" 
                value={teamOnlyFilter ? 'team' : 'all'} 
                onChange={e => { setTeamOnlyFilter(e.target.value === 'team'); setPage(1); }}
              >
                <option value="all">All Tasks</option>
                <option value="team">My Team</option>
              </select>
            )}
            
            {/* 1. Color / Priority Filter */}
            <select 
              className="tasks-filter-select" 
              value={priorityFilter} 
              onChange={e => { setPriorityFilter(e.target.value); setPage(1); }}
            >
              <option value="All">Priority: All</option>
              <option value="RED">🔴 High Priority</option>
              <option value="YELLOW">🟡 Medium Priority</option>
              <option value="GREEN">🟢 Low Priority</option>
              <option value="OVERDUE">⚫ Overdue</option>
            </select>

            {/* 2. School / Department Filter (Only for Super Admin) */}
            {user?.role === 'super_admin' && (
              <select 
                className="tasks-filter-select" 
                value={teamOnlyFilter ? 'All' : schoolFilter} 
                onChange={e => { setSchoolFilter(e.target.value); setPage(1); }}
                disabled={teamOnlyFilter}
                style={teamOnlyFilter ? { opacity: 0.55, cursor: 'not-allowed', backgroundColor: '#f1f5f9' } : {}}
                title={teamOnlyFilter ? 'Department filter is disabled for My Team' : undefined}
              >
                <option value="All">{teamOnlyFilter ? 'Department: N/A (My Team)' : 'School: All'}</option>
                {!teamOnlyFilter && departments.map(dept => (
                  <option key={dept._id} value={dept.name}>{dept.name}</option>
                ))}
              </select>
            )}

            {/* 3. Status Filter */}
            <select className="tasks-filter-select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="All">Status: All</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="submitted_for_review">In Review</option>
              <option value="completed">Completed</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>

            {/* 4. Type Filter: Main / Subtask */}
            <select className="tasks-filter-select" value={taskTypeFilter} onChange={e => { setTaskTypeFilter(e.target.value); setPage(1); }}>
              <option value="All">Type: All</option>
              <option value="main">Main Task</option>
              <option value="subtask">Subtask</option>
            </select>
          </div>
        </div>

        {error && <div className="error-message" style={{ marginBottom: '1rem' }}>{error}</div>}

        {loading ? (
          <p>Loading tasks...</p>
        ) : displayTasks.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <h3 style={{ color: '#666' }}>No tasks found</h3>
            <p>Try adjusting your filters or create a new task.</p>
          </div>
        ) : (
          <>
            {/* Action Required Header for Desktop */}
            {pendingReviewsCount !== null && pendingReviewsCount > 0 && statusFilter === 'All' && (
               <div style={{ marginBottom: '1rem', color: '#1e40af', fontWeight: 'bold' }}>
                  {pendingReviewsCount} tasks require your attention.
               </div>
            )}
            
            {/* View Controls Toolbar (Task count & Expand/Collapse All) */}
            <div className="tasks-toolbar">
              <span className="tasks-count-badge">
                Showing <strong>{displayTasks.length}</strong> tasks
              </span>

              <div className="tasks-view-actions">
                <button
                  type="button"
                  className="tasks-view-toggle-btn"
                  onClick={() => setForceExpandedAll(prev => prev === true ? false : true)}
                  title={forceExpandedAll === true ? "Collapse all task cards" : "Expand all task cards"}
                >
                  {forceExpandedAll === true ? (
                    <>
                      <Minimize2 size={13} />
                      <span>Collapse All</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 size={13} />
                      <span>Expand All</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="tasks-grid">
              {displayTasks.map(task => (
                <TaskCard 
                  key={task._id} 
                  task={task} 
                  currentUser={user}
                  forceExpanded={forceExpandedAll}
                  onClick={() => setSelectedTask(task)} 
                  onCreateSubtask={() => handleCreateSubtaskForTask(task._id)}
                  onOpenChat={(t) => setChatTask(t)}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '2.5rem' }}>
                <button 
                  className="btn btn-secondary" 
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </button>
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  Page {page} of {totalPages}
                </span>
                <button 
                  className="btn btn-secondary" 
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {selectedTask && (
        <TaskModal 
          task={selectedTask} 
          currentUser={user}
          availableAssignees={availableAssignees}
          departments={departments}
          onClose={() => setSelectedTask(null)}
          onRefresh={() => {
            loadTasks();
            loadPendingCount();
            api.getTaskById(selectedTask._id).then(res => setSelectedTask(res.data.task)).catch(() => setSelectedTask(null));
          }}
          onCreateSubtask={() => handleCreateSubtaskForTask(selectedTask._id)}
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
          loadTasks();
        }}
      />
    </>
  );
};

export default TasksPage;
