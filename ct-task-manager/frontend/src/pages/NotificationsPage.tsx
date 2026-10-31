import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Bell,
  CheckCircle2,
  XCircle,
  Star,
  MessageSquare,
  FileText,
  ArrowRight,
  ListChecks,
  CheckCheck,
  Clock,
  Filter,
  AlertCircle,
  Send,
  UserCheck
} from 'lucide-react';
import './NotificationsPage.css';

interface Notification {
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

const NotificationsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const filterParam = filter === 'all' ? undefined : filter;
      const res = await api.getNotifications({ page, limit: 20, filter: filterParam });
      if (res.success) {
        setNotifications(res.data);
        setTotalPages(res.pagination.totalPages);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await api.getUnreadNotificationCount();
      if (res.success) {
        setUnreadCount(res.count);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, [fetchNotifications, fetchUnreadCount]);

  const getBasePath = () => {
    if (currentUser?.role === 'super_admin') return '/super-admin';
    if (currentUser?.role === 'department_admin') return '/admin';
    return '/staff';
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.isRead) {
      try {
        await api.markNotificationRead(notification._id);
        setNotifications(prev =>
          prev.map(n => n._id === notification._id ? { ...n, isRead: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (error) {
        console.error('Error marking notification read:', error);
      }
    }

    // Navigate to task
    if (notification.taskId?._id) {
      const basePath = getBasePath();
      navigate(`${basePath}/tasks?openTask=${notification.taskId._id}${notification.type === 'new_chat_message' ? '&openChat=true' : ''}`);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications read:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'task_assigned':
        return <FileText size={20} />;
      case 'task_delegated':
        return <UserCheck size={20} />;
      case 'task_status_changed':
        return <ArrowRight size={20} />;
      case 'task_submitted_for_review':
        return <Send size={20} />;
      case 'task_approved':
        return <CheckCircle2 size={20} />;
      case 'task_rejected':
        return <XCircle size={20} />;
      case 'task_rated':
        return <Star size={20} />;
      case 'new_chat_message':
        return <MessageSquare size={20} />;
      case 'task_due_soon':
        return <Clock size={20} />;
      case 'task_overdue':
        return <AlertCircle size={20} />;
      default:
        return <Bell size={20} />;
    }
  };

  const getNotificationIconClass = (type: string) => {
    switch (type) {
      case 'task_assigned':
      case 'task_delegated':
        return 'notif-icon-blue';
      case 'task_status_changed':
      case 'task_due_soon':
        return 'notif-icon-amber';
      case 'task_submitted_for_review':
        return 'notif-icon-purple';
      case 'task_approved':
        return 'notif-icon-green';
      case 'task_rejected':
      case 'task_overdue':
        return 'notif-icon-red';
      case 'task_rated':
        return 'notif-icon-gold';
      case 'new_chat_message':
        return 'notif-icon-cyan';
      default:
        return 'notif-icon-default';
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

  const filterTabs = [
    { key: 'all', label: 'All', icon: <ListChecks size={16} /> },
    { key: 'unread', label: 'Unread', icon: <AlertCircle size={16} /> },
    { key: 'tasks', label: 'Tasks', icon: <FileText size={16} /> },
    { key: 'chat', label: 'Chat', icon: <MessageSquare size={16} /> }
  ];

  return (
    <div className="notifications-page">
      {/* Header */}
      <div className="notif-header">
        <div className="notif-header-left">
          <div className="notif-header-icon">
            <Bell size={24} />
            {unreadCount > 0 && (
              <span className="notif-header-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </div>
          <div>
            <h1 className="notif-title">Notifications</h1>
            <p className="notif-subtitle">
              {unreadCount > 0
                ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
                : 'You\'re all caught up!'}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <button className="notif-mark-all-btn" onClick={handleMarkAllRead}>
            <CheckCheck size={16} />
            Mark All Read
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="notif-filter-bar">
        <Filter size={16} className="notif-filter-icon" />
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            className={`notif-filter-tab ${filter === tab.key ? 'active' : ''}`}
            onClick={() => { setFilter(tab.key); setPage(1); }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notification List */}
      <div className="notif-list">
        {loading ? (
          <div className="notif-loading">
            <div className="notif-loading-spinner"></div>
            <p>Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="notif-empty">
            <div className="notif-empty-icon">
              <Bell size={48} />
            </div>
            <h3>No notifications</h3>
            <p>
              {filter === 'unread'
                ? 'No unread notifications. You\'re all caught up!'
                : filter === 'tasks'
                  ? 'No task notifications yet.'
                  : filter === 'chat'
                    ? 'No chat notifications yet.'
                    : 'When someone interacts with your tasks, you\'ll see it here.'}
            </p>
          </div>
        ) : (
          <>
            {notifications.map((notif) => (
              <div
                key={notif._id}
                className={`notif-card ${!notif.isRead ? 'unread' : ''}`}
                onClick={() => handleNotificationClick(notif)}
              >
                <div className={`notif-card-icon ${getNotificationIconClass(notif.type)}`}>
                  {getNotificationIcon(notif.type)}
                </div>
                <div className="notif-card-content">
                  <div className="notif-card-top">
                    <span className="notif-card-title">{notif.title}</span>
                    <span className="notif-card-time">
                      <Clock size={12} />
                      {timeAgo(notif.createdAt)}
                    </span>
                  </div>
                  <p className="notif-card-message">{notif.message}</p>
                  {notif.triggeredBy && (
                    <span className="notif-card-from">
                      by {notif.triggeredBy.name}
                      {notif.triggeredBy.department ? ` • ${notif.triggeredBy.department}` : ''}
                    </span>
                  )}
                </div>
                {!notif.isRead && <div className="notif-unread-dot" />}
              </div>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="notif-pagination">
                <button
                  className="notif-page-btn"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  ← Previous
                </button>
                <span className="notif-page-info">
                  Page {page} of {totalPages}
                </span>
                <button
                  className="notif-page-btn"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
