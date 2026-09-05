import { Router } from 'express';
import {
  getUsers,
  getUserStats,
  getUserById,
  updateUserRole,
  updateUserStatus,
  deleteUser,
  getUserProfile,
  updateUserProfile,
  changeDepartmentAdmin,
} from '../controllers/userController';
import { authenticate, authorizeRoles } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// @route   GET /api/users/profile, GET /api/users/profile/:id
// @desc    Get user profile with rating and performance stats
router.get('/profile', getUserProfile);
router.get('/profile/:id', getUserProfile);

// @route   PATCH /api/users/profile
// @desc    Update current user's profile (e.g. department, phone)
router.patch('/profile', updateUserProfile);

// @route   GET /api/users
// @desc    Get all registered users with pagination & filtering
router.get('/', authorizeRoles('super_admin', 'department_admin'), getUsers);

// The remaining routes require Super Admin access
router.use(authorizeRoles('super_admin'));

// @route   GET /api/users/stats
// @desc    Get user counts by role and status
router.get('/stats', getUserStats);

// @route   GET /api/users/:id
// @desc    Get single user details
router.get('/:id', getUserById);

// @route   PATCH /api/users/:id/role
// @desc    Update user's role
router.patch('/:id/role', updateUserRole);

// @route   PATCH /api/users/:id/status
// @desc    Activate/deactivate user
router.patch('/:id/status', updateUserStatus);

// @route   DELETE /api/users/:id
// @desc    Permanently delete user from database
router.delete('/:id', deleteUser);

// @route   POST /api/users/change-department-admin
// @desc    Change department admin, transferring active team assignments and setting old admin to unassigned staff
router.post('/change-department-admin', changeDepartmentAdmin);

export default router;
