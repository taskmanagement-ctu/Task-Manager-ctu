import React, { useState, useEffect } from 'react';
import { Calendar, Clock, CheckCircle2, CornerDownRight, MessageSquare, ChevronDown, ChevronUp, ExternalLink, Plus, X, Check, Loader2, ListTree, Layers, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { calculateUrgency, getUrgencyCardStyle, getUrgencyLabel, getUrgencyColor } from '../utils/taskUrgency';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import './TaskCard.css';

interface TaskCardProps {
  task: any;
  currentUser: any;
  onClick: (task: any) => void;
  onCreateSubtask?: () => void;
  onOpenChat?: (task: any) => void;
  forceExpanded?: boolean | null;
  availableAssignees?: any[];
  onSubtaskCreated?: () => void;
  onTaskDeleted?: () => void;
}

const formatToLocalDateTimeInput = (dateString?: string | Date) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const TaskCard: React.FC<TaskCardProps> = ({ 
  task, 
  currentUser, 
  onClick, 
  onCreateSubtask: _onCreateSubtask, 
  onOpenChat,
  forceExpanded,
  availableAssignees = [],
  onSubtaskCreated,
  onTaskDeleted
}) => {
  const [progress, setProgress] = useState<any>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Subtasks downwards drawer state
  const [isSubtasksOpen, setIsSubtasksOpen] = useState<boolean>(false);
  const [subtasksList, setSubtasksList] = useState<any[]>(task.subtasks || []);
  const [loadingSubtasks, setLoadingSubtasks] = useState<boolean>(false);

  useEffect(() => {
    if (task.subtasks && task.subtasks.length > 0) {
      setSubtasksList(task.subtasks);
    }
  }, [task.subtasks]);

  // Inline subtask creation state
  const [isAddingSubtask, setIsAddingSubtask] = useState<boolean>(false);
  const [subtaskTitle, setSubtaskTitle] = useState<string>('');
  const [subtaskDesc, setSubtaskDesc] = useState<string>('');
  const [subtaskDeadline, setSubtaskDeadline] = useState<string>('');
  const [subtaskAssignee, setSubtaskAssignee] = useState<string>('');
  const [isSubmittingSubtask, setIsSubmittingSubtask] = useState<boolean>(false);
  const [subtaskError, setSubtaskError] = useState<string>('');
  const [subtaskSuccess, setSubtaskSuccess] = useState<string>('');
  const [internalAssignees, setInternalAssignees] = useState<any[]>(availableAssignees);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);

  // Permission: Task Creator or Super Admin (10001 or delegated)
  const creatorId = task.createdBy?._id || task.createdBy?.id || (typeof task.createdBy === 'string' ? task.createdBy : null);
  const currentUserId = currentUser?.id || currentUser?._id;
  const isCreator = Boolean(
    (creatorId && currentUserId && creatorId.toString() === currentUserId.toString()) ||
    (task.createdBy?.universityId && currentUser?.universityId && task.createdBy.universityId === currentUser.universityId)
  );
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const canDelete = isSuperAdmin || isCreator;

  const handleDeleteTask = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canDelete || isDeleting) return;
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      await api.deleteTask(task._id);
      setShowDeleteConfirm(false);
      if (onTaskDeleted) {
        onTaskDeleted();
      }
    } catch (err: any) {
      console.error('Failed to delete task', err);
      alert(`Error deleting task: ${err.message || 'Unknown error'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (availableAssignees && availableAssignees.length > 0) {
      setInternalAssignees(availableAssignees);
    }
  }, [availableAssignees]);

  useEffect(() => {
    if (!task.isSubtask) {
      api.getTaskProgress(task._id).then(res => setProgress(res.data)).catch(console.error);
    }
  }, [task._id, task.isSubtask]);

  // Sync with global Expand All / Collapse All state if controlled
  useEffect(() => {
    if (forceExpanded !== undefined && forceExpanded !== null) {
      setIsExpanded(forceExpanded);
    }
  }, [forceExpanded]);

  const loadSubtasksList = async () => {
    if (task.isSubtask) return;
    setLoadingSubtasks(true);
    try {
      const res = await api.getSubtasks(task._id);
      if (res.success && res.data?.subtasks) {
        setSubtasksList(res.data.subtasks);
      }
    } catch (err) {
      console.error('Failed to load subtasks for task', task._id, err);
    } finally {
      setLoadingSubtasks(false);
    }
  };

  const handleToggleSubtasks = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextState = !isSubtasksOpen;
    setIsSubtasksOpen(nextState);
    if (nextState && subtasksList.length === 0) {
      loadSubtasksList();
    }
  };

  const handleOpenAddSubtask = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAddingSubtask(true);
    setIsSubtasksOpen(true);
    setSubtaskTitle('');
    setSubtaskDesc('');
    setSubtaskDeadline(formatToLocalDateTimeInput(task.deadline));
    setSubtaskError('');
    setSubtaskSuccess('');

    const defaultAssigneeId = task.assignedTo?._id || task.assignedTo?.id || (internalAssignees.length > 0 ? (internalAssignees[0]._id || internalAssignees[0].id) : '');
    setSubtaskAssignee(defaultAssigneeId);

    if (internalAssignees.length === 0) {
      try {
        if (currentUser?.role === 'super_admin') {
          const res = await api.getUsers({ limit: 500, status: 'Active' });
          if (res.data?.users) setInternalAssignees(res.data.users);
        } else if (currentUser?.role === 'department_admin') {
          const res = await api.getAdminAssignments(currentUser.id || currentUser._id).catch(() => ({ data: { assignments: [] } }));
          const assignedStaff = (res.data?.assignments || []).map((a: any) => a.staffId).filter(Boolean);
          setInternalAssignees(assignedStaff);
        }
      } catch (err) {
        console.error('Failed to load assignees for subtask:', err);
      }
    }

    if (subtasksList.length === 0) {
      loadSubtasksList();
    }
  };

  const handleCreateSubtaskSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!subtaskTitle.trim()) {
      setSubtaskError('Please enter a subtask title.');
      return;
    }
    if (!subtaskAssignee) {
      setSubtaskError('Please select an assignee.');
      return;
    }
    if (!subtaskDeadline) {
      setSubtaskError('Please select a deadline.');
      return;
    }

    const parentDeadlineTime = new Date(task.deadline).getTime();
    const chosenDeadlineTime = new Date(subtaskDeadline).getTime();
    if (chosenDeadlineTime > parentDeadlineTime) {
      setSubtaskError('Subtask deadline cannot exceed parent task deadline.');
      return;
    }

    setIsSubmittingSubtask(true);
    setSubtaskError('');
    setSubtaskSuccess('');

    try {
      const res = await api.createSubtask(task._id, {
        title: subtaskTitle.trim(),
        description: subtaskDesc.trim() || subtaskTitle.trim(),
        deadline: new Date(subtaskDeadline).toISOString(),
        assignedTo: subtaskAssignee
      });

      if (res.success) {
        setSubtaskSuccess('Subtask created & assigned successfully!');
        await Promise.all([
          loadSubtasksList(),
          api.getTaskProgress(task._id).then(r => setProgress(r.data)).catch(console.error)
        ]);

        setSubtaskTitle('');
        setSubtaskDesc('');
        setTimeout(() => {
          setIsAddingSubtask(false);
          setSubtaskSuccess('');
        }, 1200);

        if (onSubtaskCreated) {
          onSubtaskCreated();
        }
      } else {
        setSubtaskError(res.message || 'Failed to create subtask.');
      }
    } catch (err: any) {
      setSubtaskError(err.message || 'Error creating subtask.');
    } finally {
      setIsSubmittingSubtask(false);
    }
  };

  const isCompleted = task.status === 'completed' || task.status === 'approved';
  const isSubmitted = task.status === 'submitted_for_review';
  const canAddSubtask = !task.isSubtask && !isCompleted && (
    currentUser?.role === 'super_admin' || 
    currentUser?.role === 'department_admin'
  );
  
  // Card Deck detection
  const subtaskCount = (task.subtasks?.length ?? 0) || task.subtaskCount || progress?.total || 0;
  const hasDeck = !task.isSubtask && subtaskCount > 0;
  
  // Calculate urgency from deadline (frozen at submission/completion if submitted/completed)
  const urgency = calculateUrgency(task);
  const cardStyle = getUrgencyCardStyle(urgency);
  const urgencyLabel = getUrgencyLabel(urgency);
  const urgencyColor = getUrgencyColor(urgency);

  const isOverdue = !isCompleted && !isSubmitted && urgency === 'OVERDUE';

  // Status pill styling
  let pillClass = 'tc-pill-gray';
  let statusText = 'Pending';

  if (isCompleted) {
    pillClass = 'tc-pill-green';
    statusText = task.status === 'approved' ? 'Approved' : 'Completed';
  } else if (isOverdue) {
    pillClass = 'tc-pill-red';
    statusText = 'Overdue';
  } else if (task.status === 'in_progress' || task.status === 'submitted_for_review') {
    pillClass = 'tc-pill-blue';
    statusText = task.status === 'submitted_for_review' ? 'In Review' : 'In Progress';
  } else if (task.status === 'rejected') {
    pillClass = 'tc-pill-red';
    statusText = 'Rejected';
  }

  // Format date to dd/mm/yyyy
  const formatDateDDMMYYYY = (dateString?: string | Date) => {
    if (!dateString) return '—';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Get completion timeline info
  const getCompletionTimeline = () => {
    if (!isCompleted) return null;
    const completedDate = task.completedAt ? new Date(task.completedAt) : null;
    const deadlineDate = new Date(task.deadline);
    if (!completedDate) return null;

    const diffTime = deadlineDate.getTime() - completedDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      return { text: `${diffDays} day${diffDays !== 1 ? 's' : ''} before deadline`, color: '#10b981', icon: '✅' };
    } else if (diffDays < 0) {
      return { text: `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} overdue`, color: '#ef4444', icon: '⚠️' };
    } else {
      return { text: 'Completed on deadline', color: '#f59e0b', icon: '✅' };
    }
  };

  const completionTimeline = getCompletionTimeline();

  // Format deadline for UI
  const formatDeadline = (dateString: string) => {
    if (isCompleted) {
       return formatDateDDMMYYYY(dateString);
    }
    
    const deadline = new Date(dateString);
    const now = new Date();
    const diffTime = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    
    if (diffDays < 0) {
      return `${Math.abs(diffDays)} days ago`;
    } else if (diffDays === 0) {
      return 'Today';
    } else {
      return `In ${diffDays} days`;
    }
  };

  const commentCount = task.comments?.length || 0;
  const hasUnread = Boolean(
    task.comments &&
    task.comments.length > 0 &&
    task.comments.some((c: any) => {
      if (!c.readBy || !Array.isArray(c.readBy)) return true;
      return !c.readBy.some((uid: any) => (uid?._id || uid)?.toString() === currentUserId?.toString());
    })
  );
  const showDelegated = Boolean(task.delegatedTo?.name && !isSuperAdmin);
  const displayAssignee = showDelegated ? task.delegatedTo : task.assignedTo;

  const handleCardClick = () => {
    // On mobile view (<= 768px), if collapsed, tap expands the card
    if (window.innerWidth <= 768 && !isExpanded) {
      setIsExpanded(true);
      return;
    }
    // If already expanded or on desktop, open modal
    onClick(task);
  };

  return (
    <div className={`tc-deck-container ${hasDeck ? 'is-deck' : ''}`}>
      {hasDeck && (
        <>
          <div className="tc-deck-layer-2" />
          <div className="tc-deck-layer-1" />
        </>
      )}
      <div 
        className={`tc-card ${isExpanded ? 'tc-is-expanded' : 'tc-is-collapsed'} ${hasDeck ? 'tc-has-deck' : ''}`} 
        style={cardStyle} 
        onClick={handleCardClick}
      >
        {/* ── Header ── */}
        <div className="tc-header">
          <div className="tc-type">
            {task.isSubtask ? (
              <><CornerDownRight size={13} /> SUBTASK #{task.taskId}</>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800 }}>#{task.taskId}</span>
                {hasDeck && (
                  <span className="tc-deck-tag" title={`Card Deck with ${subtaskCount} subtasks stacked backward`}>
                    <Layers size={11} /> DECK ({subtaskCount})
                  </span>
                )}
              </div>
            )}
          </div>
        
        <div className="tc-header-right">
          <div className="tc-urgency-badge">
            <span 
              className="tc-priority-dot" 
              style={{ 
                width: '7px', 
                height: '7px', 
                borderRadius: '50%', 
                backgroundColor: urgencyColor, 
                display: 'inline-block',
                boxShadow: `0 0 6px ${urgencyColor}40`
              }} 
            />
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: urgencyColor, textTransform: 'uppercase' }}>
              {urgencyLabel}
            </span>
          </div>

          <div className={`tc-status-pill ${pillClass}`}>{statusText}</div>
        </div>
      </div>
      
      {/* ── Title ── */}
      <h3 className={`tc-title ${isCompleted ? 'completed' : ''}`}>
        {task.title}
      </h3>

      {/* Delegated Super Admin Creator Indicator (Visible to Primary Super Admin 10001) */}
      {currentUser?.universityId === '10001' && 
       task.createdBy?.role === 'super_admin' && 
       task.createdBy?.universityId !== '10001' && (
        <div style={{
          background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
          border: '1px solid #ddd6fe',
          borderRadius: '6px',
          padding: '0.3rem 0.6rem',
          margin: '0.35rem 0 0.6rem 0',
          fontSize: '0.74rem',
          color: '#5b21b6',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          fontWeight: 600
        }}>
          <span>🛡️</span>
          <span>Created &amp; Assigned by Super Admin: <strong>{(task.createdBy?.universityId === '24051' || task.createdBy?.email === 'vc@ctuniversity.in' || task.createdBy?.name?.toLowerCase().includes('nitin')) ? "Vice Chancellor's Office" : task.createdBy.name}</strong> ({task.createdBy.universityId})</span>
        </div>
      )}

      {/* ── Collapsible Body (Hidden by default on mobile, expands smoothly) ── */}
      <div className={`tc-collapsible-body ${isExpanded ? 'expanded' : 'collapsed'}`}>
        {task.isSubtask && task.parentTaskId && (
          <div className="tc-parent-ref">
            <CornerDownRight size={12} />
            <span>Subtask of #{task.parentTaskId.taskId} - {task.parentTaskId.title}</span>
          </div>
        )}
        
        {task.description && (
          <div className="tc-desc">
            {task.description}
          </div>
        )}

        {/* ── Subtasks Downwards Section for Main Tasks ── */}
        {!task.isSubtask && (
          <div className="tc-subtasks-section" onClick={(e) => e.stopPropagation()}>
            <div className="tc-subtasks-header">
              <div className="tc-subtasks-header-left">
                {subtaskCount > 0 ? (
                  <button 
                    type="button"
                    className={`tc-subtasks-toggle-btn ${isSubtasksOpen ? 'open' : ''}`}
                    onClick={handleToggleSubtasks}
                    title={isSubtasksOpen ? "Hide deck subtasks" : "View subtasks downwards in deck"}
                  >
                    <Layers size={13} />
                    <span>Deck ({progress?.approved || 0}/{subtaskCount})</span>
                    {isSubtasksOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                ) : (
                  <span className="tc-subtasks-empty-label">
                    <ListTree size={13} /> Subtasks (0)
                  </span>
                )}
              </div>

              {canAddSubtask && !isAddingSubtask && (
                <button 
                  type="button"
                  className="tc-add-subtask-action-btn"
                  onClick={handleOpenAddSubtask}
                  title="Add subtask directly downwards"
                >
                  <Plus size={13} />
                  <span>Add Subtask</span>
                </button>
              )}
            </div>

            {/* Progress Bar for subtasks */}
            {progress && progress.total > 0 && !isCompleted && (
              <div className="tc-progress-container" style={{ margin: '0.35rem 0 0.5rem 0' }}>
                <div className="tc-progress-bar">
                  <div className="tc-progress-fill" style={{ width: `${progress.percentage}%` }}></div>
                </div>
              </div>
            )}

            {/* Inline Downwards Subtask Form */}
            {isAddingSubtask && (
              <div className="tc-inline-subtask-form">
                <div className="tc-subtask-form-header">
                  <div className="tc-subtask-form-title">
                    <Plus size={13} color="#2563eb" />
                    <span>New Subtask for #{task.taskId}</span>
                  </div>
                  <button 
                    type="button" 
                    className="tc-subtask-close-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsAddingSubtask(false);
                      setSubtaskError('');
                    }}
                    title="Close"
                  >
                    <X size={13} />
                  </button>
                </div>

                {subtaskError && (
                  <div className="tc-subtask-form-error">{subtaskError}</div>
                )}
                {subtaskSuccess && (
                  <div className="tc-subtask-form-success">{subtaskSuccess}</div>
                )}

                <div className="tc-subtask-input-group">
                  <label className="tc-subtask-label">Title *</label>
                  <input 
                    type="text" 
                    className="tc-subtask-input" 
                    placeholder="Enter subtask title..."
                    value={subtaskTitle}
                    onChange={(e) => setSubtaskTitle(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="tc-subtask-input-group">
                  <label className="tc-subtask-label">Description / Instructions</label>
                  <textarea 
                    className="tc-subtask-textarea" 
                    placeholder="Instructions or requirements..."
                    rows={2}
                    value={subtaskDesc}
                    onChange={(e) => setSubtaskDesc(e.target.value)}
                  />
                </div>

                <div className="tc-subtask-grid-2">
                  <div className="tc-subtask-input-group">
                    <label className="tc-subtask-label">Assign To *</label>
                    <select 
                      className="tc-subtask-select"
                      value={subtaskAssignee}
                      onChange={(e) => setSubtaskAssignee(e.target.value)}
                    >
                      <option value="">-- Select Assignee --</option>
                      {internalAssignees.map(u => {
                        const uid = u._id || u.id;
                        return (
                          <option key={uid} value={uid}>
                            {u.name} {u.universityId ? `(${u.universityId})` : ''} - {u.role === 'department_admin' ? 'Admin' : 'Staff'}{u.department ? ` [${u.department}]` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="tc-subtask-input-group">
                    <label className="tc-subtask-label">
                      Deadline * <span className="tc-deadline-hint">(Max: {formatDateDDMMYYYY(task.deadline)})</span>
                    </label>
                    <input 
                      type="datetime-local" 
                      className="tc-subtask-input" 
                      value={subtaskDeadline}
                      max={formatToLocalDateTimeInput(task.deadline)}
                      onChange={(e) => setSubtaskDeadline(e.target.value)}
                    />
                  </div>
                </div>

                <div className="tc-subtask-form-actions">
                  <button 
                    type="button" 
                    className="tc-subtask-cancel-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsAddingSubtask(false);
                      setSubtaskError('');
                    }}
                    disabled={isSubmittingSubtask}
                  >
                    Cancel
                  </button>
                  <button 
                    type="button" 
                    className="tc-subtask-submit-btn"
                    onClick={handleCreateSubtaskSubmit}
                    disabled={isSubmittingSubtask}
                  >
                    {isSubmittingSubtask ? (
                      <>
                        <Loader2 size={13} className="tc-spinner" />
                        <span>Creating...</span>
                      </>
                    ) : (
                      <>
                        <Check size={13} />
                        <span>Create Subtask</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Downwards Subtasks Drawer */}
            {isSubtasksOpen && (
              <div className="tc-subtasks-drawer">
                {loadingSubtasks ? (
                  <div className="tc-subtasks-loading">
                    <Loader2 size={13} className="tc-spinner" />
                    <span>Loading subtasks...</span>
                  </div>
                ) : subtasksList.length === 0 ? (
                  <div className="tc-subtasks-empty">
                    No subtasks created yet. Click "+ Add Subtask" above to create one.
                  </div>
                ) : (
                  <div className="tc-subtasks-list">
                    {subtasksList.map(st => {
                      const stAssignee = st.delegatedTo || st.assignedTo;
                      const isStCompleted = st.status === 'completed' || st.status === 'approved';
                      return (
                        <div 
                          key={st._id} 
                          className="tc-subtask-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            onClick(st);
                          }}
                          title="Click to view/edit subtask"
                        >
                          <div className="tc-subtask-item-main">
                            <span className="tc-subtask-item-id">#{st.taskId}</span>
                            <span className={`tc-subtask-item-title ${isStCompleted ? 'completed' : ''}`}>
                              {st.title}
                            </span>
                          </div>
                          <div className="tc-subtask-item-meta">
                            <span className="tc-subtask-item-assignee" title={stAssignee ? `${stAssignee.name || ''} (${stAssignee.universityId || 'No ID'})` : 'Unassigned'}>
                              👤 {stAssignee ? `${stAssignee.name || ''} ${stAssignee.universityId ? `(${stAssignee.universityId})` : ''}`.trim() || 'Unassigned' : 'Unassigned'}
                            </span>
                            {st.createdAt && (
                              <span className="tc-subtask-item-date" title={`Created: ${new Date(st.createdAt).toLocaleString()}`}>
                                🕒 {formatDateDDMMYYYY(st.createdAt)}
                              </span>
                            )}
                            <span className="tc-subtask-item-date">
                              📅 {formatDateDDMMYYYY(st.deadline)}
                            </span>
                            <span className={`tc-subtask-pill tc-subtask-pill-${st.status}`}>
                              {st.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Mobile View Full Details Action Button */}
        <div className="tc-expanded-actions">
          <button 
            type="button" 
            className="tc-open-modal-btn"
            onClick={(e) => {
              e.stopPropagation();
              onClick(task);
            }}
          >
            <ExternalLink size={13} />
            <span>Open Task & Edit</span>
          </button>
        </div>
      </div>

      {/* ── Footer / Meta Row ── */}
      <div className="tc-footer">
        <div className="tc-footer-left">
          {/* Assignee (Name & ID) */}
          <div 
            className="tc-assignee" 
            title={displayAssignee ? `${displayAssignee.name || 'User'} (${displayAssignee.universityId || 'No ID'})` : 'Unassigned'}
          >
            <div className="tc-avatar">
              {displayAssignee?.name ? (
                <img 
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(displayAssignee.name)}&background=e2e8f0&color=0f172a`} 
                  alt="avatar" 
                  title={`Assigned to ${displayAssignee.name}`} 
                />
              ) : '?'}
            </div>
            <div className="tc-assignee-info">
              <span className="tc-assignee-name">
                {(displayAssignee?.universityId === '24051' || displayAssignee?.email === 'vc@ctuniversity.in' || displayAssignee?.name?.toLowerCase().includes('nitin')) ? "Vice Chancellor's Office" : (displayAssignee?.name || 'Unassigned')}
              </span>
              {displayAssignee?.universityId && (
                <span className="tc-assignee-id">
                  ({displayAssignee.universityId})
                </span>
              )}
            </div>
          </div>

          {/* Task Created Date */}
          {task.createdAt && (
            <div className="tc-created-date" title={`Created on: ${new Date(task.createdAt).toLocaleString()}`}>
              <Clock size={12} />
              <span>Created: {formatDateDDMMYYYY(task.createdAt)}</span>
            </div>
          )}
          
          {/* Deadline */}
          <div className={`tc-deadline ${isOverdue ? 'overdue' : ''}`} style={{ color: isOverdue ? '#dc2626' : urgencyColor }}>
            {isCompleted ? <CheckCircle2 size={13} /> : <Calendar size={13} className={isOverdue ? "text-red-500" : ""} />}
            <span>{formatDeadline(task.deadline)}</span>
          </div>

          {completionTimeline && isExpanded && (
            <div className="tc-completion-timeline" style={{ color: completionTimeline.color }}>
              {completionTimeline.icon} {completionTimeline.text}
            </div>
          )}
        </div>

        <div className="tc-footer-right">
          {/* Delete Button (Creator or Super Admin) */}
          {canDelete && (
            <button 
              type="button"
              className="tc-delete-btn"
              title="Delete this task (Creator or Super Admin)"
              onClick={handleDeleteTask}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
            </button>
          )}

          {/* Chat Button */}
          {onOpenChat && (
            <button 
              type="button"
              className={`tc-chat-btn ${hasUnread ? 'has-unread' : ''}`}
              title="Open Task Discussion / Chat"
              onClick={(e) => {
                e.stopPropagation();
                onOpenChat(task);
              }}
            >
              <MessageSquare size={13} />
              <span>Chat</span>
              {commentCount > 0 && <span className="tc-chat-count">{commentCount}</span>}
              {hasUnread && <span className="tc-unread-dot" />}
            </button>
          )}

          {/* Expand / Collapse Button */}
          <button 
            type="button"
            className={`tc-expand-btn ${isExpanded ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            aria-label={isExpanded ? "Collapse task details" : "Expand task details"}
            title={isExpanded ? "Collapse details" : "Expand details"}
          >
            <span>{isExpanded ? 'Less' : 'Details'}</span>
            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>
    </div>

    {/* In-App Verification Modal to Delete Task */}
    <ConfirmDeleteModal 
      isOpen={showDeleteConfirm}
      taskId={task.taskId}
      taskTitle={task.title}
      subtaskCount={task.subtasks?.length || subtasksList.length || 0}
      isDeleting={isDeleting}
      onConfirm={handleConfirmDelete}
      onCancel={() => setShowDeleteConfirm(false)}
    />
  </div>
  );
};

export default TaskCard;
