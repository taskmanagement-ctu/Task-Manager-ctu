import React, { useState, useEffect, useCallback } from 'react';
import { 
  ClipboardCheck, 
  CheckCircle2, 
  Clock, 
  Search, 
  RotateCcw, 
  AlertCircle, 
  Building2, 
  ExternalLink,
  Star,
  Paperclip,
  Download,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Video,
  FolderUp,
  File as FileIcon,
  Loader2,
  X
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import TaskModal from '../components/TaskModal';
import { calculateUrgency, getUrgencyCardStyle, getUrgencyColor, getUrgencyLabel } from '../utils/taskUrgency';
import './ReviewTasksPage.css';

// Helpers: File Type and Size
const getFileInfo = (filename: string) => {
  const ext = (filename || '').split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
    return { type: 'image', label: ext.toUpperCase(), color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' };
  }
  if (['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext)) {
    return { type: 'video', label: ext.toUpperCase(), color: '#9333ea', bg: '#faf5ff', border: '#f3e8ff' };
  }
  if (['pdf'].includes(ext)) {
    return { type: 'pdf', label: 'PDF', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' };
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return { type: 'sheet', label: ext.toUpperCase(), color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' };
  }
  if (['doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) {
    return { type: 'doc', label: ext.toUpperCase(), color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' };
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return { type: 'archive', label: ext.toUpperCase(), color: '#d97706', bg: '#fffbeb', border: '#fde68a' };
  }
  return { type: 'other', label: ext ? ext.toUpperCase() : 'FILE', color: '#475569', bg: '#f8fafc', border: '#e2e8f0' };
};

const renderFileTypeIcon = (type: string, color: string) => {
  switch (type) {
    case 'image': return <ImageIcon size={14} color={color} />;
    case 'video': return <Video size={14} color={color} />;
    case 'pdf': return <FileText size={14} color={color} />;
    case 'sheet': return <FileSpreadsheet size={14} color={color} />;
    case 'doc': return <FileText size={14} color={color} />;
    case 'archive': return <FolderUp size={14} color={color} />;
    default: return <FileIcon size={14} color={color} />;
  }
};

const formatFileSize = (bytes?: number) => {
  if (!bytes || bytes === 0) return '0 KB';
  const k = 1024;
  if (bytes < k * 1024) return `${Math.round(bytes / k)} KB`;
  return `${(bytes / (k * 1024)).toFixed(1)} MB`;
};

const formatDateTime = (dateString?: string | Date) => {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year}, ${hours}:${mins}`;
};

// Deliverables Sub-component for each card
const TaskDeliverablesList: React.FC<{ fileIds?: string[] }> = ({ fileIds }) => {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const fetchMetadata = async () => {
      try {
        setLoading(true);
        const resolved = await Promise.all(
          (fileIds || []).map(async (id: any) => {
            const rawId = typeof id === 'object' && id ? (id._id || id.id) : id;
            if (!rawId) return null;
            try {
              const res = await api.getFileMetadata(rawId.toString());
              return res.data?.file || null;
            } catch {
              return null;
            }
          })
        );
        if (isMounted) {
          setFiles(resolved.filter(Boolean));
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (fileIds && fileIds.length > 0) {
      fetchMetadata();
    } else {
      setFiles([]);
      setLoading(false);
    }
    return () => { isMounted = false; };
  }, [fileIds]);

  const apiUrl = import.meta.env.VITE_API_URL !== undefined 
    ? import.meta.env.VITE_API_URL 
    : (import.meta.env.DEV ? 'http://localhost:5000' : '');

  if (loading) {
    return (
      <div className="rt-deliv-loading">
        <Loader2 size={13} className="animate-spin" />
        <span>Loading attached deliverables...</span>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="rt-deliv-empty">
        <Paperclip size={13} />
        <span>No deliverable files attached</span>
      </div>
    );
  }

  return (
    <div className="rt-deliv-grid">
      {files.map((file, idx) => {
        const info = getFileInfo(file.filename);
        return (
          <div key={file._id || idx} className="rt-deliv-chip">
            <span className="rt-deliv-chip-icon" style={{ color: info.color, backgroundColor: info.bg }}>
              {renderFileTypeIcon(info.type, info.color)}
            </span>
            <div className="rt-deliv-chip-text">
              <span className="rt-deliv-chip-name" title={file.filename}>{file.filename}</span>
              <span className="rt-deliv-chip-meta">{info.label} • {formatFileSize(file.length)}</span>
            </div>
            <div className="rt-deliv-chip-actions">
              <a 
                href={`${apiUrl}/api/files/${file._id}`} 
                download={file.filename}
                target="_blank" 
                rel="noopener noreferrer"
                className="rt-deliv-action-icon-btn"
                title="Download file"
              >
                <Download size={13} />
              </a>
              <a 
                href={`${apiUrl}/api/files/${file._id}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="rt-deliv-action-icon-btn"
                title="Open file in new tab"
              >
                <ExternalLink size={13} />
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const ReviewTasksPage: React.FC = () => {
  const { currentUser } = useAuth();
  
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [departments, setDepartments] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const [counts, setCounts] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0
  });

  // TaskModal viewing state
  const [selectedTaskForModal, setSelectedTaskForModal] = useState<any | null>(null);

  // Quick Approval Modal State
  const [approvingTask, setApprovingTask] = useState<any | null>(null);
  const [approvalRating, setApprovalRating] = useState<number>(5);
  const [approvalFeedback, setApprovalFeedback] = useState<string>('');
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  // Quick Rejection / Request Revision Modal State
  const [rejectingTask, setRejectingTask] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isSubmittingRejection, setIsSubmittingRejection] = useState(false);
  const [rejectionError, setRejectionError] = useState<string | null>(null);

  // Fetch count stats
  const fetchCounts = useCallback(async () => {
    try {
      const [pendRes, appRes, rejRes] = await Promise.all([
        api.getTasks({ status: 'submitted_for_review', limit: 1 }),
        api.getTasks({ status: 'approved', limit: 1 }),
        api.getTasks({ status: 'rejected', limit: 1 })
      ]);

      const pendCount = pendRes.success ? (pendRes.data?.pagination?.total || 0) : 0;
      const appCount = appRes.success ? (appRes.data?.pagination?.total || 0) : 0;
      const rejCount = rejRes.success ? (rejRes.data?.pagination?.total || 0) : 0;

      setCounts({
        pending: pendCount,
        approved: appCount,
        rejected: rejCount,
        total: pendCount + appCount + rejCount
      });
    } catch (e) {
      console.error('Failed to load review counts', e);
    }
  }, []);

  // Fetch tasks for the current tab and filters
  const fetchTasks = useCallback(async (
    tab = activeTab, 
    searchTerm = search, 
    dept = departmentFilter, 
    pageNum = page
  ) => {
    try {
      setLoading(true);
      setError(null);

      let statusParam: string | undefined = undefined;
      if (tab === 'pending') statusParam = 'submitted_for_review';
      else if (tab === 'approved') statusParam = 'approved';
      else if (tab === 'rejected') statusParam = 'rejected';

      const res = await api.getTasks({
        status: statusParam,
        search: searchTerm || undefined,
        department: dept !== 'All' ? dept : undefined,
        page: pageNum,
        limit: 12
      });

      if (res.success && res.data) {
        setTasks(res.data.tasks || []);
        setTotalPages(res.data.pagination?.totalPages || 1);
      } else {
        setTasks([]);
        setError('Failed to fetch tasks for review.');
      }
    } catch (err: any) {
      console.error('Error fetching review tasks:', err);
      setError(err?.message || 'Error communicating with server.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, departmentFilter, page]);

  // Load departments if super admin
  useEffect(() => {
    if (currentUser?.role === 'super_admin') {
      api.getDepartments().then(res => {
        if (res.success && res.data?.departments) {
          setDepartments(res.data.departments);
        }
      }).catch(() => {});
    }
  }, [currentUser]);

  // Initial load & listeners
  useEffect(() => {
    fetchCounts();
    fetchTasks(activeTab, search, departmentFilter, page);

    const handleUpdate = () => {
      fetchCounts();
      fetchTasks(activeTab, search, departmentFilter, page);
    };

    window.addEventListener('task-review-updated', handleUpdate);
    window.addEventListener('task-updated', handleUpdate);

    return () => {
      window.removeEventListener('task-review-updated', handleUpdate);
      window.removeEventListener('task-updated', handleUpdate);
    };
  }, [fetchCounts, fetchTasks, activeTab, search, departmentFilter, page]);

  const handleTabChange = (newTab: 'pending' | 'approved' | 'rejected' | 'all') => {
    setActiveTab(newTab);
    setPage(1);
    fetchTasks(newTab, search, departmentFilter, 1);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTasks(activeTab, search, departmentFilter, 1);
  };

  // Submit Quick Approval
  const handleConfirmApproval = async () => {
    if (!approvingTask) return;
    try {
      setIsSubmittingApproval(true);
      setApprovalError(null);

      const res = await api.reviewTask(
        approvingTask._id,
        'approved',
        undefined,
        approvalRating,
        approvalFeedback.trim() || undefined
      );

      if (res.success) {
        setSuccessBanner(`Task #${approvingTask.taskId || approvingTask._id.slice(-6)} has been approved and marked complete! ⭐`);
        setTimeout(() => setSuccessBanner(null), 4000);
        setApprovingTask(null);
        setApprovalFeedback('');
        setApprovalRating(5);
        window.dispatchEvent(new Event('task-review-updated'));
        fetchCounts();
        fetchTasks(activeTab, search, departmentFilter, page);
      } else {
        setApprovalError((res as any).message || 'Failed to approve task.');
      }
    } catch (err: any) {
      setApprovalError(err?.message || 'Error occurred while approving task.');
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  // Submit Quick Rejection / Request Revision
  const handleConfirmRejection = async () => {
    if (!rejectingTask) return;
    if (!rejectionReason.trim()) {
      setRejectionError('Please provide clear revision instructions so the assignee knows what to fix.');
      return;
    }

    try {
      setIsSubmittingRejection(true);
      setRejectionError(null);

      const res = await api.reviewTask(
        rejectingTask._id,
        'rejected',
        rejectionReason.trim()
      );

      if (res.success) {
        setSuccessBanner(`Task #${rejectingTask.taskId || rejectingTask._id.slice(-6)} sent back for revision.`);
        setTimeout(() => setSuccessBanner(null), 4000);
        setRejectingTask(null);
        setRejectionReason('');
        window.dispatchEvent(new Event('task-review-updated'));
        fetchCounts();
        fetchTasks(activeTab, search, departmentFilter, page);
      } else {
        setRejectionError((res as any).message || 'Failed to reject task.');
      }
    } catch (err: any) {
      setRejectionError(err?.message || 'Error occurred while requesting revisions.');
    } finally {
      setIsSubmittingRejection(false);
    }
  };

  const getRatingLabel = (stars: number) => {
    switch (stars) {
      case 5: return '5 Stars — Exceptional / Outstanding';
      case 4: return '4 Stars — Very Good Work';
      case 3: return '3 Stars — Met Requirements';
      case 2: return '2 Stars — Below Expectations';
      case 1: return '1 Star — Major Quality Issues';
      default: return '';
    }
  };

  return (
    <div className="rt-container">
      {/* Page Header */}
      <div className="rt-header">
        <div className="rt-title-area">
          <h1>
            <ClipboardCheck size={26} color="#021c3b" />
            <span>Task Reviews & Approvals</span>
          </h1>
          <p>
            Review work submissions, inspect deliverables, rate performance, and approve or request revisions for assigned tasks.
          </p>
        </div>

        <div className="rt-header-actions">
          <button 
            type="button" 
            className="rt-refresh-btn"
            onClick={() => {
              fetchCounts();
              fetchTasks(activeTab, search, departmentFilter, page);
            }}
            disabled={loading}
            title="Refresh review list"
          >
            <RotateCcw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successBanner && (
        <div className="rt-alert-banner success">
          <CheckCircle2 size={18} />
          <span>{successBanner}</span>
          <button 
            type="button" 
            className="rt-alert-close" 
            onClick={() => setSuccessBanner(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Filter Tabs & Search Controls */}
      <div className="rt-controls-bar">
        <div className="rt-tabs">
          <button 
            type="button"
            className={`rt-tab ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => handleTabChange('pending')}
          >
            <span>Pending Review</span>
            <span className={`rt-tab-badge ${counts.pending > 0 ? 'pending' : ''}`}>
              {counts.pending}
            </span>
          </button>

          <button 
            type="button"
            className={`rt-tab ${activeTab === 'approved' ? 'active' : ''}`}
            onClick={() => handleTabChange('approved')}
          >
            <span>Approved</span>
            <span className="rt-tab-badge">{counts.approved}</span>
          </button>

          <button 
            type="button"
            className={`rt-tab ${activeTab === 'rejected' ? 'active' : ''}`}
            onClick={() => handleTabChange('rejected')}
          >
            <span>Revisions Requested</span>
            <span className="rt-tab-badge">{counts.rejected}</span>
          </button>

          <button 
            type="button"
            className={`rt-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => handleTabChange('all')}
          >
            <span>All Tasks</span>
            <span className="rt-tab-badge">{counts.total}</span>
          </button>
        </div>

        <div className="rt-filter-controls">
          {currentUser?.role === 'super_admin' && departments.length > 0 && (
            <div className="rt-dept-select-wrap">
              <Building2 size={14} className="rt-filter-icon" />
              <select
                className="rt-dept-select"
                value={departmentFilter}
                onChange={(e) => {
                  setDepartmentFilter(e.target.value);
                  setPage(1);
                  fetchTasks(activeTab, search, e.target.value, 1);
                }}
              >
                <option value="All">All Departments</option>
                {departments.map((d: any) => (
                  <option key={d._id || d.name} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>
          )}

          <form className="rt-search-box" onSubmit={handleSearchSubmit}>
            <Search size={15} />
            <input 
              type="text"
              className="rt-search-input"
              placeholder="Search by Task #, title, assignee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="rt-alert-banner error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Review Tasks List */}
      <div className="rt-list">
        {loading && tasks.length === 0 ? (
          <div className="rt-loading-box">
            <RotateCcw size={30} className="animate-spin" />
            <p>Loading tasks for review...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="rt-empty-state">
            <div className="rt-empty-icon">
              <ClipboardCheck size={32} />
            </div>
            <h3 className="rt-empty-title">
              {activeTab === 'pending' ? 'All caught up!' : 'No tasks found'}
            </h3>
            <p className="rt-empty-desc">
              {activeTab === 'pending'
                ? 'Great job! There are currently no task submissions waiting for your review.'
                : 'No tasks match the selected filter criteria.'}
            </p>
          </div>
        ) : (
          tasks.map((task) => {
            const assignee = task.delegatedTo || task.assignedTo;
            const urgency = calculateUrgency(task);
            const cardStyle = getUrgencyCardStyle(urgency);
            const urgencyColor = getUrgencyColor(urgency);
            const urgencyLabel = getUrgencyLabel(urgency);

            // Turnaround delta
            let turnaroundBadge = null;
            if (task.submittedAt && task.deadline) {
              const subTime = new Date(task.submittedAt).getTime();
              const deadTime = new Date(task.deadline).getTime();
              if (!isNaN(subTime) && !isNaN(deadTime)) {
                const diffMs = deadTime - subTime;
                const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
                if (diffMs >= 0) {
                  turnaroundBadge = (
                    <span className="rt-turnaround-badge on-time">
                      ✓ Submitted on time {diffDays > 0 ? `(${diffDays}d before deadline)` : ''}
                    </span>
                  );
                } else {
                  turnaroundBadge = (
                    <span className="rt-turnaround-badge late">
                      ⚠ Submitted after deadline ({Math.abs(diffDays)}d late)
                    </span>
                  );
                }
              }
            }

            return (
              <div 
                key={task._id} 
                className="rt-card"
                style={cardStyle}
              >
                {/* Card Top Header */}
                <div className="rt-card-header">
                  <div className="rt-card-top-meta">
                    <div className="rt-card-id-dept">
                      <span 
                        className="rt-task-id" 
                        onClick={() => setSelectedTaskForModal(task)}
                        title="Click to view full task"
                      >
                        #{task.taskId || task._id.slice(-6)}
                      </span>
                      {task.department && (
                        <span className="rt-dept-badge">
                          <Building2 size={11} />
                          <span>{task.department}</span>
                        </span>
                      )}
                      <span 
                        className="rt-urgency-badge" 
                        style={{ color: urgencyColor, borderColor: `${urgencyColor}40`, backgroundColor: `${urgencyColor}15` }}
                      >
                        {urgencyLabel}
                      </span>
                    </div>

                    <div className="rt-status-pill-wrap">
                      {task.status === 'submitted_for_review' && (
                        <span className="rt-status-pill pending">
                          <Clock size={12} />
                          <span>Awaiting Your Review</span>
                        </span>
                      )}
                      {task.status === 'approved' && (
                        <span className="rt-status-pill approved">
                          <CheckCircle2 size={12} />
                          <span>Approved & Completed</span>
                        </span>
                      )}
                      {task.status === 'rejected' && (
                        <span className="rt-status-pill rejected">
                          <RotateCcw size={12} />
                          <span>Revision Requested</span>
                        </span>
                      )}
                      {!['submitted_for_review', 'approved', 'rejected'].includes(task.status) && (
                        <span className="rt-status-pill other">
                          <span>{task.status?.replace('_', ' ').toUpperCase()}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 
                    className="rt-task-title" 
                    onClick={() => setSelectedTaskForModal(task)}
                    title="Click to view full task details"
                  >
                    {task.title}
                  </h3>

                  {task.description && (
                    <p className="rt-task-desc">
                      {task.description.length > 220 
                        ? `${task.description.slice(0, 220)}...` 
                        : task.description}
                    </p>
                  )}
                </div>

                {/* Assignee & Creator Info Grid */}
                <div className="rt-card-people-grid">
                  <div className="rt-person-col">
                    <span className="rt-col-label">SUBMITTED BY (ASSIGNEE)</span>
                    <div className="rt-person-card">
                      <div className="rt-avatar-circle">
                        {assignee?.name ? assignee.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="rt-person-details">
                        <span className="rt-person-name">{assignee?.name || 'Unassigned'}</span>
                        <span className="rt-person-sub">
                          {assignee?.universityId ? `ID: ${assignee.universityId}` : ''}
                          {assignee?.department ? ` • ${assignee.department}` : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rt-person-col">
                    <span className="rt-col-label">TASK CREATOR</span>
                    <div className="rt-person-card creator">
                      <div className="rt-avatar-circle creator">
                        {task.createdBy?.name ? task.createdBy.name.charAt(0).toUpperCase() : 'A'}
                      </div>
                      <div className="rt-person-details">
                        <span className="rt-person-name">{task.createdBy?.name || 'Admin'}</span>
                        <span className="rt-person-sub">
                          {task.createdBy?.role === 'super_admin' ? 'Super Admin' : 'Dept Admin'}
                          {task.createdBy?.department ? ` • ${task.createdBy.department}` : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timeline & Turnaround Section */}
                <div className="rt-card-timeline-row">
                  <div className="rt-timeline-item">
                    <span className="rt-timeline-label">SUBMITTED AT</span>
                    <span className="rt-timeline-val">{formatDateTime(task.submittedAt)}</span>
                  </div>

                  <div className="rt-timeline-item">
                    <span className="rt-timeline-label">DEADLINE</span>
                    <span className="rt-timeline-val">{formatDateTime(task.deadline)}</span>
                  </div>

                  {turnaroundBadge && (
                    <div className="rt-timeline-item delta">
                      <span className="rt-timeline-label">TIMELINESS</span>
                      {turnaroundBadge}
                    </div>
                  )}
                </div>

                {/* Deliverables & Work Files Section */}
                <div className="rt-card-deliverables-section">
                  <div className="rt-deliv-header">
                    <div className="rt-deliv-title-group">
                      <Paperclip size={14} className="rt-deliv-icon" />
                      <span className="rt-deliv-title">Submitted Deliverables & Proofs</span>
                      {task.completionAttachments && task.completionAttachments.length > 0 && (
                        <span className="rt-deliv-count">
                          {task.completionAttachments.length} {task.completionAttachments.length === 1 ? 'file' : 'files'}
                        </span>
                      )}
                    </div>
                  </div>

                  <TaskDeliverablesList fileIds={task.completionAttachments} />
                </div>

                {/* Rejection / Revision History if applicable */}
                {task.rejectionReason && (
                  <div className="rt-rejection-box">
                    <div className="rt-rejection-header">
                      <RotateCcw size={13} />
                      <span>Revision Instructions Provided to Assignee</span>
                    </div>
                    <p className="rt-rejection-text">"{task.rejectionReason}"</p>
                  </div>
                )}

                {/* Rating & Feedback Banner if approved */}
                {task.status === 'approved' && (task.rating || task.feedback) && (
                  <div className="rt-rating-box">
                    <div className="rt-rating-stars">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star 
                          key={s} 
                          size={15} 
                          fill={s <= (task.rating || 5) ? '#eab308' : 'none'} 
                          color={s <= (task.rating || 5) ? '#eab308' : '#cbd5e1'} 
                        />
                      ))}
                      <span className="rt-rating-score">
                        {task.rating ? `${task.rating}/5 Stars` : 'Approved'}
                      </span>
                    </div>
                    {task.feedback && (
                      <p className="rt-rating-feedback">"{task.feedback}"</p>
                    )}
                  </div>
                )}

                {/* Card Bottom Actions */}
                <div className="rt-card-footer">
                  <button 
                    type="button" 
                    className="rt-btn rt-btn-view"
                    onClick={() => setSelectedTaskForModal(task)}
                    title="View complete task with full discussion and details"
                  >
                    <ExternalLink size={14} />
                    <span>View Full Task</span>
                  </button>

                  {task.status === 'submitted_for_review' && (
                    <div className="rt-actions-right">
                      <button 
                        type="button" 
                        className="rt-btn rt-btn-reject"
                        onClick={() => {
                          setRejectingTask(task);
                          setRejectionReason('');
                          setRejectionError(null);
                        }}
                        title="Request changes and return task to assignee"
                      >
                        <RotateCcw size={14} />
                        <span>Request Changes</span>
                      </button>

                      <button 
                        type="button" 
                        className="rt-btn rt-btn-approve"
                        onClick={() => {
                          setApprovingTask(task);
                          setApprovalRating(5);
                          setApprovalFeedback('');
                          setApprovalError(null);
                        }}
                        title="Approve submission, rate work quality, and close task"
                      >
                        <CheckCircle2 size={15} />
                        <span>Approve & Rate</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="rt-pagination">
          <button 
            type="button" 
            className="rt-page-btn"
            disabled={page <= 1}
            onClick={() => {
              const prev = Math.max(1, page - 1);
              setPage(prev);
              fetchTasks(activeTab, search, departmentFilter, prev);
            }}
          >
            Previous
          </button>
          <span className="rt-page-info">
            Page {page} of {totalPages}
          </span>
          <button 
            type="button" 
            className="rt-page-btn"
            disabled={page >= totalPages}
            onClick={() => {
              const next = Math.min(totalPages, page + 1);
              setPage(next);
              fetchTasks(activeTab, search, departmentFilter, next);
            }}
          >
            Next
          </button>
        </div>
      )}

      {/* Quick Approval Modal Dialog */}
      {approvingTask && (
        <div className="rt-modal-overlay">
          <div className="rt-modal-card">
            <div className="rt-modal-header approve">
              <div className="rt-modal-header-left">
                <CheckCircle2 size={20} color="#15803d" />
                <h3>Approve Task Submission</h3>
              </div>
              <button 
                type="button" 
                className="rt-modal-close" 
                onClick={() => setApprovingTask(null)}
                disabled={isSubmittingApproval}
              >
                <X size={18} />
              </button>
            </div>

            <div className="rt-modal-body">
              <div className="rt-modal-task-summary">
                <span className="rt-summary-id">#{approvingTask.taskId || approvingTask._id.slice(-6)}</span>
                <span className="rt-summary-title">{approvingTask.title}</span>
              </div>

              {approvalError && (
                <div className="rt-modal-error">
                  <AlertCircle size={15} />
                  <span>{approvalError}</span>
                </div>
              )}

              <div className="rt-modal-field">
                <label className="rt-field-label">Rate Quality of Work (1 - 5 Stars):</label>
                <div className="rt-stars-picker">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`rt-star-btn ${s <= approvalRating ? 'filled' : ''}`}
                      onClick={() => setApprovalRating(s)}
                      aria-label={`${s} star`}
                    >
                      <Star 
                        size={26} 
                        fill={s <= approvalRating ? '#eab308' : 'none'} 
                        color={s <= approvalRating ? '#eab308' : '#cbd5e1'} 
                      />
                    </button>
                  ))}
                </div>
                <span className="rt-rating-hint">{getRatingLabel(approvalRating)}</span>
              </div>

              <div className="rt-modal-field">
                <label className="rt-field-label">
                  Commendation / Feedback Note <span className="rt-optional">(Optional)</span>:
                </label>
                <textarea 
                  className="rt-textarea"
                  rows={3}
                  placeholder="e.g. Excellent attention to detail and completed on schedule. Well done!"
                  value={approvalFeedback}
                  onChange={(e) => setApprovalFeedback(e.target.value)}
                  maxLength={1000}
                />
              </div>
            </div>

            <div className="rt-modal-footer">
              <button 
                type="button" 
                className="rt-btn-cancel" 
                onClick={() => setApprovingTask(null)}
                disabled={isSubmittingApproval}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="rt-btn-confirm-approve" 
                onClick={handleConfirmApproval}
                disabled={isSubmittingApproval}
              >
                {isSubmittingApproval ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Approving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Confirm Approval & Complete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Rejection / Request Revision Modal Dialog */}
      {rejectingTask && (
        <div className="rt-modal-overlay">
          <div className="rt-modal-card">
            <div className="rt-modal-header reject">
              <div className="rt-modal-header-left">
                <RotateCcw size={20} color="#b91c1c" />
                <h3>Request Changes / Revisions</h3>
              </div>
              <button 
                type="button" 
                className="rt-modal-close" 
                onClick={() => setRejectingTask(null)}
                disabled={isSubmittingRejection}
              >
                <X size={18} />
              </button>
            </div>

            <div className="rt-modal-body">
              <div className="rt-modal-task-summary">
                <span className="rt-summary-id">#{rejectingTask.taskId || rejectingTask._id.slice(-6)}</span>
                <span className="rt-summary-title">{rejectingTask.title}</span>
              </div>

              <div className="rt-reject-notice-box">
                <AlertCircle size={15} />
                <span>
                  This task will be returned to the assignee as <strong>In Progress</strong>. Please specify clearly what corrections or deliverables are needed.
                </span>
              </div>

              {rejectionError && (
                <div className="rt-modal-error">
                  <AlertCircle size={15} />
                  <span>{rejectionError}</span>
                </div>
              )}

              <div className="rt-modal-field">
                <label className="rt-field-label">
                  Revision Requirements <span className="rt-required">*</span>:
                </label>
                <textarea 
                  className="rt-textarea"
                  rows={4}
                  placeholder="e.g. Please update the summary section in the Excel sheet and re-upload the signed approval document before resubmitting."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  maxLength={1000}
                />
              </div>
            </div>

            <div className="rt-modal-footer">
              <button 
                type="button" 
                className="rt-btn-cancel" 
                onClick={() => setRejectingTask(null)}
                disabled={isSubmittingRejection}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="rt-btn-confirm-reject" 
                onClick={handleConfirmRejection}
                disabled={isSubmittingRejection}
              >
                {isSubmittingRejection ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Sending Back...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw size={16} />
                    <span>Send Back for Revision</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Task Modal View */}
      {selectedTaskForModal && (
        <TaskModal
          task={selectedTaskForModal}
          currentUser={currentUser}
          onClose={() => setSelectedTaskForModal(null)}
          onRefresh={() => {
            fetchCounts();
            fetchTasks(activeTab, search, departmentFilter, page);
            setSelectedTaskForModal(null);
          }}
        />
      )}
    </div>
  );
};

export default ReviewTasksPage;
