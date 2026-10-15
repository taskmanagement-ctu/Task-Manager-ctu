import { Router } from 'express';
import {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  assignTask,
  updateTaskStatus,
  submitReview,
  reviewTask,
  createSubtask,
  getSubtasks,
  getTaskProgress,
  getNaacReport,
  addTaskComment,
  getTaskComments,
  markCommentsAsRead,
  deleteTask,
  uploadTaskAttachments
} from '../controllers/taskController';
import { authenticate, authorizeRoles } from '../middleware/auth';
import { uploadAny } from '../middleware/upload';

const router = Router();

router.use(authenticate);

// @route   POST /api/tasks
// @desc    Create a task
// @access  Super Admin, Department Admin
router.post('/', authorizeRoles('super_admin', 'department_admin'), uploadAny.array('attachments'), createTask);

// @route   GET /api/tasks/naac-report
// @desc    Get department-wise NAAC report and leaderboard
// @access  Super Admin, Department Admin, Staff
router.get('/naac-report', authorizeRoles('super_admin', 'department_admin', 'staff'), getNaacReport);

// @route   GET /api/tasks
// @desc    Get all visible tasks with filtering/pagination
// @access  All roles
router.get('/', getTasks);

// @route   GET /api/tasks/:id
// @desc    Get a single task by ID
// @access  All roles (visibility enforced in controller)
router.get('/:id', getTaskById);

// @route   PATCH /api/tasks/:id
// @desc    Update task details (title, description, deadline)
// @access  Super Admin, Department Admin (own only)
router.patch('/:id', authorizeRoles('super_admin', 'department_admin'), updateTask);

// @route   PATCH /api/tasks/:id/assign
// @desc    Assign or unassign a task
// @access  Super Admin, Department Admin
router.patch('/:id/assign', authorizeRoles('super_admin', 'department_admin'), assignTask);

// @route   PATCH /api/tasks/:id/status
// @desc    Update task status
// @access  All roles (visibility enforced in controller)
router.patch('/:id/status', updateTaskStatus);

// @route   PATCH /api/tasks/:id/submit-review
// @desc    Submit a task for review (and upload completion attachments)
// @access  Assignee only
router.patch('/:id/submit-review', uploadAny.array('attachments'), submitReview);

// @route   POST /api/tasks/:id/attachments
// @desc    Upload deliverables/files for a task (any format, < 5MB)
// @access  Assignee, staff, creator, admins
router.post('/:id/attachments', uploadAny.array('attachments'), uploadTaskAttachments);

// @route   PATCH /api/tasks/:id/review
// @desc    Approve or reject a task
// @access  Super Admin or assigned Department Admin
router.patch('/:id/review', authorizeRoles('super_admin', 'department_admin'), reviewTask);

// @route   POST /api/tasks/:id/subtasks
// @desc    Create a subtask
// @access  Super Admin, Department Admin
router.post('/:id/subtasks', authorizeRoles('super_admin', 'department_admin'), createSubtask);

// @route   GET /api/tasks/:id/subtasks
// @desc    Get all subtasks for a given parent task
// @access  All roles
router.get('/:id/subtasks', getSubtasks);

// @route   GET /api/tasks/:id/progress
// @desc    Get progress of a parent task
// @access  All roles
router.get('/:id/progress', getTaskProgress);

// @route   POST /api/tasks/:id/comments
// @desc    Post a comment/message to a task
// @access  Task participants & admins
router.post('/:id/comments', addTaskComment);

// @route   GET /api/tasks/:id/comments
// @desc    Get all comments for a task
// @access  Task participants & admins
router.get('/:id/comments', getTaskComments);

// @route   PATCH /api/tasks/:id/comments/read
// @desc    Mark comments as read for a task
// @access  All authenticated users
router.patch('/:id/comments/read', markCommentsAsRead);

// @route   DELETE /api/tasks/:id
// @desc    Delete a task (Creator or Super Admin only)
// @access  Task Creator or Super Admin
router.delete('/:id', deleteTask);

export default router;
