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
  uploadTaskAttachments,
  deleteTaskAttachment,
  requestDeadlineExtension,
  reviewDeadlineExtension,
  directExtendDeadline
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

// @route   PATCH /api/tasks/:id/extend-deadline
// @desc    Super Admin or Creator directly extends task deadline
// @access  Super Admin, Department Admin (creator)
router.patch('/:id/extend-deadline', authorizeRoles('super_admin', 'department_admin'), directExtendDeadline);

// @route   POST /api/tasks/:id/request-extension
// @desc    Assignee requests deadline extension
// @access  Task Assignees
router.post('/:id/request-extension', requestDeadlineExtension);

// @route   PATCH /api/tasks/:id/review-extension
// @desc    Review (endorse, approve, reject) a deadline extension request
// @access  Super Admin, Department Admin
router.patch('/:id/review-extension', authorizeRoles('super_admin', 'department_admin'), reviewDeadlineExtension);

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

// @route   DELETE /api/tasks/:id/attachments/:fileId
// @desc    Delete a deliverable/work file from a task (only while in progress/pending/rejected)
// @access  Assignee, staff, creator, admins
router.delete('/:id/attachments/:fileId', deleteTaskAttachment);

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
