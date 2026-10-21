import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  FileText,
  UserCheck,
  ArrowRight,
  Send,
  CheckCircle2,
  XCircle,
  Star,
  MessageSquare,
  Clock,
  ExternalLink,
  Sparkles,
  Edit2
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './NotificationDropdown.css';

interface NotificationItem {
  _id: string;
  type: string;
  title: string;
  message: string;
  taskId?: {
    _id: string;
    taskId: string;
    title: string;
    status: string;
  };
  triggeredBy?: {
    _id: string;
    name: string;
    role: string;
    universityId: string;
    department?: string;
  };
  isRead: boolean;
  createdAt: string;
}

export const NotificationDropdown: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'tasks' | 'chat'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ─── Fetch Unread Count ─────────────────────────────────────
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await api.getUnreadNotificationCount();
      if (res.success) {
        setUnreadCount(res.count);
      }
    } catch (err) {
      console.error('Error fetching unread notification count:', err);
    }
  }, []);

  // ─── Fetch Notification List ────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const filterParam = filter === 'all' ? undefined : filter;
      const res = await api.getNotifications({ page: 1, limit: 30, filter: filterParam });
      if (res.success) {
        setNotifications(res.data);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // Initial & periodic polling of unread count
  useEffect(() => {
    if (!currentUser) return;
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [currentUser, fetchUnreadCount]);

  // Fetch notifications whenever popover opens or filter changes
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
      fetchUnreadCount();
    }
  }, [isOpen, fetchNotifications, fetchUnreadCount]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Escape key to close
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const getBasePath = () => {
    if (currentUser?.role === 'super_admin') return '/super-admin';
    if (currentUser?.role === 'department_admin') return '/admin';
    return '/staff';
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    // Mark as read in backend
    if (!notif.isRead) {
      try {
        await api.markNotificationRead(notif._id);
        setNotifications(prev =>
          prev.map(n => (n._id === notif._id ? { ...n, isRead: true } : n))
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (err) {
        console.error('Error marking notification read:', err);
      }
    }

    setIsOpen(false);

    // Navigate directly to task view with query params to auto-open modal or chat
    if (notif.taskId?._id) {
      const basePath = getBasePath();
      const isChat = notif.type === 'new_chat_message';
      navigate(`${basePath}/tasks?openTask=${notif.taskId._id}${isChat ? '&openChat=true' : ''}`);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all notifications read:', err);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'task_assigned':
        return <FileText size={16} />;
      case 'task_delegated':
        return <UserCheck size={16} />;
      case 'task_status_changed':
        return <ArrowRight size={16} />;
      case 'task_submitted_for_review':
        return <Send size={16} />;
      case 'task_approved':
        return <CheckCircle2 size={16} />;
      case 'task_rejected':
        return <XCircle size={16} />;
      case 'task_rated':
        return <Star size={16} />;
      case 'task_updated':
        return <Edit2 size={16} />;
      case 'new_chat_message':
        return <MessageSquare size={16} />;
      default:
        return <Bell size={16} />;
    }
  };

  const getIconClass = (type: string) => {
    switch (type) {
      case 'task_assigned':
      case 'task_delegated':
        return 'nd-icon-blue';
      case 'task_status_changed':
        return 'nd-icon-amber';
      case 'task_submitted_for_review':
        return 'nd-icon-purple';
      case 'task_approved':
        return 'nd-icon-green';
      case 'task_rejected':
        return 'nd-icon-red';
      case 'task_rated':
        return 'nd-icon-gold';
      case 'task_updated':
        return 'nd-icon-blue';
      case 'new_chat_message':
        return 'nd-icon-cyan';
      default:
        return 'nd-icon-slate';
    }
  };

  const timeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="nd-container" ref={dropdownRef}>
      {/* ─── Trigger: Bell Button ─── */}
      <button
        className={`nd-bell-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="nd-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* ─── Pop-up Dropdown ─── */}
      {isOpen && (
        <div className="nd-popover">
          {/* Header */}
          <div className="nd-header">
            <div className="nd-header-title">
              <div className="nd-header-icon-box">
                <Bell size={18} />
              </div>
              <div className="nd-header-text">
                <h3>Notifications</h3>
                {unreadCount > 0 ? (
                  <span className="nd-unread-pill">{unreadCount} new</span>
                ) : (
                  <span className="nd-all-caught-up">
                    <Sparkles size={12} /> All caught up
                  </span>
                )}
              </div>
            </div>

            {unreadCount > 0 && (
              <button
                className="nd-mark-read-btn"
                onClick={handleMarkAllRead}
                title="Mark all as read"
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
            )}
          </div>

          {/* Filter Bar */}
          <div className="nd-filter-bar">
            {(
              [
                { key: 'all', label: 'All' },
                { key: 'unread', label: 'Unread' },
                { key: 'tasks', label: 'Tasks' },
                { key: 'chat', label: 'Chat' },
              ] as const
            ).map(tab => (
              <button
                key={tab.key}
                className={`nd-filter-chip ${filter === tab.key ? 'active' : ''}`}
                onClick={() => setFilter(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* List Area */}
          <div className="nd-list">
            {loading ? (
              <div className="nd-loading">
                <div className="nd-spinner" />
                <span>Loading notifications...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="nd-empty">
                <div className="nd-empty-icon">
                  <Bell size={32} />
                </div>
                <p className="nd-empty-title">No notifications</p>
                <p className="nd-empty-sub">
                  {filter === 'unread'
                    ? 'No unread notifications right now.'
                    : filter === 'chat'
                    ? 'No chat messages on your tasks.'
                    : 'You have no notifications in this view.'}
                </p>
              </div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif._id}
                  className={`nd-item ${!notif.isRead ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(notif)}
                >
                  <div className={`nd-item-icon ${getIconClass(notif.type)}`}>
                    {getNotificationIcon(notif.type)}
                  </div>

                  <div className="nd-item-content">
                    <div className="nd-item-top">
                      <span className="nd-item-title">{notif.title}</span>
                      <span className="nd-item-time">
                        <Clock size={11} />
                        {timeAgo(notif.createdAt)}
                      </span>
                    </div>

                    <p className="nd-item-message">{notif.message}</p>

                    <div className="nd-item-footer">
                      {notif.triggeredBy && (
                        <span className="nd-item-author">
                          From {notif.triggeredBy.name}
                          {notif.triggeredBy.department ? ` (${notif.triggeredBy.department})` : ''}
                        </span>
                      )}
                      {notif.taskId && (
                        <span className="nd-item-task-link">
                          Open Task <ExternalLink size={11} />
                        </span>
                      )}
                    </div>
                  </div>

                  {!notif.isRead && <div className="nd-unread-dot" />}
                </div>
              ))
            )}
          </div>

          {/* Footer hint */}
          <div className="nd-footer">
            <span>Click any notification to open task details or chat</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
