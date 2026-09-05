import { Router } from 'express';
import { uploadFile } from '../middleware/upload';
import { authenticate, authorizeRoles } from '../middleware/auth';
import {
  importFile,
  createVerifiedUser,
  deleteVerifiedUser,
  bulkDeleteVerifiedUsers,
  getVerifiedUsers,
  getStats,
  getByUniversityId,
  downloadTemplate,
} from '../controllers/verifiedUserController';

const router = Router();

// GET /api/verified-users/template — Download blank template
router.get('/template', downloadTemplate);

// GET /api/verified-users/stats — Summary statistics
router.get('/stats', authenticate, authorizeRoles('super_admin', 'department_admin'), getStats);

// GET /api/verified-users/:universityId — Single user lookup (public for registration check)
router.get('/:universityId', getByUniversityId);

// GET /api/verified-users — List with pagination, search, filter
router.get('/', authenticate, authorizeRoles('super_admin', 'department_admin'), getVerifiedUsers);

// POST /api/verified-users — Add single verified user
router.post('/', authenticate, authorizeRoles('super_admin', 'department_admin'), createVerifiedUser);

// POST /api/verified-users/import — Upload Excel/CSV file
router.post('/import', authenticate, authorizeRoles('super_admin', 'department_admin'), uploadFile.single('file'), importFile);

// POST /api/verified-users/bulk-delete — Bulk delete verified users
router.post('/bulk-delete', authenticate, authorizeRoles('super_admin', 'department_admin'), bulkDeleteVerifiedUsers);

// DELETE /api/verified-users/bulk — Bulk delete verified users
router.delete('/bulk', authenticate, authorizeRoles('super_admin', 'department_admin'), bulkDeleteVerifiedUsers);

// DELETE /api/verified-users/:id — Delete a verified user
router.delete('/:id', authenticate, authorizeRoles('super_admin', 'department_admin'), deleteVerifiedUser);

export default router;

