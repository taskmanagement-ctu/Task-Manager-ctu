const API_URL = import.meta.env.VITE_API_URL || '';

export const isTokenExpired = (token: string | null): boolean => {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonPayload);
    if (!parsed || typeof parsed.exp !== 'number') {
      return false;
    }
    // Expire 5 seconds early to avoid edge race conditions
    return parsed.exp * 1000 <= Date.now() + 5000;
  } catch {
    return true;
  }
};

// ─── Token Management ─────────────────────────────────────
export const tokenStorage = {
  getToken: (): string | null => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return null;
      if (isTokenExpired(token)) {
        localStorage.removeItem('token');
        return null;
      }
      return token;
    } catch {
      return null;
    }
  },
  setToken: (token: string) => {
    try {
      localStorage.setItem('token', token);
    } catch {
      // Ignore quota errors
    }
  },
  clearToken: () => {
    try {
      localStorage.removeItem('token');
    } catch {
      // Ignore errors
    }
  },
};

export const parseSafeJson = async (response: Response, defaultErrorMessage: string) => {
  const text = await response.text().catch(() => '');
  let json: any = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  if (!response.ok) {
    let errorMsg = json?.message;
    if (!errorMsg) {
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        errorMsg = `Backend server is unavailable (${response.status} Bad Gateway). Please make sure the backend server is running.`;
      } else if (response.status === 404) {
        errorMsg = 'API route not found (404)';
      } else {
        errorMsg = `${defaultErrorMessage} (${response.status})`;
      }
    }
    const err: any = new Error(errorMsg);
    err.status = response.status;
    err.code = json?.code;
    err.canRequestAccess = json?.canRequestAccess;
    throw err;
  }
  return json || {};
};

const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
  const token = tokenStorage.getToken();
  const headers: any = {
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (networkError: any) {
    throw new Error('Unable to connect to the server. Please check your connection or verify the backend is running.');
  }

  const text = await response.text().catch(() => '');
  let json: any = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!response.ok) {
    if (response.status === 401 && token) {
      tokenStorage.clearToken();
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
        window.location.href = '/login';
      }
    }
    let errorMsg = json?.message;
    if (!errorMsg) {
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        errorMsg = `Backend server is unavailable (${response.status} Bad Gateway). Please make sure the backend server is running.`;
      } else if (response.status === 404) {
        errorMsg = `API route not found (404): ${endpoint}`;
      } else {
        errorMsg = `API request failed (${response.status})`;
      }
    }
    const err: any = new Error(errorMsg);
    err.status = response.status;
    err.code = json?.code;
    err.canRequestAccess = json?.canRequestAccess;
    throw err;
  }
  return json || {};
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
  category?: string | null;
  isRegistered: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccessRequest {
  _id: string;
  universityId: string;
  name: string;
  email: string;
  phone: string;
  department: string | null;
  userType: 'staff' | 'student';
  category?: string | null;
  reason?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string | null;
  reviewedBy?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccessRequestStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
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
  sheet?: string;
  field: string;
  message: string;
}

export interface ImportResult {
  totalRows: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: ImportRowError[];
  sheetsProcessed?: string[];
}

export interface VerifiedUserStats {
  total: number;
  registered: number;
  notRegistered: number;
  departments: number;
  categories?: string[];
}

// ─── API Methods ──────────────────────────────────────────

export const api = {
  /**
   * Check backend health status.
   */
  checkHealth: async (): Promise<HealthResponse> => {
    const response = await fetch(`${API_URL}/api/health`);
    return parseSafeJson(response, 'Health check failed');
  },

  // ─── Verified Users ───────────────────────────────────

  /**
   * Upload an Excel/CSV file to import verified users.
   */
  importVerifiedUsers: async (file: File): Promise<{ success: boolean; message: string; data: ImportResult }> => {
    const formData = new FormData();
    formData.append('file', file);

    return fetchWithAuth('/api/verified-users/import', {
      method: 'POST',
      body: formData,
    });
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
    category?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    export?: boolean;
  }): Promise<{ success: boolean; data: { users: VerifiedUser[]; pagination: Pagination } }> => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.status) query.set('status', params.status);
    if (params.userType) query.set('userType', params.userType);
    if (params.department) query.set('department', params.department);
    if (params.category && params.category !== 'All') query.set('category', params.category);
    if (params.sortBy) query.set('sortBy', params.sortBy);
    if (params.sortOrder) query.set('sortOrder', params.sortOrder);
    if (params.export) query.set('export', 'true');

    return fetchWithAuth(`/api/verified-users?${query.toString()}`);
  },

  createVerifiedUser: async (userData: {
    universityId: string;
    name: string;
    email: string;
    phone: string;
    department?: string | null;
    userType?: 'staff' | 'student';
    category?: string | null;
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

  // ─── Access Requests ───────────────────────────────────

  /**
   * Submit a new portal access request (Public).
   */
  submitAccessRequest: async (data: {
    universityId: string;
    name: string;
    email: string;
    phone: string;
    department?: string | null;
    userType?: 'staff' | 'student';
    reason?: string;
  }): Promise<{ success: boolean; message: string; data: AccessRequest }> => {
    const response = await fetch(`${API_URL}/api/access-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return parseSafeJson(response, 'Failed to submit access request');
  },

  /**
   * Fetch access requests (Admin).
   */
  getAccessRequests: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    department?: string;
    search?: string;
  }): Promise<{ success: boolean; data: { requests: AccessRequest[]; pagination: Pagination } }> => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.status && params.status !== 'all') query.set('status', params.status);
    if (params?.department && params.department !== 'All') query.set('department', params.department);
    if (params?.search) query.set('search', params.search);

    return fetchWithAuth(`/api/access-requests?${query.toString()}`);
  },

  /**
   * Fetch access request stats.
   */
  getAccessRequestStats: async (): Promise<{ success: boolean; data: AccessRequestStats }> => {
    return fetchWithAuth('/api/access-requests/stats');
  },

  /**
   * Approve an access request.
   */
  approveAccessRequest: async (id: string): Promise<{ success: boolean; message: string; data: AccessRequest }> => {
    return fetchWithAuth(`/api/access-requests/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  },

  /**
   * Reject an access request.
   */
  rejectAccessRequest: async (id: string, reason?: string): Promise<{ success: boolean; message: string; data: AccessRequest }> => {
    return fetchWithAuth(`/api/access-requests/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
  },

  // ─── Departments ──────────────────────────────────────

  getDepartments: async (): Promise<{ success: boolean; data: { departments: Department[] } }> => {
    // Public endpoint for registration form
    const response = await fetch(`${API_URL}/api/departments`);
    return parseSafeJson(response, 'Failed to fetch departments');
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
   * Send OTP to email for registration or password reset.
   */
  sendOTP: async (data: { email?: string; identifier?: string; purpose: 'registration' | 'forgot_password'; universityId?: string; name?: string }): Promise<{ success: boolean; message: string; email?: string; maskedEmail?: string; universityId?: string }> => {
    const response = await fetch(`${API_URL}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return parseSafeJson(response, 'Failed to send verification code.');
  },

  /**
   * Verify an OTP code.
   */
  verifyOTP: async (data: { email?: string; identifier?: string; otp: string; purpose: 'registration' | 'forgot_password' }): Promise<{ success: boolean; message: string }> => {
    const response = await fetch(`${API_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return parseSafeJson(response, 'Failed to verify code.');
  },

  /**
   * Reset password with verified OTP.
   */
  resetPassword: async (data: { email?: string; identifier?: string; otp: string; newPassword: string; confirmNewPassword: string }): Promise<{ success: boolean; message: string; universityId?: string }> => {
    const response = await fetch(`${API_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return parseSafeJson(response, 'Failed to reset password.');
  },

  /**
   * Change password for the current authenticated user.
   */
  changePassword: async (data: { currentPassword: string; newPassword: string; confirmPassword: string }): Promise<{ success: boolean; message: string }> => {
    return fetchWithAuth('/api/users/change-password', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

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

    return parseSafeJson(response, 'Registration failed');
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

    return parseSafeJson(response, 'Invalid University ID or password.');
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
    department?: string;
    status?: string;
    unassignedOnly?: boolean;
  }): Promise<{ success: boolean; data: { users: User[]; pagination: Pagination } }> => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.role) query.set('role', params.role);
    if (params.department) query.set('department', params.department);
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
    return fetchWithAuth(`/api/users/${id}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, department }),
    });
  },

  /**
   * Change department admin smoothly, transferring active team and setting former admin to unassigned staff.
   */
  changeDepartmentAdmin: async (newAdminId: string, department?: string): Promise<{ success: boolean; message: string; data: { newAdmin: User; previousAdmin: User | null; transferredCount: number } }> => {
    return fetchWithAuth('/api/users/change-department-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newAdminId, department }),
    });
  },

  /**
   * Update user status (activate/deactivate).
   */
  updateUserStatus: async (id: string, isActive: boolean): Promise<{ success: boolean; message: string; data: { user: User } }> => {
    return fetchWithAuth(`/api/users/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    });
  },

  /**
   * Permanently delete a registered user from the database.
   */
  deleteUser: async (id: string): Promise<{ success: boolean; message: string }> => {
    return fetchWithAuth(`/api/users/${id}`, {
      method: 'DELETE',
    });
  },

  // ─── Staff Assignments ────────────────────────────────
  
  getAssignments: async (): Promise<{ success: boolean; data: { assignments: any[] } }> => {
    return fetchWithAuth('/api/staff-assignments');
  },
  
  createAssignment: async (adminId: string, staffId: string): Promise<{ success: boolean; message: string; data: any }> => {
    return fetchWithAuth('/api/staff-assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId, staffId }),
    });
  },

  updateAssignmentStatus: async (assignmentId: string, isActive: boolean): Promise<{ success: boolean; message: string; data: any }> => {
    return fetchWithAuth(`/api/staff-assignments/${assignmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    });
  },

  getAdminAssignments: async (adminId: string): Promise<{ success: boolean; data: { assignments: any[] } }> => {
    return fetchWithAuth(`/api/staff-assignments/admin/${adminId}`);
  },

  getStaffAssignment: async (staffId: string): Promise<{ success: boolean; data: { assignment: any } }> => {
    return fetchWithAuth(`/api/staff-assignments/staff/${staffId}`);
  },

  // ─── Tasks ────────────────────────────────────────────

  createTask: async (taskData: FormData): Promise<{ success: boolean; message: string; data: any }> => {
    return fetchWithAuth('/api/tasks', {
      method: 'POST',
      body: taskData,
    });
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
    return fetchWithAuth(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  },

  assignTask: async (id: string, assignedTo: string | null): Promise<{ success: boolean; message: string; data: any }> => {
    return fetchWithAuth(`/api/tasks/${id}/assign`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignedTo }),
    });
  },

  updateTaskStatus: async (id: string, status: string): Promise<{ success: boolean; message: string; data: any }> => {
    return fetchWithAuth(`/api/tasks/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  },

  submitTaskForReview: async (id: string, formData?: FormData): Promise<{ success: boolean; message: string; data: any }> => {
    return fetchWithAuth(`/api/tasks/${id}/submit-review`, {
      method: 'PATCH',
      body: formData || new FormData(),
    });
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
    return fetchWithAuth('/api/users/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  },

  createSubtask: async (taskId: string, data: { title: string; description: string; deadline: string; assignedTo: string | string[] }): Promise<{ success: boolean; data: { task: any; tasks?: any[] } }> => {
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
    return fetchWithAuth(`/api/files/${fileId}/metadata`);
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
      const json = await parseSafeJson(res, 'Failed to fetch settings');
      if (json && json.data) {
        return json;
      }
      return { success: true, data: { systemName: 'Task-Manage' } };
    } catch {
      return { success: true, data: { systemName: 'Task-Manage' } };
    }
  },

  updateSettings: async (settings: { systemName?: string; logoUrl?: string | null; logoShape?: string; logoSize?: string }): Promise<{ success: boolean; data: any; message: string }> => {
    return fetchWithAuth('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
  }
};
