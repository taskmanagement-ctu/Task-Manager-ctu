import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle2, CornerDownRight, MessageSquare, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { api } from '../services/api';
import { calculateUrgency, getUrgencyCardStyle, getUrgencyLabel, getUrgencyColor } from '../utils/taskUrgency';
import './TaskCard.css';

interface TaskCardProps {
  task: any;
  currentUser: any;
  onClick: (task: any) => void;
  onCreateSubtask?: () => void;
  onOpenChat?: (task: any) => void;
  forceExpanded?: boolean | null;
}

const TaskCard: React.FC<TaskCardProps> = ({ 
  task, 
  currentUser, 
  onClick, 
  onCreateSubtask, 
  onOpenChat,
  forceExpanded
}) => {
  const [progress, setProgress] = useState<any>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

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

  const isCompleted = task.status === 'completed' || task.status === 'approved';
  const isSubmitted = task.status === 'submitted_for_review';
  
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
  const formatDateDDMMYYYY = (dateString: string) => {
    const d = new Date(dateString);
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
  const currentUserId = currentUser?._id || currentUser?.id;
  const hasUnread = Boolean(
    task.comments &&
    task.comments.length > 0 &&
    task.comments.some((c: any) => {
      if (!c.readBy || !Array.isArray(c.readBy)) return true;
      return !c.readBy.some((uid: any) => (uid?._id || uid)?.toString() === currentUserId?.toString());
    })
  );

  const isSuperAdmin = currentUser?.role === 'super_admin';
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
    <div 
      className={`tc-card ${isExpanded ? 'tc-is-expanded' : 'tc-is-collapsed'}`} 
      style={cardStyle} 
      onClick={handleCardClick}
    >
      {/* ── Header ── */}
      <div className="tc-header">
        <div className="tc-type">
          {task.isSubtask ? (
            <><CornerDownRight size={13} /> SUBTASK #{task.taskId}</>
          ) : (
            <span style={{ fontWeight: 800 }}>#{task.taskId}</span>
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

        {/* Progress Bar for subtasks */}
        {!task.isSubtask && progress && progress.total > 0 && !isCompleted && (
          <div className="tc-progress-container">
            <div className="tc-progress-label">
              <span>Subtasks</span>
              <span>{progress.approved} / {progress.total}</span>
            </div>
            <div className="tc-progress-bar">
              <div className="tc-progress-fill" style={{ width: `${progress.percentage}%` }}></div>
            </div>
          </div>
        )}

        {/* Add Subtask Button for Main Tasks */}
        {!task.isSubtask && onCreateSubtask && !isCompleted && (
          <div className="tc-add-subtask-wrap">
            <button 
              type="button"
              className="tc-add-subtask-btn" 
              onClick={(e) => {
                e.stopPropagation();
                onCreateSubtask();
              }}
            >
              + Add Subtask
            </button>
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
          {/* Assignee */}
          <div className="tc-assignee">
            <div className="tc-avatar">
              {displayAssignee?.name ? (
                <img 
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(displayAssignee.name)}&background=e2e8f0&color=0f172a`} 
                  alt="avatar" 
                  title={`Assigned to ${displayAssignee.name}`} 
                />
              ) : '?'}
            </div>
            <span className="tc-assignee-id">
              {displayAssignee ? (displayAssignee.universityId || displayAssignee.name?.substring(0, 10)) : 'Unassigned'}
            </span>
          </div>
          
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
  );
};

export default TaskCard;
