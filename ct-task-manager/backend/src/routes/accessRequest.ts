import { Router } from 'express';
import { authenticate, authorizeRoles } from '../middleware/auth';
import {
  submitAccessRequest,
  getAccessRequests,
  getAccessRequestStats,
  approveAccessRequest,
  rejectAccessRequest,
} from '../controllers/accessRequestController';

const router = Router();

// POST /api/access-requests — Public submission for unlisted users
router.post('/', submitAccessRequest);

// GET /api/access-requests/stats — Statistics (Pending, Approved, Rejected)
router.get('/stats', authenticate, authorizeRoles('super_admin', 'department_admin'), getAccessRequestStats);

// GET /api/access-requests — List requests with filter & pagination
router.get('/', authenticate, authorizeRoles('super_admin', 'department_admin'), getAccessRequests);

// POST /api/access-requests/:id/approve — Approve a request
router.post('/:id/approve', authenticate, authorizeRoles('super_admin', 'department_admin'), approveAccessRequest);

// POST /api/access-requests/:id/reject — Reject a request
router.post('/:id/reject', authenticate, authorizeRoles('super_admin', 'department_admin'), rejectAccessRequest);

export default router;
