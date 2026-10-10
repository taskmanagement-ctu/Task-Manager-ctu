import Department from '../models/Department';
import User from '../models/User';
import VerifiedUser from '../models/VerifiedUser';
import Task from '../models/Task';
import {
  normalizeDepartmentName,
  formatDepartmentDisplayName,
  findMatchingDepartment,
} from '../utils/normalization';

/**
 * Scans the database and reconciles any historical data conflicts where
 * '&' and 'and', abbreviations, or irregular spacing created duplicate or mismatched
 * department records across Department, User, VerifiedUser, and Task collections.
 */
export const syncAndNormalizeDepartments = async (): Promise<void> => {
  try {
    const departments = await Department.find({});
    if (!departments || departments.length === 0) {
      return;
    }

    // 1. Ensure all departments have normalizedName and merge any existing duplicates
    const canonicalMap = new Map<string, typeof departments[0]>();

    for (const dept of departments) {
      const norm = normalizeDepartmentName(dept.name);
      
      if (!dept.normalizedName || dept.normalizedName !== norm) {
        dept.normalizedName = norm;
        dept.name = formatDepartmentDisplayName(dept.name);
        await dept.save();
      }

      if (!canonicalMap.has(norm)) {
        canonicalMap.set(norm, dept);
      } else {
        // A duplicate department already exists with equivalent '&' vs 'and' variation
        const canonical = canonicalMap.get(norm)!;
        console.log(
          `[DepartmentSync] Merging duplicate department "${dept.name}" into canonical "${canonical.name}"`
        );

        // Reassign all associated users, verified users, and tasks to the canonical department
        await User.updateMany(
          { department: dept.name },
          { $set: { department: canonical.name } }
        );
        await VerifiedUser.updateMany(
          { department: dept.name },
          { $set: { department: canonical.name } }
        );
        await Task.updateMany(
          { department: dept.name },
          { $set: { department: canonical.name } }
        );

        // Delete the redundant department record
        await Department.deleteOne({ _id: dept._id });
      }
    }

    // Refresh active canonical departments list after merging
    const activeDepts = await Department.find({});

    // 2. Reconcile all users whose department differs only by '&' vs 'and' or spacing
    const usersWithDept = await User.find({ department: { $ne: null } });
    for (const u of usersWithDept) {
      if (u.department) {
        const matched = findMatchingDepartment(activeDepts, u.department);
        if (matched && matched.name !== u.department) {
          console.log(
            `[DepartmentSync] Reconciled User "${u.name}" department: "${u.department}" -> "${matched.name}"`
          );
          u.department = matched.name;
          await u.save();
        }
      }
    }

    // 3. Reconcile verified users
    const verifiedUsersWithDept = await VerifiedUser.find({ department: { $ne: null } });
    for (const vu of verifiedUsersWithDept) {
      if (vu.department) {
        const matched = findMatchingDepartment(activeDepts, vu.department);
        if (matched && matched.name !== vu.department) {
          console.log(
            `[DepartmentSync] Reconciled VerifiedUser "${vu.universityId}" department: "${vu.department}" -> "${matched.name}"`
          );
          vu.department = matched.name;
          await vu.save();
        }
      }
    }

    // 4. Reconcile verified users designation & category (Faculty -> Teaching, Admin -> Non-Teaching, move job titles to designation)
    const allVerifiedUsers = await VerifiedUser.find({});
    for (const vu of allVerifiedUsers) {
      let changed = false;
      const currentCat = (vu.category || '').trim();
      const currentDesig = (vu.designation || '').trim();

      // If category has a known designation title (e.g. Professor, Trainer, etc.) and designation is empty
      if (currentCat && !currentDesig) {
        const lower = currentCat.toLowerCase();
        if (
          lower !== 'teaching' &&
          lower !== 'non-teaching' &&
          lower !== 'faculty' &&
          lower !== 'admin' &&
          lower !== 'staff' &&
          lower !== 'student'
        ) {
          // This category was actually a designation
          vu.designation = currentCat;
          if (
            lower.includes('professor') ||
            lower.includes('lecturer') ||
            lower.includes('faculty') ||
            lower.includes('teacher') ||
            lower.includes('trainer') ||
            lower.includes('instructor') ||
            lower.includes('dean') ||
            lower.includes('hod') ||
            lower.includes('chancellor')
          ) {
            vu.category = 'Teaching';
          } else {
            vu.category = 'Non-Teaching';
          }
          changed = true;
        }
      }

      // Convert legacy "Faculty" -> "Teaching", "Admin" / "Staff" -> "Non-Teaching"
      if (vu.category) {
        const lower = vu.category.trim().toLowerCase();
        if (lower === 'faculty' || lower === 'teaching') {
          if (vu.category !== 'Teaching') {
            vu.category = 'Teaching';
            changed = true;
          }
        } else if (lower === 'admin' || lower === 'staff' || lower === 'non-teaching' || lower === 'non_teaching') {
          if (vu.category !== 'Non-Teaching') {
            vu.category = 'Non-Teaching';
            changed = true;
          }
        }
      }

      if (changed) {
        await vu.save();
      }
    }

    console.log('✅ [DepartmentSync] Department and Verified User category normalization complete.');
  } catch (err: any) {
    console.error('⚠️ [DepartmentSync] Error syncing department normalization:', err.message || err);
  }
};
