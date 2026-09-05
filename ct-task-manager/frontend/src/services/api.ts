const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ─── Token Management ─────────────────────────────────────
export const tokenStorage = {
  getToken: () => localStorage.getItem('token'),
  setToken: (token: string) => localStorage.setItem('token', token),
  clearToken: () => localStorage.removeItem('token'),
};

const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
  const token = tokenStorage.getToken();
  const headers: any = {
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const json = await response.json().catch(() => ({ message: 'API request failed' }));
  if (!response.ok) {
    if (response.status === 401 && token) {
      tokenStorage.clearToken();
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
        window.location.href = '/login';
      }
    }
    throw new Error(json.message || 'API request failed');
  }
  return json;
};

// ─── Shared Types ─────────────────────────────────────────

interface HealthResponse {
  success: boolean;
  message: string;
  database: string;
}

export interface VerifiedUser {
  _id: string;
  universityId: string;
  name: string;
  email: string;
  phone: string;
  department: string | null;
  userType?: 'staff' | 'student';
  isRegistered: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  _id?: string;
  universityId: string;
  name: string;
  email: string;
  phone: string;
  department: string | null;
  role: string;
  isActive?: boolean;
}

export interface TaskComment {
  _id: string;
  sender: {
    _id: string;
    name: string;
    role: string;
    department?: string;
    universityId?: string;
    employeeId?: string;
    email?: string;
  };
  message: string;
  channel?: 'super_admin' | 'staff' | 'general';
  attachments?: any[];
  readBy?: string[];
  readAt?: string | null;
  createdAt: string;
}

export interface Task {
  _id: string;
  id?: string;
  taskId?: string;
  title: string;
  description: string;
  createdBy: any;
  assignedTo: any;
  delegatedTo?: any;
  deadline: string;
  status: 'pending' | 'in_progress' | 'completed' | 'submitted_for_review' | 'approved' | 'rejected';
  isSubtask?: boolean;
  workflowType?: string;
  reviewStage?: string;
  currentReviewer?: any;
  reviewRequestedBy?: any;
  rejectionReason?: string | null;
  attachments?: string[];
  completionAttachments?: string[];
  requiredCompletionExtensions?: string[];
  submittedAt?: string | null;
  completedAt?: string | null;
  rating?: number | null;
  feedback?: string | null;
  ratedBy?: any;
  ratedAt?: string | null;
  ratedUser?: any;
  comments?: TaskComment[];
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  _id: string;
  name: string;
  code?: string;
  verifiedUserAccess?: 'none' | 'staff' | 'student' | 'both';
  canAddVerifiedUsers?: boolean;
  canUploadVerifiedUsers?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ImportRowError {
  row: number;
  field: string;
  message: string;
}

export interface ImportResult {
  totalRows: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: ImportRowError[];
}

export interface VerifiedUserStats {
  total: number;
  registered: number;
  notRegistered: number;
  departments: number;
}

// ─── API Methods ──────────────────────────────────────────

export const api = {
  /**
   * Check backend health status.
   */
  checkHealth: async (): Promise<HealthResponse> => {
    const response = await fetch(`${API_URL}/api/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    return response.json();
  },

  // ─── Verified Users ───────────────────────────────────

  /**
   * Upload an Excel/CSV file to import verified users.
   */
  importVerifiedUsers: async (file: File): Promise<{ success: boolean; message: string; data: ImportResult }> => {
    const formData = new FormData();
    formData.append('file', file);

    const token = tokenStorage.getToken();
    const headers: any = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_URL}/api/verified-users/import`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.message || 'Import failed');
    }
    return json;
  },

  /**
   * Fetch verified users with pagination, search, and status filter.
   */
  getVerifiedUsers: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    userType?: string;
    department?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ success: boolean; data: { users: VerifiedUser[]; pagination: Pagination } }> => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.status) query.set('status', params.status);
    if (params.userType) query.set('userType', params.userType);
    if (params.department) query.set('department', params.department);
    if (params.sortBy) query.set('sortBy', params.sortBy);
    if (params.sortOrder) query.set('sortOrder', params.sortOrder);

    return fetchWithAuth(`/api/verified-users?${query.toString()}`);
  },

  createVerifiedUser: async (userData: {
    universityId: string;
    name: string;
    email: string;
    phone: string;
    department?: string | null;
    userType?: 'staff' | 'student';
  }): Promise<{ success: boolean; message: string; data: { user: VerifiedUser } }> => {
    return fetchWithAuth('/api/verified-users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
  },

  deleteVerifiedUser: async (id: string): Promise<{ success: boolean; message: string }> => {
    return fetchWithAuth(`/api/verified-users/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Bulk delete verified users.
   */
  bulkDeleteVerifiedUsers: async (ids: string[]): Promise<{ success: boolean; message: string; data?: { deletedCount: number } }> => {
    return fetchWithAuth('/api/verified-users/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
  },

  /**
   * Get verified user statistics.
   */
  getVerifiedUserStats: async (): Promise<{ success: boolean; data: VerifiedUserStats & { staffCount?: number; studentCount?: number } }> => {
    return fetchWithAuth(`/api/verified-users/stats`);
  },

  /**
   * Download the verified users Excel template.
   */
  downloadTemplate: (): string => {
    return `${API_URL}/api/verified-users/template`;
  },

  // ─── Departments ──────────────────────────────────────

  getDepartments: async (): Promise<{ success: boolean; data: { departments: Department[] } }> => {
    // Public endpoint for registration form
    const response = await fetch(`${API_URL}/api/departments`);
    const json = await response.json();
    if (!response.ok) throw new Error(json.message || 'Failed to fetch departments');
    return json;
  },

  getMyDepartmentPermissions: async (): Promise<{
    success: boolean;
    data: {
      department: string | null;
      verifiedUserAccess: 'none' | 'staff' | 'student' | 'both';
      canAddVerifiedUsers: boolean;
      canUploadVerifiedUsers: boolean;
    };
  }> => {
    return fetchWithAuth('/api/departments/my-permissions');
  },

  createDepartment: async (name: string, code?: string): Promise<{ success: boolean; message: string; data: { department: Department } }> => {
    return fetchWithAuth('/api/departments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, code }),
    });
  },

  updateDepartment: async (id: string, data: { name?: string; code?: string }): Promise<{ success: boolean; message: string; data: { department: Department } }> => {
    return fetchWithAuth(`/api/departments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  updateDepartmentPermissions: async (
    id: string,
    permissions: {
      verifiedUserAccess?: 'none' | 'staff' | 'student' | 'both';
      canAddVerifiedUsers?: boolean;
      canUploadVerifiedUsers?: boolean;
    }
  ): Promise<{ success: boolean; message: string; data: { department: Department } }> => {
    return fetchWithAuth(`/api/departments/${id}/permissions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(permissions),
    });
  },

  deleteDepartment: async (id: string): Promise<{ success: boolean; message: string }> => {
    return fetchWithAuth(`/api/departments/${id}`, {
      method: 'DELETE',
    });
  },

  // ─── Authentication ───────────────────────────────────

  /**
   * Register a new user.
   */
  register: async (userData: any): Promise<{ success: boolean; message: string; data?: { user: User } }> => {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.message || 'Registration failed');
    }
    return json;
  },

  /**
   * Login user and return token + user info.
   */
  login: async (credentials: any): Promise<{ success: boolean; message: string; data: { token: string; user: User } }> => {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.message || 'Invalid University ID or password.');
    }
    return json;
  },

  /**
   * Get the current authenticated user's profile from the database.
   */
  getCurrentUser: async (): Promise<{ success: boolean; data: { user: User } }> => {
    return fetchWithAuth('/api/auth/me');
  },

  // ─── User Management (Super Admin) ────────────────────

  /**
   * Fetch users with pagination and filtering.
   */
  getUsers: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    status?: string;
    unassignedOnly?: boolean;
  }): Promise<{ success: boolean; data: { users: User[]; pagination: Pagination } }> => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.role) query.set('role', params.role);
    if (params.status) query.set('status', params.status);
    if (params.unassignedOnly) query.set('unassignedOnly', 'true');

    return fetchWithAuth(`/api/users?${query.toString()}`);
  },

  /**
   * Get user statistics.
   */
  getUserStats: async (): Promise<{
    success: boolean;
    data: {
      totalUsers: number;
      activeUsers: number;
      inactiveUsers: number;
      superAdmins: number;
      departmentAdmins: number;
      staff: number;
    };
  }> => {
    return fetchWithAuth(`/api/users/stats`);
  },

  /**
   * Get user by ID.
   */
  getUserById: async (id: string): Promise<{ success: boolean; data: { user: User } }> => {
    return fetchWithAuth(`/api/users/${id}`);
  },

  /**
   * Update user role.
   */
  updateUserRole: async (id: string, role: string, department?: string): Promise<{ success: boolean; message: string; data: { user: User } }> => {
    const response = await fetch(`${API_URL}/api/users/${id}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenStorage.getToken()}`
      },
      body: JSON.stringify({ role, department }),
    });
    
    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.message || 'Failed to update user role');
    }
    return json;
  },

  /**
   * Change department admin smoothly, transferring active team and setting former admin to unassigned staff.
   */
  changeDepartmentAdmin: async (newAdminId: string, department?: string): Promise<{ success: boolean; message: string; data: { newAdmin: User; previousAdmin: User | null; transferredCount: number } }> => {
    const response = await fetch(`${API_URL}/api/users/change-department-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenStorage.getToken()}`
      },
      body: JSON.stringify({ newAdminId, department }),
    });

    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.message || 'Failed to change department admin');
    }
    return json;
  },

  /**
   * Update user status (activate/deactivate).
   */
  updateUserStatus: async (id: string, isActive: boolean): Promise<{ success: boolean; message: string; data: { user: User } }> => {
    const response = await fetch(`${API_URL}/api/users/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenStorage.getToken()}`
      },
      body: JSON.stringify({ isActive }),
    });

    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.message || 'Failed to update user status');
    }
    return json;
  },

  /**
   * Permanently delete a registered user from the database.
   */
  deleteUser: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await fetch(`${API_URL}/api/users/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${tokenStorage.getToken()}`
      },
    });

    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.message || 'Failed to delete user');
    }
    return json;
  },

  // ─── Staff Assignments ────────────────────────────────
  
  getAssignments: async (): Promise<{ success: boolean; data: { assignments: any[] } }> => {
    return fetchWithAuth('/api/staff-assignments');
  },
  
  createAssignment: async (adminId: string, staffId: string): Promise<{ success: boolean; message: string; data: any }> => {
    const response = await fetch(`${API_URL}/api/staff-assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenStorage.getToken()}`
      },
      body: JSON.stringify({ adminId, staffId }),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.message || 'Failed to create assignment');
    return json;
  },

  updateAssignmentStatus: async (assignmentId: string, isActive: boolean): Promise<{ success: boolean; message: string; data: any }> => {
    const response = await fetch(`${API_URL}/api/staff-assignments/${assignmentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenStorage.getToken()}`
      },
      body: JSON.stringify({ isActive }),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.message || 'Failed to update assignment status');
    return json;
  },

  getAdminAssignments: async (adminId: string): Promise<{ success: boolean; data: { assignments: any[] } }> => {
    return fetchWithAuth(`/api/staff-assignments/admin/${adminId}`);
  },

  getStaffAssignment: async (staffId: string): Promise<{ success: boolean; data: { assignment: any } }> => {
    return fetchWithAuth(`/api/staff-assignments/staff/${staffId}`);
  },

  // ─── Tasks ────────────────────────────────────────────

  createTask: async (taskData: FormData): Promise<{ success: boolean; message: string; data: any }> => {
    const response = await fetch(`${API_URL}/api/tasks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenStorage.getToken()}`
      },
      body: taskData,
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.message || 'Failed to create task');
    return json;
  },

  getTasks: async (params: { page?: number; limit?: number; search?: string; status?: string; assignee?: string; sortBy?: string; workflow?: string; reviewStage?: string; taskType?: string; department?: string; teamOnly?: string }): Promise<{ success: boolean; data: { tasks: any[]; pagination: Pagination } }> => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.status) query.set('status', params.status);
    if (params.assignee) query.set('assignee', params.assignee);
    if (params.sortBy) query.set('sortBy', params.sortBy);
    if (params.workflow) query.set('workflow', params.workflow);
    if (params.reviewStage) query.set('reviewStage', params.reviewStage);
    if (params.taskType) query.set('taskType', params.taskType);
    if (params.department) query.set('department', params.department);
    if (params.teamOnly) query.set('teamOnly', params.teamOnly);

    return fetchWithAuth(`/api/tasks?${query.toString()}`);
  },

  getTaskById: async (id: string): Promise<{ success: boolean; data: { task: any } }> => {
    return fetchWithAuth(`/api/tasks/${id}`);
  },

  updateTask: async (id: string, updates: { title?: string; description?: string; deadline?: string }): Promise<{ success: boolean; message: string; data: any }> => {
    const response = await fetch(`${API_URL}/api/tasks/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenStorage.getToken()}`
      },
      body: JSON.stringify(updates),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.message || 'Failed to update task');
    return json;
  },

  assignTask: async (id: string, assignedTo: string | null): Promise<{ success: boolean; message: string; data: any }> => {
    const response = await fetch(`${API_URL}/api/tasks/${id}/assign`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenStorage.getToken()}`
      },
      body: JSON.stringify({ assignedTo }),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.message || 'Failed to assign task');
    return json;
  },

  updateTaskStatus: async (id: string, status: string): Promise<{ success: boolean; message: string; data: any }> => {
    const response = await fetch(`${API_URL}/api/tasks/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenStorage.getToken()}`
      },
      body: JSON.stringify({ status }),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.message || 'Failed to update task status');
    return json;
  },

  submitTaskForReview: async (id: string, formData?: FormData): Promise<{ success: boolean; message: string; data: any }> => {
    const response = await fetch(`${API_URL}/api/tasks/${id}/submit-review`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${tokenStorage.getToken()}`
      },
      body: formData || new FormData(),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.message || 'Failed to submit for review');
    return json;
  },

  getNaacReport: async (): Promise<{ success: boolean; data: any }> => {
    return fetchWithAuth(`/api/tasks/naac-report`);
  },
  reviewTask: async (taskId: string, decision: 'approved' | 'rejected', reason?: string, rating?: number, feedback?: string): Promise<{ success: boolean; data: { task: any } }> => {
    return fetchWithAuth(`/api/tasks/${taskId}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, reason, rating, feedback }),
    });
  },

  getUserProfile: async (userId?: string): Promise<{ success: boolean; data: { user: any; performance: any } }> => {
    return fetchWithAuth(userId ? `/api/users/profile/${userId}` : `/api/users/profile`);
  },

  updateUserProfile: async (updates: { department?: string; phone?: string; name?: string }): Promise<{ success: boolean; message: string; data: { user: any } }> => {
    const response = await fetch(`${API_URL}/api/users/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenStorage.getToken()}`
      },
      body: JSON.stringify(updates),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.message || 'Failed to update profile');
    return json;
  },

  createSubtask: async (taskId: string, data: { title: string; description: string; deadline: string; assignedTo: string }): Promise<{ success: boolean; data: { task: any } }> => {
    return fetchWithAuth(`/api/tasks/${taskId}/subtasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  getSubtasks: async (taskId: string): Promise<{ success: boolean; data: { subtasks: any[] } }> => {
    return fetchWithAuth(`/api/tasks/${taskId}/subtasks`);
  },

  getTaskProgress: async (taskId: string): Promise<{ success: boolean; data: any }> => {
    return fetchWithAuth(`/api/tasks/${taskId}/progress`);
  },

  getFileMetadata: async (fileId: string): Promise<{ success: boolean; data: { file: any } }> => {
    const response = await fetch(`${API_URL}/api/files/${fileId}/metadata`);
    const json = await response.json();
    if (!response.ok) throw new Error(json.message || 'Failed to fetch file metadata');
    return json;
  },

  getTaskComments: async (taskId: string): Promise<{ success: boolean; data: TaskComment[] }> => {
    return fetchWithAuth(`/api/tasks/${taskId}/comments`);
  },

  addTaskComment: async (taskId: string, message: string, channel?: string): Promise<{ success: boolean; data: TaskComment[]; message: string }> => {
    return fetchWithAuth(`/api/tasks/${taskId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, channel }),
    });
  },

  markTaskCommentsRead: async (taskId: string, channel?: string): Promise<{ success: boolean; message: string }> => {
    return fetchWithAuth(`/api/tasks/${taskId}/comments/read`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel }),
    });
  },

  // ─── Notifications ──────────────────────────────────────────

  getNotifications: async (params?: { page?: number; limit?: number; filter?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.filter) searchParams.set('filter', params.filter);
    const qs = searchParams.toString();
    return fetchWithAuth(`/api/notifications${qs ? `?${qs}` : ''}`);
  },

  getUnreadNotificationCount: async (): Promise<{ success: boolean; count: number }> => {
    return fetchWithAuth('/api/notifications/unread-count');
  },

  markNotificationRead: async (id: string) => {
    return fetchWithAuth(`/api/notifications/${id}/read`, { method: 'PATCH' });
  },

  markAllNotificationsRead: async () => {
    return fetchWithAuth('/api/notifications/read-all', { method: 'PATCH' });
  },

  // ─── System Settings ──────────────────────────────────────────

  getSettings: async (): Promise<{ success: boolean; data: { systemName: string; [key: string]: any } }> => {
    try {
      const res = await fetch(`${API_URL}/api/settings`);
      const json = await res.json();
      if (res.ok && json.data) {
        return json;
      }
      return { success: true, data: { systemName: 'Task-Manage' } };
    } catch (e) {
      return { success: true, data: { systemName: 'Task-Manage' } };
    }
  },

  updateSettings: async (settings: { systemName?: string; logoUrl?: string | null; logoShape?: string; logoSize?: string }): Promise<{ success: boolean; data: any; message: string }> => {
    const response = await fetch(`${API_URL}/api/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenStorage.getToken()}`
      },
      body: JSON.stringify(settings)
    });

    let json: any;
    try {
      json = await response.json();
    } catch {
      if (response.status === 413) {
        throw new Error('Image is too large for the server. Please try a smaller image or re-crop.');
      }
      throw new Error(`Server returned error status ${response.status}`);
    }

    if (!response.ok) {
      throw new Error(json.message || 'Failed to update system settings');
    }
    return json;
  }
};
