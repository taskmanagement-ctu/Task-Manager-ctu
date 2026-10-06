import React, { useState, useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Calendar as CalendarIcon, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Download, 
  ChevronRight as ArrowIcon
} from 'lucide-react';
import { Task } from '../services/api';
import { calculateUrgency, getUrgencyColor, getUrgencyLabel } from '../utils/taskUrgency';
import './TaskCalendarModal.css';

interface TaskCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  onSelectTask: (task: Task) => void;
}

export const exportTasksToIcs = (tasks: Task[], filename = 'ct-university-deadlines.ics') => {
  const safeList = Array.isArray(tasks) ? tasks : [];
  const events = safeList
    .filter(t => t && t.deadline && !isNaN(new Date(t.deadline).getTime()))
    .map(t => {
      const d = new Date(t.deadline!);
      const pad = (n: number) => String(n).padStart(2, '0');
      const dtString = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
      const uid = `${t._id || t.id || Math.random()}@ctuniversity.in`;
      const cleanTitle = (t.title || 'Task Deadline').replace(/[\r\n]+/g, ' ');
      const cleanDesc = (t.description || '').replace(/[\r\n]+/g, '\\n');
      const isDone = (t.status === 'completed' || t.status === 'approved');
      return [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${dtString}`,
        `DTSTART:${dtString}`,
        `SUMMARY:CTU Task: ${cleanTitle}`,
        `DESCRIPTION:${cleanDesc}`,
        `STATUS:${isDone ? 'COMPLETED' : 'CONFIRMED'}`,
        'END:VEVENT'
      ].join('\r\n');
    })
    .join('\r\n');

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CT University//TaskDesk Portal//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    events,
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TaskCalendarModal: React.FC<TaskCalendarModalProps> = ({
  isOpen,
  onClose,
  tasks,
  onSelectTask,
}) => {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  const safeTasks = useMemo(() => Array.isArray(tasks) ? tasks : [], [tasks]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Close on ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Tasks grouped by 'YYYY-MM-DD'
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    safeTasks.forEach(task => {
      if (!task || !task.deadline) return;
      const d = new Date(task.deadline);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    });
    return map;
  }, [safeTasks]);

  // Calendar cells generation
  const calendarCells = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const cells: Array<{
      date: Date;
      isCurrentMonth: boolean;
      dateKey: string;
      tasks: Task[];
    }> = [];

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthDays - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      cells.push({
        date: d,
        isCurrentMonth: false,
        dateKey: key,
        tasks: tasksByDate.get(key) || []
      });
    }

    // Current month days
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const d = new Date(year, month, day);
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({
        date: d,
        isCurrentMonth: true,
        dateKey: key,
        tasks: tasksByDate.get(key) || []
      });
    }

    // Next month padding to fill complete rows of 7
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let day = 1; day <= remaining; day++) {
      const d = new Date(year, month + 1, day);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      cells.push({
        date: d,
        isCurrentMonth: false,
        dateKey: key,
        tasks: tasksByDate.get(key) || []
      });
    }

    return cells;
  }, [year, month, tasksByDate]);

  // Tasks for current month stats
  const monthTasks = useMemo(() => {
    const list: Task[] = [];
    safeTasks.forEach(t => {
      if (!t || !t.deadline) return;
      const d = new Date(t.deadline);
      if (isNaN(d.getTime())) return;
      if (d.getFullYear() === year && d.getMonth() === month) {
        list.push(t);
      }
    });
    return list;
  }, [safeTasks, year, month]);

  const monthCompleted = monthTasks.filter(t => t.status === 'completed' || t.status === 'approved').length;
  const monthOverdue = monthTasks.filter(t => {
    const isDone = t.status === 'completed' || t.status === 'approved';
    return !isDone && t.deadline && new Date(t.deadline).getTime() < Date.now();
  }).length;
  const monthPending = monthTasks.length - monthCompleted;

  // Selected date key and its tasks
  const selectedKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
  const selectedDateTasks = tasksByDate.get(selectedKey) || [];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
  };

  const isToday = (d: Date) => {
    const now = new Date();
    return d.getDate() === now.getDate() &&
           d.getMonth() === now.getMonth() &&
           d.getFullYear() === now.getFullYear();
  };

  const isSelected = (d: Date) => {
    return d.getDate() === selectedDate.getDate() &&
           d.getMonth() === selectedDate.getMonth() &&
           d.getFullYear() === selectedDate.getFullYear();
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="tcm-overlay" onClick={onClose}>
      <div className="tcm-modal" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="tcm-header">
          <div className="tcm-header-left">
            <div className="tcm-icon-box">
              <CalendarIcon size={20} />
            </div>
            <div>
              <h2 className="tcm-title">Task &amp; Deadline Calendar</h2>
              <p className="tcm-subtitle">University Academic Schedule &amp; Submission Milestones</p>
            </div>
          </div>

          <div className="tcm-header-actions">
            <button 
              type="button" 
              className="tcm-action-btn"
              onClick={() => exportTasksToIcs(safeTasks)}
              title="Download calendar file for Google Calendar / Outlook"
            >
              <Download size={14} />
              <span>Export .ics</span>
            </button>
            <button 
              type="button" 
              className="tcm-close-btn" 
              onClick={onClose}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="tcm-stats-strip">
          <div className="tcm-stat-item">
            <span className="tcm-stat-num">{monthTasks.length}</span>
            <span className="tcm-stat-lbl">Deadlines this Month</span>
          </div>
          <div className="tcm-stat-divider" />
          <div className="tcm-stat-item">
            <span className="tcm-stat-num text-emerald">{monthCompleted}</span>
            <span className="tcm-stat-lbl">Completed</span>
          </div>
          <div className="tcm-stat-divider" />
          <div className="tcm-stat-item">
            <span className="tcm-stat-num text-amber">{monthPending}</span>
            <span className="tcm-stat-lbl">Pending / Active</span>
          </div>
          <div className="tcm-stat-divider" />
          <div className="tcm-stat-item">
            <span className="tcm-stat-num text-rose">{monthOverdue}</span>
            <span className="tcm-stat-lbl">Overdue</span>
          </div>
        </div>

        {/* Navigation Bar */}
        <div className="tcm-nav-bar">
          <div className="tcm-month-display">
            <span className="tcm-month-name">
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
          </div>

          <div className="tcm-nav-controls">
            <button 
              type="button" 
              className="tcm-today-btn"
              onClick={handleToday}
            >
              Today
            </button>
            <div className="tcm-nav-arrows">
              <button 
                type="button" 
                className="tcm-arrow-btn" 
                onClick={handlePrevMonth}
                aria-label="Previous Month"
              >
                <ChevronLeft size={18} />
              </button>
              <button 
                type="button" 
                className="tcm-arrow-btn" 
                onClick={handleNextMonth}
                aria-label="Next Month"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Main Body: Grid + Inspector Panel */}
        <div className="tcm-body">
          {/* Calendar Grid Column */}
          <div className="tcm-grid-col">
            {/* Weekdays */}
            <div className="tcm-weekdays-row">
              {DAYS_OF_WEEK.map((d, i) => (
                <div key={d} className={`tcm-weekday ${i === 0 || i === 6 ? 'weekend' : ''}`}>
                  {d}
                </div>
              ))}
            </div>

            {/* Day Cells Grid */}
            <div className="tcm-days-grid">
              {calendarCells.map(cell => {
                const cellTasks = cell.tasks;
                const hasTasks = cellTasks.length > 0;
                const today = isToday(cell.date);
                const selected = isSelected(cell.date);

                // Check statuses for color dots
                const hasOverdue = cellTasks.some(t => {
                  const done = t.status === 'completed' || t.status === 'approved';
                  return !done && t.deadline && new Date(t.deadline).getTime() < Date.now();
                });
                const hasPending = cellTasks.some(t => t.status === 'pending' || t.status === 'in_progress' || t.status === 'submitted_for_review');
                const hasCompleted = cellTasks.some(t => t.status === 'completed' || t.status === 'approved');

                return (
                  <div
                    key={cell.dateKey}
                    className={`tcm-day-cell ${!cell.isCurrentMonth ? 'outside-month' : ''} ${today ? 'is-today' : ''} ${selected ? 'is-selected' : ''} ${hasTasks ? 'has-tasks' : ''}`}
                    onClick={() => {
                      setSelectedDate(cell.date);
                      if (!cell.isCurrentMonth) {
                        setCurrentDate(new Date(cell.date.getFullYear(), cell.date.getMonth(), 1));
                      }
                    }}
                  >
                    <div className="tcm-day-header">
                      <span className="tcm-day-num">{cell.date.getDate()}</span>
                      {today && <span className="tcm-today-badge">Today</span>}
                    </div>

                    {/* Task Indicators */}
                    {hasTasks && (
                      <div className="tcm-task-indicators">
                        <div className="tcm-task-dots">
                          {hasOverdue && <span className="tcm-dot dot-overdue" title="Overdue task" />}
                          {hasPending && <span className="tcm-dot dot-pending" title="Active/Pending task" />}
                          {hasCompleted && <span className="tcm-dot dot-completed" title="Completed task" />}
                        </div>

                        {/* Task Mini Chips (Desktop) */}
                        <div className="tcm-chips-list">
                          {cellTasks.slice(0, 2).map((t, idx) => {
                            const isDone = t.status === 'completed' || t.status === 'approved';
                            const isLate = !isDone && t.deadline && new Date(t.deadline).getTime() < Date.now();
                            return (
                              <div 
                                key={t._id || idx} 
                                className={`tcm-chip ${isDone ? 'chip-done' : isLate ? 'chip-late' : 'chip-active'}`}
                                title={t.title}
                              >
                                {t.title}
                              </div>
                            );
                          })}
                          {cellTasks.length > 2 && (
                            <span className="tcm-chip-more">+{cellTasks.length - 2} more</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="tcm-legend">
              <span className="tcm-legend-item">
                <span className="tcm-dot dot-overdue" /> Overdue / Urgent
              </span>
              <span className="tcm-legend-item">
                <span className="tcm-dot dot-pending" /> In Progress / Pending
              </span>
              <span className="tcm-legend-item">
                <span className="tcm-dot dot-completed" /> Completed / Approved
              </span>
            </div>
          </div>

          {/* Inspector Panel for Selected Date */}
          <div className="tcm-inspector-col">
            <div className="tcm-inspector-header">
              <div className="tcm-inspector-date-label">
                {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
              <span className="tcm-inspector-count-badge">
                {selectedDateTasks.length} {selectedDateTasks.length === 1 ? 'Deadline' : 'Deadlines'}
              </span>
            </div>

            <div className="tcm-inspector-list">
              {selectedDateTasks.length === 0 ? (
                <div className="tcm-empty-inspector">
                  <div className="tcm-empty-icon">
                    <Clock size={28} />
                  </div>
                  <p className="tcm-empty-title">No Deadlines On This Day</p>
                  <p className="tcm-empty-desc">
                    Select another date on the calendar with indicator dots to view deliverables.
                  </p>
                </div>
              ) : (
                selectedDateTasks.map(task => {
                  const statusVal = task.status || 'pending';
                  const isDone = statusVal === 'completed' || statusVal === 'approved';
                  const isOverdue = !isDone && task.deadline && new Date(task.deadline).getTime() < Date.now();
                  const urgency = calculateUrgency(task);
                  const urgencyLabel = getUrgencyLabel(urgency);
                  const urgencyColor = getUrgencyColor(urgency);

                  return (
                    <div 
                      key={task._id || task.id} 
                      className={`tcm-task-card ${isDone ? 'card-done' : isOverdue ? 'card-overdue' : ''}`}
                      onClick={() => {
                        onClose();
                        onSelectTask(task);
                      }}
                    >
                      <div className="tcm-card-top">
                        <span className="tcm-card-id">#{task.taskId || task._id?.substring(0, 6)}</span>
                        {task.isSubtask && <span className="tcm-subtask-tag">Subtask</span>}
                        <span 
                          className="tcm-card-urgency"
                          style={{ color: urgencyColor, borderColor: `${urgencyColor}40`, backgroundColor: `${urgencyColor}15` }}
                        >
                          {urgencyLabel}
                        </span>
                      </div>

                      <h4 className="tcm-card-title">{task.title}</h4>
                      
                      {task.description && (
                        <p className="tcm-card-desc">{task.description}</p>
                      )}

                      <div className="tcm-card-footer">
                        <span className={`tcm-card-status status-${statusVal}`}>
                          {isDone ? <CheckCircle2 size={12} /> : isOverdue ? <AlertTriangle size={12} /> : <Clock size={12} />}
                          {statusVal.replace(/_/g, ' ').toUpperCase()}
                        </span>

                        <button 
                          type="button" 
                          className="tcm-open-task-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                            onSelectTask(task);
                          }}
                        >
                          <span>Open Details</span>
                          <ArrowIcon size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default TaskCalendarModal;
