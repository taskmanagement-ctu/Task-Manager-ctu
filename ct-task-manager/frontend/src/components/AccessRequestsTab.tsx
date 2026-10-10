import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  api,
  AccessRequest,
  AccessRequestStats,
  Pagination,
  Department,
} from '../services/api';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Check,
  X,
  Filter,
  Mail,
  Phone,
  Building2,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import './AccessRequestsTab.css';

interface AccessRequestsTabProps {
  isDeptAdmin: boolean;
  currentUserDepartment?: string | null;
  departments: Department[];
  onStatsChange?: (stats: AccessRequestStats) => void;
  onRequestApproved?: () => void;
}

const AccessRequestsTab: React.FC<AccessRequestsTabProps> = ({
  isDeptAdmin,
  currentUserDepartment,
  departments,
  onStatsChange,
  onRequestApproved,
}) => {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [stats, setStats] = useState<AccessRequestStats | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 15,
    total: 0,
    totalPages: 0,
  });

  // Filters
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Reject Modal State
  const [rejectModal, setRejectModal] = useState<{
    isOpen: boolean;
    request: AccessRequest | null;
    reason: string;
  }>({
    isOpen: false,
    request: null,
    reason: '',
  });

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.getAccessRequestStats();
      if (res.success) {
        setStats(res.data);
        if (onStatsChange) onStatsChange(res.data);
      }
    } catch (err) {
      console.error('Failed to load access request stats', err);
    }
  }, [onStatsChange]);

  const fetchRequests = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const deptParam = isDeptAdmin
        ? currentUserDepartment || undefined
        : (departmentFilter !== 'All' ? departmentFilter : undefined);

      const res = await api.getAccessRequests({
        page,
        limit: 15,
        status: statusFilter,
        department: deptParam,
        search: search.trim() || undefined,
      });

      if (res.success) {
        setRequests(res.data.requests);
        setPagination(res.data.pagination);
      }
    } catch (err) {
      console.error('Failed to load access requests', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, departmentFilter, search, isDeptAdmin, currentUserDepartment]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchRequests(1);
  }, [fetchRequests]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      fetchRequests(1);
    }, 300);
  };

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4500);
  };

  // ─── Approve Action ─────────────────────────────────────────
  const handleApprove = async (req: AccessRequest) => {
    try {
      setActionLoadingId(req._id);
      const res = await api.approveAccessRequest(req._id);
      if (res.success) {
        showToast(`Access approved for ${req.name} (${req.universityId}). Added to verified records & email sent.`);
        await Promise.all([fetchRequests(pagination.page), fetchStats()]);
        if (onRequestApproved) onRequestApproved();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to approve request', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // ─── Reject Action ──────────────────────────────────────────
  const openRejectModal = (req: AccessRequest) => {
    setRejectModal({
      isOpen: true,
      request: req,
      reason: 'Credentials could not be verified in institutional records.',
    });
  };

  const handleConfirmReject = async () => {
    if (!rejectModal.request) return;
    try {
      setActionLoadingId(rejectModal.request._id);
      const res = await api.rejectAccessRequest(rejectModal.request._id, rejectModal.reason);
      if (res.success) {
        showToast(`Access request for ${rejectModal.request.name} was rejected.`);
        setRejectModal({ isOpen: false, request: null, reason: '' });
        await Promise.all([fetchRequests(pagination.page), fetchStats()]);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to reject request', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="art-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`art-toast ${toastMessage.type}`}>
          {toastMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{toastMessage.text}</span>
          <button className="art-toast-close" onClick={() => setToastMessage(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="art-stats-grid">
          <div
            className={`art-stat-card pending ${statusFilter === 'pending' ? 'active-filter' : ''}`}
            onClick={() => setStatusFilter('pending')}
          >
            <div className="art-stat-icon-wrap pending">
              <Clock size={20} />
            </div>
            <div>
              <div className="art-stat-value">{stats.pending}</div>
              <div className="art-stat-label">Pending Review</div>
            </div>
          </div>

          <div
            className={`art-stat-card approved ${statusFilter === 'approved' ? 'active-filter' : ''}`}
            onClick={() => setStatusFilter('approved')}
          >
            <div className="art-stat-icon-wrap approved">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <div className="art-stat-value">{stats.approved}</div>
              <div className="art-stat-label">Approved Requests</div>
            </div>
          </div>

          <div
            className={`art-stat-card rejected ${statusFilter === 'rejected' ? 'active-filter' : ''}`}
            onClick={() => setStatusFilter('rejected')}
          >
            <div className="art-stat-icon-wrap rejected">
              <XCircle size={20} />
            </div>
            <div>
              <div className="art-stat-value">{stats.rejected}</div>
              <div className="art-stat-label">Rejected Requests</div>
            </div>
          </div>

          <div
            className={`art-stat-card total ${statusFilter === 'all' ? 'active-filter' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            <div className="art-stat-icon-wrap total">
              <RefreshCw size={20} />
            </div>
            <div>
              <div className="art-stat-value">{stats.total}</div>
              <div className="art-stat-label">Total Submissions</div>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="art-toolbar">
        <div className="art-search-wrap">
          <Search size={16} className="art-search-icon" />
          <input
            type="text"
            placeholder="Search by name, ID, email, phone..."
            value={search}
            onChange={handleSearchChange}
            className="art-search-input"
          />
          {search && (
            <button className="art-search-clear" onClick={() => { setSearch(''); fetchRequests(1); }}>
              <X size={14} />
            </button>
          )}
        </div>

        <div className="art-filter-group">
          {/* Status Filter */}
          <div className="art-select-wrap">
            <Filter size={14} className="art-select-icon" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="art-select"
            >
              <option value="pending">Pending Only</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="all">All Requests</option>
            </select>
          </div>

          {/* Department Filter (For Super Admin) */}
          {!isDeptAdmin && (
            <div className="art-select-wrap">
              <Building2 size={14} className="art-select-icon" />
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="art-select"
              >
                <option value="All">All Departments</option>
                {departments.map((d) => (
                  <option key={d._id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button className="btn btn-secondary art-refresh-btn" onClick={() => { fetchRequests(pagination.page); fetchStats(); }} title="Refresh list">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Requests Table */}
      <div className="art-table-card">
        {loading ? (
          <div className="art-loading-state">
            <Loader2 size={32} className="art-spin" />
            <p>Loading access requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="art-empty-state">
            <div className="art-empty-icon-wrap">
              <Clock size={36} />
            </div>
            <h3>No Access Requests Found</h3>
            <p>
              {statusFilter === 'pending'
                ? 'Great! There are no pending access requests waiting for review.'
                : 'No access requests matching your active filters.'}
            </p>
          </div>
        ) : (
          <div className="art-table-responsive">
            <table className="art-table">
              <thead>
                <tr>
                  <th>University ID</th>
                  <th>Applicant Name</th>
                  <th>Contact Info</th>
                  <th>Department</th>
                  <th>Remarks / Reason</th>
                  <th>Submitted At</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req._id} className={`art-row status-${req.status}`}>
                    {/* University ID */}
                    <td>
                      <span className="art-uid-badge">{req.universityId}</span>
                    </td>

                    {/* Name & Type */}
                    <td>
                      <div className="art-applicant-name">
                        <strong>{req.name}</strong>
                        <span className={`art-usertype-pill ${req.userType}`}>
                          {req.userType === 'teaching'
                            ? 'Teaching Staff'
                            : req.userType === 'non_teaching'
                            ? 'Non-Teaching Staff'
                            : req.userType === 'student'
                            ? 'Student'
                            : 'Staff / Faculty'}
                        </span>
                      </div>
                    </td>

                    {/* Contact Info */}
                    <td>
                      <div className="art-contact-info">
                        <div className="art-contact-item">
                          <Mail size={12} />
                          <span>{req.email}</span>
                        </div>
                        <div className="art-contact-item">
                          <Phone size={12} />
                          <span>{req.phone}</span>
                        </div>
                      </div>
                    </td>

                    {/* Department */}
                    <td>
                      <span className="art-dept-text">{req.department || '—'}</span>
                    </td>

                    {/* Remarks / Reason */}
                    <td>
                      <div className="art-reason-box" title={req.reason || 'No remarks provided'}>
                        {req.reason ? req.reason : <span style={{ color: '#94a3b8' }}>None</span>}
                      </div>
                    </td>

                    {/* Submitted At */}
                    <td>
                      <div className="art-date-text">
                        {new Date(req.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                        <div className="art-time-text">
                          {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td>
                      <span className={`art-status-badge ${req.status}`}>
                        {req.status === 'pending' && <Clock size={12} />}
                        {req.status === 'approved' && <Check size={12} />}
                        {req.status === 'rejected' && <X size={12} />}
                        {req.status === 'pending' && 'Pending'}
                        {req.status === 'approved' && 'Approved'}
                        {req.status === 'rejected' && 'Rejected'}
                      </span>
                    </td>

                    {/* Action Buttons */}
                    <td style={{ textAlign: 'right' }}>
                      {req.status === 'pending' ? (
                        <div className="art-actions-cell">
                          <button
                            type="button"
                            className="btn btn-sm art-btn-approve"
                            onClick={() => handleApprove(req)}
                            disabled={actionLoadingId === req._id}
                            title="Approve access and add to verified list"
                          >
                            {actionLoadingId === req._id ? (
                              <Loader2 size={13} className="art-spin" />
                            ) : (
                              <Check size={13} />
                            )}
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm art-btn-reject"
                            onClick={() => openRejectModal(req)}
                            disabled={actionLoadingId === req._id}
                            title="Reject request"
                          >
                            <X size={13} />
                            Reject
                          </button>
                        </div>
                      ) : (
                        <div className="art-reviewed-info">
                          <span className="art-reviewed-by">
                            Reviewed by {req.reviewedByName || 'Admin'}
                          </span>
                          {req.rejectionReason && (
                            <span className="art-rejection-note" title={req.rejectionReason}>
                              Note: {req.rejectionReason}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="art-pagination">
            <span className="art-pagination-text">
              Showing page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.total} total)
            </span>
            <div className="art-pagination-btns">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => fetchRequests(pagination.page - 1)}
                disabled={pagination.page <= 1 || loading}
              >
                Previous
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => fetchRequests(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || loading}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {rejectModal.isOpen && rejectModal.request && (
        <div className="art-modal-overlay" onClick={() => setRejectModal({ isOpen: false, request: null, reason: '' })}>
          <div className="art-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="art-modal-header">
              <div className="art-modal-header-icon reject">
                <XCircle size={22} />
              </div>
              <div>
                <h4>Reject Access Request</h4>
                <p>University ID: {rejectModal.request.universityId} • {rejectModal.request.name}</p>
              </div>
            </div>

            <div className="art-modal-body">
              <label htmlFor="art-reject-reason">Rejection Reason / Note to Applicant:</label>
              <textarea
                id="art-reject-reason"
                rows={3}
                value={rejectModal.reason}
                onChange={(e) => setRejectModal((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder="Explain why this request is rejected..."
                className="art-modal-textarea"
              />
              <p className="art-modal-hint">
                This note will be included in the email notification sent to the user.
              </p>
            </div>

            <div className="art-modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setRejectModal({ isOpen: false, request: null, reason: '' })}
                disabled={actionLoadingId === rejectModal.request._id}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleConfirmReject}
                disabled={actionLoadingId === rejectModal.request._id}
              >
                {actionLoadingId === rejectModal.request._id ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccessRequestsTab;
