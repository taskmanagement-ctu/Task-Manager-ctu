import { Request, Response } from 'express';
import VerifiedUser from '../models/VerifiedUser';
import Department from '../models/Department';
import { importVerifiedUsers } from '../services/verifiedUserService';
import { 
  isValidUniversityId, 
  isValidPhone, 
  isValidEmail, 
  normalizeUniversityId, 
  normalizePhone 
} from '../utils/validators';

/**
 * Helper to check Department Admin's verified user permissions
 */
const getDeptAdminPermissions = async (user: any) => {
  if (user.role === 'super_admin') {
    return {
      allowed: true,
      access: 'both' as const,
      canAdd: true,
      canUpload: true,
      department: null,
    };
  }

  if (user.role !== 'department_admin' || !user.department) {
    return {
      allowed: false,
      access: 'none' as const,
      canAdd: false,
      canUpload: false,
      department: null,
    };
  }

  const dept = await Department.findOne({ name: user.department });
  if (!dept || dept.verifiedUserAccess === 'none') {
    return {
      allowed: false,
      access: 'none' as const,
      canAdd: false,
      canUpload: false,
      department: user.department,
    };
  }

  return {
    allowed: true,
    access: dept.verifiedUserAccess,
    canAdd: dept.canAddVerifiedUsers ?? true,
    canUpload: dept.canUploadVerifiedUsers ?? true,
    department: dept.name,
  };
};

/**
 * POST /api/verified-users/import
 * Upload and import an Excel (.xlsx) or CSV file of verified users.
 */
export const importFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'No file uploaded. Please upload a .xlsx or .csv file.',
      });
      return;
    }

    let departmentOverride: string | undefined = undefined;
    let defaultUserType: 'staff' | 'student' = (req.body.defaultUserType as 'staff' | 'student') || 'staff';

    if (user && user.role === 'department_admin') {
      const perms = await getDeptAdminPermissions(user);
      if (!perms.allowed || !perms.canUpload) {
        res.status(403).json({
          success: false,
          message: 'Forbidden. Your department does not have permission to upload verified users.',
        });
        return;
      }
      departmentOverride = perms.department || undefined;
      if (perms.access === 'staff') defaultUserType = 'staff';
      if (perms.access === 'student') defaultUserType = 'student';
    }

    const result = await importVerifiedUsers(req.file.buffer, req.file.originalname, {
      departmentOverride,
      defaultUserType,
    });

    res.status(200).json({
      success: true,
      message: 'Import completed',
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Import failed';
    res.status(400).json({
      success: false,
      message,
    });
  }
};

/**
 * POST /api/verified-users
 * Manually add a single verified user (Super Admin or authorized Department Admin)
 */
export const createVerifiedUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const { name, email, phone, userType, department } = req.body;
    let { universityId } = req.body;

    if (!universityId || !name || !email) {
      res.status(400).json({
        success: false,
        message: 'University ID, Name, and Email are required.',
      });
      return;
    }

    universityId = normalizeUniversityId(universityId);
    const normalizedPhone = normalizePhone(phone);
    const normalizedEmail = String(email).toLowerCase().trim();
    const finalUserType: 'staff' | 'student' = userType === 'student' ? 'student' : 'staff';

    if (!isValidUniversityId(universityId)) {
      res.status(400).json({
        success: false,
        message: 'University ID must be exactly 5 digits.',
      });
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      res.status(400).json({
        success: false,
        message: 'Invalid email address format.',
      });
      return;
    }

    if (!isValidPhone(normalizedPhone)) {
      res.status(400).json({
        success: false,
        message: 'Invalid phone number format.',
      });
      return;
    }

    let finalDepartment = department ? String(department).trim() : null;

    if (user && user.role === 'department_admin') {
      const perms = await getDeptAdminPermissions(user);
      if (!perms.allowed || !perms.canAdd) {
        res.status(403).json({
          success: false,
          message: 'Forbidden. Your department does not have permission to add verified users.',
        });
        return;
      }
      finalDepartment = perms.department;
      if (perms.access === 'staff' && finalUserType !== 'staff') {
        res.status(403).json({
          success: false,
          message: 'Forbidden. Your department can only add verified Staff.',
        });
        return;
      }
      if (perms.access === 'student' && finalUserType !== 'student') {
        res.status(403).json({
          success: false,
          message: 'Forbidden. Your department can only add verified Students.',
        });
        return;
      }
    }

    // Check existing
    const existing = await VerifiedUser.findOne({ universityId });
    if (existing) {
      res.status(400).json({
        success: false,
        message: `Verified user with University ID "${universityId}" already exists.`,
      });
      return;
    }

    const newVerifiedUser = await VerifiedUser.create({
      universityId,
      name: String(name).trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      department: finalDepartment,
      userType: finalUserType,
    });

    res.status(201).json({
      success: true,
      message: 'Verified user added successfully',
      data: { user: newVerifiedUser },
    });
  } catch (error: any) {
    console.error('Error adding verified user:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

/**
 * DELETE /api/verified-users/:id
 * Delete a verified user entry
 */
export const deleteVerifiedUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const { id } = req.params;

    const target = await VerifiedUser.findById(id);
    if (!target) {
      res.status(404).json({ success: false, message: 'Verified user not found' });
      return;
    }

    if (user.role === 'department_admin') {
      const perms = await getDeptAdminPermissions(user);
      if (!perms.allowed || target.department !== perms.department) {
        res.status(403).json({
          success: false,
          message: 'Forbidden. You cannot delete verified users outside your department.',
        });
        return;
      }
    }

    await VerifiedUser.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Verified user deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting verified user:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

/**
 * POST /api/verified-users/bulk-delete
 * Delete multiple verified user entries
 */
export const bulkDeleteVerifiedUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ success: false, message: 'Please provide an array of IDs to delete' });
      return;
    }

    const validIds = ids.filter((id: any) => typeof id === 'string' && id.trim().length > 0);
    if (validIds.length === 0) {
      res.status(400).json({ success: false, message: 'No valid IDs provided' });
      return;
    }

    if (user.role === 'department_admin') {
      const perms = await getDeptAdminPermissions(user);
      if (!perms.allowed) {
        res.status(403).json({
          success: false,
          message: 'Forbidden. You do not have permission to delete verified users.',
        });
        return;
      }

      // Check if any selected user belongs to a different department
      const nonDeptCount = await VerifiedUser.countDocuments({
        _id: { $in: validIds },
        department: { $ne: perms.department },
      });

      if (nonDeptCount > 0) {
        res.status(403).json({
          success: false,
          message: 'Forbidden. Some selected users are outside your department.',
        });
        return;
      }
    }

    const result = await VerifiedUser.deleteMany({ _id: { $in: validIds } });
    res.status(200).json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} verified user(s)`,
      data: { deletedCount: result.deletedCount },
    });
  } catch (error: any) {
    console.error('Error bulk deleting verified users:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

/**
 * GET /api/verified-users
 * List verified users with pagination, search, and filter.
 */
export const getVerifiedUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const search = (req.query.search as string || '').trim();
    const status = (req.query.status as string || '').trim().toLowerCase();
    const userType = (req.query.userType as string || '').trim().toLowerCase();
    const departmentQuery = (req.query.department as string || '').trim();

    // Backfill legacy records where userType is missing or null
    await VerifiedUser.updateMany(
      { $or: [{ userType: { $exists: false } }, { userType: null }] },
      { $set: { userType: 'staff' } }
    ).catch(() => {});

    // Build filter
    const filter: Record<string, unknown> = {};

    // Department Admin scoping & permission enforcement
    if (user && user.role === 'department_admin') {
      const perms = await getDeptAdminPermissions(user);
      if (!perms.allowed) {
        res.status(403).json({
          success: false,
          message: 'Forbidden. Your department does not have access to verified users.',
        });
        return;
      }
      filter.department = perms.department;
      if (perms.access === 'staff') {
        filter.userType = { $in: ['staff', null, undefined] };
      } else if (perms.access === 'student') {
        filter.userType = 'student';
      } else if (perms.access === 'both') {
        if (userType === 'staff') {
          filter.userType = { $in: ['staff', null, undefined] };
        } else if (userType === 'student') {
          filter.userType = 'student';
        }
      }
    } else {
      // Super admin or public
      if (departmentQuery && departmentQuery !== 'All') {
        filter.department = departmentQuery;
      }
      if (userType === 'staff') {
        filter.userType = { $in: ['staff', null, undefined] };
      } else if (userType === 'student') {
        filter.userType = 'student';
      }
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { universityId: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } },
      ];
    }

    if (status === 'registered') {
      filter.isRegistered = true;
    } else if (status === 'not-registered') {
      filter.isRegistered = false;
    }

    const sortBy = (req.query.sortBy as string || 'name').trim();
    const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
    const sortField = ['name', 'universityId', 'email', 'department', 'createdAt'].includes(sortBy)
      ? sortBy
      : 'name';

    const total = await VerifiedUser.countDocuments(filter);
    const users = await VerifiedUser.find(filter)
      .collation({ locale: 'en', strength: 2 })
      .sort({ [sortField]: sortOrder as 1 | -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-__v');

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch verified users';
    res.status(500).json({ success: false, message });
  }
};

/**
 * GET /api/verified-users/stats
 * Return summary statistics.
 */
export const getStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const filter: Record<string, unknown> = {};

    if (user && user.role === 'department_admin') {
      const perms = await getDeptAdminPermissions(user);
      if (!perms.allowed) {
        res.status(403).json({ success: false, message: 'Forbidden' });
        return;
      }
      filter.department = perms.department;
      if (perms.access === 'staff') filter.userType = { $in: ['staff', null, undefined] };
      if (perms.access === 'student') filter.userType = 'student';
    }

    const total = await VerifiedUser.countDocuments(filter);
    const registered = await VerifiedUser.countDocuments({ ...filter, isRegistered: true });
    const notRegistered = await VerifiedUser.countDocuments({ ...filter, isRegistered: false });
    const staffCount = await VerifiedUser.countDocuments({
      ...filter,
      userType: { $in: ['staff', null, undefined] },
    });
    const studentCount = await VerifiedUser.countDocuments({ ...filter, userType: 'student' });

    // Get distinct departments
    const departments = await VerifiedUser.distinct('department', {
      ...filter,
      department: { $nin: [null, ''] },
    });

    res.status(200).json({
      success: true,
      data: {
        total,
        registered,
        notRegistered,
        staffCount,
        studentCount,
        departments: departments.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch stats';
    res.status(500).json({ success: false, message });
  }
};

/**
 * GET /api/verified-users/:universityId
 * Get a single verified user by University ID.
 */
export const getByUniversityId = async (req: Request, res: Response): Promise<void> => {
  try {
    const { universityId } = req.params;

    const user = await VerifiedUser.findOne({ universityId }).select('-__v');
    if (!user) {
      res.status(404).json({
        success: false,
        message: `Verified user with ID "${universityId}" not found`,
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch user';
    res.status(500).json({ success: false, message });
  }
};

/**
 * GET /api/verified-users/template
 * Download a blank template file (.xlsx).
 */
export const downloadTemplate = async (_req: Request, res: Response): Promise<void> => {
  try {
    const XLSX = await import('xlsx');

    const templateData = [
      {
        'Sr. No.': 1,
        'ID': '10001',
        'Name': 'Example Staff',
        'Email': 'staff@ctuniversity.in',
        'Phone No.': '9876500001',
        'Department': 'School Of Engineering And Technology',
        'Type': 'Staff',
      },
      {
        'Sr. No.': 2,
        'ID': '10002',
        'Name': 'Example Student',
        'Email': 'student@ctuniversity.in',
        'Phone No.': '9876500002',
        'Department': 'School Of Engineering And Technology',
        'Type': 'Student',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);

    worksheet['!cols'] = [
      { wch: 8 },   // Sr. No.
      { wch: 10 },  // ID
      { wch: 25 },  // Name
      { wch: 35 },  // Email
      { wch: 15 },  // Phone No.
      { wch: 35 },  // Department
      { wch: 12 },  // Type
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Verified Users');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=verified_users_template.xlsx');
    res.send(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate template';
    res.status(500).json({ success: false, message });
  }
};

