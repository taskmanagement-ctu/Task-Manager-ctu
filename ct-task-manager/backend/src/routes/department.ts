import express from 'express';
import { 
  getDepartments, 
  createDepartment, 
  updateDepartment,
  deleteDepartment,
  updateDepartmentPermissions,
  getMyDepartmentPermissions
} from '../controllers/departmentController';
import { authenticate, authorizeRoles } from '../middleware/auth';

const router = express.Router();

// Publicly accessible so the registration form can fetch the dropdown list
router.get('/', getDepartments);

// Authenticated: Get my department's permissions
router.get('/my-permissions', authenticate, getMyDepartmentPermissions);

// Only Super Admins can manage departments
router.post('/', authenticate, authorizeRoles('super_admin'), createDepartment);
router.patch('/:id', authenticate, authorizeRoles('super_admin'), updateDepartment);
router.put('/:id', authenticate, authorizeRoles('super_admin'), updateDepartment);
router.patch('/:id/permissions', authenticate, authorizeRoles('super_admin'), updateDepartmentPermissions);
router.delete('/:id', authenticate, authorizeRoles('super_admin'), deleteDepartment);

export default router;
