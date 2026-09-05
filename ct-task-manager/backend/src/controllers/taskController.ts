import { Request, Response } from 'express';
import Task from '../models/Task';
import User from '../models/User';
import StaffAssignment from '../models/StaffAssignment';
import mongoose from 'mongoose';
import { createNotification } from './notificationController';

/** Helper to check if a Department Admin can assign/manage a specific staff member */
const checkAdminStaffPermission = async (adminId: string, staffId: string) => {
  if (adminId === staffId) return true; // Can assign to self
  
  const assignment = await StaffAssignment.findOne({
    adminId,
    staffId,
    isActive: true
  });
  return !!assignment;
};

// POST /api/tasks
export const createTask = async (req: Request, res: Response) => {
  try {
    const { title, description, deadline, assignedTo } = req.body;
    let { requiredCompletionExtensions, isSubtask, parentTaskId } = req.body;
    const user = req.user;

    // Staff cannot create tasks
    if (user.role === 'staff') {
      return res.status(403).json({ success: false, message: 'Forbidden. Staff cannot create tasks.' });
    }

    if (!title || !description || !deadline) {
      return res.status(400).json({ success: false, message: 'Title, description, and deadline are required.' });
    }

    const parsedDeadline = new Date(deadline);
    if (isNaN(parsedDeadline.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid deadline date.' });
    }

    let parsedExtensions: string[] = [];
    if (requiredCompletionExtensions) {
      try {
        parsedExtensions = JSON.parse(requiredCompletionExtensions);
      } catch (e) {
        // If not a JSON string, it might just be a comma-separated string or array
        if (Array.isArray(requiredCompletionExtensions)) {
          parsedExtensions = requiredCompletionExtensions;
        } else if (typeof requiredCompletionExtensions === 'string') {
          parsedExtensions = requiredCompletionExtensions.split(',').map(s => s.trim());
        }
      }
    }

    let workflowType = undefined;
    let finalAssignee = null;
    let parsedIsSubtask = isSubtask === 'true' || isSubtask === true;

    if (parsedIsSubtask) {
      if (!parentTaskId) {
        return res.status(400).json({ success: false, message: 'Parent Task is required for subtasks.' });
      }
      const parent = await Task.findById(parentTaskId);
      if (!parent || parent.isSubtask) {
        return res.status(400).json({ success: false, message: 'Invalid Parent Task.' });
      }
    }

    if (assignedTo) {
      const targetUser = await User.findById(assignedTo);
      if (!targetUser || !targetUser.isActive) {
        return res.status(400).json({ success: false, message: 'Target assigned user is invalid or inactive.' });
      }

      if (user.role === 'super_admin') {
        finalAssignee = assignedTo;
        if (targetUser.role === 'department_admin') {
          workflowType = 'department_admin';
        } else {
          workflowType = 'super_admin_direct';
        }
      } else if (user.role === 'department_admin') {
        const hasPermission = await checkAdminStaffPermission(user._id.toString(), assignedTo);
        if (!hasPermission) {
          return res.status(403).json({ success: false, message: 'Forbidden. You can only assign tasks to yourself or your active staff.' });
        }
        finalAssignee = assignedTo;
        workflowType = 'department_admin';
      }
    } else {
      // Unassigned
      if (user.role === 'department_admin') {
        workflowType = 'department_admin';
      }
    }

    // Handle File Uploads via GridFSBucket
    const attachmentIds: mongoose.Types.ObjectId[] = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      const db = mongoose.connection.db;
      if (db) {
        const bucket = new mongoose.mongo.GridFSBucket(db, {
          bucketName: 'attachments'
        });
        
        for (const file of req.files) {
          await new Promise<void>((resolve, reject) => {
            const uploadStream = bucket.openUploadStream(file.originalname, {
              contentType: file.mimetype
            });
            uploadStream.end(file.buffer);
            uploadStream.on('finish', () => {
              attachmentIds.push(uploadStream.id as mongoose.Types.ObjectId);
              resolve();
            });
            uploadStream.on('error', reject);
          });
        }
      }
    }

    const task = new Task({
      title,
      description,
      deadline: parsedDeadline,
      createdBy: user._id,
      assignedTo: finalAssignee,
      workflowType,
      attachments: attachmentIds,
      requiredCompletionExtensions: parsedExtensions,
      isSubtask: parsedIsSubtask,
      parentTaskId: parsedIsSubtask ? parentTaskId : null
    });

    await task.save();

    const populatedTask = await Task.findById(task._id)
      .populate('createdBy', 'name role universityId')
      .populate('assignedTo', 'name role department universityId')
      .populate('parentTaskId', 'taskId title');

    // Notify assignee about new task
    if (finalAssignee && finalAssignee.toString() !== user._id.toString()) {
      createNotification(
        finalAssignee,
        'task_assigned',
        'New Task Assigned',
        `Task #${populatedTask?.taskId || ''} "${title}" has been assigned to you.`,
        task._id,
        user._id
      );
    }

    return res.status(201).json({ success: true, data: { task: populatedTask } });
  } catch (error) {
    console.error('Error creating task:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// GET /api/tasks
export const getTasks = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const status = req.query.status as string;
    const assignee = req.query.assignee as string;

    const workflow = req.query.workflow as string;
    const reviewStage = req.query.reviewStage as string;
    const taskType = req.query.taskType as string; // 'All', 'main', 'subtask'
    const sortBy = req.query.sortBy as string;
    const department = req.query.department as string;

    const query: any = {};
    const user = req.user;

    // Build visibility query based on role
    if (user.role === 'staff') {
      // Staff can only see tasks assigned to them or delegated to them
      query.$or = [
        { assignedTo: user._id },
        { delegatedTo: user._id }
      ];
    } else if (user.role === 'department_admin') {
      // Department admin sees tasks they created, assigned/delegated to them, or assigned/delegated to their staff
      const myStaffAssignments = await StaffAssignment.find({ adminId: user._id, isActive: true });
      const myStaffIds = myStaffAssignments.map(a => a.staffId);
      
      query.$or = [
        { createdBy: user._id },
        { assignedTo: user._id },
        { delegatedTo: user._id },
        { assignedTo: { $in: myStaffIds } },
        { delegatedTo: { $in: myStaffIds } }
      ];
    } else if (user.role === 'super_admin') {
      const myStaffAssignments = await StaffAssignment.find({ adminId: user._id, isActive: true });
      const myStaffIds = myStaffAssignments.map(a => a.staffId);
      const teamOnly = req.query.teamOnly === 'true';

      if (teamOnly) {
        query.$or = [
          { assignedTo: { $in: myStaffIds } },
          { delegatedTo: { $in: myStaffIds } },
          { createdBy: user._id, assignedTo: { $in: myStaffIds } }
        ];
      } else {
        // Super admin sees tasks they created, tasks assigned/delegated to them or their team staff, or submitted for review
        query.$or = [
          { createdBy: user._id },
          { assignedTo: user._id },
          { delegatedTo: user._id },
          { assignedTo: { $in: myStaffIds } },
          { delegatedTo: { $in: myStaffIds } },
          { reviewStage: 'super_admin' },
          { currentReviewer: user._id }
        ];
      }
    }

    // Filters
    if (status && status !== 'All') {
      query.status = status;
    }
    
    if (workflow && workflow !== 'All') {
      query.workflowType = workflow;
    }
    
    if (reviewStage && reviewStage !== 'All') {
      if (reviewStage === 'Pending Review') {
        query.status = 'submitted_for_review';
      } else {
        query.reviewStage = reviewStage;
      }
    }
    
    if (taskType === 'main') {
      query.isSubtask = false;
    } else if (taskType === 'subtask') {
      query.isSubtask = true;
    }

    if (assignee) {
      if (assignee === 'Unassigned') {
        query.assignedTo = null;
        query.delegatedTo = null;
      } else if (assignee !== 'All') {
        const assigneeCond = { $or: [{ assignedTo: assignee }, { delegatedTo: assignee }] };
        if (query.$or) {
          query.$and = [{ $or: query.$or }, assigneeCond];
          delete query.$or;
        } else {
          Object.assign(query, assigneeCond);
        }
      }
    }

    if (department && department !== 'All') {
      const deptUsers = await User.find({ department }).select('_id');
      const deptUserIds = deptUsers.map(u => u._id);
      const deptCond = {
        $or: [
          { assignedTo: { $in: deptUserIds } },
          { delegatedTo: { $in: deptUserIds } }
        ]
      };
      if (query.$and) {
        query.$and.push(deptCond);
      } else if (query.$or) {
        query.$and = [{ $or: query.$or }, deptCond];
        delete query.$or;
      } else {
        Object.assign(query, deptCond);
      }
    }

    // Search
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      
      // Find users whose name matches the search term
      const matchingUsers = await User.find({ name: searchRegex }).select('_id');
      const matchingUserIds = matchingUsers.map(u => u._id);

      const searchCond: any = {
        $or: [
          { title: searchRegex }, 
          { description: searchRegex },
          { taskId: searchRegex }
        ]
      };

      if (matchingUserIds.length > 0) {
        searchCond.$or.push({ assignedTo: { $in: matchingUserIds } });
        searchCond.$or.push({ delegatedTo: { $in: matchingUserIds } });
      }
      
      if (query.$and) {
        query.$and.push(searchCond);
      } else if (query.$or) {
        query.$and = [{ $or: query.$or }, searchCond];
        delete query.$or;
      } else {
        Object.assign(query, searchCond);
      }
    }

    const total = await Task.countDocuments(query);
    
    let sortObj: any = { deadline: 1, createdAt: -1 }; // default
    if (sortBy === 'createdAt_desc') sortObj = { createdAt: -1 };
    else if (sortBy === 'createdAt_asc') sortObj = { createdAt: 1 };
    else if (sortBy === 'title_asc') sortObj = { title: 1 };
    else if (sortBy === 'title_desc') sortObj = { title: -1 };

    const tasks = await Task.find(query)
      .populate('createdBy', 'name role universityId')
      .populate('assignedTo', 'name role department universityId')
      .populate('delegatedTo', 'name role department universityId')
      .populate('ratedBy', 'name role universityId')
      .populate('ratedUser', 'name role department universityId')
      .populate('parentTaskId', 'taskId title')
      .sort(sortObj)
      .skip((page - 1) * limit)
      .limit(limit);

    return res.status(200).json({
      success: true,
      data: {
        tasks,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      }
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// GET /api/tasks/:id
export const getTaskById = async (req: Request, res: Response) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('createdBy', 'name role universityId')
      .populate('assignedTo', 'name role department universityId')
      .populate('delegatedTo', 'name role department universityId')
      .populate('ratedBy', 'name role universityId')
      .populate('ratedUser', 'name role department universityId')
      .populate('parentTaskId', 'taskId title');
      
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    // Enforce visibility
    const user = req.user;
    let allowed = false;

    if (user.role === 'super_admin') {
      if (
        task.createdBy._id.toString() === user._id.toString() ||
        (task.assignedTo && task.assignedTo._id.toString() === user._id.toString()) ||
        (task.delegatedTo && task.delegatedTo._id.toString() === user._id.toString()) ||
        task.reviewStage === 'super_admin' ||
        (task.currentReviewer && task.currentReviewer.toString() === user._id.toString())
      ) {
        allowed = true;
      }
    } else if (user.role === 'staff') {
      allowed = Boolean(
        (task.assignedTo && (task.assignedTo._id?.toString() === user._id.toString() || task.assignedTo.toString() === user._id.toString())) ||
        (task.delegatedTo && (task.delegatedTo._id?.toString() === user._id.toString() || task.delegatedTo.toString() === user._id.toString()))
      );
    } else if (user.role === 'department_admin') {
      if (task.createdBy._id?.toString() === user._id.toString() || task.createdBy.toString() === user._id.toString()) allowed = true;
      else if (task.assignedTo && (task.assignedTo._id?.toString() === user._id.toString() || task.assignedTo.toString() === user._id.toString())) allowed = true;
      else if (task.delegatedTo && (task.delegatedTo._id?.toString() === user._id.toString() || task.delegatedTo.toString() === user._id.toString())) allowed = true;
      else if (task.assignedTo) {
        const staffId = task.assignedTo._id ? task.assignedTo._id.toString() : task.assignedTo.toString();
        const hasPerm = await checkAdminStaffPermission(user._id.toString(), staffId);
        if (hasPerm) allowed = true;
      }
      if (!allowed && task.delegatedTo) {
        const staffId = task.delegatedTo._id ? task.delegatedTo._id.toString() : task.delegatedTo.toString();
        const hasPerm = await checkAdminStaffPermission(user._id.toString(), staffId);
        if (hasPerm) allowed = true;
      }
    }

    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Forbidden. You do not have access to this task.' });
    }

    return res.status(200).json({ success: true, data: { task } });
  } catch (error) {
    console.error('Error fetching task:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// PATCH /api/tasks/:id
export const updateTask = async (req: Request, res: Response) => {
  try {
    const { title, description, deadline } = req.body;
    const user = req.user;

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    // Authorization
    if (user.role === 'staff') {
      return res.status(403).json({ success: false, message: 'Forbidden. Staff cannot edit task content.' });
    } else if (user.role === 'department_admin') {
      if (task.createdBy.toString() !== user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Forbidden. Department Admin can only edit tasks they created.' });
      }
    }

    // Only allow editing when status is pending
    if (task.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Tasks can only be edited while in pending status.' });
    }

    if (title) task.title = title;
    if (description) task.description = description;
    if (deadline) {
      const pd = new Date(deadline);
      if (!isNaN(pd.getTime())) task.deadline = pd;
    }

    await task.save();

    return res.status(200).json({ success: true, data: { task } });
  } catch (error) {
    console.error('Error updating task:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// PATCH /api/tasks/:id/assign
export const assignTask = async (req: Request, res: Response) => {
  try {
    const { assignedTo } = req.body;
    const user = req.user;

    if (user.role === 'staff') {
      return res.status(403).json({ success: false, message: 'Forbidden. Staff cannot assign tasks.' });
    }

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    if (assignedTo === null) {
      // Unassign
      if (user.role === 'department_admin') {
        const canUnassign = 
          task.createdBy.toString() === user._id.toString() ||
          (task.assignedTo && task.assignedTo.toString() === user._id.toString()) ||
          (task.assignedTo && await checkAdminStaffPermission(user._id.toString(), task.assignedTo.toString()));
          
        if (!canUnassign) {
          return res.status(403).json({ success: false, message: 'Forbidden. Cannot unassign this task.' });
        }
      }
      // If we are unassigning
      if (task.delegatedTo) {
         task.delegatedTo = null; // Unassign delegation
      } else {
         task.assignedTo = null;
      }
    } else {
      // Assign
      const targetUser = await User.findById(assignedTo);
      if (!targetUser || !targetUser.isActive) {
        return res.status(400).json({ success: false, message: 'Target user is invalid or inactive.' });
      }

      if (user.role === 'department_admin') {
        const hasPermission = await checkAdminStaffPermission(user._id.toString(), assignedTo);
        if (!hasPermission) {
          return res.status(403).json({ success: false, message: 'Forbidden. Can only assign to yourself or your active staff.' });
        }
        
        // Ensure dept admin can actually touch this task
        const canTouch = 
          task.createdBy.toString() === user._id.toString() ||
          (task.assignedTo && task.assignedTo.toString() === user._id.toString()) ||
          (task.assignedTo && await checkAdminStaffPermission(user._id.toString(), task.assignedTo.toString()));
          
        if (!canTouch && task.assignedTo !== null) {
            return res.status(403).json({ success: false, message: 'Forbidden. Cannot manipulate a task outside your permission scope.' });
        }
      } else if (user.role === 'super_admin') {
        // If workflowType is missing (migration) or it's unassigned, figure it out
        if (!task.workflowType) {
          if (targetUser.role === 'department_admin') {
            task.workflowType = 'department_admin';
          } else {
            task.workflowType = 'super_admin_direct';
          }
        }
      }

      // If workflowType is missing for a Dept Admin created task, assume it's department_admin
      if (!task.workflowType && (user.role === 'department_admin' || task.createdBy.toString() === user._id.toString())) {
        task.workflowType = 'department_admin';
      }

      // Delegation / Assignment logic
      const isCreator = task.createdBy.toString() === user._id.toString();

      if (user.role === 'department_admin' && isCreator) {
        // If Dept Admin created the task, assign directly to target staff (Dept Admin is creator, not assignee)
        task.assignedTo = assignedTo;
        task.delegatedTo = null;
      } else if (
        user.role === 'department_admin' && 
        task.assignedTo && 
        task.assignedTo.toString() === user._id.toString() && 
        targetUser.role === 'staff'
      ) {
        // Super admin created task assigned to Dept Admin: delegate to staff
        task.delegatedTo = assignedTo;
      } else {
        task.assignedTo = assignedTo; // Normal assignment
        task.delegatedTo = null; // Clear delegation if any
      }
    }

    await task.save();

    const populatedTask = await Task.findById(task._id)
      .populate('createdBy', 'name role universityId')
      .populate('assignedTo', 'name role department universityId')
      .populate('delegatedTo', 'name role department universityId')
      .populate('ratedBy', 'name role universityId')
      .populate('ratedUser', 'name role department universityId')
      .populate('parentTaskId', 'taskId title');

    // Notify the assigned/delegated user
    const notifyTarget = task.delegatedTo || assignedTo;
    if (notifyTarget && notifyTarget.toString() !== user._id.toString()) {
      createNotification(
        notifyTarget,
        task.delegatedTo ? 'task_delegated' : 'task_assigned',
        task.delegatedTo ? 'Task Delegated to You' : 'Task Assigned to You',
        `Task #${populatedTask?.taskId || ''} "${task.title}" has been ${task.delegatedTo ? 'delegated' : 'assigned'} to you.`,
        task._id,
        user._id
      );
    }

    return res.status(200).json({ success: true, data: { task: populatedTask } });
  } catch (error) {
    console.error('Error assigning task:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// PATCH /api/tasks/:id/status
export const updateTaskStatus = async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const user = req.user;

    const validStatuses = ['pending', 'in_progress', 'completed']; // Expandable later
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    // Authorization
    if (user.role === 'staff') {
      const isAssigned = 
        (task.assignedTo && task.assignedTo.toString() === user._id.toString()) ||
        (task.delegatedTo && task.delegatedTo.toString() === user._id.toString());
      if (!isAssigned) {
        return res.status(403).json({ success: false, message: 'Forbidden. Can only change status of your assigned tasks.' });
      }
    } else if (user.role === 'department_admin') {
      const canChange = 
        task.createdBy.toString() === user._id.toString() ||
        (task.assignedTo && task.assignedTo.toString() === user._id.toString()) ||
        (task.delegatedTo && task.delegatedTo.toString() === user._id.toString()) ||
        (task.assignedTo && await checkAdminStaffPermission(user._id.toString(), task.assignedTo.toString())) ||
        (task.delegatedTo && await checkAdminStaffPermission(user._id.toString(), task.delegatedTo.toString()));
        
      if (!canChange) {
        return res.status(403).json({ success: false, message: 'Forbidden. Cannot change status of this task.' });
      }
    }
    
    // Subtask check: If marking completed, check if all subtasks are approved
    if (status === 'completed' && !task.isSubtask) {
      const unapprovedSubtasks = await Task.countDocuments({
        parentTaskId: task._id,
        isSubtask: true,
        status: { $ne: 'approved' }
      });
      if (unapprovedSubtasks > 0) {
        return res.status(400).json({ success: false, message: 'All subtasks must be approved before completing the main task.' });
      }
    }

    task.status = status;
    if (status === 'completed') {
      task.completedAt = new Date();
    }
    await task.save();

    // Notify creator/admin about status change
    if (status === 'in_progress' || status === 'completed') {
      const notifyUsers: string[] = [];
      if (task.createdBy && task.createdBy.toString() !== user._id.toString()) {
        notifyUsers.push(task.createdBy.toString());
      }
      if (task.assignedTo && task.assignedTo.toString() !== user._id.toString() && !notifyUsers.includes(task.assignedTo.toString())) {
        notifyUsers.push(task.assignedTo.toString());
      }
      for (const uid of notifyUsers) {
        createNotification(
          uid,
          'task_status_changed',
          status === 'in_progress' ? 'Task Started' : 'Task Completed',
          `Task #${task.taskId || ''} "${task.title}" has been ${status === 'in_progress' ? 'started' : 'completed'} by ${user.name || 'a user'}.`,
          task._id,
          user._id
        );
      }
    }

    return res.status(200).json({ success: true, data: { task } });
  } catch (error) {
    console.error('Error updating task status:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// PATCH /api/tasks/:id/submit-review
export const submitReview = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    const task = await Task.findById(req.params.id);
    
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    
    const isPerformer = 
      (task.assignedTo && task.assignedTo.toString() === user._id.toString()) ||
      (task.delegatedTo && task.delegatedTo.toString() === user._id.toString());
    if (!isPerformer) {
      return res.status(403).json({ success: false, message: 'Forbidden. Only the assignee can submit a task for review.' });
    }

    if (task.status !== 'completed' && task.status !== 'in_progress') {
      return res.status(400).json({ success: false, message: 'Task must be in progress or completed before submission.' });
    }

    // Validate required extensions if any
    if (task.requiredCompletionExtensions && task.requiredCompletionExtensions.length > 0) {
      const files = req.files as Express.Multer.File[] || [];
      const fileExts = files.map(f => {
        const parts = f.originalname.split('.');
        return '.' + parts[parts.length - 1].toLowerCase();
      });

      // Check if all required extensions are met, OR at least the files provided match the required extensions.
      // Usually, it means "If there are required extensions, the uploaded files must have those extensions."
      // Let's ensure every uploaded file has an allowed extension (if restricted) and maybe at least one file is uploaded if required.
      if (files.length === 0) {
        return res.status(400).json({ success: false, message: `Attachments required with formats: ${task.requiredCompletionExtensions.join(', ')}` });
      }

      for (const ext of fileExts) {
        if (!task.requiredCompletionExtensions.includes(ext)) {
          return res.status(400).json({ 
            success: false, 
            message: `Invalid file format: ${ext}. Allowed formats are: ${task.requiredCompletionExtensions.join(', ')}` 
          });
        }
      }
    }

    // Handle File Uploads via GridFSBucket for completionAttachments
    const attachmentIds: mongoose.Types.ObjectId[] = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      const db = mongoose.connection.db;
      if (db) {
        const bucket = new mongoose.mongo.GridFSBucket(db, {
          bucketName: 'attachments'
        });
        
        for (const file of req.files) {
          await new Promise<void>((resolve, reject) => {
            const uploadStream = bucket.openUploadStream(file.originalname, {
              contentType: file.mimetype
            });
            uploadStream.end(file.buffer);
            uploadStream.on('finish', () => {
              attachmentIds.push(uploadStream.id as mongoose.Types.ObjectId);
              resolve();
            });
            uploadStream.on('error', reject);
          });
        }
      }
    }

    task.completionAttachments = [...(task.completionAttachments || []), ...attachmentIds];
    task.status = 'submitted_for_review';
    task.submittedAt = new Date();
    task.reviewRequestedBy = user._id;

    const creator = await User.findById(task.createdBy);
    const isCreatorSuperAdmin = Boolean(creator && creator.role === 'super_admin');

    if (task.isSubtask) {
      // Subtasks go directly to their creator for final review
      task.reviewStage = creator?.role === 'department_admin' ? 'department_admin' : 'super_admin';
      task.currentReviewer = task.createdBy;
    } else if (task.delegatedTo && task.delegatedTo.toString() === user._id.toString()) {
      // Delegated task submitted by staff: goes to Dept Admin
      task.reviewStage = 'department_admin';
      task.currentReviewer = task.assignedTo;
    } else if (!isCreatorSuperAdmin) {
      // Task was created by Dept Admin -> goes directly to Dept Admin (Creator) for review & final approval
      task.reviewStage = 'department_admin';
      task.currentReviewer = task.createdBy;
    } else {
      // Task created by Super Admin -> goes to Super Admin
      task.reviewStage = 'super_admin';
      task.currentReviewer = task.createdBy;
    }

    await task.save();

    // Notify reviewer about submission
    if (task.currentReviewer && task.currentReviewer.toString() !== user._id.toString()) {
      createNotification(
        task.currentReviewer,
        'task_submitted_for_review',
        'Task Submitted for Review',
        `Task #${task.taskId || ''} "${task.title}" has been submitted for your review.`,
        task._id,
        user._id
      );
    }

    return res.status(200).json({ success: true, data: { task } });
  } catch (error) {
    console.error('Error submitting review:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// PATCH /api/tasks/:id/review
export const reviewTask = async (req: Request, res: Response) => {
  try {
    const { decision, reason, rating, feedback } = req.body;
    const user = req.user;

    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Invalid decision.' });
    }

    if (decision === 'rejected' && !reason) {
      return res.status(400).json({ success: false, message: 'Reason is required for rejection.' });
    }

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    if (task.status !== 'submitted_for_review') {
      return res.status(400).json({ success: false, message: 'Task is not pending review.' });
    }

    // Authorization
    if (user.role !== 'super_admin') {
      if (task.reviewStage === 'super_admin') {
        return res.status(403).json({ success: false, message: 'Forbidden. Only Super Admin can perform final review.' });
      } else if (task.reviewStage === 'department_admin') {
        if (!task.currentReviewer || task.currentReviewer.toString() !== user._id.toString()) {
          return res.status(403).json({ success: false, message: 'Forbidden. You are not the reviewer for this task.' });
        }
      } else {
        return res.status(400).json({ success: false, message: 'Invalid review stage.' });
      }
    }
    
    // Subtask check: If approving a parent task, check if all subtasks are approved
    if (decision === 'approved' && !task.isSubtask) {
      const unapprovedSubtasks = await Task.countDocuments({
        parentTaskId: task._id,
        isSubtask: true,
        status: { $ne: 'approved' }
      });
      if (unapprovedSubtasks > 0) {
        return res.status(400).json({ success: false, message: 'All subtasks must be approved before completing the main task.' });
      }
    }

    if (decision === 'approved') {
      let finalApproved = false;

      const creator = await User.findById(task.createdBy);
      const isCreatorSuperAdmin = Boolean(creator && creator.role === 'super_admin');

      // 1. Super Admin is always final reviewer
      if (user.role === 'super_admin') {
        task.status = 'approved';
        task.completedAt = new Date();
        task.reviewStage = 'none';
        task.currentReviewer = null;
        task.rejectionReason = null;
        finalApproved = true;
      }
      // 2. Subtasks approved by their creator
      else if (task.isSubtask && task.createdBy.toString() === user._id.toString()) {
        task.status = 'approved';
        task.completedAt = new Date();
        task.reviewStage = 'none';
        task.currentReviewer = null;
        task.rejectionReason = null;
        finalApproved = true;
      }
      // 3. Dept Admin approving a task THEY CREATED (or where creator is not Super Admin) -> FINAL APPROVED!
      else if (!isCreatorSuperAdmin || task.createdBy.toString() === user._id.toString()) {
        task.status = 'approved';
        task.completedAt = new Date();
        task.reviewStage = 'none';
        task.currentReviewer = null;
        task.rejectionReason = null;
        finalApproved = true;
      }
      // 4. Delegated task that originated from Super Admin -> forward to Super Admin
      else if (isCreatorSuperAdmin && task.delegatedTo) {
        task.reviewStage = 'super_admin';
        task.status = 'submitted_for_review'; // Stays in review, but moved to super admin
        task.currentReviewer = task.createdBy; 
        task.rejectionReason = null;
      }
      // 5. Fallback for non-super-admin tasks
      else {
        task.status = 'approved';
        task.completedAt = new Date();
        task.reviewStage = 'none';
        task.currentReviewer = null;
        task.rejectionReason = null;
        finalApproved = true;
      }

      if (finalApproved) {
        // Rating & Completer attribution:
        const completerId = task.delegatedTo || task.reviewRequestedBy || task.assignedTo;
        if (completerId) {
          task.ratedUser = completerId as mongoose.Types.ObjectId;
        }
        // Super Admin OR Department Admin (when approving their task) can give rating & feedback
        if (rating && typeof rating === 'number' && rating >= 1 && rating <= 5) {
          task.rating = rating;
          task.feedback = feedback ? String(feedback).trim() : null;
          task.ratedBy = user._id;
          task.ratedAt = new Date();
        }
      }
    } else if (decision === 'rejected') {
      task.status = 'rejected';
      task.rejectionReason = reason;
      // assignedTo remains the same.
    }

    await task.save();

    // Notify relevant users about review decision
    const performer = task.delegatedTo || task.assignedTo;
    if (decision === 'approved') {
      // Notify performer
      if (performer && performer.toString() !== user._id.toString()) {
        createNotification(
          performer,
          'task_approved',
          'Task Approved',
          `Task #${task.taskId || ''} "${task.title}" has been approved${rating ? ` with a ${rating}-star rating` : ''}.`,
          task._id,
          user._id
        );
      }
      // If forwarded to super admin, notify super admin
      if (task.reviewStage === 'super_admin' && task.currentReviewer && task.currentReviewer.toString() !== user._id.toString()) {
        createNotification(
          task.currentReviewer,
          'task_submitted_for_review',
          'Task Forwarded for Final Review',
          `Task #${task.taskId || ''} "${task.title}" has been forwarded to you for final approval.`,
          task._id,
          user._id
        );
      }
      // Notify about rating if given
      if (rating && task.ratedUser && task.ratedUser.toString() !== user._id.toString()) {
        createNotification(
          task.ratedUser,
          'task_rated',
          'Task Rated',
          `You received a ${rating}-star rating on Task #${task.taskId || ''} "${task.title}".`,
          task._id,
          user._id
        );
      }
    } else if (decision === 'rejected') {
      if (performer && performer.toString() !== user._id.toString()) {
        createNotification(
          performer,
          'task_rejected',
          'Task Needs Revision',
          `Task #${task.taskId || ''} "${task.title}" was returned for revision: ${reason || 'See task details'}.`,
          task._id,
          user._id
        );
      }
    }

    return res.status(200).json({ success: true, data: { task } });
  } catch (error) {
    console.error('Error reviewing task:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// POST /api/tasks/:id/subtasks
export const createSubtask = async (req: Request, res: Response) => {
  try {
    const { title, description, deadline, assignedTo } = req.body;
    const user = req.user;

    if (user.role === 'staff') {
      return res.status(403).json({ success: false, message: 'Forbidden. Staff cannot create subtasks.' });
    }

    if (!title || !description || !deadline || !assignedTo) {
      return res.status(400).json({ success: false, message: 'Title, description, deadline, and assignedTo are required.' });
    }

    const parentTask = await Task.findById(req.params.id);
    if (!parentTask) {
      return res.status(404).json({ success: false, message: 'Parent task not found.' });
    }

    if (parentTask.isSubtask) {
      return res.status(400).json({ success: false, message: 'Subtasks cannot contain other subtasks.' });
    }

    if (parentTask.status === 'approved') {
      return res.status(400).json({ success: false, message: 'Cannot add subtasks to an approved task.' });
    }

    const parsedDeadline = new Date(deadline);
    if (isNaN(parsedDeadline.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid deadline date.' });
    }

    if (parsedDeadline.getTime() > new Date(parentTask.deadline).getTime()) {
      return res.status(400).json({ success: false, message: 'Subtask deadline cannot exceed parent task deadline.' });
    }

    const targetUser = await User.findById(assignedTo);
    if (!targetUser || !targetUser.isActive) {
      return res.status(400).json({ success: false, message: 'Target assigned user is invalid or inactive.' });
    }

    let workflowType = undefined;
    
    // Auth Check
    if (user.role === 'super_admin') {
      if (targetUser.role === 'department_admin') {
        workflowType = 'department_admin';
      } else {
        workflowType = 'super_admin_direct';
      }
    } else if (user.role === 'department_admin') {
      // Check if Dept Admin can create subtasks on this parent
      const canManageParent = 
        parentTask.createdBy.toString() === user._id.toString() ||
        (parentTask.assignedTo && parentTask.assignedTo.toString() === user._id.toString()) ||
        (parentTask.assignedTo && await checkAdminStaffPermission(user._id.toString(), parentTask.assignedTo.toString()));
        
      if (!canManageParent) {
        return res.status(403).json({ success: false, message: 'Forbidden. You do not manage this parent task.' });
      }

      // Check if Dept Admin can assign to this specific targetUser
      const hasPermission = await checkAdminStaffPermission(user._id.toString(), assignedTo);
      if (!hasPermission) {
        return res.status(403).json({ success: false, message: 'Forbidden. Can only assign to yourself or your active staff.' });
      }
      
      workflowType = 'department_admin';
    }

    const subtask = new Task({
      title,
      description,
      deadline: parsedDeadline,
      createdBy: user._id,
      assignedTo: assignedTo,
      workflowType,
      isSubtask: true,
      parentTaskId: parentTask._id
    });

    await subtask.save();

    const populatedSubtask = await Task.findById(subtask._id)
      .populate('createdBy', 'name role universityId')
      .populate('assignedTo', 'name role department universityId')
      .populate('parentTaskId', 'taskId title');

    return res.status(201).json({ success: true, data: { task: populatedSubtask } });
  } catch (error) {
    console.error('Error creating subtask:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// GET /api/tasks/:id/subtasks
export const getSubtasks = async (req: Request, res: Response) => {
  try {
    const parentTaskId = req.params.id;
    const user = req.user;

    const query: any = { parentTaskId, isSubtask: true };

    if (user.role === 'staff') {
      query.assignedTo = user._id;
    } else if (user.role === 'department_admin') {
      // To see subtasks, Dept Admin can see subtasks on parents they manage.
      // But instead of complex parent query, it's easier to say: Dept Admin sees subtasks they created or assigned to them or their staff.
      // The requirement says "Only subtasks within their permitted task hierarchy". 
      // Subtasks they manage fall under: created by them, assigned to them, or assigned to their staff.
      const myStaffAssignments = await StaffAssignment.find({ adminId: user._id, isActive: true });
      const myStaffIds = myStaffAssignments.map(a => a.staffId);
      
      query.$or = [
        { createdBy: user._id },
        { assignedTo: user._id },
        { assignedTo: { $in: myStaffIds } }
      ];
    }
    // Super Admin sees all

    const subtasks = await Task.find(query)
      .populate('createdBy', 'name role universityId')
      .populate('assignedTo', 'name role department universityId')
      .populate('parentTaskId', 'taskId title')
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: { subtasks } });
  } catch (error) {
    console.error('Error fetching subtasks:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// GET /api/tasks/:id/progress
export const getTaskProgress = async (req: Request, res: Response) => {
  try {
    const parentTaskId = req.params.id;
    const subtasks = await Task.find({ parentTaskId, isSubtask: true });

    let total = subtasks.length;
    let pending = 0, inProgress = 0, completed = 0, submittedForReview = 0, rejected = 0, approved = 0;

    subtasks.forEach(st => {
      if (st.status === 'pending') pending++;
      else if (st.status === 'in_progress') inProgress++;
      else if (st.status === 'completed') completed++;
      else if (st.status === 'submitted_for_review') submittedForReview++;
      else if (st.status === 'rejected') rejected++;
      else if (st.status === 'approved') approved++;
    });

    const percentage = total === 0 ? 0 : Math.round((approved / total) * 100);
    const allApproved = total > 0 && total === approved;

    return res.status(200).json({
      success: true,
      data: {
        total,
        pending,
        inProgress,
        completed,
        submittedForReview,
        rejected,
        approved,
        percentage,
        allApproved
      }
    });
  } catch (error) {
    console.error('Error fetching task progress:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// GET /api/tasks/naac-report
export const getNaacReport = async (req: Request, res: Response) => {
  try {
    const User = require('../models/User').default;
    const StaffAssignment = require('../models/StaffAssignment').default;
    const Department = require('../models/Department').default;
    
    // 1. Fetch all departments from Department model and active users
    const allDepartments = await Department.find({}).sort({ name: 1 });
    const allUsers = await User.find({ isActive: true }).select('_id name role department universityId phone email');

    const deptMap: { [dept: string]: any } = {};

    // Initialize all departments with exact name and code configured by Super Admin
    allDepartments.forEach((d: any) => {
      deptMap[d.name] = {
        department: d.name,
        code: (d.code && d.code.trim()) ? d.code.trim().toUpperCase() : '',
        totalTasksGiven: 0,
        totalTasksPending: 0,
        totalTasksInReview: 0,
        totalTasksCompleted: 0,
        totalRatings: 0,
        averageRating: 0,
        rank: 1,
        users: []
      };
    });

    // Also include any department present on users
    allUsers.forEach((u: any) => {
      if (u.department && !deptMap[u.department]) {
        // Look up if this department exists in Department model (case-insensitive)
        const matchedDept = allDepartments.find(
          (ad: any) => ad.name.trim().toLowerCase() === u.department.trim().toLowerCase()
        );
        const code = matchedDept && matchedDept.code ? matchedDept.code.trim().toUpperCase() : '';

        deptMap[u.department] = {
          department: u.department,
          code,
          totalTasksGiven: 0,
          totalTasksPending: 0,
          totalTasksInReview: 0,
          totalTasksCompleted: 0,
          totalRatings: 0,
          averageRating: 0,
          rank: 1,
          users: []
        };
      }
    });

    const allUserIdsToFetchTasks: mongoose.Types.ObjectId[] = [];

    // Map users to their respective department (skip unassigned staff)
    allUsers.forEach((u: any) => {
      if (u.role === 'super_admin') return; // Super admin not counted in department stats
      if (!u.department || !u.department.trim() || u.department === 'Unassigned Department' || u.department === 'No Department Assigned') {
        return; // Unassigned staff do not belong to an institutional department
      }
      const deptName = u.department.trim();
      if (!deptMap[deptName]) {
        const matchedDept = allDepartments.find(
          (ad: any) => ad.name.trim().toLowerCase() === deptName.toLowerCase()
        );
        const code = matchedDept && matchedDept.code ? matchedDept.code.trim().toUpperCase() : '';

        deptMap[deptName] = {
          department: deptName,
          code,
          totalTasksGiven: 0,
          totalTasksPending: 0,
          totalTasksInReview: 0,
          totalTasksCompleted: 0,
          totalRatings: 0,
          averageRating: 0,
          rank: 1,
          users: []
        };
      }

      deptMap[deptName].users.push({
        _id: u._id,
        name: u.name,
        universityId: u.universityId || '',
        role: u.role,
        department: u.department,
        email: u.email,
        phone: u.phone,
        tasksGiven: 0,
        tasksPending: 0,
        tasksInReview: 0,
        tasksCompleted: 0,
        totalRatings: 0,
        averageRating: 0,
        onTimeRate: 100,
        rank: 0
      });
      allUserIdsToFetchTasks.push(u._id);
    });

    // 2. Fetch tasks for all these users
    const tasks = await Task.find({
      $or: [
        { assignedTo: { $in: allUserIdsToFetchTasks } },
        { delegatedTo: { $in: allUserIdsToFetchTasks } },
        { ratedUser: { $in: allUserIdsToFetchTasks } }
      ]
    })
    .select('assignedTo delegatedTo ratedUser status rating feedback completedAt deadline ratedBy')
    .populate('ratedBy', 'role name');

    // 3. Process data and counts
    Object.values(deptMap).forEach((deptObj: any) => {
      let deptSuperAdminRatingsSum = 0;
      let deptSuperAdminRatingsCount = 0;

      deptObj.users.forEach((userObj: any) => {
        const userTasks = tasks.filter(t => {
          const completerId = t.ratedUser ? t.ratedUser.toString() : (t.delegatedTo ? t.delegatedTo.toString() : (t.assignedTo ? t.assignedTo.toString() : null));
          return completerId === userObj._id.toString();
        });

        userObj.tasksGiven = userTasks.length;
        userObj.tasksCompleted = userTasks.filter(t => t.status === 'approved' || t.completedAt).length;
        userObj.tasksPending = userTasks.filter(t => t.status === 'pending' || t.status === 'in_progress' || t.status === 'rejected' || t.status === 'completed').length;
        userObj.tasksInReview = userTasks.filter(t => t.status === 'submitted_for_review').length;

        // User Personal Rating calculation (includes ALL ratings received by the user)
        const userRatedTasks = userTasks.filter(t => t.rating && typeof t.rating === 'number' && t.rating > 0);
        userObj.totalRatings = userRatedTasks.length;
        const userRatingSum = userRatedTasks.reduce((acc, t) => acc + (t.rating || 0), 0);
        userObj.averageRating = userObj.totalRatings > 0 ? Number((userRatingSum / userObj.totalRatings).toFixed(1)) : 0;

        // On-time calculation
        let onTime = 0;
        let totalFinished = 0;
        userTasks.forEach(t => {
          if (t.completedAt && t.deadline) {
            totalFinished++;
            if (new Date(t.completedAt).getTime() <= new Date(t.deadline).getTime()) {
              onTime++;
            }
          }
        });
        userObj.onTimeRate = totalFinished > 0 ? Math.round((onTime / totalFinished) * 100) : 100;

        // Department Aggregate Rating: ONLY count tasks rated by a Super Admin
        const deptSuperAdminRatedTasks = userTasks.filter(t => {
          return t.rating && typeof t.rating === 'number' && t.rating > 0 && t.ratedBy && (t.ratedBy as any).role === 'super_admin';
        });
        const deptSuperAdminRatingSum = deptSuperAdminRatedTasks.reduce((acc, t) => acc + (t.rating || 0), 0);
        deptSuperAdminRatingsSum += deptSuperAdminRatingSum;
        deptSuperAdminRatingsCount += deptSuperAdminRatedTasks.length;

        deptObj.totalTasksGiven += userObj.tasksGiven;
        deptObj.totalTasksPending += userObj.tasksPending;
        deptObj.totalTasksInReview += userObj.tasksInReview;
        deptObj.totalTasksCompleted += userObj.tasksCompleted;
      });

      deptObj.totalRatings = deptSuperAdminRatingsCount;
      deptObj.averageRating = deptSuperAdminRatingsCount > 0 ? Number((deptSuperAdminRatingsSum / deptSuperAdminRatingsCount).toFixed(1)) : 0;

      // Sort users inside dept: Department Admin first, then Staff sorted by averageRating (desc), totalRatings (desc), totalCompleted (desc), name
      deptObj.users.sort((a: any, b: any) => {
        if (a.role === 'department_admin' && b.role !== 'department_admin') return -1;
        if (b.role === 'department_admin' && a.role !== 'department_admin') return 1;
        if (b.averageRating !== a.averageRating) return b.averageRating - a.averageRating;
        if (b.totalRatings !== a.totalRatings) return b.totalRatings - a.totalRatings;
        if (b.tasksCompleted !== a.tasksCompleted) return b.tasksCompleted - a.tasksCompleted;
        return a.name.localeCompare(b.name);
      });

      // Assign ranking among staff
      let staffRank = 1;
      deptObj.users.forEach((u: any) => {
        if (u.role === 'staff') {
          u.rank = staffRank++;
        }
      });
    });

    // 4. Sort departments by averageRating (desc), then totalTasksCompleted (desc) and assign department rank
    const deptList = Object.values(deptMap).filter((d: any) => 
      d.department !== 'Unassigned Department' &&
      d.department !== 'No Department Assigned' &&
      (d.users.length > 0 || d.totalTasksGiven > 0)
    );
    deptList.sort((a: any, b: any) => {
      if (b.averageRating !== a.averageRating) return b.averageRating - a.averageRating;
      if (b.totalTasksCompleted !== a.totalTasksCompleted) return b.totalTasksCompleted - a.totalTasksCompleted;
      return a.department.localeCompare(b.department);
    });

    deptList.forEach((d: any, index: number) => {
      d.rank = index + 1;
    });

    return res.status(200).json({ success: true, data: deptList });
  } catch (error) {
    console.error('Error fetching NAAC report:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// POST /api/tasks/:id/comments
// POST /api/tasks/:id/comments
// Add a comment/chat message to a task
export const addTaskComment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { message, channel } = req.body;
    const user = req.user;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message cannot be empty.' });
    }

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    // Permission check: Super Admin, Creator, Assignee, Delegated, or Department Admin
    let hasAccess = false;
    if (user.role === 'super_admin') {
      hasAccess = true;
    } else if (task.createdBy.toString() === user._id.toString()) {
      hasAccess = true;
    } else if (task.assignedTo && task.assignedTo.toString() === user._id.toString()) {
      hasAccess = true;
    } else if (task.delegatedTo && task.delegatedTo.toString() === user._id.toString()) {
      hasAccess = true;
    } else if (user.role === 'department_admin') {
      // Check if task is within admin's department
      const assignedUser = await User.findById(task.assignedTo || task.delegatedTo);
      if (assignedUser && assignedUser.department === user.department) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Forbidden. You do not have permission to comment on this task.' });
    }

    if (!task.comments) {
      task.comments = [];
    }

    // Determine chat channel for 3-tier hierarchy:
    // A 3-tier task has a distinct assignedTo (Dept Admin) and delegatedTo (Staff)
    const isThreeTier = Boolean(
      task.delegatedTo && 
      task.assignedTo && 
      task.delegatedTo.toString() !== task.assignedTo.toString()
    );

    let commentChannel: 'super_admin' | 'staff' | 'general' = 'general';
    if (isThreeTier) {
      if (user.role === 'super_admin') {
        commentChannel = 'super_admin';
      } else if (user.role === 'staff') {
        commentChannel = 'staff';
      } else if (user.role === 'department_admin') {
        // Dept Admin chooses which tab/recipient they are messaging
        commentChannel = channel === 'super_admin' ? 'super_admin' : 'staff';
      }
    }

    const newComment = {
      sender: user._id,
      message: message.trim(),
      channel: commentChannel,
      readBy: [user._id],
      createdAt: new Date()
    };

    task.comments.push(newComment as any);
    await task.save();

    // Populate the task comments with sender info
    const updatedTask = await Task.findById(id)
      .populate('comments.sender', 'name role department universityId employeeId email');

    let returnComments = updatedTask?.comments || [];
    if (isThreeTier) {
      if (user.role === 'super_admin') {
        returnComments = returnComments.filter((c: any) => c.channel !== 'staff');
      } else if (user.role === 'staff') {
        returnComments = returnComments.filter((c: any) => c.channel !== 'super_admin');
      }
    }

    // Notify other chat participants
    const chatNotifyTargets = new Set<string>();
    if (isThreeTier) {
      if (commentChannel === 'super_admin') {
        // Notify super admin or dept admin (the other party)
        if (user.role === 'super_admin' && task.assignedTo) chatNotifyTargets.add(task.assignedTo.toString());
        if (user.role === 'department_admin' && task.createdBy) chatNotifyTargets.add(task.createdBy.toString());
      } else if (commentChannel === 'staff') {
        if (user.role === 'staff' && task.assignedTo) chatNotifyTargets.add(task.assignedTo.toString());
        if (user.role === 'department_admin' && task.delegatedTo) chatNotifyTargets.add(task.delegatedTo.toString());
      }
    } else {
      // 2-tier: notify all other participants
      if (task.createdBy) chatNotifyTargets.add(task.createdBy.toString());
      if (task.assignedTo) chatNotifyTargets.add(task.assignedTo.toString());
      if (task.delegatedTo) chatNotifyTargets.add(task.delegatedTo.toString());
    }
    chatNotifyTargets.delete(user._id.toString());

    for (const recipientId of chatNotifyTargets) {
      createNotification(
        recipientId,
        'new_chat_message',
        'New Chat Message',
        `${user.name || 'Someone'} sent a message on Task #${task.taskId || ''} "${task.title}".`,
        task._id,
        user._id
      );
    }

    return res.status(201).json({
      success: true,
      data: returnComments,
      message: 'Comment posted successfully.'
    });
  } catch (error: any) {
    console.error('Error adding task comment:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error.' });
  }
};

// GET /api/tasks/:id/comments
// Fetch all comments for a task
export const getTaskComments = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const task = await Task.findById(id)
      .populate('comments.sender', 'name role department universityId employeeId email');

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    const isThreeTier = Boolean(
      task.delegatedTo && 
      task.assignedTo && 
      task.delegatedTo.toString() !== task.assignedTo.toString()
    );

    // Filter comments visible to this user
    let visibleComments = task.comments || [];
    if (isThreeTier) {
      if (user.role === 'super_admin') {
        visibleComments = visibleComments.filter((c: any) => c.channel !== 'staff');
      } else if (user.role === 'staff') {
        visibleComments = visibleComments.filter((c: any) => c.channel !== 'super_admin');
      }
    }

    // Mark visible unread comments as read for current user
    let hasUnread = false;
    const now = new Date();
    if (visibleComments.length > 0) {
      visibleComments.forEach((c: any) => {
        const isNotSender = c.sender ? (c.sender._id || c.sender).toString() !== user._id.toString() : true;
        if (isNotSender) {
          if (!c.readBy || !c.readBy.some((uid: any) => (uid?._id || uid).toString() === user._id.toString())) {
            if (!c.readBy) c.readBy = [];
            c.readBy.push(user._id);
            c.readAt = now;
            hasUnread = true;
          }
        }
      });
      if (hasUnread) {
        await task.save();
      }
    }

    return res.status(200).json({
      success: true,
      data: visibleComments
    });
  } catch (error: any) {
    console.error('Error fetching task comments:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error.' });
  }
};

// PATCH /api/tasks/:id/comments/read
// Mark comments as read (optionally for a specific channel)
export const markCommentsAsRead = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const channel = req.body.channel || req.query.channel;
    const user = req.user;
    const now = new Date();

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    if (task.comments && task.comments.length > 0) {
      task.comments.forEach((c: any) => {
        // If channel specified, only mark that channel
        if (channel && c.channel && c.channel !== channel) return;
        if (user.role === 'super_admin' && c.channel === 'staff') return;
        if (user.role === 'staff' && c.channel === 'super_admin') return;

        const isNotSender = c.sender ? (c.sender._id || c.sender).toString() !== user._id.toString() : true;
        if (isNotSender) {
          if (!c.readBy) c.readBy = [];
          if (!c.readBy.some((uid: any) => (uid?._id || uid).toString() === user._id.toString())) {
            c.readBy.push(user._id);
            c.readAt = now;
          }
        }
      });
      await task.save();
    }

    return res.status(200).json({ success: true, message: 'Comments marked as read.' });
  } catch (error: any) {
    console.error('Error marking comments as read:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error.' });
  }
};

