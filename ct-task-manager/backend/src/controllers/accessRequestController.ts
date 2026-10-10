import { Request, Response } from 'express';
import AccessRequest from '../models/AccessRequest';
import VerifiedUser from '../models/VerifiedUser';
import User from '../models/User';
import Department from '../models/Department';
import {
  sendAccessRequestApprovalEmail,
  sendAccessRequestRejectionEmail,
} from '../services/emailService';
import {
  findMatchingDepartment,
  formatDepartmentDisplayName,
  normalizeDepartmentName,
} from '../utils/normalization';

/**
 * Public endpoint: Submit a new Access / Verification Request
 * POST /api/access-requests
 */
export const submitAccessRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { universityId, name, email, phone, department, userType, reason } = req.body;

    const trimmedId = String(universityId || '').trim();
    const trimmedName = String(name || '').trim();
    const trimmedEmail = String(email || '').trim().toLowerCase();
    const trimmedPhone = String(phone || '').trim().replace(/\D/g, '');
    const trimmedDept = department ? String(department).trim() : null;
    const rawType = String(userType || '').toLowerCase().trim();
    const type = rawType.includes('non') ? 'non_teaching' : 'teaching';
    const categoryName = type === 'non_teaching' ? 'Non-Teaching Staff' : 'Teaching Staff';

    // 1. Validations
    if (!trimmedId || !trimmedName || !trimmedEmail || !trimmedPhone) {
      res.status(400).json({
        success: false,
        message: 'University ID, Name, Email, and Phone Number are required.',
      });
      return;
    }

    if (!/^\d{3,5}$/.test(trimmedId)) {
      res.status(400).json({
        success: false,
        message: 'University ID must contain between 3 and 5 digits.',
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      res.status(400).json({
        success: false,
        message: 'Please enter a valid email address.',
      });
      return;
    }

    if (trimmedPhone.length !== 10) {
      res.status(400).json({
        success: false,
        message: 'Phone number must contain exactly 10 digits.',
      });
      return;
    }

    // 2. Check if already registered
    const existingUser = await User.findOne({
      $or: [{ universityId: trimmedId }, { email: trimmedEmail }],
    });
    if (existingUser) {
      res.status(409).json({
        success: false,
        message: 'An account with this University ID or Email is already registered. Please log in.',
      });
      return;
    }

    // 3. Check if already verified
    const existingVerified = await VerifiedUser.findOne({ universityId: trimmedId });
    if (existingVerified) {
      res.status(409).json({
        success: false,
        message: 'Your University ID is already in the verified database! You can directly click "Send Code" to register.',
      });
      return;
    }

    // 4. Check if pending request already exists
    const pendingRequest = await AccessRequest.findOne({
      universityId: trimmedId,
      status: 'pending',
    });
    if (pendingRequest) {
      res.status(409).json({
        success: false,
        message: `An access request for University ID ${trimmedId} has already been submitted and is currently pending administrator review.`,
      });
      return;
    }

    // 5. Create request
    const newRequest = await AccessRequest.create({
      universityId: trimmedId,
      name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone,
      department: trimmedDept || null,
      userType: type,
      category: categoryName,
      reason: reason ? String(reason).trim() : null,
      status: 'pending',
    });

    res.status(201).json({
      success: true,
      message: 'Access request submitted successfully. The administrator will review your details shortly.',
      data: newRequest,
    });
  } catch (error: any) {
    console.error('Submit Access Request Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit access request. Please try again.',
    });
  }
};

/**
 * Get Access Requests (Paginated + Filtered)
 * GET /api/access-requests
 */
export const getAccessRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const status = req.query.status as string;
    const search = (req.query.search as string || '').trim();
    const departmentQuery = req.query.department as string;

    const filter: any = {};

    // Role-based department scoping
    if (user?.role === 'department_admin') {
      if (!user.department) {
        res.status(403).json({ success: false, message: 'Department admin has no assigned department.' });
        return;
      }
      const allDepts = await Department.find({});
      const matched = findMatchingDepartment(allDepts, user.department);
      if (matched) {
        filter.department = matched.name;
      } else {
        filter.department = user.department;
      }
    } else if (departmentQuery && departmentQuery !== 'All') {
      filter.department = departmentQuery;
    }

    // Status filter
    if (status && status !== 'all') {
      filter.status = status;
    }

    // Search filter
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { universityId: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await AccessRequest.countDocuments(filter);
    const requests = await AccessRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-__v');

    res.status(200).json({
      success: true,
      data: {
        requests,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: any) {
    console.error('Get Access Requests Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch access requests.',
    });
  }
};

/**
 * Get Access Request Statistics
 * GET /api/access-requests/stats
 */
export const getAccessRequestStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const baseFilter: any = {};

    if (user?.role === 'department_admin') {
      if (user.department) {
        const allDepts = await Department.find({});
        const matched = findMatchingDepartment(allDepts, user.department);
        baseFilter.department = matched ? matched.name : user.department;
      }
    }

    const [total, pending, approved, rejected] = await Promise.all([
      AccessRequest.countDocuments(baseFilter),
      AccessRequest.countDocuments({ ...baseFilter, status: 'pending' }),
      AccessRequest.countDocuments({ ...baseFilter, status: 'approved' }),
      AccessRequest.countDocuments({ ...baseFilter, status: 'rejected' }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        total,
        pending,
        approved,
        rejected,
      },
    });
  } catch (error: any) {
    console.error('Get Access Request Stats Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch access request statistics.',
    });
  }
};

/**
 * Approve an Access Request
 * POST /api/access-requests/:id/approve
 */
export const approveAccessRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user;

    const accessReq = await AccessRequest.findById(id);
    if (!accessReq) {
      res.status(404).json({ success: false, message: 'Access request not found.' });
      return;
    }

    // Dept Admin check
    if (user?.role === 'department_admin') {
      if (!user.department || accessReq.department !== user.department) {
        res.status(403).json({
          success: false,
          message: 'You can only approve requests for your assigned department.',
        });
        return;
      }
    }

    // 1. Add / Update in VerifiedUser collection
    const targetCategory = accessReq.category 
      ? (accessReq.category.toLowerCase().includes('non') ? 'Non-Teaching' : 'Teaching')
      : (accessReq.userType === 'non_teaching' ? 'Non-Teaching' : 'Teaching');
    const existingVerified = await VerifiedUser.findOne({ universityId: accessReq.universityId });
    if (!existingVerified) {
      await VerifiedUser.create({
        universityId: accessReq.universityId,
        name: accessReq.name,
        email: accessReq.email,
        phone: accessReq.phone,
        department: accessReq.department,
        userType: 'staff',
        category: targetCategory,
        isRegistered: false,
      });
    } else {
      existingVerified.name = accessReq.name;
      existingVerified.email = accessReq.email;
      existingVerified.phone = accessReq.phone;
      if (accessReq.department) existingVerified.department = accessReq.department;
      existingVerified.userType = 'staff';
      existingVerified.category = targetCategory;
      await existingVerified.save();
    }

    // 2. Update request status
    accessReq.status = 'approved';
    accessReq.rejectionReason = null;
    accessReq.reviewedBy = user?._id || null;
    accessReq.reviewedByName = user?.name || 'Administrator';
    accessReq.reviewedAt = new Date();
    await accessReq.save();

    // 3. Send approval email asynchronously
    try {
      await sendAccessRequestApprovalEmail(accessReq.email, accessReq.name, accessReq.universityId);
    } catch (emailErr) {
      console.warn('Approval email could not be sent:', emailErr);
    }

    res.status(200).json({
      success: true,
      message: `Access request for "${accessReq.name}" approved. Added to verified records and email notification sent.`,
      data: accessReq,
    });
  } catch (error: any) {
    console.error('Approve Access Request Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to approve access request.',
    });
  }
};

/**
 * Reject an Access Request
 * POST /api/access-requests/:id/reject
 */
export const rejectAccessRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const user = req.user;

    const accessReq = await AccessRequest.findById(id);
    if (!accessReq) {
      res.status(404).json({ success: false, message: 'Access request not found.' });
      return;
    }

    // Dept Admin check
    if (user?.role === 'department_admin') {
      if (!user.department || accessReq.department !== user.department) {
        res.status(403).json({
          success: false,
          message: 'You can only reject requests for your assigned department.',
        });
        return;
      }
    }

    accessReq.status = 'rejected';
    accessReq.rejectionReason = reason ? String(reason).trim() : 'Unable to verify institutional credentials.';
    accessReq.reviewedBy = user?._id || null;
    accessReq.reviewedByName = user?.name || 'Administrator';
    accessReq.reviewedAt = new Date();
    await accessReq.save();

    // Send rejection email asynchronously
    try {
      await sendAccessRequestRejectionEmail(
        accessReq.email,
        accessReq.name,
        accessReq.universityId,
        accessReq.rejectionReason
      );
    } catch (emailErr) {
      console.warn('Rejection email could not be sent:', emailErr);
    }

    res.status(200).json({
      success: true,
      message: `Access request for "${accessReq.name}" has been rejected.`,
      data: accessReq,
    });
  } catch (error: any) {
    console.error('Reject Access Request Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to reject access request.',
    });
  }
};
