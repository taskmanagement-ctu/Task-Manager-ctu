import React from 'react';

export type Urgency = 'RED' | 'YELLOW' | 'GREEN' | 'OVERDUE';

export interface TaskUrgencyInput {
  deadline: string;
  status?: string;
  submittedAt?: string | Date | null;
  completedAt?: string | Date | null;
  updatedAt?: string | Date | null;
  priority?: 'low' | 'medium' | 'high' | string | null;
}

/**
 * Calculates priority from deadline automatically:
 *  - 0-5 days remaining: 'high'
 *  - 6-10 days remaining: 'medium'
 *  - 11+ days remaining: 'low'
 */
export const getAutoPriorityFromDeadline = (deadlineString: string): 'low' | 'medium' | 'high' => {
  if (!deadlineString) return 'medium';
  const deadline = new Date(deadlineString);
  if (isNaN(deadline.getTime())) return 'medium';
  const now = new Date();
  deadline.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diffTime = deadline.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays <= 5) return 'high';
  if (diffDays <= 10) return 'medium';
  return 'low';
};

/**
 * Calculates task urgency dynamically based on the deadline.
 * If task is submitted or completed, the calculation is frozen at the submission/completion date.
 * If creator set a custom manual priority (high/medium/low), that priority takes precedence.
 * Rules:
 *  - passed: OVERDUE
 *  - custom priority: RED (high), YELLOW (medium), GREEN (low)
 *  - auto deadline fallback: 0-5 days (RED), 6-10 days (YELLOW), 11+ days (GREEN)
 */
export const calculateUrgency = (
  taskOrDeadline: TaskUrgencyInput | string,
  status?: string,
  submittedOrCompletedAt?: string | Date | null
): Urgency => {
  let deadlineString = '';
  let taskStatus = status;
  let freezeDate = submittedOrCompletedAt;
  let customPriority: string | null | undefined = null;

  if (typeof taskOrDeadline === 'object' && taskOrDeadline !== null) {
    deadlineString = taskOrDeadline.deadline;
    taskStatus = taskOrDeadline.status;
    freezeDate = taskOrDeadline.submittedAt || taskOrDeadline.completedAt || taskOrDeadline.updatedAt;
    customPriority = taskOrDeadline.priority;
  } else {
    deadlineString = taskOrDeadline;
  }

  if (!deadlineString) {
    if (customPriority) {
      const cp = String(customPriority).toLowerCase().trim();
      if (cp === 'high' || cp === 'red') return 'RED';
      if (cp === 'medium' || cp === 'yellow') return 'YELLOW';
      if (cp === 'low' || cp === 'green') return 'GREEN';
    }
    return 'GREEN';
  }

  const deadline = new Date(deadlineString);
  let comparisonDate = new Date();

  // If task has been submitted or completed, freeze comparison date at the submission/completion time
  if (
    taskStatus === 'submitted_for_review' ||
    taskStatus === 'completed' ||
    taskStatus === 'approved'
  ) {
    if (freezeDate) {
      comparisonDate = new Date(freezeDate);
    }
  }

  // Reset time to start of day for pure date difference
  deadline.setHours(0, 0, 0, 0);
  const compDay = new Date(comparisonDate);
  compDay.setHours(0, 0, 0, 0);

  const diffTime = deadline.getTime() - compDay.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return 'OVERDUE';
  }

  // If a manual priority is set on the task, honor it:
  if (customPriority) {
    const cp = String(customPriority).toLowerCase().trim();
    if (cp === 'high' || cp === 'red') return 'RED';
    if (cp === 'medium' || cp === 'yellow') return 'YELLOW';
    if (cp === 'low' || cp === 'green') return 'GREEN';
  }

  if (diffDays <= 5) {
    return 'RED';
  } else if (diffDays <= 10) {
    return 'YELLOW';
  } else {
    return 'GREEN';
  }
};

export const getUrgencyColor = (urgency: Urgency): string => {
  switch (urgency) {
    case 'RED': return '#ef4444'; // Tailwind red-500
    case 'YELLOW': return '#eab308'; // Tailwind yellow-500
    case 'GREEN': return '#22c55e'; // Tailwind green-500
    case 'OVERDUE': return '#7f1d1d'; // Tailwind red-900
    default: return '#6b7280'; // gray
  }
};

export const getUrgencyBadgeClass = (urgency: Urgency): string => {
  switch (urgency) {
    case 'RED': return 'badge-danger';
    case 'YELLOW': return 'badge-warning';
    case 'GREEN': return 'badge-success';
    case 'OVERDUE': return 'badge-dark'; // Assume a dark/strong styling
    default: return 'badge-secondary';
  }
};

/**
 * Returns inline style object for task cards based on urgency.
 * Used globally across all pages that display task cards.
 */
export const getUrgencyCardStyle = (urgency: Urgency): React.CSSProperties => {
  switch (urgency) {
    case 'RED':
      return {
        backgroundColor: '#fef2f2',
        borderLeft: '4px solid #ef4444',
        borderColor: '#fecaca',
      };
    case 'YELLOW':
      return {
        backgroundColor: '#fefce8',
        borderLeft: '4px solid #eab308',
        borderColor: '#fef08a',
      };
    case 'GREEN':
      return {
        backgroundColor: '#f0fdf4',
        borderLeft: '4px solid #22c55e',
        borderColor: '#bbf7d0',
      };
    case 'OVERDUE':
      return {
        backgroundColor: '#fef2f2',
        borderLeft: '4px solid #991b1b',
        borderColor: '#fca5a5',
      };
    default:
      return {
        backgroundColor: '#f8fafc',
        borderLeft: '4px solid #94a3b8',
        borderColor: '#e2e8f0',
      };
  }
};

/**
 * Returns the priority label text for display.
 */
export const getUrgencyLabel = (urgency: Urgency): string => {
  switch (urgency) {
    case 'RED': return 'High Priority';
    case 'YELLOW': return 'Medium Priority';
    case 'GREEN': return 'Low Priority';
    case 'OVERDUE': return 'Overdue';
    default: return '';
  }
};
