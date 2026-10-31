import cron from 'node-cron';
import Task, { ITask } from '../models/Task';
import User from '../models/User';
import Notification from '../models/Notification';
import { sendTaskDueSoonEmail, sendTaskOverdueEmail } from './emailService';

// Ensure User model is loaded in Mongoose model registry for populate
const _userModel = User;

/**
 * Normalizes a date to YYYY-MM-DD string in UTC/local to safely check same-day execution
 */
const getDateString = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

/**
 * Checks all active tasks for:
 * 1. 3 Days Left Reminder: Tasks due within 3 days (not yet reminded)
 * 2. Overdue Daily Reminder: Tasks that have passed deadline (once per day)
 */
export const checkAndSendTaskDeadlines = async (): Promise<{
  checkedCount: number;
  dueSoonSent: number;
  overdueSent: number;
}> => {
  const stats = { checkedCount: 0, dueSoonSent: 0, overdueSent: 0 };

  try {
    const now = new Date();
    const todayStr = getDateString(now);

    // Fetch tasks that are active (not completed or approved or submitted for review)
    // and have at least one assigned user or co-assignees
    const activeTasks = await Task.find({
      status: { $in: ['pending', 'in_progress', 'rejected'] },
      $or: [
        { assignedTo: { $ne: null } },
        { coAssignees: { $exists: true, $not: { $size: 0 } } },
      ],
    })
      .populate('assignedTo', 'name email role department universityId')
      .populate('coAssignees', 'name email role department universityId')
      .populate('createdBy', 'name email role');

    stats.checkedCount = activeTasks.length;

    for (const task of activeTasks) {
      if (!task.deadline) continue;

      const deadline = new Date(task.deadline);
      const diffMs = deadline.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      // Collect all unique assignees to notify
      const recipientsMap = new Map<string, any>();
      if (task.assignedTo && (task.assignedTo as any).email) {
        recipientsMap.set((task.assignedTo as any)._id.toString(), task.assignedTo);
      }
      if (Array.isArray(task.coAssignees)) {
        for (const co of task.coAssignees as any[]) {
          if (co && co.email) {
            recipientsMap.set(co._id.toString(), co);
          }
        }
      }

      const recipients = Array.from(recipientsMap.values());
      if (recipients.length === 0) continue;

      const formattedDeadline = deadline.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      // -------------------------------------------------------------
      // 1. 3-DAYS-LEFT REMINDER
      // Conditions:
      // - Deadline is within 3 days (0 < diffDays <= 3 and diffMs > 0)
      // - Reminder has NOT been sent yet for this deadline
      // -------------------------------------------------------------
      if (diffMs > 0 && diffDays <= 3 && !task.dueSoonReminderSent) {
        for (const recipient of recipients) {
          try {
            await sendTaskDueSoonEmail(
              recipient.email,
              recipient.name,
              task.title,
              task.taskId || '',
              deadline,
              Math.max(1, diffDays),
              task.description,
              task._id.toString()
            );

            // Create in-app notification
            await Notification.create({
              recipient: recipient._id,
              type: 'task_due_soon',
              title: 'Task Due in 3 Days',
              message: `Your task "${task.title}" (Task #${task.taskId || ''}) is due in ${Math.max(1, diffDays)} day(s) on ${formattedDeadline}. Please complete it before the deadline.`,
              taskId: task._id,
              triggeredBy: (task.createdBy as any)?._id || null,
            });
          } catch (err) {
            console.error(`[Scheduler] Error notifying user ${recipient.email} for 3-day reminder on task ${task.taskId}:`, err);
          }
        }

        task.dueSoonReminderSent = true;
        task.dueSoonReminderSentAt = now;
        await task.save();
        stats.dueSoonSent++;
        console.log(`[Scheduler] 3-Day reminder sent for Task #${task.taskId} ("${task.title}") to ${recipients.length} assignee(s).`);
        continue;
      }

      // -------------------------------------------------------------
      // 2. DAILY OVERDUE REMINDER
      // Conditions:
      // - Deadline has passed (diffMs < 0)
      // - Reminder has not already been sent today
      // -------------------------------------------------------------
      if (diffMs < 0) {
        const lastSentDateStr = task.lastOverdueReminderSentAt
          ? getDateString(new Date(task.lastOverdueReminderSentAt))
          : null;

        // If already sent today, skip to avoid spamming
        if (lastSentDateStr === todayStr) {
          continue;
        }

        const daysOverdue = Math.max(1, Math.floor(Math.abs(diffMs) / (1000 * 60 * 60 * 24)));

        for (const recipient of recipients) {
          try {
            await sendTaskOverdueEmail(
              recipient.email,
              recipient.name,
              task.title,
              task.taskId || '',
              deadline,
              daysOverdue,
              task.description,
              task._id.toString()
            );

            // Create in-app notification
            await Notification.create({
              recipient: recipient._id,
              type: 'task_overdue',
              title: 'Task Overdue',
              message: `Your task "${task.title}" (Task #${task.taskId || ''}) was due on ${formattedDeadline} and is currently overdue by ${daysOverdue} day(s). Please complete or update it immediately.`,
              taskId: task._id,
              triggeredBy: (task.createdBy as any)?._id || null,
            });
          } catch (err) {
            console.error(`[Scheduler] Error notifying user ${recipient.email} for overdue reminder on task ${task.taskId}:`, err);
          }
        }

        task.lastOverdueReminderSentAt = now;
        task.overdueReminderCount = (task.overdueReminderCount || 0) + 1;
        await task.save();
        stats.overdueSent++;
        console.log(`[Scheduler] Daily overdue reminder sent for Task #${task.taskId} ("${task.title}") to ${recipients.length} assignee(s). (Overdue by ${daysOverdue} days)`);
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error checking task deadlines:', error);
  }

  return stats;
};

/**
 * Initializes cron jobs for automated deadline checking
 */
export const initTaskDeadlineScheduler = (): void => {
  console.log('⏰ Initializing Task Deadline Scheduler...');

  // Run every hour on the hour (e.g. 09:00, 10:00, 11:00...)
  // Overdue check is protected by same-day check so it will strictly fire once per day per task.
  // 3-days left check will fire promptly when a task enters the 3-day window.
  cron.schedule('0 * * * *', async () => {
    console.log('[Scheduler] Running hourly task deadline check...');
    await checkAndSendTaskDeadlines();
  });

  // Also run once after a 10-second delay upon server startup
  setTimeout(() => {
    console.log('[Scheduler] Running initial startup task deadline check...');
    checkAndSendTaskDeadlines()
      .then((res) => {
        console.log(`[Scheduler] Initial check completed. Checked: ${res.checkedCount}, Due Soon Sent: ${res.dueSoonSent}, Overdue Sent: ${res.overdueSent}`);
      })
      .catch((err) => console.error('[Scheduler] Initial deadline check error:', err));
  }, 10000);

  console.log('✅ Task Deadline Scheduler initialized (Hourly check + daily overdue enforcement).');
};
