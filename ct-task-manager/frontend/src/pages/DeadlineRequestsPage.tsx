import React, { useState, useEffect, useCallback } from 'react';
import { 
  CalendarClock, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ArrowRight, 
  Search, 
  RotateCcw, 
  AlertCircle, 
  User as UserIcon, 
  X, 
  Calendar,
  Send,
  Building2,
  ExternalLink
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import TaskModal from '../components/TaskModal';
import { calculateUrgency, getUrgencyCardStyle, getUrgencyColor, getUrgencyLabel } from '../utils/taskUrgency';
import './DeadlineRequestsPage.css';

// Helper: Format Date & Time for display (strings)
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

// Helper: Render Date & Time with distinct styling tags for compact mobile presentation
const renderDateBadge = (dateString?: string | Date) => {
  if (!dateString) return <span className="dr-val-date">—</span>;
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return <span className="dr-val-date">—</span>;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return (
    <>
      <span className="dr-val-date">{`${day}/${month}/${year}`}</span>
      <span className="dr-val-time">{`${hours}:${mins}`}</span>
    </>
  );
};

// Helper: Format to local input datetime string (YYYY-MM-DDTHH:mm)
const formatToInputDate = (dateString?: string | Date) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Helper: Calculate days between two dates
const getDaysDiff = (start?: string | Date, end?: string | Date) => {
  if (!start || !end) return null;
  const d1 = new Date(start).getTime();
  const d2 = new Date(end).getTime();
  if (isNaN(d1) || isNaN(d2)) return null;
  const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
  return diffDays;
};

const DeadlineRequestsPage: React.FC = () => {
  const { currentUser } = useAuth();
  
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [search, setSearch] = useState('');
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

  // Review Modal State
  const [reviewTaskTarget, setReviewTaskTarget] = useState<any | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | 'endorse'>('approve');
  const [approvedDeadline, setApprovedDeadline] = useState('');
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const fetchRequests = useCallback(async (tab = activeTab, searchTerm = search, pageNum = page) => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await api.getDeadlineRequests({
        status: tab,
        search: searchTerm,
        page: pageNum,
        limit: 15
      });

      if (res.success && res.data) {
        setTasks(res.data.tasks || []);
        setTotalPages(res.data.totalPages || 1);
        if (res.data.counts) {
          setCounts(res.data.counts);
        }
      } else {
        setTasks([]);
      }
    } catch (err: any) {
      console.error('Failed to fetch deadline requests:', err);
      setError(err.message || 'Failed to load deadline extension requests.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, page]);

  useEffect(() => {
    fetchRequests(activeTab, search, page);
  }, [activeTab, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchRequests(activeTab, search, 1);
  };

  const handleTabChange = (tab: 'pending' | 'approved' | 'rejected' | 'all') => {
    setActiveTab(tab);
    setPage(1);
  };

  // Open review dialog
  const openReviewModal = (task: any, action: 'approve' | 'reject' | 'endorse') => {
    setReviewTaskTarget(task);
    setReviewAction(action);
    setReviewRemarks('');
    setReviewError(null);

    if (action === 'approve') {
      const defaultDate = task.extensionRequest?.requestedDeadline || task.deadline;
      setApprovedDeadline(formatToInputDate(defaultDate));
    } else {
      setApprovedDeadline('');
    }
  };

  const closeReviewModal = () => {
    if (isSubmittingReview) return;
    setReviewTaskTarget(null);
    setReviewError(null);
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewTaskTarget) return;

    if (reviewAction === 'reject' && !reviewRemarks.trim()) {
      setReviewError('Please provide a reason / remarks for rejecting this request.');
      return;
    }

    try {
      setIsSubmittingReview(true);
      setReviewError(null);

      const payload: any = {
        action: reviewAction,
        remarks: reviewRemarks.trim()
      };

      if (reviewAction === 'approve' && approvedDeadline) {
        payload.approvedDeadline = new Date(approvedDeadline).toISOString();
      }

      const res = await api.reviewDeadlineExtension(reviewTaskTarget._id, payload);

      if (res.success) {
        closeReviewModal();
        fetchRequests(activeTab, search, page);
      } else {
        setReviewError(res.message || 'Failed to submit review.');
      }
    } catch (err: any) {
      console.error('Error submitting deadline review:', err);
      setReviewError(err.message || 'Server error while submitting review.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const isSuperAdmin = currentUser?.role === 'super_admin';

  return (
    <div className="dr-container">
      {/* Page Header */}
      <div className="dr-header">
        <div className="dr-title-area">
          <h1>
            <CalendarClock size={26} color="#0f172a" />
            Deadline Extension Requests
          </h1>
          <p>
            {isSuperAdmin
              ? 'Review and manage university-wide deadline extension requests submitted by faculty and staff.'
              : 'Review, endorse, or approve deadline extensions for tasks in your department.'}
          </p>
        </div>

        <div className="dr-header-actions">
          <button 
            type="button" 
            className="dr-refresh-btn" 
            onClick={() => fetchRequests(activeTab, search, page)}
            disabled={loading}
            title="Refresh requests"
          >
            <RotateCcw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Controls */}
      <div className="dr-controls-bar">
        <div className="dr-tabs">
          <button 
            type="button"
            className={`dr-tab ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => handleTabChange('pending')}
          >
            <span>Pending</span>
            <span className={`dr-tab-badge ${counts.pending > 0 ? 'pending' : ''}`}>
              {counts.pending}
            </span>
          </button>

          <button 
            type="button"
            className={`dr-tab ${activeTab === 'approved' ? 'active' : ''}`}
            onClick={() => handleTabChange('approved')}
          >
            <span>Approved</span>
            <span className="dr-tab-badge">{counts.approved}</span>
          </button>

          <button 
            type="button"
            className={`dr-tab ${activeTab === 'rejected' ? 'active' : ''}`}
            onClick={() => handleTabChange('rejected')}
          >
            <span>Rejected</span>
            <span className="dr-tab-badge">{counts.rejected}</span>
          </button>

          <button 
            type="button"
            className={`dr-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => handleTabChange('all')}
          >
            <span>All</span>
            <span className="dr-tab-badge">{counts.total}</span>
          </button>
        </div>

        <form className="dr-search-box" onSubmit={handleSearchSubmit}>
          <Search size={15} />
          <input 
            type="text"
            className="dr-search-input"
            placeholder="Search by Task #, title, staff, reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>
      </div>

      {/* Error Notice */}
      {error && (
        <div style={{
          background: '#fee2e2',
          border: '1px solid #fecaca',
          color: '#991b1b',
          padding: '0.8rem 1.1rem',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          fontSize: '0.85rem'
        }}>
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      {/* Requests List */}
      <div className="dr-list">
        {loading && tasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem', color: '#64748b' }}>
            <RotateCcw size={28} className="animate-spin" style={{ margin: '0 auto 0.75rem' }} />
            <p style={{ margin: 0, fontWeight: 600 }}>Loading deadline extension requests...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="dr-empty-state">
            <div className="dr-empty-icon">
              <CalendarClock size={28} />
            </div>
            <h3 className="dr-empty-title">No deadline requests found</h3>
            <p className="dr-empty-desc">
              {activeTab === 'pending'
                ? 'Great news! There are currently no pending deadline extension requests requiring your review.'
                : 'No extension requests match the selected filter criteria.'}
            </p>
          </div>
        ) : (
          tasks.map((task) => {
            const ext = task.extensionRequest;
            const reqUser = ext?.requestedBy || task.assignedTo;
            const daysDelta = getDaysDiff(task.deadline, ext?.requestedDeadline);
            const isCreatorSuperAdmin = task.createdBy?.role === 'super_admin';
            const isDeptAdmin = currentUser?.role === 'department_admin';
            const isMyDeptOrTask = isSuperAdmin || (
              (task.createdBy?._id || task.createdBy) === (currentUser?._id || currentUser?.id) ||
              (task.assignedTo?._id || task.assignedTo) === (currentUser?._id || currentUser?.id) ||
              (task.delegatedTo?._id || task.delegatedTo) === (currentUser?._id || currentUser?.id) ||
              Boolean(currentUser?.department && (
                (task.department && task.department.trim().toLowerCase() === currentUser.department.trim().toLowerCase()) ||
                (reqUser?.department && reqUser.department.trim().toLowerCase() === currentUser.department.trim().toLowerCase())
              ))
            );
            const canEndorse = isDeptAdmin && isMyDeptOrTask && isCreatorSuperAdmin && ext?.status === 'pending' && ext?.stage === 'department_admin';
            const canApprove = isSuperAdmin || (isDeptAdmin && isMyDeptOrTask && !isCreatorSuperAdmin);
            const isPendingOrEndorsed = ext?.status === 'pending' || ext?.status === 'endorsed';

            const urgency = calculateUrgency(task);
            const cardStyle = getUrgencyCardStyle(urgency);
            const urgencyColor = getUrgencyColor(urgency);
            const urgencyLabel = getUrgencyLabel(urgency);

            return (
              <div 
                key={task._id} 
                className="dr-card"
                style={cardStyle}
              >
                {/* Card Top Header */}
                <div className="dr-card-header">
                  <div className="dr-card-top-meta">
                    <div className="dr-card-id-dept">
                      <span className="dr-task-id" onClick={() => setSelectedTaskForModal(task)} title="Click to view task details">#{task.taskId || task._id.slice(-6)}</span>
                      {task.department && (
                        <span className="dr-dept-badge">
                          <Building2 size={11} />
                          <span>{task.department}</span>
                        </span>
                      )}
                      <span 
                        className="dr-urgency-badge"
                        style={{
                          color: urgencyColor,
                          borderColor: `${urgencyColor}40`,
                          backgroundColor: `${urgencyColor}15`
                        }}
                      >
                        {urgencyLabel}
                      </span>
                    </div>

                    <div className="dr-badges-row">
                      {ext?.status === 'pending' && (
                        <span className="dr-badge pending">
                          <Clock size={11} />
                          <span>{ext?.stage === 'super_admin' ? 'Awaiting Super Admin' : 'Pending Review'}</span>
                        </span>
                      )}

                      {ext?.status === 'endorsed' && (
                        <span className="dr-badge endorsed">
                          <Send size={11} />
                          <span>Endorsed</span>
                        </span>
                      )}

                      {ext?.status === 'approved' && (
                        <span className="dr-badge approved">
                          <CheckCircle2 size={11} />
                          <span>Approved</span>
                        </span>
                      )}

                      {ext?.status === 'rejected' && (
                        <span className="dr-badge rejected">
                          <XCircle size={11} />
                          <span>Rejected</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 
                    className="dr-task-title" 
                    onClick={() => setSelectedTaskForModal(task)}
                    title="Click to view full task details"
                  >
                    {task.title}
                  </h3>
                </div>

                {/* Card Body */}
                <div className="dr-card-body">
                  {/* Requester Info */}
                  <div className="dr-requester-info">
                    <div className="dr-user-row">
                      <div className="dr-avatar">
                        {reqUser?.name ? reqUser.name.charAt(0).toUpperCase() : <UserIcon size={14} />}
                      </div>
                      <div className="dr-user-meta">
                        <div className="dr-user-name-line">
                          <span className="dr-user-name">{reqUser?.name || 'Assigned Staff'}</span>
                          {reqUser?.universityId && (
                            <span className="dr-user-id">({reqUser.universityId})</span>
                          )}
                        </div>
                        <div className="dr-req-time">
                          <Calendar size={11} />
                          <span>Req: {formatDateTime(ext?.createdAt || task.updatedAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Deadline Timeline & Comparison */}
                  <div className="dr-deadline-timeline">
                    <div className="dr-dates-comparison">
                      <div className="dr-date-box current">
                        <span className="dr-date-label">Current</span>
                        <div className="dr-date-val old">
                          {renderDateBadge(task.deadline)}
                        </div>
                      </div>

                      <div className="dr-date-arrow-wrap">
                        <ArrowRight size={13} className="dr-date-arrow-icon" />
                        {daysDelta !== null && daysDelta > 0 && ext?.status !== 'approved' && (
                          <span className="dr-delta-pill">+{daysDelta}d</span>
                        )}
                      </div>

                      <div className={`dr-date-box ${ext?.status === 'approved' ? 'approved' : 'requested'}`}>
                        <span className="dr-date-label">
                          {ext?.status === 'approved' ? 'Approved' : 'Requested'}
                        </span>
                        <div className={`dr-date-val ${ext?.status === 'approved' ? 'approved' : 'new'}`}>
                          {renderDateBadge(ext?.status === 'approved' && ext?.approvedDeadline ? ext.approvedDeadline : ext?.requestedDeadline)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stated Reason */}
                {ext?.reason && (
                  <div className="dr-reason-box">
                    <span className="dr-reason-label">Reason:</span>
                    <span className="dr-reason-text">"{ext.reason}"</span>
                  </div>
                )}

                {/* Endorsement Note (if forwarded by Dept Admin) */}
                {ext?.deptAdminActionBy && (
                  <div className="dr-decision-box" style={{ background: '#eff6ff', borderColor: '#bfdbfe' }}>
                    <div style={{ color: '#1e40af', fontWeight: 700 }}>
                      ↗ Endorsed by {ext.deptAdminActionBy?.name || 'Department Admin'}
                      {ext.deptAdminActionAt ? ` on ${formatDateTime(ext.deptAdminActionAt)}` : ''}
                    </div>
                    {ext.deptAdminRemarks && (
                      <div style={{ color: '#1e3a8a' }}>"{ext.deptAdminRemarks}"</div>
                    )}
                  </div>
                )}

                {/* Decision Info (if already decided) */}
                {ext?.status === 'approved' && ext?.decidedBy && (
                  <div className="dr-decision-box" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                    <div style={{ color: '#166534', fontWeight: 700 }}>
                      ✓ Approved by {ext.decidedBy?.name || 'Administrator'} on {formatDateTime(ext.decidedAt)}
                    </div>
                  </div>
                )}

                {ext?.status === 'rejected' && (
                  <div className="dr-decision-box" style={{ background: '#fef2f2', borderColor: '#fecaca' }}>
                    <div style={{ color: '#991b1b', fontWeight: 700 }}>
                      ✕ Rejected by {ext.decidedBy?.name || 'Administrator'}
                      {ext.decidedAt ? ` on ${formatDateTime(ext.decidedAt)}` : ''}
                    </div>
                    {ext.decisionReason && (
                      <div style={{ color: '#7f1d1d' }}>Reason: "{ext.decisionReason}"</div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="dr-card-actions">
                  <button
                    type="button"
                    className="dr-btn dr-btn-secondary"
                    onClick={() => setSelectedTaskForModal(task)}
                    title="View task details"
                  >
                    <ExternalLink size={13} />
                    <span className="dr-btn-label-full">View Task</span>
                    <span className="dr-btn-label-short">View</span>
                  </button>

                  {/* Actions for Pending/Endorsed Requests */}
                  {isPendingOrEndorsed && (
                    <>
                      {canEndorse ? (
                        <>
                          <button
                            type="button"
                            className="dr-btn dr-btn-endorse"
                            onClick={() => openReviewModal(task, 'endorse')}
                          >
                            <Send size={13} />
                            <span>Endorse</span>
                          </button>

                          <button
                            type="button"
                            className="dr-btn dr-btn-reject"
                            onClick={() => openReviewModal(task, 'reject')}
                          >
                            <XCircle size={13} />
                            <span>Reject</span>
                          </button>
                        </>
                      ) : canApprove ? (
                        <>
                          <button
                            type="button"
                            className="dr-btn dr-btn-reject"
                            onClick={() => openReviewModal(task, 'reject')}
                          >
                            <XCircle size={13} />
                            <span>Reject</span>
                          </button>

                          <button
                            type="button"
                            className="dr-btn dr-btn-approve"
                            onClick={() => openReviewModal(task, 'approve')}
                          >
                            <CheckCircle2 size={13} />
                            <span>Approve</span>
                          </button>
                        </>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
          <button
            type="button"
            className="dr-btn dr-btn-secondary"
            disabled={page <= 1 || loading}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className="dr-btn dr-btn-secondary"
            disabled={page >= totalPages || loading}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      )}

      {/* ─── Review Modal Dialog ─── */}
      {reviewTaskTarget && (
        <div className="dr-modal-overlay" onClick={closeReviewModal}>
          <div className="dr-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="dr-modal-header">
              <h3>
                {reviewAction === 'approve' && <CheckCircle2 size={19} color="#10b981" />}
                {reviewAction === 'reject' && <XCircle size={19} color="#ef4444" />}
                {reviewAction === 'endorse' && <Send size={19} color="#2563eb" />}
                <span>
                  {reviewAction === 'approve' ? 'Approve Deadline Extension' : reviewAction === 'reject' ? 'Reject Extension Request' : 'Endorse to Super Admin'}
                </span>
              </h3>
              <button type="button" className="dr-modal-close" onClick={closeReviewModal}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleReviewSubmit}>
              <div className="dr-modal-body">
                {/* Task Context Card */}
                <div style={{ background: '#f8fafc', padding: '0.75rem 0.9rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.82rem' }}>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>
                    Task: #{reviewTaskTarget.taskId || ''} - {reviewTaskTarget.title}
                  </div>
                  <div style={{ color: '#64748b', marginTop: '0.2rem' }}>
                    Requester: {reviewTaskTarget.extensionRequest?.requestedBy?.name || 'Staff member'}
                  </div>
                  {reviewTaskTarget.extensionRequest?.requestedDeadline && (
                    <div style={{ color: '#d97706', fontWeight: 600, marginTop: '0.25rem' }}>
                      Requested Deadline: {formatDateTime(reviewTaskTarget.extensionRequest.requestedDeadline)}
                    </div>
                  )}
                </div>

                {reviewError && (
                  <div style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', padding: '0.65rem 0.85rem', borderRadius: '6px', fontSize: '0.82rem' }}>
                    {reviewError}
                  </div>
                )}

                {/* For Approve: Option to confirm or customize new deadline */}
                {reviewAction === 'approve' && (
                  <div className="dr-field">
                    <label>Approved Deadline Date &amp; Time *</label>
                    <input 
                      type="datetime-local"
                      className="dr-input"
                      required
                      value={approvedDeadline}
                      onChange={(e) => setApprovedDeadline(e.target.value)}
                    />
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Defaults to the requested deadline. You may adjust it if required.
                    </span>
                  </div>
                )}

                {/* Remarks Input */}
                <div className="dr-field">
                  <label>
                    {reviewAction === 'reject' ? 'Reason for Rejection *' : 'Remarks / Note (Optional)'}
                  </label>
                  <textarea 
                    className="dr-textarea"
                    placeholder={
                      reviewAction === 'reject'
                        ? 'Explain why this deadline extension cannot be approved...'
                        : reviewAction === 'endorse'
                        ? 'Add any departmental recommendation notes for Super Admin...'
                        : 'e.g., Extension granted in view of upcoming examination schedule.'
                    }
                    value={reviewRemarks}
                    onChange={(e) => setReviewRemarks(e.target.value)}
                    required={reviewAction === 'reject'}
                  />
                </div>
              </div>

              <div className="dr-modal-footer">
                <button 
                  type="button" 
                  className="dr-btn dr-btn-secondary" 
                  onClick={closeReviewModal}
                  disabled={isSubmittingReview}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className={`dr-btn ${reviewAction === 'approve' ? 'dr-btn-approve' : reviewAction === 'endorse' ? 'dr-btn-endorse' : 'dr-btn-reject'}`}
                  disabled={isSubmittingReview}
                >
                  {isSubmittingReview ? 'Saving...' : reviewAction === 'approve' ? 'Confirm Approval' : reviewAction === 'endorse' ? 'Confirm & Forward' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Full Task View Modal ─── */}
      {selectedTaskForModal && (
        <TaskModal
          task={selectedTaskForModal}
          currentUser={currentUser}
          onClose={() => setSelectedTaskForModal(null)}
          onRefresh={() => {
            fetchRequests(activeTab, search, page);
            setSelectedTaskForModal(null);
          }}
        />
      )}
    </div>
  );
};

export default DeadlineRequestsPage;
