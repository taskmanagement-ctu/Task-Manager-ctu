import { Router } from 'express';
import healthRoutes from './health';
import authRoutes from './auth';
import verifiedUserRoutes from './verifiedUsers';
import userRoutes from './user';
import staffAssignmentRoutes from './staffAssignment';
import taskRoutes from './task';
import departmentRoutes from './department';
import fileRoutes from './file';
import notificationRoutes from './notification';
import settingRoutes from './setting';
import accessRequestRoutes from './accessRequest';

const router = Router();

// Mount routes
router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/verified-users', verifiedUserRoutes);
router.use('/access-requests', accessRequestRoutes);
router.use('/users', userRoutes);
router.use('/staff-assignments', staffAssignmentRoutes);
router.use('/tasks', taskRoutes);
router.use('/departments', departmentRoutes);
router.use('/files', fileRoutes);
router.use('/notifications', notificationRoutes);
router.use('/settings', settingRoutes);

export default router;
