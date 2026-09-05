import { Request, Response } from 'express';
import User from '../models/User';
import StaffAssignment from '../models/StaffAssignment';
import Task from '../models/Task';
import VerifiedUser from '../models/VerifiedUser';

// GET /api/users
export const getUsers = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const role = req.query.role as string;
    const status = req.query.status as string;
    const unassignedOnly = req.query.unassignedOnly === 'true';

    const query: any = {};

    // Search
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { universityId: searchRegex },
      ];
    }

    // Role filter
    if (role && role !== 'All') {
      if (role.includes(',')) {
        query.role = { $in: role.split(',') };
      } else {
        query.role = role;
      }
    }

    // Status filter
    if (status && status !== 'All') {
      query.isActive = status === 'Active';
    }

    // Unassigned only filter
    if (unassignedOnly) {
      const activeAssignments = await StaffAssignment.find({ isActive: true }).select('staffId');
      const assignedStaffIds = activeAssignments.map(a => a.staffId);
      query._id = { $nin: assignedStaffIds };
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    console.log('GET /api/users query:', query);
    console.log('GET /api/users result length:', users.length);

    return res.status(200).json({
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
    console.error('Error fetching users:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// GET /api/users/stats
export const getUserStats = async (req: Request, res: Response) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const inactiveUsers = await User.countDocuments({ isActive: false });
    const superAdmins = await User.countDocuments({ role: 'super_admin' });
    const departmentAdmins = await User.countDocuments({ role: 'department_admin' });
    const staff = await User.countDocuments({ role: 'staff' });

    return res.status(200).json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        inactiveUsers,
        superAdmins,
        departmentAdmins,
        staff,
      },
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// GET /api/users/:id
export const getUserById = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.status(200).json({ success: true, data: { user } });
  } catch (error) {
    console.error('Error fetching user by id:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// PATCH /api/users/:id/role
export const updateUserRole = async (req: Request, res: Response) => {
  try {
    const { role, department } = req.body;
    const userId = req.params.id;

    // Validate role
    const validRoles = ['super_admin', 'department_admin', 'staff'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role.' });
    }

    const userToUpdate = await User.findById(userId);
    if (!userToUpdate) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Safety: Prevent removing the last super admin
    if (userToUpdate.role === 'super_admin' && role !== 'super_admin') {
      const superAdminCount = await User.countDocuments({ role: 'super_admin' });
      if (superAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'At least one Super Admin must remain.',
        });
      }
    }

    const oldRole = userToUpdate.role;
    userToUpdate.role = role;
    
    // Check candidate's current active staff assignment to see who their admin is
    const candidateAssignment = await StaffAssignment.findOne({ staffId: userToUpdate._id, isActive: true });
    let previousAdminFromAssignment: any = null;
    if (candidateAssignment) {
      previousAdminFromAssignment = await User.findById(candidateAssignment.adminId);
    }

    // Update department if provided or infer from previous admin if promoting to department_admin
    if (department !== undefined && department !== null && String(department).trim() !== '') {
      userToUpdate.department = String(department).trim();
    } else if (role === 'department_admin' && !userToUpdate.department && previousAdminFromAssignment?.department) {
      userToUpdate.department = previousAdminFromAssignment.department;
    }
    
    await userToUpdate.save();

    let existingAdmin: any = null;

    // Handle Single Admin Per Department rule and Team Transfer
    if (role === 'department_admin') {
      const targetDept = userToUpdate.department;

      if (targetDept) {
        existingAdmin = await User.findOne({
          role: 'department_admin',
          department: { $regex: new RegExp(`^${targetDept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          _id: { $ne: userToUpdate._id }
        });
      }

      if (!existingAdmin && previousAdminFromAssignment && previousAdminFromAssignment.role === 'department_admin' && previousAdminFromAssignment._id.toString() !== userToUpdate._id.toString()) {
        existingAdmin = previousAdminFromAssignment;
      }

      if (existingAdmin) {
        // Demote existing admin to staff
        existingAdmin.role = 'staff';
        await existingAdmin.save();

        // Deactivate new admin's own subordinate staff assignment (cannot report to self)
        await StaffAssignment.updateMany(
          { staffId: userToUpdate._id, isActive: true },
          { $set: { isActive: false } }
        );

        // Transfer all other active team members from existingAdmin to userToUpdate
        await StaffAssignment.updateMany(
          { adminId: existingAdmin._id, staffId: { $ne: userToUpdate._id }, isActive: true },
          { $set: { adminId: userToUpdate._id, assignedBy: (req as any).user?._id || userToUpdate._id } }
        );

        // Ensure former admin has NO active staff assignment (former admin becomes UNASSIGNED STAFF)
        await StaffAssignment.updateMany(
          { staffId: existingAdmin._id, isActive: true },
          { $set: { isActive: false } }
        );
      } else {
        // Deactivate new admin's own subordinate staff assignment if promoted without an existing admin
        await StaffAssignment.updateMany(
          { staffId: userToUpdate._id, isActive: true },
          { $set: { isActive: false } }
        );
      }
    }

    // Cascading side-effects for Staff Assignment
    if (oldRole === 'department_admin' && role !== 'department_admin') {
      // Deactivate all staff assignments where this user was the admin
      // Note: If they were demoted because someone else was promoted, their team was already transferred above.
      // This mainly applies to manual demotions by Super Admin without a successor.
      await StaffAssignment.updateMany(
        { adminId: userId, isActive: true },
        { $set: { isActive: false } }
      );
    } else if (oldRole === 'staff' && role !== 'staff') {
      // Deactivate any active staff assignment for this staff
      await StaffAssignment.updateMany(
        { staffId: userId, isActive: true },
        { $set: { isActive: false } }
      );
    }

    return res.status(200).json({
      success: true,
      message: existingAdmin
        ? `Successfully promoted ${userToUpdate.name} to Department Admin. Replaced previous admin ${existingAdmin.name} and transferred team.`
        : 'User role updated successfully.',
      data: { user: await User.findById(userId).select('-passwordHash') },
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// PATCH /api/users/:id/status
export const updateUserStatus = async (req: Request, res: Response) => {
  try {
    const { isActive } = req.body;
    const userId = req.params.id;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }

    const userToUpdate = await User.findById(userId);
    if (!userToUpdate) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Optional safety: Prevent super admin from deactivating themselves? 
    // The prompt does not explicitly forbid it, but says we cannot delete. 
    // Usually a good idea to prevent deactivating the last super_admin as well.
    if (userToUpdate.role === 'super_admin' && !isActive) {
      const superAdminCount = await User.countDocuments({ role: 'super_admin', isActive: true });
      if (superAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'At least one active Super Admin must remain.',
        });
      }
    }

    userToUpdate.isActive = isActive;
    await userToUpdate.save();

    // Cascading side-effects
    if (!isActive) {
      if (userToUpdate.role === 'department_admin') {
        await StaffAssignment.updateMany(
          { adminId: userId, isActive: true },
          { $set: { isActive: false } }
        );
      } else if (userToUpdate.role === 'staff') {
        await StaffAssignment.updateMany(
          { staffId: userId, isActive: true },
          { $set: { isActive: false } }
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully.`,
      data: { user: await User.findById(userId).select('-passwordHash') },
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// DELETE /api/users/:id
// Permanently delete user from the database
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const requestingUser = req.user;

    // Prevent deleting own account
    if (requestingUser && (requestingUser._id?.toString() === userId || requestingUser.id === userId)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account.',
      });
    }

    const userToDelete = await User.findById(userId);
    if (!userToDelete) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Safety: Prevent deleting the last active Super Admin
    if (userToDelete.role === 'super_admin') {
      const superAdminCount = await User.countDocuments({ role: 'super_admin' });
      if (superAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete the last remaining Super Admin account.',
        });
      }
    }

    // Cascading cleanups:
    // 1. Staff assignments: delete assignments associated with this user
    await StaffAssignment.deleteMany({
      $or: [{ staffId: userId }, { adminId: userId }],
    });

    // 2. VerifiedUser: mark as unregistered so pre-authorization record remains accurate
    await VerifiedUser.updateMany(
      { $or: [{ registeredUserId: userId }, { universityId: userToDelete.universityId }] },
      { $set: { isRegistered: false, registeredUserId: null } }
    );

    // 3. Delete user document from database
    await User.findByIdAndDelete(userId);

    return res.status(200).json({
      success: true,
      message: `User "${userToDelete.name}" was permanently deleted from the database.`,
    });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};

// GET /api/users/profile or GET /api/users/profile/:id
export const getUserProfile = async (req: Request, res: Response) => {
  try {
    const targetUserId = req.params.id || req.user._id;
    const user = await User.findById(targetUserId).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Find all tasks where this user was the performer/credited completer
    const completedTasks = await Task.find({
      $or: [
        { ratedUser: user._id },
        { assignedTo: user._id, status: 'approved' },
        { delegatedTo: user._id, status: 'approved' }
      ]
    })
    .populate('ratedBy', 'name role universityId')
    .sort({ ratedAt: -1, completedAt: -1, updatedAt: -1 });

    // Deduplicate tasks by _id
    const taskMap = new Map();
    completedTasks.forEach(t => {
      taskMap.set(t._id.toString(), t);
    });
    const allUserTasks = Array.from(taskMap.values());

    const totalCompleted = allUserTasks.filter(t => t.status === 'approved' || t.completedAt).length;
    
    // On-time calculation
    let onTimeCount = 0;
    let overdueCount = 0;
    allUserTasks.forEach(t => {
      if (t.completedAt && t.deadline) {
        const completedTime = new Date(t.completedAt).getTime();
        const deadlineTime = new Date(t.deadline).getTime();
        if (completedTime <= deadlineTime) {
          onTimeCount++;
        } else {
          overdueCount++;
        }
      }
    });

    // Rating calculations
    const ratedTasks = allUserTasks.filter(t => t.rating && typeof t.rating === 'number' && t.rating > 0);
    const totalRatings = ratedTasks.length;
    const ratingSum = ratedTasks.reduce((acc, t) => acc + (t.rating || 0), 0);
    const averageRating = totalRatings > 0 ? Number((ratingSum / totalRatings).toFixed(1)) : 0;

    const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    ratedTasks.forEach(t => {
      const r = Math.min(5, Math.max(1, Math.round(t.rating)));
      if (ratingDistribution[r as keyof typeof ratingDistribution] !== undefined) {
        ratingDistribution[r as keyof typeof ratingDistribution]++;
      }
    });

    const reviews = ratedTasks.map(t => ({
      taskId: t._id,
      customTaskId: t.taskId,
      title: t.title,
      rating: t.rating,
      feedback: t.feedback || '',
      ratedAt: t.ratedAt || t.completedAt || t.updatedAt,
      ratedBy: t.ratedBy ? {
        name: (t.ratedBy as any).name,
        role: (t.ratedBy as any).role,
        universityId: (t.ratedBy as any).universityId
      } : null
    }));

    // Department Stats and Leaderboard Calculation (if user belongs to a department)
    let departmentStats: any = null;
    if (user.department && user.role !== 'super_admin') {
      try {
        const allDeptUsers = await User.find({ isActive: true }).select('_id name role department universityId phone email');
        const deptMembers = allDeptUsers.filter((u: any) => u.department === user.department);
        
        // Fetch tasks for all active department users across the university to compute rankings
        const allActiveUserIds = allDeptUsers.map((u: any) => u._id);
        const deptTasks = await Task.find({
          $or: [
            { assignedTo: { $in: allActiveUserIds } },
            { delegatedTo: { $in: allActiveUserIds } },
            { ratedUser: { $in: allActiveUserIds } }
          ]
        }).select('assignedTo delegatedTo ratedUser status rating completedAt deadline');

        // Group ratings by department for rank calculation
        const allDeptScores: { [dept: string]: { sum: number, count: number, completed: number } } = {};
        allDeptUsers.forEach((u: any) => {
          if (u.role === 'super_admin' || !u.department) return;
          if (!allDeptScores[u.department]) {
            allDeptScores[u.department] = { sum: 0, count: 0, completed: 0 };
          }
        });

        // Compute member stats for current user's department
        const memberStatsList: any[] = [];
        let curDeptRatingSum = 0;
        let curDeptRatingCount = 0;
        let curDeptCompleted = 0;

        deptMembers.forEach((member: any) => {
          const mTasks = deptTasks.filter(t => {
            const completerId = t.ratedUser ? t.ratedUser.toString() : (t.delegatedTo ? t.delegatedTo.toString() : (t.assignedTo ? t.assignedTo.toString() : null));
            return completerId === member._id.toString();
          });

          const mCompleted = mTasks.filter(t => t.status === 'approved' || t.completedAt).length;
          const mRated = mTasks.filter(t => t.rating && typeof t.rating === 'number' && t.rating > 0);
          const mRatingSum = mRated.reduce((acc, t) => acc + (t.rating || 0), 0);
          const mRatingCount = mRated.length;
          const mAvg = mRatingCount > 0 ? Number((mRatingSum / mRatingCount).toFixed(1)) : 0;

          let onTime = 0;
          let finished = 0;
          mTasks.forEach(t => {
            if (t.completedAt && t.deadline) {
              finished++;
              if (new Date(t.completedAt).getTime() <= new Date(t.deadline).getTime()) {
                onTime++;
              }
            }
          });

          memberStatsList.push({
            _id: member._id,
            name: member.name,
            universityId: member.universityId || '',
            role: member.role,
            department: member.department,
            totalCompleted: mCompleted,
            totalRatings: mRatingCount,
            averageRating: mAvg,
            onTimePercentage: finished > 0 ? Math.round((onTime / finished) * 100) : 100,
            rank: 0
          });

          curDeptRatingSum += mRatingSum;
          curDeptRatingCount += mRatingCount;
          curDeptCompleted += mCompleted;
        });

        // Sort department members: Admin on top, then Staff by rating desc, totalRatings desc, totalCompleted desc
        memberStatsList.sort((a: any, b: any) => {
          if (a.role === 'department_admin' && b.role !== 'department_admin') return -1;
          if (b.role === 'department_admin' && a.role !== 'department_admin') return 1;
          if (b.averageRating !== a.averageRating) return b.averageRating - a.averageRating;
          if (b.totalRatings !== a.totalRatings) return b.totalRatings - a.totalRatings;
          if (b.totalCompleted !== a.totalCompleted) return b.totalCompleted - a.totalCompleted;
          return a.name.localeCompare(b.name);
        });

        let staffRank = 1;
        memberStatsList.forEach((m: any) => {
          if (m.role === 'staff') {
            m.rank = staffRank++;
          }
        });

        // Compute scores for all departments to get current department rank
        allDeptUsers.forEach((u: any) => {
          if (u.role === 'super_admin' || !u.department) return;
          const uTasks = deptTasks.filter(t => {
            const completerId = t.ratedUser ? t.ratedUser.toString() : (t.delegatedTo ? t.delegatedTo.toString() : (t.assignedTo ? t.assignedTo.toString() : null));
            return completerId === u._id.toString();
          });
          const uRated = uTasks.filter(t => t.rating && typeof t.rating === 'number' && t.rating > 0);
          const uSum = uRated.reduce((acc, t) => acc + (t.rating || 0), 0);
          const uCount = uRated.length;
          const uComp = uTasks.filter(t => t.status === 'approved' || t.completedAt).length;

          if (allDeptScores[u.department]) {
            allDeptScores[u.department].sum += uSum;
            allDeptScores[u.department].count += uCount;
            allDeptScores[u.department].completed += uComp;
          }
        });

        const deptRankings = Object.keys(allDeptScores).map(dName => {
          const s = allDeptScores[dName];
          return {
            department: dName,
            averageRating: s.count > 0 ? Number((s.sum / s.count).toFixed(1)) : 0,
            completed: s.completed
          };
        });

        deptRankings.sort((a, b) => {
          if (b.averageRating !== a.averageRating) return b.averageRating - a.averageRating;
          return b.completed - a.completed;
        });

        const rankIndex = deptRankings.findIndex(d => d.department === user.department);
        const deptRank = rankIndex !== -1 ? rankIndex + 1 : 1;

        departmentStats = {
          department: user.department,
          averageRating: curDeptRatingCount > 0 ? Number((curDeptRatingSum / curDeptRatingCount).toFixed(1)) : 0,
          totalRatings: curDeptRatingCount,
          totalMembers: deptMembers.length,
          totalCompleted: curDeptCompleted,
          rank: deptRank,
          totalDepartments: deptRankings.length,
          leaderboard: memberStatsList
        };
      } catch (deptErr) {
        console.error('Error computing department stats:', deptErr);
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        user,
        performance: {
          totalCompleted,
          onTimeCount,
          overdueCount,
          onTimePercentage: totalCompleted > 0 ? Math.round((onTimeCount / totalCompleted) * 100) : 100,
          totalRatings,
          averageRating,
          ratingDistribution,
          reviews
        },
        departmentStats
      }
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// PATCH /api/users/profile
export const updateUserProfile = async (req: Request, res: Response) => {
  try {
    const { department, phone, name } = req.body;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (department !== undefined) user.department = department ? String(department).trim() : null;
    if (phone !== undefined && phone) user.phone = String(phone).trim();
    if (name !== undefined && name) user.name = String(name).trim();

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { user: await User.findById(userId).select('-passwordHash') }
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// POST /api/users/change-department-admin
export const changeDepartmentAdmin = async (req: Request, res: Response) => {
  try {
    const { newAdminId, department } = req.body;

    if (!newAdminId) {
      return res.status(400).json({ success: false, message: 'newAdminId is required.' });
    }

    const newAdmin = await User.findById(newAdminId);
    if (!newAdmin) {
      return res.status(404).json({ success: false, message: 'Selected user not found.' });
    }

    if (!newAdmin.isActive) {
      return res.status(400).json({ success: false, message: 'Selected user is deactivated.' });
    }

    // 1. Check if newAdmin is currently assigned to a department admin
    const candidateAssignment = await StaffAssignment.findOne({ staffId: newAdmin._id, isActive: true });
    let previousAdminFromAssignment: any = null;
    if (candidateAssignment) {
      previousAdminFromAssignment = await User.findById(candidateAssignment.adminId);
    }

    // 2. Resolve target department
    const targetDept = (department && String(department).trim()) ||
      (newAdmin.department && String(newAdmin.department).trim()) ||
      (previousAdminFromAssignment?.department && String(previousAdminFromAssignment.department).trim());

    if (!targetDept) {
      return res.status(400).json({ success: false, message: 'Department is required.' });
    }

    // 3. Find current department admin for this department
    let currentAdmin = await User.findOne({
      role: 'department_admin',
      department: { $regex: new RegExp(`^${targetDept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      _id: { $ne: newAdmin._id }
    });

    if (!currentAdmin && previousAdminFromAssignment && previousAdminFromAssignment.role === 'department_admin' && previousAdminFromAssignment._id.toString() !== newAdmin._id.toString()) {
      currentAdmin = previousAdminFromAssignment;
    }

    let transferredCount = 0;

    if (currentAdmin) {
      // Step A: Demote current admin to staff
      currentAdmin.role = 'staff';
      await currentAdmin.save();

      // Step B: Deactivate new admin's own subordinate staff assignment (cannot report to self)
      await StaffAssignment.updateMany(
        { staffId: newAdmin._id, isActive: true },
        { $set: { isActive: false } }
      );

      // Step C: Transfer all other active team members from currentAdmin to newAdmin
      const transferResult = await StaffAssignment.updateMany(
        { adminId: currentAdmin._id, staffId: { $ne: newAdmin._id }, isActive: true },
        { $set: { adminId: newAdmin._id, assignedBy: (req as any).user?._id || newAdmin._id } }
      );
      transferredCount = transferResult.modifiedCount;

      // Step D: Ensure currentAdmin has NO staff assignment (former admin becomes UNASSIGNED STAFF)
      await StaffAssignment.updateMany(
        { staffId: currentAdmin._id, isActive: true },
        { $set: { isActive: false } }
      );
    } else {
      // If no active admin was found, still deactivate new admin's subordinate assignment if any
      await StaffAssignment.updateMany(
        { staffId: newAdmin._id, isActive: true },
        { $set: { isActive: false } }
      );
    }

    // Step E: Promote newAdmin to department_admin
    newAdmin.role = 'department_admin';
    newAdmin.department = targetDept;
    await newAdmin.save();

    const previousAdminName = currentAdmin ? currentAdmin.name : 'Previous admin';

    return res.status(200).json({
      success: true,
      message: `Department Admin changed successfully. ${transferredCount} team member(s) transferred to ${newAdmin.name}. ${currentAdmin ? `${previousAdminName} is now unassigned staff.` : ''}`,
      data: {
        newAdmin: await User.findById(newAdmin._id).select('-passwordHash'),
        previousAdmin: currentAdmin ? await User.findById(currentAdmin._id).select('-passwordHash') : null,
        transferredCount,
      },
    });
  } catch (error: any) {
    console.error('Error changing department admin:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};

