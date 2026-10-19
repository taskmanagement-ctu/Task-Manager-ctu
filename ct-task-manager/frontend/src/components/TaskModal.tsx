import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, ChevronUp, Paperclip, FileText, Star, Building2, MessageSquare, Video, Plus, Check, X, Layers, ArrowLeft, ExternalLink, Trash2, User, Clock, AlignLeft, FileSpreadsheet, Image as ImageIcon, File as FileIcon, Download, Loader2, CheckCircle2, FolderUp, AlertCircle, Send } from 'lucide-react';
import { api } from '../services/api';
import { calculateUrgency, getUrgencyColor, getUrgencyLabel } from '../utils/taskUrgency';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import './TaskModal.css';

// Auto-compress image files to ~500KB max
const compressImage = (file: File, maxSizeKB: number = 500): Promise<File> => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) { resolve(file); return; }
    if (file.size <= maxSizeKB * 1024) { resolve(file); return; }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        const maxDim = 1920;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        let quality = 0.8;
        const tryCompress = () => {
          canvas.toBlob((blob) => {
            if (!blob) { resolve(file); return; }
            if (blob.size > maxSizeKB * 1024 && quality > 0.1) {
              quality -= 0.1;
              tryCompress();
            } else {
              resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
            }
          }, 'image/jpeg', quality);
        };
        tryCompress();
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

const compressFiles = async (files: File[]): Promise<File[]> => {
  return Promise.all(files.map(f => compressImage(f)));
};

// Date format helper
const formatDateTimeDDMMYYYY = (dateString?: string | Date) => {
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

const EMPTY_ARRAY: any[] = [];

interface AttachmentListProps {
  fileIds: string[];
  title?: string;
  hideCardWrap?: boolean;
  canDelete?: boolean;
  onDelete?: (fileId: string) => void;
  deletingFileId?: string | null;
  uploaderLabel?: string;
}

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
    case 'image': return <ImageIcon size={16} color={color} />;
    case 'video': return <Video size={16} color={color} />;
    case 'pdf': return <FileText size={16} color={color} />;
    case 'sheet': return <FileSpreadsheet size={16} color={color} />;
    case 'doc': return <FileText size={16} color={color} />;
    case 'archive': return <FolderUp size={16} color={color} />;
    default: return <FileIcon size={16} color={color} />;
  }
};

const formatFileSize = (bytes?: number) => {
  if (!bytes || bytes === 0) return '0 KB';
  const k = 1024;
  if (bytes < k * 1024) {
    return `${Math.round(bytes / k)} KB`;
  }
  return `${(bytes / (k * 1024)).toFixed(1)} MB`;
};

const AttachmentList: React.FC<AttachmentListProps> = ({ 
  fileIds, 
  title, 
  hideCardWrap = false,
  canDelete = false,
  onDelete,
  deletingFileId,
  uploaderLabel
}) => {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const fileIdsKey = Array.isArray(fileIds) ? fileIds.join(',') : '';

  useEffect(() => {
    let isMounted = true;
    const fetchFiles = async () => {
      setLoading(true);
      try {
        const fetchedFiles = await Promise.all(
          (fileIds || []).map(async (id) => {
            try {
              const res = await api.getFileMetadata(id);
              return res.data?.file;
            } catch (e) {
              return null;
            }
          })
        );
        if (isMounted) {
          setFiles(fetchedFiles.filter(Boolean));
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    if (fileIds && fileIds.length > 0) {
      fetchFiles();
    } else if (isMounted) {
      setFiles([]);
      setLoading(false);
    }
    return () => { isMounted = false; };
  }, [fileIdsKey]);

  if (!fileIds || fileIds.length === 0) return null;

  const apiUrl = import.meta.env.VITE_API_URL !== undefined ? import.meta.env.VITE_API_URL : (import.meta.env.DEV ? 'http://localhost:5000' : '');

  const content = (
    <div className="tm-file-items-list">
      {loading ? (
        <div className="tm-file-loading-skeleton">
          <Loader2 size={15} className="tm-spin" style={{ color: '#021c3b' }} />
          <span>Loading attached files...</span>
        </div>
      ) : files.length === 0 ? (
        <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>No file details available</span>
      ) : (
        files.map((file, i) => {
          const info = getFileInfo(file.filename);
          return (
            <div key={file._id || i} className="tm-file-item-card">
              <div className="tm-file-item-left">
                <div 
                  className="tm-file-type-icon-box"
                  style={{ backgroundColor: info.bg, borderColor: info.border, color: info.color }}
                >
                  {renderFileTypeIcon(info.type, info.color)}
                </div>
                <div className="tm-file-info-col">
                  <span className="tm-file-name" title={file.filename}>
                    {file.filename}
                  </span>
                  <div className="tm-file-meta-row">
                    <span className="tm-file-badge" style={{ color: info.color, backgroundColor: info.bg, borderColor: info.border }}>
                      {info.label}
                    </span>
                    <span className="tm-file-size">
                      {formatFileSize(file.length)}
                    </span>
                    {uploaderLabel && (
                      <span className="tm-file-uploader-tag">
                        • {uploaderLabel}
                      </span>
                    )}
                    {file.uploadDate && (
                      <span className="tm-file-upload-date">
                        • {formatDateTimeDDMMYYYY(file.uploadDate)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="tm-file-actions-row">
                <a
                  href={`${apiUrl}/api/files/${file._id}`}
                  download={file.filename}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tm-file-action-btn tm-file-download-btn"
                  title="Download file directly"
                >
                  <Download size={13} />
                  <span>Download</span>
                </a>
                <a
                  href={`${apiUrl}/api/files/${file._id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tm-file-action-btn tm-file-view-btn"
                  title="Open file in new tab"
                >
                  <ExternalLink size={13} />
                </a>
                {canDelete && onDelete && (
                  <button
                    type="button"
                    className="tm-file-action-btn tm-file-delete-btn"
                    onClick={() => onDelete(file._id)}
                    disabled={deletingFileId === file._id}
                    title="Remove this work file"
                    aria-label={`Remove ${file.filename}`}
                  >
                    {deletingFileId === file._id ? (
                      <Loader2 size={13} className="tm-spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  if (hideCardWrap) {
    return content;
  }

  return (
    <div className="tm-attachments-card">
      {title && (
        <div className="tm-attachments-header">
          <Paperclip size={14} className="tm-attachments-icon" />
          <span>{title}</span>
          {files.length > 0 && (
            <span className="tm-attachments-count">{files.length}</span>
          )}
        </div>
      )}
      <div style={{ padding: '0.85rem 1rem' }}>
        {content}
      </div>
    </div>
  );
};

interface TaskModalProps {
  task: any | null;
  onClose: () => void;
  onRefresh: () => void;
  currentUser: any;
  availableAssignees?: any[];
  departments?: any[];
  onCreateSubtask?: () => void;
  onOpenChat?: (task: any) => void;
}

const TaskModal: React.FC<TaskModalProps> = ({ 
  task: initialTask, 
  onClose, 
  onRefresh, 
  currentUser, 
  availableAssignees = EMPTY_ARRAY, 
  departments = EMPTY_ARRAY, 
  onCreateSubtask: _onCreateSubtask, 
  onOpenChat 
}) => {
  const [task, setTask] = useState<any>(initialTask);
  const [parentMainTask, setParentMainTask] = useState<any>(!initialTask.isSubtask ? initialTask : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [subtasks, setSubtasks] = useState<any[]>(initialTask.subtasks || []);
  
  // Compact Metadata Details Toggle
  const [showMoreDetails, setShowMoreDetails] = useState<boolean>(false);

  // Assignee Direct Work File Upload (<5MB, Any format)
  const [isUploadingWorkFile, setIsUploadingWorkFile] = useState(false);
  const [workFileError, setWorkFileError] = useState('');
  const [workFileSuccess, setWorkFileSuccess] = useState('');
  const workFileInputRef = useRef<HTMLInputElement>(null);

  const handleWorkFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    setWorkFileError('');
    setWorkFileSuccess('');

    // Strict 5MB limit check per file
    const MAX_SIZE = 5 * 1024 * 1024;
    const oversizedFiles = files.filter(f => f.size > MAX_SIZE);
    if (oversizedFiles.length > 0) {
      setWorkFileError(
        `File "${oversizedFiles[0].name}" (${(oversizedFiles[0].size / (1024 * 1024)).toFixed(2)} MB) exceeds the 5MB limit. Please select files under 5MB.`
      );
      if (workFileInputRef.current) workFileInputRef.current.value = '';
      return;
    }

    try {
      setIsUploadingWorkFile(true);
      const formData = new FormData();
      files.forEach(f => formData.append('attachments', f));
      const res = await api.uploadTaskAttachments(task._id, formData);
      if (res.success) {
        setWorkFileSuccess(`${files.length} file${files.length > 1 ? 's' : ''} sent successfully!`);
        refreshTaskData();
        setTimeout(() => setWorkFileSuccess(''), 4000);
      } else {
        setWorkFileError(res.message || 'Failed to upload files.');
      }
    } catch (err: any) {
      setWorkFileError(err.message || 'Failed to upload files.');
    } finally {
      setIsUploadingWorkFile(false);
      if (workFileInputRef.current) workFileInputRef.current.value = '';
    }
  };

  const [deletingWorkFileId, setDeletingWorkFileId] = useState<string | null>(null);

  const handleDeleteWorkFile = async (fileId: string) => {
    if (!window.confirm('Are you sure you want to delete this deliverable file?')) {
      return;
    }
    setWorkFileError('');
    setWorkFileSuccess('');
    setDeletingWorkFileId(fileId);
    try {
      const res = await api.deleteTaskAttachment(task._id, fileId);
      if (res.success) {
        setWorkFileSuccess('File removed successfully.');
        setTask((prev: any) => ({
          ...prev,
          completionAttachments: (prev.completionAttachments || []).filter(
            (id: any) => (id?._id || id?.id || id)?.toString() !== fileId
          )
        }));
        refreshTaskData();
        setTimeout(() => setWorkFileSuccess(''), 3000);
      } else {
        setWorkFileError(res.message || 'Failed to delete file.');
      }
    } catch (err: any) {
      setWorkFileError(err.message || 'Failed to delete file.');
    } finally {
      setDeletingWorkFileId(null);
    }
  };

  // Inline Assignee Comments & Work Notes
  const [taskComments, setTaskComments] = useState<any[]>(initialTask.comments || []);
  const [newCommentText, setNewCommentText] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [commentError, setCommentError] = useState('');

  const fetchComments = async (taskIdToFetch?: string) => {
    const tId = taskIdToFetch || task?._id;
    if (!tId) return;
    try {
      const res = await api.getTaskComments(tId);
      if (res.success && res.data) {
        setTaskComments(res.data);
      }
    } catch (err) {
      console.error('Failed to load comments in TaskModal:', err);
    }
  };

  const handleAddComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newCommentText.trim() || isPostingComment) return;

    try {
      setIsPostingComment(true);
      setCommentError('');
      const channelToSend = (currentUser?.role === 'super_admin' ? 'super_admin' : currentUser?.role === 'staff' ? 'staff' : 'general');
      const res = await api.addTaskComment(task._id, newCommentText.trim(), channelToSend);
      if (res.success) {
        setTaskComments(res.data || []);
        setNewCommentText('');
        setTask((prev: any) => ({
          ...prev,
          comments: res.data || []
        }));
        if (onRefresh) onRefresh();
      } else {
        setCommentError(res.message || 'Failed to post comment.');
      }
    } catch (err: any) {
      setCommentError(err.message || 'Failed to post comment.');
    } finally {
      setIsPostingComment(false);
    }
  };
  
  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    title: task.title,
    description: task.description,
    deadline: new Date(task.deadline).toISOString().slice(0, 16)
  });

  // Assign mode
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignTarget, setAssignTarget] = useState(task.delegatedTo ? (task.delegatedTo._id || task.delegatedTo.id) : (task.assignedTo ? (task.assignedTo._id || task.assignedTo.id) : ''));
  
  // Custom Assign Dropdown State (Main Task)
  const [isAssignDropdownOpen, setIsAssignDropdownOpen] = useState(false);
  const [assignSearchQuery, setAssignSearchQuery] = useState('');
  const [assignRoleFilter, setAssignRoleFilter] = useState<'all' | 'staff' | 'department_admin'>('all');
  const [assignDeptFilter, setAssignDeptFilter] = useState<string>('all');
  const [departmentList, setDepartmentList] = useState<string[]>([]);
  const assignDropdownRef = useRef<HTMLDivElement>(null);

  // Stable keys for dependencies to avoid infinite loops from re-created array references
  const deptPropKey = Array.isArray(departments)
    ? departments.map(d => (typeof d === 'string' ? d : d?.name || '')).filter(Boolean).join(',')
    : '';
  const assigneesDeptKey = Array.isArray(availableAssignees)
    ? availableAssignees.map(a => a?.department || '').filter(Boolean).join(',')
    : '';
  const currentUserRole = currentUser?.role;

  // Load / build department list for filtering
  useEffect(() => {
    let isMounted = true;
    const updateDeptList = async () => {
      let depts: string[] = [];
      if (departments && departments.length > 0) {
        depts = departments.map(d => typeof d === 'string' ? d : d?.name).filter(Boolean);
      } else if (currentUserRole === 'super_admin') {
        try {
          const res = await api.getDepartments();
          if (isMounted && res.success && res.data?.departments) {
            depts = res.data.departments.map((d: any) => d.name).filter(Boolean);
          }
        } catch (err) {
          console.error('Failed to load departments', err);
        }
      }
      const assigneeDepts = (availableAssignees || []).map(a => a?.department).filter(Boolean);
      const unique = Array.from(new Set([...depts, ...assigneeDepts])).sort((a, b) => a.localeCompare(b));
      if (isMounted) {
        setDepartmentList(prev => {
          if (prev.length === unique.length && prev.every((v, i) => v === unique[i])) {
            return prev; // Bail out to avoid triggering a component re-render
          }
          return unique;
        });
      }
    };

    updateDeptList();
    return () => { isMounted = false; };
  }, [deptPropKey, assigneesDeptKey, currentUserRole]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (assignDropdownRef.current && !assignDropdownRef.current.contains(event.target as Node)) {
        setIsAssignDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getFilteredAssignees = (query: string, role: string, dept: string = 'all') => {
    return availableAssignees.filter(a => {
      // Role filter
      if (role === 'department_admin' && !a.role?.includes('admin')) return false;
      if (role === 'staff' && a.role !== 'staff') return false;
      if (role !== 'all' && role !== 'department_admin' && role !== 'staff' && a.role !== role) return false;

      // Department filter
      if (currentUser?.role === 'super_admin' && dept !== 'all') {
        if (!a.department || a.department.trim().toLowerCase() !== dept.trim().toLowerCase()) {
          return false;
        }
      }

      // Search query filter
      if (query) {
        const q = query.toLowerCase();
        return (a.name && a.name.toLowerCase().includes(q)) || 
               (a.role && a.role.toLowerCase().includes(q)) || 
               (a.department && a.department.toLowerCase().includes(q)) ||
               (a.universityId && a.universityId.toLowerCase().includes(q));
      }
      return true;
    });
  };

  // Review mode
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const resolveUserName = (userObj: any) => {
    if (!userObj) return '';
    if (userObj.universityId === '24051' || userObj.email === 'vc@ctuniversity.in' || userObj.name?.toLowerCase().includes('nitin')) {
      return "Vice Chancellor's Office";
    }
    return userObj.name || '';
  };

  const formatName = (userObj: any) => {
    if (!userObj) return <span style={{ color: '#94a3b8' }}>Unassigned</span>;
    const isMe = userObj._id === currentUser.id || userObj.id === currentUser.id;
    const resolved = resolveUserName(userObj);
    const name = isMe ? (resolved === "Vice Chancellor's Office" ? "me (Vice Chancellor's Office)" : 'me') : resolved;
    const staffId = userObj.universityId || 'N/A';
    const dept = userObj.department ? ` • ${userObj.department}` : '';
    return <>{name} <span style={{ color: '#64748b', fontSize: '0.85rem' }}>(ID: {staffId}{dept})</span></>;
  };

  const formatNameString = (userObj: any) => {
    if (!userObj) return 'Unassigned';
    const isMe = userObj._id === currentUser.id || userObj.id === currentUser.id;
    const resolved = resolveUserName(userObj);
    const name = isMe ? (resolved === "Vice Chancellor's Office" ? "me (Vice Chancellor's Office)" : 'me') : resolved;
    const staffId = userObj.universityId ? ` (ID: ${userObj.universityId})` : '';
    const dept = userObj.department ? ` • ${userObj.department}` : '';
    return `${name}${staffId}${dept}`;
  };

  // Submit Review mode
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewFiles, setReviewFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState('');
  const reviewFileInputRef = useRef<HTMLInputElement>(null);

  // Approval Rating mode
  const [isApproving, setIsApproving] = useState(false);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [reviewFeedback, setReviewFeedback] = useState<string>('');

  // Inline Subtask Creation in Modal
  const [isAddingSubtaskModal, setIsAddingSubtaskModal] = useState(false);
  const [modalSubtaskTitle, setModalSubtaskTitle] = useState('');
  const [modalSubtaskDesc, setModalSubtaskDesc] = useState('');
  const [modalSubtaskDeadline, setModalSubtaskDeadline] = useState('');
  const [modalSubtaskAssignees, setModalSubtaskAssignees] = useState<string[]>([]);
  const [modalSubtaskMode, setModalSubtaskMode] = useState<'individual' | 'shared'>('individual');
  const [modalSubtaskLoading, setModalSubtaskLoading] = useState(false);
  const [modalSubtaskError, setModalSubtaskError] = useState('');
  const [modalSubtaskSuccess, setModalSubtaskSuccess] = useState('');
  const [deletingSubtaskId, setDeletingSubtaskId] = useState<string | null>(null);

  const refreshTaskData = async () => {
    try {
      const res = await api.getTaskById(task._id);
      if (res.success) {
        setTask(res.data.task);
        if (res.data.task.comments) {
          setTaskComments(res.data.task.comments);
        }
      }
    } catch (err) {
      console.error("Failed to refresh task data:", err);
    }
    if (onRefresh) {
      onRefresh();
    }
  };

  // Reset local state when task changes
  useEffect(() => {
    setTask(initialTask);
    setIsEditing(false);
    setIsAssigning(false);
    setIsRejecting(false);
    setRejectionReason('');
    setIsApproving(false);
    setReviewRating(5);
    setHoverRating(0);
    setReviewFeedback('');
    setIsSubmittingReview(false);
    setReviewFiles([]);
    setFileError('');
    setTaskComments(initialTask.comments || []);
    setNewCommentText('');
    setCommentError('');
    if (initialTask?._id) {
      fetchComments(initialTask._id);
    }
    setEditData({
      title: initialTask.title,
      description: initialTask.description,
      deadline: new Date(initialTask.deadline).toISOString().slice(0, 16)
    });
    setAssignTarget(initialTask.delegatedTo ? initialTask.delegatedTo._id : (initialTask.assignedTo ? initialTask.assignedTo._id : ''));
    setIsAddingSubtaskModal(false);
    setModalSubtaskTitle('');
    setModalSubtaskDesc('');
    setModalSubtaskDeadline('');
    setModalSubtaskAssignees([]);
    setModalSubtaskMode('individual');
    setModalSubtaskError('');
    setModalSubtaskSuccess('');

    if (initialTask && !initialTask.isSubtask) {
      if (initialTask.subtasks && initialTask.subtasks.length > 0) {
        setSubtasks(initialTask.subtasks);
      }
      fetchSubtasks();
    }
  }, [initialTask]);

  const fetchSubtasks = async () => {
    try {
      const res = await api.getSubtasks(task._id);
      setSubtasks(res.data.subtasks);
    } catch (err) {
      console.error('Failed to fetch subtasks', err);
    }
  };

  const handleModalCreateSubtask = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!modalSubtaskTitle.trim()) {
      setModalSubtaskError('Subtask title is required.');
      return;
    }
    if (!modalSubtaskAssignees || modalSubtaskAssignees.length === 0) {
      setModalSubtaskError('Please select at least one assignee.');
      return;
    }
    if (!modalSubtaskDeadline) {
      setModalSubtaskError('Please specify a deadline.');
      return;
    }

    const parentDeadlineTime = new Date(task.deadline).getTime();
    const chosenDeadlineTime = new Date(modalSubtaskDeadline).getTime();
    if (chosenDeadlineTime > parentDeadlineTime) {
      setModalSubtaskError('Subtask deadline cannot exceed main task deadline.');
      return;
    }

    setModalSubtaskLoading(true);
    setModalSubtaskError('');
    setModalSubtaskSuccess('');

    try {
      const res = await api.createSubtask(task._id, {
        title: modalSubtaskTitle.trim(),
        description: modalSubtaskDesc.trim() || modalSubtaskTitle.trim(),
        deadline: new Date(modalSubtaskDeadline).toISOString(),
        assignedTo: modalSubtaskAssignees,
        assignmentMode: modalSubtaskMode
      });

      if (res.success) {
        setModalSubtaskSuccess(modalSubtaskMode === 'shared' ? 'Shared team subtask created successfully!' : 'Subtask(s) created successfully!');
        await fetchSubtasks();
        refreshTaskData();
        setModalSubtaskTitle('');
        setModalSubtaskDesc('');
        setModalSubtaskAssignees([]);
        setModalSubtaskMode('individual');
        setTimeout(() => {
          setIsAddingSubtaskModal(false);
          setModalSubtaskSuccess('');
        }, 1200);
      } else {
        setModalSubtaskError(res.message || 'Failed to create subtask.');
      }
    } catch (err: any) {
      setModalSubtaskError(err.message || 'Error creating subtask.');
    } finally {
      setModalSubtaskLoading(false);
    }
  };

  const handleDeleteSubtask = async (subtaskId: string, subtaskTitle: string) => {
    if (!window.confirm(`Are you sure you want to delete subtask "${subtaskTitle}"?`)) {
      return;
    }
    try {
      setDeletingSubtaskId(subtaskId);
      const res = await api.deleteTask(subtaskId);
      if (res.success) {
        await fetchSubtasks();
        refreshTaskData();
      } else {
        alert(res.message || 'Failed to delete subtask.');
      }
    } catch (err: any) {
      console.error('Failed to delete subtask:', err);
      alert(err.message || 'Error deleting subtask.');
    } finally {
      setDeletingSubtaskId(null);
    }
  };

  const currentUserId = currentUser.id || currentUser._id;
  const isCoAssignee = Boolean(
    task.coAssignees && task.coAssignees.some((ca: any) => (ca?._id || ca?.id || ca) === currentUserId)
  );
  const isAssignedStaff = currentUser.role === 'staff' && Boolean(
    (task.assignedTo && (task.assignedTo._id === currentUserId || task.assignedTo.id === currentUserId || task.assignedTo === currentUserId)) ||
    (task.delegatedTo && (task.delegatedTo._id === currentUserId || task.delegatedTo.id === currentUserId || task.delegatedTo === currentUserId)) ||
    isCoAssignee
  );
  const isPerformerAdmin = currentUser.role === 'department_admin' && !task.delegatedTo && Boolean(
    (task.assignedTo && (task.assignedTo._id === currentUserId || task.assignedTo.id === currentUserId || task.assignedTo === currentUserId)) ||
    isCoAssignee
  );
  const isPerformerSuperAdmin = currentUser.role === 'super_admin' && !task.delegatedTo && Boolean(
    task.assignedTo && (task.assignedTo._id === currentUserId || task.assignedTo.id === currentUserId || task.assignedTo === currentUserId)
  );
  const canPerformStaffActions = isAssignedStaff || isPerformerAdmin || isPerformerSuperAdmin;

  const isCreator = Boolean(
    (task.createdBy?._id && (task.createdBy._id === currentUser.id || task.createdBy._id === currentUser._id)) ||
    (task.createdBy?.id && (task.createdBy.id === currentUser.id || task.createdBy.id === currentUser._id)) ||
    (typeof task.createdBy === 'string' && (task.createdBy === currentUser.id || task.createdBy === currentUser._id)) ||
    (task.createdBy?.universityId && currentUser?.universityId && task.createdBy.universityId === currentUser.universityId)
  );

  const isSuperAdmin = currentUser?.role === 'super_admin';

  // Only the user who created the task can edit its details (while still pending)
  const canEdit = isCreator && task.status === 'pending';
  
  const canAssign = (currentUser.role === 'super_admin' || currentUser.role === 'department_admin') && 
    task.status !== 'submitted_for_review' && task.status !== 'approved';
  
  const canDelete = isSuperAdmin || isCreator;
  // Only the assigned performer can upload, add or delete deliverables, and only while task is in-progress/pending/rejected
  const canManageDeliverables = canPerformStaffActions && ['pending', 'in_progress', 'rejected'].includes(task.status);
  
  const currentPerformer = task.delegatedTo || task.assignedTo;
  const performerName = resolveUserName(currentPerformer) || currentPerformer?.name || '';
  const deliverablesSectionTitle = canPerformStaffActions 
    ? 'YOUR DELIVERABLES & WORK FILES' 
    : 'ASSIGNEE SUBMISSIONS & WORK PROOFS';
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);

  const handleDeleteTaskModal = () => {
    if (!canDelete || loading) return;
    setShowDeleteConfirm(true);
  };

  const handleConfirmDeleteModal = async () => {
    try {
      setLoading(true);
      await api.deleteTask(task._id);
      setShowDeleteConfirm(false);
      onClose();
      onRefresh();
    } catch (err: any) {
      console.error('Failed to delete task', err);
      alert(`Error deleting task: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const canRateOnApproval = currentUser.role === 'super_admin' || (currentUser.role === 'department_admin' && isCreator);

  const canReview = 
    task.status === 'submitted_for_review' && (
      currentUser.role === 'super_admin' ||
      (task.reviewStage === 'department_admin' && currentUser.role === 'department_admin' && (
        !task.currentReviewer || 
        task.currentReviewer === currentUser.id || 
        task.currentReviewer?._id === currentUser.id || 
        task.currentReviewer?._id === currentUser._id ||
        isCreator
      ))
    );

  const handleUpdate = async () => {
    try {
      setLoading(true);
      setError('');
      await api.updateTask(task._id, {
        title: editData.title,
        description: editData.description,
        deadline: editData.deadline
      });
      setIsEditing(false);
      refreshTaskData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    try {
      setLoading(true);
      setError('');
      await api.assignTask(task._id, assignTarget || null);
      setIsAssigning(false);
      refreshTaskData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    try {
      setLoading(true);
      setError('');
      await api.updateTaskStatus(task._id, status);
      refreshTaskData();
    } catch (err: any) {
      setError(err.message);
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    try {
      setLoading(true);
      setError('');

      if (task.requiredCompletionExtensions && task.requiredCompletionExtensions.length > 0) {
        if (reviewFiles.length === 0) {
          setFileError(`Please upload required documents. Formats allowed: ${task.requiredCompletionExtensions.join(', ')}`);
          setLoading(false);
          return;
        }

        const invalidFiles = reviewFiles.filter(f => {
          const parts = f.name.split('.');
          if (parts.length < 2) return true;
          const ext = '.' + parts.pop()?.toLowerCase();
          return !task.requiredCompletionExtensions.includes(ext);
        });

        if (invalidFiles.length > 0) {
          setFileError(`Invalid file format: ${invalidFiles.map(f=>f.name).join(', ')}. Allowed: ${task.requiredCompletionExtensions.join(', ')}`);
          setLoading(false);
          return;
        }
      }

      const MAX_SIZE = 5 * 1024 * 1024;
      const oversized = reviewFiles.filter(f => f.size > MAX_SIZE);
      if (oversized.length > 0) {
        setFileError(`File "${oversized[0].name}" exceeds the 5MB limit. Please select files under 5MB.`);
        setLoading(false);
        return;
      }

      let formData: FormData | undefined = undefined;
      if (reviewFiles.length > 0) {
        formData = new FormData();
        reviewFiles.forEach(f => formData!.append('attachments', f));
      }
      await api.submitTaskForReview(task._id, formData);
      setIsSubmittingReview(false);
      setReviewFiles([]);
      refreshTaskData();
    } catch (err: any) {
      setError(err.message);
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewAction = async (decision: 'approved' | 'rejected') => {
    try {
      setLoading(true);
      setError('');
      if (decision === 'rejected' && !rejectionReason.trim()) {
        setError('Rejection reason is required.');
        setLoading(false);
        return;
      }
      await api.reviewTask(
        task._id, 
        decision, 
        decision === 'rejected' ? rejectionReason : undefined,
        decision === 'approved' && reviewRating ? reviewRating : undefined,
        decision === 'approved' && reviewFeedback ? reviewFeedback : undefined
      );
      setIsRejecting(false);
      setIsApproving(false);
      refreshTaskData();
    } catch (err: any) {
      setError(err.message);
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const urgency = calculateUrgency(task);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'pending': return { bg: '#fef3c7', color: '#92400e', text: 'PENDING' };
      case 'in_progress': return { bg: '#dbeafe', color: '#1e40af', text: 'IN PROGRESS' };
      case 'completed': return { bg: '#d1fae5', color: '#065f46', text: 'COMPLETED' };
      case 'submitted_for_review': return { bg: '#e0e7ff', color: '#3730a3', text: 'SUBMITTED FOR REVIEW' };
      case 'approved': return { bg: '#d1fae5', color: '#065f46', text: 'APPROVED' };
      case 'rejected': return { bg: '#fee2e2', color: '#991b1b', text: 'REJECTED' };
      default: return { bg: '#f1f5f9', color: '#475569', text: status.replace(/_/g, ' ').toUpperCase() };
    }
  };

  const statusStyle = getStatusColor(task.status);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '720px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>&times;</button>
        
        {error && <div className="error-message" style={{ marginBottom: '1rem' }}>{error}</div>}

        {!isEditing ? (
          <>
            {parentMainTask && task.isSubtask && (
              <button
                type="button"
                onClick={() => setTask(parentMainTask)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  backgroundColor: '#ede9fe',
                  color: '#6d28d9',
                  border: '1px solid #ddd6fe',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginBottom: '0.85rem'
                }}
              >
                <ArrowLeft size={14} /> Back to Main Task #{parentMainTask.taskId} Deck
              </button>
            )}
            <div className="tm-top-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', paddingRight: '2.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.45rem', flexWrap: 'wrap' }}>
                  <span className="tm-task-id-tag">#{task.taskId}</span>
                  
                  {/* Priority / Urgency Badge */}
                  <span style={{ 
                    background: getUrgencyColor(urgency) + '20', 
                    color: getUrgencyColor(urgency), 
                    border: `1px solid ${getUrgencyColor(urgency)}40`, 
                    padding: '0.18rem 0.55rem', 
                    borderRadius: '6px', 
                    fontSize: '0.72rem',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    whiteSpace: 'nowrap'
                  }}>
                    {getUrgencyLabel(urgency)}
                  </span>

                  {/* Status Badge in Header */}
                  <span style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center',
                    padding: '0.18rem 0.6rem', 
                    borderRadius: '6px', 
                    fontSize: '0.72rem', 
                    fontWeight: 700, 
                    backgroundColor: statusStyle.bg, 
                    color: statusStyle.color,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase'
                  }}>
                    {statusStyle.text}
                  </span>

                  {task.isSubtask && <span style={{ fontSize: '0.72rem', backgroundColor: '#e2e8f0', color: '#475569', padding: '0.18rem 0.55rem', borderRadius: '6px', fontWeight: 600 }}>SUBTASK</span>}
                  {(task.assignmentMode === 'shared' || (task.coAssignees && task.coAssignees.length > 1)) && (
                    <span style={{ fontSize: '0.72rem', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '0.18rem 0.55rem', borderRadius: '6px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      👥 Team Task ({task.coAssignees?.length || 2} Members)
                    </span>
                  )}
                  {!task.isSubtask && subtasks.length > 0 && (
                    <span className="tm-deck-badge-pill" title={`Assembled Card Deck with ${subtasks.length} subtasks`}>
                      <Layers size={12} /> Card Deck ({subtasks.length} Subtasks)
                    </span>
                  )}
                </div>

                <h2 style={{ margin: '0.15rem 0 0 0', fontSize: '1.35rem', fontWeight: 700, color: '#0f172a', lineHeight: '1.35' }}>
                  {task.title}
                </h2>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                {onOpenChat && (
                  <button
                    type="button"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      backgroundColor: '#021c3b',
                      color: '#ffffff',
                      border: 'none',
                      padding: '0.45rem 0.85rem',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(2, 28, 59, 0.2)'
                    }}
                    onClick={() => onOpenChat(task)}
                    title="Open Task Discussion Thread"
                  >
                    <MessageSquare size={14} />
                    <span>Chat / Discussion</span>
                    {((taskComments && taskComments.length > 0) || (task.comments && task.comments.length > 0)) && (
                      <span style={{ backgroundColor: '#0284c7', padding: '0.05rem 0.4rem', borderRadius: '10px', fontSize: '0.7rem' }}>
                        {taskComments && taskComments.length > 0 ? taskComments.length : task.comments.length}
                      </span>
                    )}
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      backgroundColor: "#fef2f2",
                      color: "#b91c1c",
                      border: "1px solid #fecaca",
                      padding: "0.45rem 0.85rem",
                      borderRadius: "8px",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      boxShadow: "0 1px 2px rgba(185, 28, 28, 0.08)",
                      transition: "all 0.15s ease"
                    }}
                    onClick={handleDeleteTaskModal}
                    title="Delete this task (Creator or Super Admin)"
                    disabled={loading}
                  >
                    <Trash2 size={14} />
                    <span>Delete Task</span>
                  </button>
                )}
              </div>
            </div>

            {task.isSubtask && task.parentTaskId && (
              <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ fontWeight: 600 }}>Subtask of:</span> #{task.parentTaskId.taskId} - {task.parentTaskId.title}
              </div>
            )}
            
            {/* Task Description Section */}
            <div className="tm-desc-container">
              <div className="tm-desc-header">
                <AlignLeft size={14} className="tm-desc-icon" />
                <span>TASK DESCRIPTION</span>
              </div>
              <div className="tm-desc-body">
                {task.description ? task.description : <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No additional description provided.</span>}
              </div>
            </div>

            {task.attachments && task.attachments.length > 0 && (
                <AttachmentList fileIds={task.attachments} title="Initial Attachments" />
            )}

            {task.rejectionReason && (
              <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '1rem', borderRadius: '8px', margin: '1rem 0', borderLeft: '4px solid #ef4444' }}>
                <strong>Rejection Reason:</strong> {task.rejectionReason}
              </div>
            )}

            {/* Compact Metadata Summary Bar (Assigned By, Deadline + Details toggle) */}
            <div className="tm-compact-summary-bar">
              <div className="tm-summary-primary-row">
                {/* Assigned By */}
                <div className="tm-summary-item">
                  <div className="tm-summary-label">
                    <User size={13} className="tm-summary-icon" />
                    <span>ASSIGNED BY</span>
                  </div>
                  <div className="tm-summary-val">{formatName(task.createdBy)}</div>
                </div>

                {/* Deadline */}
                <div className="tm-summary-item">
                  <div className="tm-summary-label">
                    <Clock size={13} className="tm-summary-icon" />
                    <span>DEADLINE</span>
                  </div>
                  <div className="tm-summary-val deadline-val">
                    {formatDateTimeDDMMYYYY(task.deadline)}
                  </div>
                </div>

                {/* Details Button */}
                <div className="tm-summary-action">
                  <button 
                    type="button" 
                    className={`tm-details-pill-btn ${showMoreDetails ? 'active' : ''}`}
                    onClick={() => setShowMoreDetails(!showMoreDetails)}
                    title={showMoreDetails ? "Hide full metadata" : "Show full metadata"}
                  >
                    <span>{showMoreDetails ? 'Hide Details' : 'Details'}</span>
                    {showMoreDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                </div>
              </div>

              {/* Collapsible Expanded Details */}
              {showMoreDetails && (
                <div className="tm-expanded-meta-grid">
                  <div>
                    <div className="tm-sub-label">Created Date</div>
                    <div className="tm-sub-val">{formatDateTimeDDMMYYYY(task.createdAt)}</div>
                  </div>

                  {task.assignmentMode === 'shared' || (task.coAssignees && task.coAssignees.length > 0) ? (
                    <div>
                      <div className="tm-sub-label">Assigned Team (Shared Task)</div>
                      <div className="tm-sub-val" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.2rem' }}>
                        {task.coAssignees && task.coAssignees.length > 0 ? (
                          task.coAssignees.map((ca: any) => (
                            <span key={ca._id || ca.id || ca} style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 600 }}>
                              👥 {formatName(ca)}
                            </span>
                          ))
                        ) : (
                          formatName(task.assignedTo)
                        )}
                      </div>
                    </div>
                  ) : currentUser.role === 'super_admin' ? (
                    <div>
                      <div className="tm-sub-label">Assigned To</div>
                      <div className="tm-sub-val">{formatName(task.assignedTo)}</div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <div className="tm-sub-label">
                          {task.delegatedTo ? 'Assigned Staff' : 'Assigned To'}
                        </div>
                        <div className="tm-sub-val">
                          {task.delegatedTo ? formatName(task.delegatedTo) : formatName(task.assignedTo)}
                        </div>
                      </div>
                      
                      {task.delegatedTo && (
                        <div>
                          <div className="tm-sub-label">Assigned Dept Admin</div>
                          <div className="tm-sub-val">{formatName(task.assignedTo)}</div>
                        </div>
                      )}
                    </>
                  )}

                  <div>
                    <div className="tm-sub-label">Completion Date</div>
                    <div className="tm-sub-val">
                      {task.completedAt 
                        ? formatDateTimeDDMMYYYY(task.completedAt) 
                        : (task.status === 'completed' || task.status === 'approved' ? 'Completed' : 'Not completed yet')}
                    </div>
                  </div>

                  {task.requiredCompletionExtensions && task.requiredCompletionExtensions.length > 0 && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div className="tm-sub-label">Required Completion Formats</div>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                        {task.requiredCompletionExtensions.map((ext: string) => (
                          <span key={ext} style={{ fontSize: '0.75rem', backgroundColor: '#e2e8f0', padding: '0.15rem 0.45rem', borderRadius: '4px', color: '#475569', fontWeight: 600 }}>{ext}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Completion Timeline Delta */}
                  {(task.status === 'completed' || task.status === 'approved') && task.completedAt && (() => {
                    const completedDate = new Date(task.completedAt);
                    const deadlineDate = new Date(task.deadline);
                    const diffTime = deadlineDate.getTime() - completedDate.getTime();
                    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                    let timelineText = '';
                    let timelineColor = '';
                    let timelineIcon = '';
                    if (diffDays > 0) {
                      timelineText = `Completed ${diffDays} day${diffDays !== 1 ? 's' : ''} before deadline`;
                      timelineColor = '#10b981';
                      timelineIcon = '✅';
                    } else if (diffDays < 0) {
                      timelineText = `Completed ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} after deadline (overdue)`;
                      timelineColor = '#ef4444';
                      timelineIcon = '⚠️';
                    } else {
                      timelineText = 'Completed exactly on deadline';
                      timelineColor = '#f59e0b';
                      timelineIcon = '✅';
                    }
                    return (
                      <div style={{ gridColumn: '1 / -1', marginTop: '0.25rem' }}>
                        <div style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '0.4rem',
                          padding: '0.35rem 0.75rem', 
                          borderRadius: '6px', 
                          fontSize: '0.82rem', 
                          fontWeight: 600,
                          backgroundColor: timelineColor + '15',
                          color: timelineColor,
                          border: `1px solid ${timelineColor}30`
                        }}>
                          {timelineIcon} {timelineText}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Performance Rating & Feedback Banner on Rated Task */}
            {task.rating && (
              <div style={{ margin: '1.25rem 0', padding: '1rem 1.25rem', backgroundColor: '#fefce8', border: '1px solid #fef08a', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#854d0e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Performance Rating
                    </span>
                    <span style={{ display: 'inline-flex', gap: '2px', color: '#eab308' }}>
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} size={16} fill={s <= (task.rating || 0) ? '#eab308' : 'none'} color="#eab308" />
                      ))}
                    </span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#a16207' }}>
                      ({task.rating}/5)
                    </span>
                  </div>
                  {task.ratedBy && (
                    <span style={{ fontSize: '0.75rem', color: '#a16207', fontWeight: 500 }}>
                      Rated by {task.ratedBy.name}
                    </span>
                  )}
                </div>
                {task.feedback && (
                  <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.875rem', color: '#713f12', fontStyle: 'italic' }}>
                    "{task.feedback}"
                  </p>
                )}
                {task.ratedUser && (
                  <span style={{ fontSize: '0.75rem', color: '#a16207', display: 'block', marginTop: '0.35rem' }}>
                    Awarded to: <strong>{task.ratedUser.name || 'Performer'}</strong> (ID: {task.ratedUser.universityId || 'N/A'})
                  </span>
                )}
              </div>
            )}

            {/* Assignee Deliverables & Work Files (Compact Direct Upload <5MB) & Inline Comments */}
            <div className="tm-deliverables-card">
              {/* Deliverables Header */}
              <div className="tm-deliverables-header">
                <div className="tm-deliv-title-group">
                  <div className="tm-deliv-header-icon-box">
                    <FolderUp size={14} />
                  </div>
                  <span className="tm-deliv-title">
                    {deliverablesSectionTitle}
                  </span>
                  {task.completionAttachments && task.completionAttachments.length > 0 && (
                    <span className="tm-deliv-count-badge">
                      {task.completionAttachments.length} {task.completionAttachments.length === 1 ? 'file' : 'files'}
                    </span>
                  )}
                  {canPerformStaffActions && (
                    <span className="tm-deliv-spec-inline">
                      Max 5 MB • Any format
                    </span>
                  )}
                </div>

                {/* Upload File button */}
                {canManageDeliverables && (
                  <div className="tm-deliv-header-actions">
                    <input 
                      type="file" 
                      multiple 
                      ref={workFileInputRef} 
                      style={{ display: 'none' }} 
                      accept="*/*"
                      onChange={handleWorkFileUpload} 
                    />
                    <button
                      type="button"
                      className="tm-upload-file-btn tm-btn-compact"
                      onClick={() => workFileInputRef.current?.click()}
                      disabled={isUploadingWorkFile || loading}
                      title="Upload files in any format (max 5 MB each)"
                    >
                      {isUploadingWorkFile ? (
                        <>
                          <Loader2 size={12} className="tm-spin" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <FolderUp size={12} />
                          <span>Attach File</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {workFileError && (
                <div className="tm-file-alert error">
                  <div className="tm-alert-content">
                    <AlertCircle size={13} className="tm-alert-icon" />
                    <span>{workFileError}</span>
                  </div>
                  <button type="button" onClick={() => setWorkFileError('')} aria-label="Dismiss">&times;</button>
                </div>
              )}
              {workFileSuccess && (
                <div className="tm-file-alert success">
                  <div className="tm-alert-content">
                    <CheckCircle2 size={13} className="tm-alert-icon" />
                    <span>{workFileSuccess}</span>
                  </div>
                  <button type="button" onClick={() => setWorkFileSuccess('')} aria-label="Dismiss">&times;</button>
                </div>
              )}

              {/* Uploaded Files List OR Compact Drop Area */}
              {task.completionAttachments && task.completionAttachments.length > 0 ? (
                <div className="tm-deliv-content-loaded">
                  <AttachmentList 
                    fileIds={task.completionAttachments} 
                    hideCardWrap={true} 
                    canDelete={canManageDeliverables}
                    onDelete={handleDeleteWorkFile}
                    deletingFileId={deletingWorkFileId}
                    uploaderLabel={!canPerformStaffActions && performerName ? `Uploaded by ${performerName}` : ''}
                  />
                  
                  {canManageDeliverables && (
                    <div className="tm-deliv-add-more-row">
                      <button
                        type="button"
                        className="tm-deliv-add-more-btn"
                        onClick={() => workFileInputRef.current?.click()}
                        disabled={isUploadingWorkFile || loading}
                      >
                        <Plus size={12} />
                        <span>Add another file</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                canManageDeliverables ? (
                  <div 
                    className="tm-deliv-compact-dropzone"
                    onClick={() => workFileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') workFileInputRef.current?.click(); }}
                    title="Click here to upload files (max 5 MB each)"
                  >
                    <div className="tm-compact-dropzone-left">
                      <div className="tm-compact-drop-icon">
                        <FolderUp size={14} />
                      </div>
                      <div className="tm-compact-drop-text">
                        <span className="tm-compact-drop-main">Click to attach deliverable files or proofs</span>
                        <span className="tm-compact-drop-sub">(PDF, Docs, Excel, Images, ZIP — max 5 MB)</span>
                      </div>
                    </div>
                    <span className="tm-compact-browse-btn">
                      <Plus size={11} />
                      <span>Browse Files</span>
                    </span>
                  </div>
                ) : (
                  <div className="tm-deliv-empty-readonly">
                    <Paperclip size={14} className="tm-empty-ro-icon" />
                    <span>Assignee has not uploaded any deliverables or work proofs yet.</span>
                  </div>
                )
              )}

              {/* Divider between files and comments */}
              <div className="tm-deliv-comments-divider" />

              {/* Assignee Comment & Work Notes Section */}
              <div className="tm-comments-section">
                <div className="tm-comments-header">
                  <div className="tm-comments-title-wrap">
                    <MessageSquare size={13} className="tm-comments-title-icon" />
                    <span className="tm-comments-title">
                      {canPerformStaffActions ? 'Assignee Comments & Work Notes' : 'Task Discussion & Notes'}
                    </span>
                    {taskComments && taskComments.length > 0 && (
                      <span className="tm-comments-count-pill">{taskComments.length}</span>
                    )}
                  </div>
                  {taskComments && taskComments.length > 2 && (
                    <button
                      type="button"
                      className="tm-comments-open-drawer-btn"
                      onClick={() => onOpenChat && onOpenChat(task)}
                      title="Open full conversation thread"
                    >
                      <span>Open Full Discussion</span>
                      <ExternalLink size={10} />
                    </button>
                  )}
                </div>

                {/* Recent comments list */}
                {taskComments && taskComments.length > 0 ? (
                  <div className="tm-comments-list">
                    {taskComments.slice(-3).map((cmt: any, idx: number) => {
                      const senderObj = cmt.sender || {};
                      const isMe = (senderObj._id || senderObj.id) === currentUserId;
                      const senderName = isMe ? 'You' : (resolveUserName(senderObj) || senderObj.name || 'Assignee');
                      const roleLabel = senderObj.role === 'super_admin' ? 'Super Admin' : senderObj.role === 'department_admin' ? 'Admin' : senderObj.role === 'staff' ? 'Staff' : '';
                      
                      return (
                        <div key={cmt._id || idx} className={`tm-comment-bubble-item ${isMe ? 'mine' : ''}`}>
                          <div className="tm-comment-meta">
                            <span className="tm-comment-author">{senderName}</span>
                            {roleLabel && <span className={`tm-comment-role-tag ${senderObj.role}`}>{roleLabel}</span>}
                            <span className="tm-comment-date">{formatDateTimeDDMMYYYY(cmt.createdAt)}</span>
                          </div>
                          <div className="tm-comment-text">{cmt.message}</div>
                        </div>
                      );
                    })}
                    {taskComments.length > 3 && (
                      <div className="tm-comments-more-hint" onClick={() => onOpenChat && onOpenChat(task)}>
                        View all {taskComments.length} messages in Discussion &rarr;
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="tm-comments-empty-notice">
                    {canPerformStaffActions 
                      ? 'No comments yet. Assignee can add work notes, queries, or remarks below.' 
                      : 'No notes or discussion yet. You can add feedback or remarks for the assignee below.'}
                  </div>
                )}

                {/* Inline Comment Input Box */}
                <div className="tm-comment-box-wrap">
                  <div className="tm-comment-input-row">
                    <textarea
                      className="tm-comment-textarea"
                      rows={1}
                      placeholder={canPerformStaffActions 
                        ? 'Add a comment or work update (e.g. script draft ready, please review)...' 
                        : 'Add a remark, query, or feedback for the assignee...'}
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleAddComment();
                        }
                      }}
                      disabled={isPostingComment}
                    />
                    <button
                      type="button"
                      className="tm-comment-submit-btn"
                      onClick={() => handleAddComment()}
                      disabled={isPostingComment || !newCommentText.trim()}
                      title="Post comment (Enter)"
                    >
                      {isPostingComment ? (
                        <Loader2 size={12} className="tm-spin" />
                      ) : (
                        <>
                          <Send size={11} />
                          <span>Send</span>
                        </>
                      )}
                    </button>
                  </div>
                  {commentError && (
                    <div className="tm-comment-inline-error">
                      <AlertCircle size={11} />
                      <span>{commentError}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Rejection Feedback Box */}
            {isRejecting && (
              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '1.25rem', borderRadius: '8px', margin: '1rem 0' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#991b1b', fontSize: '0.95rem', fontWeight: 600 }}>Reject Task & Request Changes</h4>
                <textarea 
                  className="form-control" 
                  placeholder="Provide reason or feedback for rejection..." 
                  value={rejectionReason} 
                  onChange={e => setRejectionReason(e.target.value)}
                  style={{ width: '100%', minHeight: '80px', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '0.75rem', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button className="btn btn-danger" onClick={() => handleReviewAction('rejected')} disabled={loading || !rejectionReason.trim()}>
                    Submit Rejection
                  </button>
                  <button className="btn btn-secondary" onClick={() => setIsRejecting(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Super Admin & Department Admin (Creator) Approval & Performance Rating Prompt */}
            {isApproving && canRateOnApproval && (
              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '1.25rem', borderRadius: '8px', margin: '1rem 0' }}>
                <h4 style={{ margin: '0 0 0.25rem 0', color: '#166534', fontSize: '1rem', fontWeight: 700 }}>
                  Approve Task & Rate Performance
                </h4>
                <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#15803d' }}>
                  Rate the quality of work for the completer. This rating will be added to their profile.
                </p>

                {/* Interactive Star Rating */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#166534', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                    Star Rating (1 to 5 Stars)
                  </label>
                  <div 
                    style={{ display: 'flex', gap: '0.2rem', alignItems: 'center' }}
                    onMouseLeave={() => setHoverRating(0)}
                  >
                    {[1, 2, 3, 4, 5].map((star) => {
                      const activeValue = hoverRating || reviewRating || 0;
                      const isFilled = activeValue >= star;
                      const isHoveredTarget = hoverRating === star;
                      return (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setReviewRating(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '0',
                            width: '32px',
                            height: '32px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: isFilled ? '#eab308' : '#cbd5e1',
                          }}
                        >
                          <Star 
                            size={26} 
                            fill={isFilled ? '#eab308' : 'none'} 
                            style={{
                              pointerEvents: 'none',
                              transition: 'transform 0.12s ease, fill 0.12s ease, color 0.12s ease',
                              transform: isHoveredTarget ? 'scale(1.2)' : isFilled ? 'scale(1.05)' : 'scale(1)',
                            }}
                          />
                        </button>
                      );
                    })}
                    <span style={{ marginLeft: '0.5rem', fontWeight: 700, fontSize: '0.95rem', color: '#854d0e' }}>
                      {hoverRating || reviewRating || 0} / 5 Stars
                    </span>
                  </div>
                </div>

                {/* Feedback comment */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#166534', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                    Feedback & Commendations (Optional)
                  </label>
                  <textarea 
                    className="form-control" 
                    placeholder="e.g. Excellent work, delivered ahead of schedule with high quality..." 
                    value={reviewFeedback} 
                    onChange={e => setReviewFeedback(e.target.value)}
                    style={{ width: '100%', minHeight: '75px', padding: '0.75rem', borderRadius: '6px', border: '1px solid #86efac', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: '0.9rem' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button 
                    className="btn btn-success" 
                    style={{ backgroundColor: '#16a34a', color: 'white', fontWeight: 600, padding: '0.6rem 1.25rem' }}
                    onClick={() => handleReviewAction('approved')} 
                    disabled={loading}
                  >
                    Confirm & Approve Task
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => setIsApproving(false)}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Modal Bottom Action Bar */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginTop: '1.5rem', 
              paddingTop: '1.25rem', 
              borderTop: '1px solid #e2e8f0', 
              flexWrap: 'wrap', 
              gap: '0.75rem' 
            }}>
              
              {/* Left Actions: Edit Details / Assign Staff */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {canEdit && (
                  <button className="btn btn-secondary" onClick={() => setIsEditing(true)}>
                    Edit Details
                  </button>
                )}

                {canAssign && (
                  isAssigning ? (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <div className="tm-assign-wrapper" ref={assignDropdownRef}>
                        <div 
                          className={`tm-custom-select ${isAssignDropdownOpen ? 'open' : ''}`}
                          onClick={() => setIsAssignDropdownOpen(!isAssignDropdownOpen)}
                        >
                          {assignTarget ? (
                            <span>{formatNameString(availableAssignees.find(a => a.id === assignTarget || a._id === assignTarget))}</span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>-- Unassigned --</span>
                          )}
                          <ChevronDown size={16} color="#64748b" />
                        </div>
                        
                        {isAssignDropdownOpen && (
                          <div className="tm-dropdown-menu">
                            <div className="tm-dropdown-header">
                              <div className="tm-dropdown-search">
                                <Search size={14} className="tm-search-icon" />
                                <input 
                                  type="text" 
                                  placeholder="Search users..." 
                                  value={assignSearchQuery}
                                  onChange={e => setAssignSearchQuery(e.target.value)}
                                  onClick={e => e.stopPropagation()}
                                  autoFocus
                                />
                              </div>
                              {currentUser.role === 'super_admin' && (
                                <div className="tm-dropdown-filter-controls">
                                  <div className="tm-dept-filter-wrapper">
                                    <Building2 size={13} className="tm-dept-filter-icon" />
                                    <select 
                                      className="tm-dept-filter-select"
                                      value={assignDeptFilter}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        setAssignDeptFilter(e.target.value);
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <option value="all">All Departments ({availableAssignees.length})</option>
                                      {departmentList.map(dept => {
                                        const count = availableAssignees.filter(a => a.department && a.department.toLowerCase() === dept.toLowerCase()).length;
                                        return (
                                          <option key={dept} value={dept}>
                                            {dept} {count > 0 ? `(${count})` : ''}
                                          </option>
                                        );
                                      })}
                                    </select>
                                  </div>

                                  <div className="tm-role-filters">
                                    <button 
                                      type="button"
                                      className={`tm-role-filter-btn ${assignRoleFilter === 'all' ? 'active' : ''}`}
                                      onClick={(e) => { e.stopPropagation(); setAssignRoleFilter('all'); }}
                                    >All</button>
                                    <button 
                                      type="button"
                                      className={`tm-role-filter-btn ${assignRoleFilter === 'department_admin' ? 'active' : ''}`}
                                      onClick={(e) => { e.stopPropagation(); setAssignRoleFilter('department_admin'); }}
                                    >Admins</button>
                                    <button 
                                      type="button"
                                      className={`tm-role-filter-btn ${assignRoleFilter === 'staff' ? 'active' : ''}`}
                                      onClick={(e) => { e.stopPropagation(); setAssignRoleFilter('staff'); }}
                                    >Staff</button>
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            <ul className="tm-dropdown-list">
                              <li 
                                className={`tm-dropdown-item ${!assignTarget ? 'selected' : ''}`}
                                onClick={() => {
                                  setAssignTarget('');
                                  setIsAssignDropdownOpen(false);
                                }}
                              >
                                <span style={{ color: '#94a3b8' }}>-- Unassigned --</span>
                              </li>
                              {getFilteredAssignees(assignSearchQuery, assignRoleFilter, assignDeptFilter).length === 0 && (
                                <li className="tm-dropdown-item empty">No users found</li>
                              )}
                              {getFilteredAssignees(assignSearchQuery, assignRoleFilter, assignDeptFilter).map(a => {
                                const userId = a.id || a._id;
                                const isSelected = assignTarget === userId;
                                return (
                                  <li 
                                    key={userId}
                                    className={`tm-dropdown-item ${isSelected ? 'selected' : ''}`}
                                    onClick={() => {
                                      setAssignTarget(userId);
                                      setIsAssignDropdownOpen(false);
                                      setAssignSearchQuery('');
                                    }}
                                  >
                                    <div className="tm-assignee-info">
                                      <div className="tm-assignee-primary">
                                        <span className="tm-assignee-name">{userId === currentUser.id || userId === currentUser._id ? 'me' : a.name}</span>
                                        {a.role?.includes('admin') && <span className="tm-role-tag admin">Admin</span>}
                                        {a.role === 'staff' && <span className="tm-role-tag staff">Staff</span>}
                                      </div>
                                      {a.department && (
                                        <span className="tm-assignee-dept">{a.department}</span>
                                      )}
                                    </div>
                                    <span className="tm-assignee-role">ID: {a.universityId || 'N/A'}</span>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}
                      </div>
                      <button className="btn btn-primary" onClick={handleAssign} disabled={loading} style={{ whiteSpace: 'nowrap' }}>Save Assignment</button>
                      <button className="btn btn-secondary" onClick={() => setIsAssigning(false)}>Cancel</button>
                    </div>
                  ) : (
                    <button className="btn btn-secondary" onClick={() => setIsAssigning(true)}>
                      Assign Staff
                    </button>
                  )
                )}
              </div>

              {/* Right Actions: Review / Staff Actions */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginLeft: 'auto' }}>
                
                {/* Review Actions (Approve / Reject) */}
                {canReview && !isRejecting && !isApproving && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      className="btn btn-success" 
                      style={{ backgroundColor: '#10b981', color: 'white', fontWeight: 600, padding: '0.6rem 1.25rem' }} 
                      onClick={() => {
                        if (canRateOnApproval) {
                          setIsApproving(true);
                        } else {
                          handleReviewAction('approved');
                        }
                      }} 
                      disabled={loading}
                    >
                      {currentUser.role === 'department_admin' && !isCreator ? 'Approve & Send to Super Admin' : 'Approve'}
                    </button>
                    <button 
                      className="btn btn-danger" 
                      style={{ backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', fontWeight: 600, padding: '0.6rem 1.25rem' }}
                      onClick={() => setIsRejecting(true)} 
                      disabled={loading}
                    >
                      Reject
                    </button>
                  </div>
                )}

                {/* Performer Staff Actions */}
                {canPerformStaffActions && !isAssigning && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {task.status === 'pending' && <button className="btn btn-primary" onClick={() => handleStatusChange('in_progress')} disabled={loading}>Start Task</button>}
                      {task.status === 'rejected' && <button className="btn btn-primary" onClick={() => handleStatusChange('in_progress')} disabled={loading}>Start Again</button>}
                      {task.status === 'in_progress' && !isSubmittingReview && <button className="btn btn-success" onClick={() => setIsSubmittingReview(true)} disabled={loading} style={{ backgroundColor: '#10b981', color: 'white' }}>Submit Task</button>}
                      {task.status === 'completed' && !isSubmittingReview && <button className="btn btn-success" onClick={() => setIsSubmittingReview(true)} disabled={loading} style={{ backgroundColor: '#3b82f6', color: 'white' }}>Submit for Review</button>}
                      {task.status === 'submitted_for_review' && !canReview && <span style={{ color: '#d97706', fontWeight: 'bold' }}>Waiting for Review</span>}
                      {task.status === 'approved' && <span style={{ color: '#059669', fontWeight: 'bold' }}>Approved</span>}
                    </div>
                    
                    {isSubmittingReview && (
                      <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', width: '100%', marginTop: '0.5rem' }}>
                        <h4 style={{ margin: '0 0 0.5rem 0' }}>Upload Completion Documents</h4>
                        {task.requiredCompletionExtensions && task.requiredCompletionExtensions.length > 0 && (
                          <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>Required formats: {task.requiredCompletionExtensions.join(', ')}</p>
                        )}
                        
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <input 
                              type="file" 
                              multiple 
                              ref={reviewFileInputRef}
                              style={{ display: 'none' }}
                              accept={task.requiredCompletionExtensions?.length ? task.requiredCompletionExtensions.join(',') : '*/*'}
                              onChange={async (e) => {
                                if (e.target.files) {
                                  const selected = Array.from(e.target.files);
                                  // Check 5MB limit
                                  const MAX_SIZE = 5 * 1024 * 1024;
                                  const oversized = selected.filter(f => f.size > MAX_SIZE);
                                  if (oversized.length > 0) {
                                    setFileError(`File "${oversized[0].name}" (${(oversized[0].size / (1024 * 1024)).toFixed(2)} MB) exceeds the 5MB limit. Please select files under 5MB.`);
                                    if (reviewFileInputRef.current) reviewFileInputRef.current.value = '';
                                    return;
                                  }
                                  // Auto-compress images
                                  const compressed = await compressFiles(selected);
                                  if (task.requiredCompletionExtensions?.length) {
                                    const invalid = compressed.filter(f => {
                                      const parts = f.name.split('.');
                                      if (parts.length < 2) return true;
                                      const ext = '.' + parts.pop()?.toLowerCase();
                                      return !task.requiredCompletionExtensions.includes(ext);
                                    });
                                    if (invalid.length > 0) {
                                      setFileError(`Invalid file format: ${invalid.map(f=>f.name).join(', ')}. Allowed: ${task.requiredCompletionExtensions.join(', ')}`);
                                      if (reviewFileInputRef.current) reviewFileInputRef.current.value = '';
                                      return;
                                    }
                                  }
                                  setFileError('');
                                  setReviewFiles(compressed);
                                }
                              }}
                            />
                            <button className="btn btn-secondary" onClick={() => reviewFileInputRef.current?.click()} style={{ width: '100%' }}>
                              Choose Files
                            </button>
                            
                            {/* File Error Popup */}
                            {fileError && (
                              <div style={{
                                marginTop: '0.75rem',
                                padding: '0.5rem 0.75rem',
                                backgroundColor: '#fee2e2',
                                border: '1px solid #fca5a5',
                                borderRadius: '6px',
                                color: '#991b1b',
                                fontSize: '0.8rem',
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                              }}>
                                <span>{fileError}</span>
                                <button 
                                  onClick={() => setFileError('')} 
                                  style={{ background: 'transparent', border: 'none', color: '#991b1b', cursor: 'pointer', fontSize: '1rem', padding: '0 0.25rem' }}
                                >&times;</button>
                              </div>
                            )}
                            {reviewFiles.length > 0 && (
                              <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1rem', fontSize: '0.8rem' }}>
                                {reviewFiles.map((f, i) => <li key={i}>{f.name}</li>)}
                              </ul>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <button className="btn btn-primary" onClick={handleSubmitReview} disabled={loading}>Submit</button>
                            <button className="btn btn-secondary" onClick={() => { setIsSubmittingReview(false); setReviewFiles([]); }}>Cancel</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Subtasks Section */}
            {!task.isSubtask && (
              <div style={{ marginTop: '2rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                    Subtasks ({subtasks.length})
                  </h3>
                  {canAssign && task.status !== 'approved' && (
                    <button 
                      className="btn btn-primary" 
                      style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }} 
                      onClick={() => {
                        const next = !isAddingSubtaskModal;
                        setIsAddingSubtaskModal(next);
                        if (next) {
                          setModalSubtaskTitle('');
                          setModalSubtaskDesc('');
                          setModalSubtaskDeadline(formatToLocalDateTimeInput(task.deadline));
                          const defAssignee = task.assignedTo?._id || task.assignedTo?.id || (availableAssignees.length > 0 ? (availableAssignees[0]._id || availableAssignees[0].id) : '');
                          setModalSubtaskAssignees(defAssignee ? [defAssignee] : []);
                          setModalSubtaskMode('individual');
                          setModalSubtaskError('');
                          setModalSubtaskSuccess('');
                        }
                      }}
                    >
                      {isAddingSubtaskModal ? <><X size={14} /> Cancel</> : <><Plus size={14} /> Add Subtask</>}
                    </button>
                  )}
                </div>

                {/* Inline Subtask Form in Modal */}
                {isAddingSubtaskModal && (
                  <div style={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1.25rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>➕ Add New Subtask</strong>
                      <button 
                        type="button" 
                        onClick={() => setIsAddingSubtaskModal(false)}
                        style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {modalSubtaskError && (
                      <div style={{ padding: '0.45rem 0.75rem', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: '6px', fontSize: '0.78rem', marginBottom: '0.65rem' }}>
                        {modalSubtaskError}
                      </div>
                    )}
                    {modalSubtaskSuccess && (
                      <div style={{ padding: '0.45rem 0.75rem', backgroundColor: '#d1fae5', border: '1px solid #86efac', color: '#065f46', borderRadius: '6px', fontSize: '0.78rem', marginBottom: '0.65rem' }}>
                        {modalSubtaskSuccess}
                      </div>
                    )}

                    <div style={{ marginBottom: '0.65rem' }}>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', marginBottom: '0.25rem' }}>
                        Subtask Title *
                      </label>
                      <input 
                        type="text" 
                        className="form-control"
                        placeholder="e.g. Prepare curriculum proposal document"
                        value={modalSubtaskTitle}
                        onChange={(e) => setModalSubtaskTitle(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                        autoFocus
                      />
                    </div>

                    <div style={{ marginBottom: '0.65rem' }}>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', marginBottom: '0.25rem' }}>
                        Description / Instructions
                      </label>
                      <textarea 
                        className="form-control"
                        placeholder="Specific instructions or notes for this subtask..."
                        rows={2}
                        value={modalSubtaskDesc}
                        onChange={(e) => setModalSubtaskDesc(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontFamily: 'inherit' }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', marginBottom: '0.25rem' }}>
                          Assign To * ({modalSubtaskAssignees.length} selected)
                        </label>
                        {modalSubtaskAssignees.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.45rem' }}>
                            {modalSubtaskAssignees.map(uid => {
                              const u = availableAssignees.find(a => (a._id || a.id) === uid);
                              const uName = u ? (resolveUserName(u) || u.name) : 'User';
                              return (
                                <span key={uid} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '0.2rem 0.5rem', borderRadius: '16px', fontSize: '0.76rem', fontWeight: 600 }}>
                                  👤 {uName}
                                  <button
                                    type="button"
                                    onClick={() => setModalSubtaskAssignees(prev => prev.filter(id => id !== uid))}
                                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center' }}
                                  >
                                    <X size={12} />
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        )}
                        <select 
                          className="form-control"
                          value=""
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val && !modalSubtaskAssignees.includes(val)) {
                              setModalSubtaskAssignees(prev => [...prev, val]);
                            }
                          }}
                          style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                        >
                          <option value="">+ Add Assignee to Subtask...</option>
                          {availableAssignees.map(u => {
                            const uid = u._id || u.id;
                            const isSelected = modalSubtaskAssignees.includes(uid);
                            return (
                              <option key={uid} value={uid} disabled={isSelected}>
                                {isSelected ? '✓ ' : ''}{u.name} {u.universityId ? `(${u.universityId})` : ''} - {u.role === 'department_admin' ? 'Admin' : 'Staff'}{u.department ? ` [${u.department}]` : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', marginBottom: '0.25rem' }}>
                          Deadline * (Max: {formatDateTimeDDMMYYYY(task.deadline)})
                        </label>
                        <input 
                          type="datetime-local" 
                          className="form-control"
                          value={modalSubtaskDeadline}
                          max={formatToLocalDateTimeInput(task.deadline)}
                          onChange={(e) => setModalSubtaskDeadline(e.target.value)}
                          style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>

                    {modalSubtaskAssignees.length > 1 && (
                      <div style={{
                        marginTop: '0.45rem',
                        padding: '0.75rem 0.85rem',
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        marginBottom: '0.75rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            👥 Multiple Assignees Selected
                          </span>
                          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Choose mode:</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                          <label style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.5rem',
                            padding: '0.55rem 0.65rem',
                            border: `1.5px solid ${modalSubtaskMode !== 'shared' ? '#2563eb' : '#e2e8f0'}`,
                            backgroundColor: modalSubtaskMode !== 'shared' ? '#eff6ff' : '#ffffff',
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}>
                            <input 
                              type="radio"
                              name="modal-subtask-mode"
                              checked={modalSubtaskMode !== 'shared'}
                              onChange={() => setModalSubtaskMode('individual')}
                              style={{ marginTop: '0.15rem' }}
                            />
                            <div>
                              <strong style={{ display: 'block', fontSize: '0.78rem', color: '#1e293b' }}>Individual Subtasks</strong>
                              <span style={{ fontSize: '0.7rem', color: '#64748b', lineHeight: 1.25, display: 'block' }}>
                                Separate subtask copy for each staff
                              </span>
                            </div>
                          </label>

                          <label style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.5rem',
                            padding: '0.55rem 0.65rem',
                            border: `1.5px solid ${modalSubtaskMode === 'shared' ? '#2563eb' : '#e2e8f0'}`,
                            backgroundColor: modalSubtaskMode === 'shared' ? '#eff6ff' : '#ffffff',
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}>
                            <input 
                              type="radio"
                              name="modal-subtask-mode"
                              checked={modalSubtaskMode === 'shared'}
                              onChange={() => setModalSubtaskMode('shared')}
                              style={{ marginTop: '0.15rem' }}
                            />
                            <div>
                              <strong style={{ display: 'block', fontSize: '0.78rem', color: '#1e293b' }}>Shared Team Subtask</strong>
                              <span style={{ fontSize: '0.7rem', color: '#64748b', lineHeight: 1.25, display: 'block' }}>
                                1 joint subtask with team deliverables & group chat
                              </span>
                            </div>
                          </label>
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <button 
                        type="button" 
                        className="btn btn-secondary"
                        onClick={() => setIsAddingSubtaskModal(false)}
                        disabled={modalSubtaskLoading}
                      >
                        Cancel
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-primary"
                        onClick={handleModalCreateSubtask}
                        disabled={modalSubtaskLoading}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        {modalSubtaskLoading ? 'Creating...' : <><Check size={14} /> Create Subtask</>}
                      </button>
                    </div>
                  </div>
                )}

                {subtasks.length === 0 ? (
                  <p style={{ color: '#888', fontStyle: 'italic' }}>No subtasks created yet.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '0.85rem' }}>
                    {subtasks.map(st => {
                      const isSubtaskCreator = Boolean(
                        (st.createdBy?._id && ((st.createdBy._id === currentUser.id || st.createdBy._id === currentUser._id))) ||
                        (st.createdBy?.id && ((st.createdBy.id === currentUser.id || st.createdBy.id === currentUser._id))) ||
                        (typeof st.createdBy === 'string' && (st.createdBy === currentUser.id || st.createdBy === currentUser._id)) ||
                        (st.createdBy?.universityId && currentUser?.universityId && st.createdBy.universityId === currentUser.universityId)
                      );
                      const canDeleteSubtask = isSuperAdmin || isSubtaskCreator;

                      return (
                        <div 
                          key={st._id} 
                          id={`subtask-card-${st._id}`}
                          className="tm-subtask-deck-card"
                          style={{ 
                            padding: '1rem', 
                            backgroundColor: '#ffffff', 
                            borderRadius: '8px', 
                            border: '1px solid #e2e8f0',
                            borderLeft: `4px solid ${st.status === 'approved' ? '#10b981' : st.status === 'rejected' ? '#ef4444' : st.status === 'submitted_for_review' ? '#f59e0b' : '#3b82f6'}`,
                            boxShadow: '0 2px 4px rgba(15, 23, 42, 0.04)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 800, color: '#3b82f6', fontSize: '0.85rem' }}>#{st.taskId}</span>
                              <strong style={{ fontSize: '0.98rem', color: '#0f172a' }}>{st.title}</strong>
                              {(st.assignmentMode === 'shared' || (st.coAssignees && st.coAssignees.length > 1)) && (
                                <span style={{ fontSize: '0.7rem', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                  👥 Team Subtask
                                </span>
                              )}
                            </div>
                            <span className={`tm-status-pill status-${st.status}`} style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', borderRadius: '12px', fontWeight: 600, textTransform: 'capitalize', backgroundColor: st.status === 'approved' ? '#dcfce7' : st.status === 'rejected' ? '#fee2e2' : '#e0e7ff', color: st.status === 'approved' ? '#166534' : st.status === 'rejected' ? '#991b1b' : '#3730a3' }}>
                              {st.status?.replace(/_/g, ' ')}
                            </span>
                          </div>

                          {st.description && st.description !== st.title && (
                            <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748b', lineHeight: 1.4 }}>
                              {st.description}
                            </p>
                          )}

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', color: '#475569', flexWrap: 'wrap', gap: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                            {st.coAssignees && st.coAssignees.length > 0 ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                👥 <strong>Team:</strong> {st.coAssignees.map((ca: any) => ca.name || ca.universityId || 'Staff').join(', ')}
                              </span>
                            ) : (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                👤 <strong>Assigned:</strong> {formatNameString(st.delegatedTo || st.assignedTo)}
                              </span>
                            )}
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                              📅 <strong>Due:</strong> {formatDateTimeDDMMYYYY(st.deadline)}
                            </span>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              {onOpenChat && (
                                <button
                                  type="button"
                                  onClick={() => onOpenChat(st)}
                                  style={{
                                    padding: '0.25rem 0.6rem',
                                    backgroundColor: '#f1f5f9',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem'
                                  }}
                                  title="Chat regarding this subtask"
                                >
                                  <MessageSquare size={12} /> Chat
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setParentMainTask(task);
                                  setTask(st);
                                }}
                                style={{
                                  padding: '0.25rem 0.6rem',
                                  backgroundColor: '#021c3b',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem'
                                }}
                                title="View full details and manage this subtask"
                              >
                                <ExternalLink size={12} /> View Details
                              </button>
                              {canDeleteSubtask && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSubtask(st._id, st.title)}
                                  disabled={deletingSubtaskId === st._id}
                                  style={{
                                    padding: '0.25rem 0.6rem',
                                    backgroundColor: '#fef2f2',
                                    color: '#dc2626',
                                    border: '1px solid #fecaca',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem'
                                  }}
                                  title="Delete this subtask"
                                >
                                  <Trash2 size={12} /> {deletingSubtaskId === st._id ? '...' : 'Delete'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="tm-edit-form">
            <div className="tm-edit-header">
              <h3 className="tm-edit-title">Edit Task</h3>
              <p className="tm-edit-subtitle">Modify task details while it is in pending status.</p>
            </div>

            <div className="tm-edit-group">
              <label className="tm-edit-label">Title</label>
              <input 
                type="text" 
                className="tm-edit-input"
                placeholder="Enter task title..."
                value={editData.title}
                onChange={e => setEditData({...editData, title: e.target.value})}
              />
            </div>
            
            <div className="tm-edit-group">
              <label className="tm-edit-label">Description</label>
              <textarea 
                className="tm-edit-textarea"
                rows={4}
                placeholder="Enter task description..."
                value={editData.description}
                onChange={e => setEditData({...editData, description: e.target.value})}
              />
            </div>

            <div className="tm-edit-group">
              <label className="tm-edit-label">Deadline</label>
              <input 
                type="datetime-local" 
                className="tm-edit-input"
                value={editData.deadline}
                onChange={e => setEditData({...editData, deadline: e.target.value})}
              />
            </div>

            <div className="tm-edit-actions">
              <button className="tm-btn-save" onClick={handleUpdate} disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              <button className="tm-btn-cancel" onClick={() => setIsEditing(false)} disabled={loading}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* In-App Verification Modal to Delete Task */}
      <ConfirmDeleteModal 
        isOpen={showDeleteConfirm}
        taskId={task.taskId}
        taskTitle={task.title}
        subtaskCount={subtasks?.length || 0}
        isDeleting={loading}
        onConfirm={handleConfirmDeleteModal}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
};

export default TaskModal;
