import { Request, Response } from 'express';
import Department from '../models/Department';
import User from '../models/User';

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
    const existing = await Department.findOne({ 
      name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } 
    });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Department already exists' });
    }

    const newDepartment = new Department({ 
      name: trimmedName,
      code: code ? String(code).trim().toUpperCase() : ''
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

      // Check if another department has this name
      const duplicate = await Department.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      });
      if (duplicate) {
        return res.status(400).json({ success: false, message: 'Another department already has this name' });
      }

      if (trimmedName !== oldName) {
        department.name = trimmedName;
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
      await User.updateMany({ department: oldName }, { $set: { department: newName } });
      try {
        const VerifiedUser = require('../models/VerifiedUser').default;
        await VerifiedUser.updateMany({ department: oldName }, { $set: { department: newName } });
      } catch (err) {
        console.error('Error cascading department name to VerifiedUser:', err);
      }
    }

    res.json({
      success: true,
      message: 'Department updated successfully',
      data: { department }
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

    // Optional: check if users are assigned to this department
    const usersInDept = await User.countDocuments({ department: department.name });
    if (usersInDept > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete department because ${usersInDept} users are assigned to it.` 
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

    if (verifiedUserAccess !== undefined) department.verifiedUserAccess = verifiedUserAccess;
    if (canAddVerifiedUsers !== undefined) department.canAddVerifiedUsers = Boolean(canAddVerifiedUsers);
    if (canUploadVerifiedUsers !== undefined) department.canUploadVerifiedUsers = Boolean(canUploadVerifiedUsers);

    await department.save();

    return res.status(200).json({
      success: true,
      message: 'Department permissions updated successfully',
      data: { department }
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
          canUploadVerifiedUsers: true
        }
      });
    }

    if (!user.department) {
      return res.status(200).json({
        success: true,
        data: {
          department: null,
          verifiedUserAccess: 'none',
          canAddVerifiedUsers: false,
          canUploadVerifiedUsers: false
        }
      });
    }

    const dept = await Department.findOne({ name: user.department });
    if (!dept) {
      return res.status(200).json({
        success: true,
        data: {
          department: user.department,
          verifiedUserAccess: 'none',
          canAddVerifiedUsers: false,
          canUploadVerifiedUsers: false
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        department: dept.name,
        verifiedUserAccess: dept.verifiedUserAccess || 'none',
        canAddVerifiedUsers: dept.canAddVerifiedUsers ?? true,
        canUploadVerifiedUsers: dept.canUploadVerifiedUsers ?? true
      }
    });
  } catch (error: any) {
    console.error('Error fetching my department permissions:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

