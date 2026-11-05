import { Request, Response } from 'express';
import Department from '../models/Department';
import User, { PRIMARY_SUPER_ADMIN_ID } from '../models/User';
import Notification from '../models/Notification';
import {
  sendDepartmentPermissionGrantedEmail,
  sendDepartmentPermissionRevokedEmail,
  sendDepartmentPermissionUpdatedEmail,
} from '../services/emailService';
import {
  normalizeDepartmentName,
  areDepartmentsEqual,
  formatDepartmentDisplayName,
  findMatchingDepartment,
} from '../utils/normalization';

// GET /api/departments
export const getDepartments = async (req: Request, res: Response) => {
  try {
    const departments = await Department.find().sort({ name: 1 });
    res.json({ success: true, data: { departments } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/departments
export const createDepartment = async (req: Request, res: Response) => {
  try {
    const { name, code } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Department name is required' });
    }

    const trimmedName = name.trim();
    const formattedName = formatDepartmentDisplayName(trimmedName);
    const normalized = normalizeDepartmentName(trimmedName);

    // Check for duplicate matching via exact regex or '&' vs 'and' normalization
    const existing = await Department.findOne({ 
      $or: [
        { name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        { normalizedName: normalized },
      ],
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Department already exists as "${existing.name}" (matches with '&' / 'and' normalization)`,
      });
    }

    const newDepartment = new Department({ 
      name: formattedName,
      normalizedName: normalized,
      code: code ? String(code).trim().toUpperCase() : '',
    });
    await newDepartment.save();

    res.status(201).json({ success: true, message: 'Department created', data: { department: newDepartment } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/departments/:id (Super Admin only - Edit department name & code)
export const updateDepartment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, code } = req.body;

    const department = await Department.findById(id);
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }

    const oldName = department.name;
    let nameChanged = false;

    if (name !== undefined) {
      const trimmedName = String(name).trim();
      if (!trimmedName) {
        return res.status(400).json({ success: false, message: 'Department name cannot be empty' });
      }

      const formattedName = formatDepartmentDisplayName(trimmedName);
      const normalized = normalizeDepartmentName(trimmedName);

      // Check if another department has this name or normalized equivalent
      const duplicate = await Department.findOne({
        _id: { $ne: id },
        $or: [
          { name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
          { normalizedName: normalized },
        ],
      });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: `Another department already exists as "${duplicate.name}" (matches with '&' / 'and' normalization)`,
        });
      }

      if (formattedName !== oldName) {
        department.name = formattedName;
        department.normalizedName = normalized;
        nameChanged = true;
      }
    }

    if (code !== undefined) {
      department.code = code ? String(code).trim().toUpperCase() : '';
    }

    await department.save();

    // If name changed, cascade update to users and verified users
    if (nameChanged) {
      const newName = department.name;
      const allUsers = await User.find({ department: { $ne: null } });
      for (const u of allUsers) {
        if (areDepartmentsEqual(u.department, oldName)) {
          u.department = newName;
          await u.save();
        }
      }
      try {
        const VerifiedUser = require('../models/VerifiedUser').default;
        const allVUsers = await VerifiedUser.find({ department: { $ne: null } });
        for (const vu of allVUsers) {
          if (areDepartmentsEqual(vu.department, oldName)) {
            vu.department = newName;
            await vu.save();
          }
        }
      } catch (err) {
        console.error('Error cascading department name to VerifiedUser:', err);
      }
    }

    res.json({
      success: true,
      message: 'Department updated successfully',
      data: { department },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/departments/:id
export const deleteDepartment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const department = await Department.findById(id);
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }

    const deptName = department.name;

    // Check if any users belong to this department (checking exact and normalized)
    const allUsers = await User.find({ department: { $ne: null } });
    const userCount = allUsers.filter((u) => areDepartmentsEqual(u.department, deptName)).length;

    if (userCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete department: ${userCount} user(s) are assigned to it. Reassign them first.` 
      });
    }

    await Department.findByIdAndDelete(id);

    res.json({ success: true, message: 'Department deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/departments/:id/permissions (Super Admin only)
export const updateDepartmentPermissions = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { verifiedUserAccess, canAddVerifiedUsers, canUploadVerifiedUsers } = req.body;

    const allowedAccess = ['none', 'staff', 'student', 'both'];
    if (verifiedUserAccess && !allowedAccess.includes(verifiedUserAccess)) {
      return res.status(400).json({ success: false, message: 'Invalid verifiedUserAccess value' });
    }

    const department = await Department.findById(id);
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }

    // Capture previous state
    const prevAccess = department.verifiedUserAccess || 'none';
    const prevCanAdd = department.canAddVerifiedUsers ?? true;
    const prevCanUpload = department.canUploadVerifiedUsers ?? true;

    // Apply updates
    if (verifiedUserAccess !== undefined) department.verifiedUserAccess = verifiedUserAccess;
    if (canAddVerifiedUsers !== undefined) department.canAddVerifiedUsers = Boolean(canAddVerifiedUsers);
    if (canUploadVerifiedUsers !== undefined) department.canUploadVerifiedUsers = Boolean(canUploadVerifiedUsers);

    await department.save();

    const newAccess = department.verifiedUserAccess || 'none';
    const newCanAdd = department.canAddVerifiedUsers ?? true;
    const newCanUpload = department.canUploadVerifiedUsers ?? true;

    // Determine what changed
    const accessChanged = prevAccess !== newAccess;
    const addChanged = prevCanAdd !== newCanAdd;
    const uploadChanged = prevCanUpload !== newCanUpload;

    const wasRevoked = prevAccess !== 'none' && newAccess === 'none';
    const wasGranted = prevAccess === 'none' && newAccess !== 'none';
    const wasUpdated = prevAccess !== 'none' && newAccess !== 'none' && (addChanged || uploadChanged);

    if (wasRevoked || wasGranted || wasUpdated) {
      try {
        // Find all department admins of this department
        const allAdmins = await User.find({
          role: 'department_admin',
          isActive: true,
        });

        const targetAdmins = allAdmins.filter(admin => 
          (admin.department && areDepartmentsEqual(admin.department, department.name)) ||
          (admin.baseDepartment && areDepartmentsEqual(admin.baseDepartment, department.name))
        );

        const operator = (req as any).user;
        const operatorDisplayName =
          operator?.name ||
          (operator?.universityId === PRIMARY_SUPER_ADMIN_ID
            ? 'Primary Super Admin (10001)'
            : 'Super Admin');

        for (const admin of targetAdmins) {
          // Send In-App Notification
          try {
            let notifTitle = '';
            let notifMessage = '';

            if (wasGranted) {
              notifTitle = 'Staff Directory Access Granted';
              notifMessage = `Your department (${department.name}) has been granted Staff Directory access by ${operatorDisplayName}.`;
            } else if (wasRevoked) {
              notifTitle = 'Staff Directory Access Revoked';
              notifMessage = `Staff Directory access for your department (${department.name}) has been revoked by ${operatorDisplayName}.`;
            } else if (wasUpdated) {
              notifTitle = 'Staff Directory Privileges Updated';
              notifMessage = `Privileges for Staff Directory in your department (${department.name}) have been updated by ${operatorDisplayName}.`;
            }

            if (notifTitle) {
              await Notification.create({
                recipient: admin._id,
                type: 'task_updated',
                title: notifTitle,
                message: notifMessage,
                triggeredBy: operator?._id || null,
              });
            }
          } catch (notifErr) {
            console.error(`Error creating notification for dept admin ${admin._id}:`, notifErr);
          }

          // Send Email Notification
          try {
            if (wasGranted) {
              sendDepartmentPermissionGrantedEmail({
                toEmail: admin.email,
                recipientName: admin.name,
                universityId: admin.universityId,
                departmentName: department.name,
                canAdd: newCanAdd,
                canUpload: newCanUpload,
                updatedByName: operatorDisplayName,
              }).catch(err => console.error(`Error sending dept permission granted email to ${admin.email}:`, err));
            } else if (wasRevoked) {
              sendDepartmentPermissionRevokedEmail({
                toEmail: admin.email,
                recipientName: admin.name,
                universityId: admin.universityId,
                departmentName: department.name,
                updatedByName: operatorDisplayName,
              }).catch(err => console.error(`Error sending dept permission revoked email to ${admin.email}:`, err));
            } else if (wasUpdated) {
              sendDepartmentPermissionUpdatedEmail({
                toEmail: admin.email,
                recipientName: admin.name,
                universityId: admin.universityId,
                departmentName: department.name,
                canAdd: newCanAdd,
                canUpload: newCanUpload,
                updatedByName: operatorDisplayName,
              }).catch(err => console.error(`Error sending dept permission updated email to ${admin.email}:`, err));
            }
          } catch (emailErr) {
            console.error(`Error dispatching email to dept admin ${admin.email}:`, emailErr);
          }
        }
      } catch (postUpdateErr) {
        console.error('Error dispatching department permission notifications/emails:', postUpdateErr);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Department permissions updated successfully',
      data: { department },
    });
  } catch (error: any) {
    console.error('Error updating department permissions:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// GET /api/departments/my-permissions (Authenticated Dept Admin)
export const getMyDepartmentPermissions = async (req: Request, res: Response) => {
  try {
    const user = req.user;

    // Super Admin has all permissions
    if (user.role === 'super_admin') {
      return res.status(200).json({
        success: true,
        data: {
          department: null,
          verifiedUserAccess: 'both',
          canAddVerifiedUsers: true,
          canUploadVerifiedUsers: true,
        },
      });
    }

    if (!user.department) {
      return res.status(200).json({
        success: true,
        data: {
          department: null,
          verifiedUserAccess: 'none',
          canAddVerifiedUsers: false,
          canUploadVerifiedUsers: false,
        },
      });
    }

    const allDepts = await Department.find({});
    const dept = findMatchingDepartment(allDepts, user.department);
    if (!dept) {
      return res.status(200).json({
        success: true,
        data: {
          department: user.department,
          verifiedUserAccess: 'none',
          canAddVerifiedUsers: false,
          canUploadVerifiedUsers: false,
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        department: dept.name,
        verifiedUserAccess: dept.verifiedUserAccess || 'none',
        canAddVerifiedUsers: dept.canAddVerifiedUsers ?? true,
        canUploadVerifiedUsers: dept.canUploadVerifiedUsers ?? true,
      },
    });
  } catch (error: any) {
    console.error('Error fetching my department permissions:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};
