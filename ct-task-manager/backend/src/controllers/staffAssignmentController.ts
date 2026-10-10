import { Request, Response } from 'express';
import StaffAssignment from '../models/StaffAssignment';
import User from '../models/User';
import { sendRosterAdditionEmail } from '../services/emailService';

// GET /api/staff-assignments
// Super Admin only: gets all active and inactive assignments (or can filter)
export const getAssignments = async (req: Request, res: Response) => {
  try {
    const assignments = await StaffAssignment.find()
      .populate('adminId', 'name universityId email department role isActive')
      .populate('staffId', 'name universityId email department role isActive')
      .populate('assignedBy', 'name')
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: { assignments } });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// POST /api/staff-assignments
// Super Admin only: Create/reassign staff to a department admin
export const createAssignment = async (req: Request, res: Response) => {
  try {
    const { adminId, staffId } = req.body;
    const assignedBy = req.user._id;

    if (!adminId || !staffId) {
      return res.status(400).json({ success: false, message: 'adminId and staffId are required.' });
    }

    if (adminId === staffId) {
      return res.status(400).json({ success: false, message: 'Cannot assign a user to themselves.' });
    }

    // Verify Admin
    const admin = await User.findById(adminId);
    if (!admin) return res.status(404).json({ success: false, message: 'Target admin not found.' });
    if (!admin.isActive) return res.status(400).json({ success: false, message: 'Target admin is inactive.' });
    if (admin.role !== 'department_admin' && admin.role !== 'super_admin') {
      return res.status(400).json({ success: false, message: 'Target admin must have department_admin or super_admin role.' });
    }
    if (req.user.role === 'department_admin' && req.user._id.toString() !== adminId) {
      return res.status(403).json({ success: false, message: 'Forbidden. You can only assign staff to your own roster.' });
    }

    // Verify Staff
    const staff = await User.findById(staffId);
    if (!staff) return res.status(404).json({ success: false, message: 'Target staff not found.' });
    if (!staff.isActive) return res.status(400).json({ success: false, message: 'Target staff is inactive.' });
    if (staff.role !== 'staff') {
      return res.status(400).json({ success: false, message: 'Target staff must have staff role.' });
    }

    // Check if staff already has an active assignment
    const existingActive = await StaffAssignment.findOne({ staffId, isActive: true });
    
    // If the staff is already assigned to the same admin, just return success or error
    if (existingActive && existingActive.adminId.toString() === adminId) {
      return res.status(400).json({ success: false, message: 'Staff member is already assigned to this admin.' });
    }

    // If reassigning, deactivate old assignment
    if (existingActive) {
      if (req.user.role !== 'super_admin') {
        return res.status(400).json({ success: false, message: 'Staff member is already assigned to another Department Admin.' });
      }
      existingActive.isActive = false;
      await existingActive.save();
    }

    // Create new assignment
    const newAssignment = new StaffAssignment({
      adminId,
      staffId,
      assignedBy,
      isActive: true,
    });
    await newAssignment.save();

    // Send roster addition notification email
    sendRosterAdditionEmail(
      staff.email,
      staff.name,
      staff.universityId,
      admin.department || staff.department,
      admin.name,
      req.user?.name
    ).catch((err) => console.error('Failed to send roster addition email:', err));

    const populatedAssignment = await StaffAssignment.findById(newAssignment._id)
      .populate('adminId', 'name universityId email department role isActive')
      .populate('staffId', 'name universityId email department role isActive')
      .populate('assignedBy', 'name');

    return res.status(201).json({
      success: true,
      message: 'Staff assigned successfully.',
      data: { assignment: populatedAssignment },
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Staff member already has an active assignment.' });
    }
    console.error('Error creating assignment:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// PATCH /api/staff-assignments/:id
// Super Admin or Department Admin (only for their own assignment)
// Specifically to deactivate an assignment (remove staff)
export const updateAssignmentStatus = async (req: Request, res: Response) => {
  try {
    const { isActive } = req.body;
    const assignmentId = req.params.id;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isActive must be a boolean.' });
    }

    const assignment = await StaffAssignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found.' });
    }

    // Authorization check
    if (req.user.role === 'department_admin') {
      if (assignment.adminId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Forbidden. You do not own this assignment.' });
      }
      if (isActive === true && assignment.isActive === false) {
         return res.status(403).json({ success: false, message: 'Forbidden. Department Admin cannot reactivate a removed assignment.' });
      }
    }

    assignment.isActive = isActive;
    await assignment.save();

    return res.status(200).json({
      success: true,
      message: 'Assignment updated successfully.',
      data: { assignment },
    });
  } catch (error) {
    console.error('Error updating assignment:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// GET /api/staff-assignments/admin/:adminId
// Department Admin (only their own) or Super Admin
export const getAdminAssignments = async (req: Request, res: Response) => {
  try {
    const { adminId } = req.params;

    // Authorization
    if (req.user.role === 'department_admin' && req.user._id.toString() !== adminId) {
      return res.status(403).json({ success: false, message: 'Forbidden. Cannot view other admin assignments.' });
    }

    const assignments = await StaffAssignment.find({ adminId, isActive: true })
      .populate('staffId', 'name universityId email phone department isActive role')
      .populate('assignedBy', 'name')
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: { assignments } });
  } catch (error) {
    console.error('Error fetching admin assignments:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// GET /api/staff-assignments/staff/:staffId
// View the active assignment of a staff member
export const getStaffAssignment = async (req: Request, res: Response) => {
  try {
    const { staffId } = req.params;

    // A staff member could view their own, super_admin can view any
    if (req.user.role === 'staff' && req.user._id.toString() !== staffId) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const assignment = await StaffAssignment.findOne({ staffId, isActive: true })
      .populate('adminId', 'name universityId email department')
      .populate('assignedBy', 'name');

    return res.status(200).json({ success: true, data: { assignment } });
  } catch (error) {
    console.error('Error fetching staff assignment:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};
