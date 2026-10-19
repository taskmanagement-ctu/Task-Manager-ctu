import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Send, 
  MessageSquare, 
  User as UserIcon, 
  Users,
  Shield, 
  Building2, 
  CheckCheck,
  Check,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { api, Task, TaskComment, User } from '../services/api';
import './TaskChatDrawer.css';

interface TaskChatDrawerProps {
  task: Task | null;
  currentUser: User | null;
  isOpen: boolean;
  onClose: () => void;
  onMessageSent?: () => void;
}

const TaskChatDrawer: React.FC<TaskChatDrawerProps> = ({
  task,
  currentUser,
  isOpen,
  onClose,
  onMessageSent
}) => {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 3-Tier Hierarchy tab state for Department Admin
  const isDeptAdmin = currentUser?.role === 'department_admin';
  const isThreeTier = Boolean(
    task?.delegatedTo && 
    task?.assignedTo && 
    (task.delegatedTo._id || task.delegatedTo) !== (task.assignedTo._id || task.assignedTo)
  );
  const showTabs = isThreeTier && isDeptAdmin;
  const isSharedTeam = task?.assignmentMode === 'shared' || Boolean(task?.coAssignees && task.coAssignees.length > 1);
  const [activeTab, setActiveTab] = useState<'super_admin' | 'staff'>('super_admin');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = (smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
  };

  // Fetch comments
  const fetchComments = async (isInitial = false) => {
    if (!task?._id) return;
    try {
      if (isInitial) setLoading(true);
      const res = await api.getTaskComments(task._id);
      if (res.success) {
        setComments(res.data || []);
        if (isInitial) {
          setTimeout(() => scrollToBottom(false), 100);
        }
      }
    } catch (err: any) {
      console.error('Failed to load comments:', err);
      if (isInitial) setError('Failed to load messages.');
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  // Fetch when drawer opens or task changes
  useEffect(() => {
    if (isOpen && task?._id) {
      fetchComments(true);
      setError(null);
      // Focus input
      setTimeout(() => inputRef.current?.focus(), 250);

      // Auto-poll comments every 3.5 seconds
      const interval = setInterval(() => {
        fetchComments(false);
      }, 3500);

      return () => clearInterval(interval);
    }
  }, [isOpen, task?._id]);

  // Scroll to bottom when comments list updates or tab changes
  useEffect(() => {
    if (comments.length > 0) {
      scrollToBottom();
    }
  }, [comments.length, activeTab]);

  // Mark comments read on tab change for Dept Admin
  useEffect(() => {
    if (isOpen && task?._id && showTabs) {
      api.markTaskCommentsRead(task._id, activeTab);
    }
  }, [activeTab, isOpen, task?._id, showTabs]);

  // Auto-expand textarea height
  const adjustTextareaHeight = () => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      const scrollH = inputRef.current.scrollHeight;
      const newHeight = Math.min(scrollH, 180);
      inputRef.current.style.height = `${Math.max(newHeight, 28)}px`;
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    adjustTextareaHeight();
  };

  // Handle Send Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !task?._id || sending) return;

    const messageText = newMessage.trim();
    setSending(true);
    setError(null);

    const channelToSend = showTabs 
      ? activeTab 
      : (isThreeTier
          ? (currentUser?.role === 'super_admin' ? 'super_admin' : currentUser?.role === 'staff' ? 'staff' : 'general')
          : 'general');

    try {
      const res = await api.addTaskComment(task._id, messageText, channelToSend);
      if (res.success) {
        setComments(res.data);
        setNewMessage('');
        if (inputRef.current) {
          inputRef.current.style.height = 'auto';
        }
        scrollToBottom();
        if (onMessageSent) onMessageSent();
      }
    } catch (err: any) {
      console.error('Failed to send comment:', err);
      setError(err.message || 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // Keydown handler: Enter to send, Shift+Enter for newline
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    } else if (e.key === 'Enter' && e.shiftKey) {
      // Allow newline and expand height
      setTimeout(adjustTextareaHeight, 10);
    }
  };

  // Quick suggestion tags
  const handleQuickSuggestion = (text: string) => {
    setNewMessage(text);
    setTimeout(() => {
      adjustTextareaHeight();
      inputRef.current?.focus();
    }, 50);
  };

  if (!isOpen || !task) return null;

  // Format timestamp
  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Format relative Seen timestamp (Instagram/WhatsApp style)
  const formatSeenTime = (dateStr?: string | null) => {
    if (!dateStr) return 'Seen';
    const readTime = new Date(dateStr).getTime();
    const now = new Date().getTime();
    const diffSec = Math.max(0, Math.floor((now - readTime) / 1000));
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);

    if (diffMin < 1) return 'Seen just now';
    if (diffMin === 1) return 'Seen 1m ago';
    if (diffMin < 60) return `Seen ${diffMin}m ago`;
    if (diffHour === 1) return 'Seen 1h ago';
    if (diffHour < 24) return `Seen ${diffHour}h ago`;

    const d = new Date(dateStr);
    return `Seen on ${d.toLocaleDateString([], { day: '2-digit', month: 'short' })}`;
  };

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Today';
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';

    return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'super_admin':
        return { label: 'Super Admin', className: 'chat-role-super-admin', icon: <Shield size={10} /> };
      case 'department_admin':
        return { label: 'Dept Admin', className: 'chat-role-dept-admin', icon: <Building2 size={10} /> };
      case 'staff':
        return { label: 'Staff', className: 'chat-role-staff', icon: <UserIcon size={10} /> };
      default:
        return { label: 'Member', className: 'chat-role-member', icon: <UserIcon size={10} /> };
    }
  };

  const myId = (currentUser?._id || currentUser?.id)?.toString();
  const myUnivId = currentUser?.universityId?.toString();

  const creator: any = task.createdBy;
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const assignee: any = isSuperAdmin ? task.assignedTo : (task.delegatedTo || task.assignedTo);

  const isMeCreator = Boolean(creator && (
    (creator._id || creator.id)?.toString() === myId ||
    (creator.universityId && creator.universityId === myUnivId)
  ));

  // Filtered comments for the current tab/view
  const displayedComments = showTabs 
    ? comments.filter(c => {
        if (c.channel) return c.channel === activeTab;
        if (activeTab === 'super_admin') {
          return c.sender?.role === 'super_admin' || c.sender?.role === 'department_admin';
        } else {
          return c.sender?.role === 'staff';
        }
      })
    : comments;

  // Unread counts for tabs
  const unreadSuperAdminCount = comments.filter(c => {
    const isChannel = c.channel ? c.channel === 'super_admin' : c.sender?.role === 'super_admin';
    const isNotMe = (c.sender?._id || (c.sender as any))?.toString() !== myId;
    const isUnread = !c.readBy || !c.readBy.some((uid: any) => (uid?._id || uid)?.toString() === myId);
    return isChannel && isNotMe && isUnread;
  }).length;

  const unreadStaffCount = comments.filter(c => {
    const isChannel = c.channel ? c.channel === 'staff' : c.sender?.role === 'staff';
    const isNotMe = (c.sender?._id || (c.sender as any))?.toString() !== myId;
    const isUnread = !c.readBy || !c.readBy.some((uid: any) => (uid?._id || uid)?.toString() === myId);
    return isChannel && isNotMe && isUnread;
  }).length;

  let counterpart: any = null;
  let counterpartLabel = 'Talking with:';

  if (showTabs) {
    if (activeTab === 'super_admin') {
      counterpart = creator;
      counterpartLabel = 'Talking with Super Admin:';
    } else {
      counterpart = task.delegatedTo || (task.coAssignees && task.coAssignees[0]);
      counterpartLabel = isSharedTeam ? 'Talking with Staff Team:' : 'Talking with Staff:';
    }
  } else if (currentUser?.role === 'super_admin') {
    counterpart = task.assignedTo;
    if (isSharedTeam) {
      counterpartLabel = 'Talking with Staff Team:';
    } else {
      counterpartLabel = 'Talking with Staff:';
    }
  } else if (currentUser?.role === 'staff') {
    counterpart = task.assignedTo || creator;
    if (isSharedTeam) {
      counterpartLabel = 'Talking with Admin & Team:';
    }
  } else {
    counterpart = isMeCreator ? assignee : creator;
    if (isSharedTeam) {
      counterpartLabel = 'Talking with Staff Team:';
    }
  }

  const isTeamView = isSharedTeam && (
    activeTab === 'staff' || 
    currentUser?.role === 'staff' || 
    currentUser?.role === 'department_admin' ||
    currentUser?.role === 'super_admin'
  );

  const counterpartName = isTeamView
    ? (task.coAssignees && task.coAssignees.length > 0
        ? task.coAssignees.map((u: any) => u.name || u.universityId).join(', ')
        : (task.delegatedTo?.name || 'Staff Team'))
    : ((counterpart?.universityId === '24051' || counterpart?.email === 'vc@ctuniversity.in' || counterpart?.name?.toLowerCase().includes('nitin'))
        ? "Vice Chancellor's Office"
        : (counterpart?.name || (showTabs 
            ? (activeTab === 'super_admin' ? 'Super Admin' : (task.delegatedTo?.name || 'Staff Member'))
            : (isMeCreator ? (task.delegatedTo?.name || 'Department Admin') : 'Super Admin'))));
  const counterpartId = isTeamView ? '' : (counterpart?.universityId || counterpart?.employeeId || '');
  const counterpartRole = counterpart?.role || (showTabs
    ? (activeTab === 'super_admin' ? 'super_admin' : 'staff')
    : (isMeCreator ? 'staff' : 'super_admin'));
  const counterpartRoleBadge = isTeamView
    ? { label: 'Staff Team', className: 'chat-role-staff', icon: <Users size={10} /> }
    : getRoleBadge(counterpartRole);

  const quickSuggestions = showTabs
    ? (activeTab === 'super_admin'
        ? [
            'Sir, this task is in progress with our departmental staff.',
            'Files have been submitted for your review. Please verify.',
            'Working on this with priority, will ensure on-time delivery.',
            'Need a brief extension for compliance verification.'
          ]
        : [
            'Please submit the required documents before deadline.',
            'Format looks good, please proceed with completion upload.',
            'Please check the guidelines and revise the document.',
            'Any blockers in completing this task?'
          ]
      )
    : [
        'Sir, files have been uploaded for review. Please check.',
        'Working on this task, will submit before deadline.',
        'Need clarification regarding the required format.',
        'Understood, will complete this promptly.'
      ];

  return (
    <div className="task-chat-drawer-overlay" onClick={onClose}>
      <div className="task-chat-drawer" onClick={(e) => e.stopPropagation()}>
        {/* Top Header */}
        <div className="task-chat-header">
          <div className="task-chat-header-info">
            <div className="task-chat-badge-row">
              <span className="task-chat-id-tag">#{task.taskId || 'TASK'}</span>
              <span className={`task-chat-status-pill ${task.status}`}>
                {task.status.replace(/_/g, ' ')}
              </span>
            </div>
            <h2 className="task-chat-task-title" title={task.title}>
              {task.title}
            </h2>
            <div className="task-chat-counterpart">
              <span className="counterpart-label">{counterpartLabel}</span>
              <div className="counterpart-chip">
                {counterpartRoleBadge.icon}
                <span className="counterpart-name">
                  {counterpartName}
                  {counterpartId ? ` (${counterpartId})` : ''}
                </span>
                <span className={`chat-role-badge ${counterpartRoleBadge.className}`}>
                  {counterpartRoleBadge.label}
                </span>
              </div>
            </div>
          </div>
          
          <div className="task-chat-header-actions">
            <button 
              className="task-chat-icon-btn" 
              onClick={() => fetchComments(true)} 
              title="Refresh messages"
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? 'spinning' : ''} />
            </button>
            <button className="task-chat-close-btn" onClick={onClose} title="Close Chat">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 3-Tier Chat Tabs for Department Admin */}
        {showTabs && (
          <div className="task-chat-tabs">
            <button 
              type="button"
              className={`task-chat-tab-btn ${activeTab === 'super_admin' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('super_admin');
                setTimeout(() => scrollToBottom(false), 50);
              }}
            >
              <Shield size={14} />
              <span>Super Admin ({creator?.name ? creator.name.split(' ')[0] : 'Admin'})</span>
              {unreadSuperAdminCount > 0 && (
                <span className="task-chat-tab-badge">{unreadSuperAdminCount}</span>
              )}
            </button>
            <button 
              type="button"
              className={`task-chat-tab-btn ${activeTab === 'staff' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('staff');
                setTimeout(() => scrollToBottom(false), 50);
              }}
            >
              {isSharedTeam ? <Users size={14} /> : <UserIcon size={14} />}
              <span>
                {isSharedTeam 
                  ? `Staff Team (${task.coAssignees?.length || 2})` 
                  : `Staff (${task.delegatedTo?.name ? task.delegatedTo.name.split(' ')[0] : 'Staff'})`}
              </span>
              {unreadStaffCount > 0 && (
                <span className="task-chat-tab-badge">{unreadStaffCount}</span>
              )}
            </button>
          </div>
        )}

        {/* Quick Help Banner */}
        <div className="task-chat-context-banner">
          <MessageSquare size={13} className="banner-icon" />
          <span>
            {showTabs 
              ? (activeTab === 'super_admin' 
                  ? 'Private thread with Super Admin (Staff cannot see this).' 
                  : (isSharedTeam 
                      ? 'Collaborative group chat with Dept Admin and all co-assigned staff (Super Admin cannot see this).' 
                      : `Internal thread with ${task.delegatedTo?.name || 'Staff'} (Super Admin cannot see this).`))
              : (isSharedTeam
                  ? 'Collaborative team discussion. All co-assigned staff and admin can participate.'
                  : 'Task-specific direct discussion.')}
          </span>
        </div>

        {/* Chat Messages Body */}
        <div className="task-chat-body">
          {loading ? (
            <div className="task-chat-loading-state">
              <RefreshCw size={24} className="spinning" />
              <p>Loading discussion...</p>
            </div>
          ) : displayedComments.length === 0 ? (
            <div className="task-chat-empty-state">
              <div className="empty-icon-circle">
                <MessageSquare size={28} />
              </div>
              <h3>No Messages in this Thread</h3>
              <p>
                {showTabs && activeTab === 'super_admin'
                  ? 'Discuss task progress or questions directly with Super Admin.'
                  : showTabs && activeTab === 'staff'
                  ? `Give instructions or updates directly to ${task.delegatedTo?.name || 'Staff'}.`
                  : 'Have questions or updates regarding this task? Start the discussion below.'}
              </p>
              
              <div className="task-chat-quick-suggestions">
                <div className="suggestion-label">
                  <Sparkles size={12} /> Quick Messages:
                </div>
                {quickSuggestions.map((text, idx) => (
                  <button 
                    key={idx}
                    className="suggestion-pill"
                    onClick={() => handleQuickSuggestion(text)}
                  >
                    "{text}"
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="task-chat-message-list">
              {displayedComments.map((msg, index) => {
                const myId = (currentUser?._id || currentUser?.id)?.toString();
                const myUnivId = currentUser?.universityId?.toString();
                const myEmail = currentUser?.email?.toLowerCase();

                const senderObj: any = typeof msg.sender === 'object' && msg.sender !== null ? msg.sender : null;
                const senderId = (senderObj?._id || senderObj?.id || msg.sender)?.toString();
                const senderUnivId = senderObj?.universityId?.toString();
                const senderEmail = senderObj?.email?.toLowerCase();

                const isMe = Boolean(
                  (myId && senderId && myId === senderId) ||
                  (myUnivId && senderUnivId && myUnivId === senderUnivId) ||
                  (myEmail && senderEmail && myEmail === senderEmail)
                );

                const isSeenByOther = Boolean(
                  msg.readAt ||
                  (msg.readBy && msg.readBy.some((uid: any) => {
                    const readerId = (uid?._id || uid?.id || uid)?.toString();
                    return readerId && readerId !== myId;
                  }))
                );

                const isLastMyMessage = isMe && (
                  index === displayedComments.length - 1 ||
                  !displayedComments.slice(index + 1).some(m => {
                    const mSender: any = m.sender;
                    const mSenderId = (mSender?._id || mSender?.id || m.sender)?.toString();
                    return mSenderId === myId;
                  })
                );

                // Check if date separator is needed
                const showDate = index === 0 || formatDateLabel(displayedComments[index - 1].createdAt) !== formatDateLabel(msg.createdAt);

                return (
                  <React.Fragment key={msg._id || index}>
                    {showDate && (
                      <div className="chat-date-separator">
                        <span>{formatDateLabel(msg.createdAt)}</span>
                      </div>
                    )}
                    <div className={`chat-message-row ${isMe ? 'my-message' : 'other-message'}`}>
                      {!isMe && (
                        <div className="chat-avatar" title={msg.sender?.name || 'Member'}>
                          <img 
                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(msg.sender?.name || 'U')}&background=0284c7&color=ffffff&size=64`} 
                            alt="avatar" 
                          />
                        </div>
                      )}
                      <div className="chat-bubble-container">
                        {!isMe && (
                          <div className="chat-sender-header">
                            <span className="chat-sender-name">
                              {senderObj?.name || 'User'}
                              {(senderObj?.universityId || senderObj?.employeeId) && (
                                <span className="chat-sender-id"> ({senderObj?.universityId || senderObj?.employeeId})</span>
                              )}
                            </span>
                          </div>
                        )}

                        <div className="chat-bubble">
                          <p className="chat-text">{msg.message}</p>
                          <div className="chat-meta">
                            <span className="chat-time">{formatTime(msg.createdAt)}</span>
                          </div>
                        </div>

                        {/* Instagram-style Seen Indicator */}
                        {isMe && isLastMyMessage && (
                          <div className={`chat-seen-indicator ${isSeenByOther ? 'seen' : 'delivered'}`}>
                            {isSeenByOther ? (
                              <>
                                <CheckCheck size={12} className="seen-check-icon" />
                                <span>{formatSeenTime(msg.readAt)}</span>
                              </>
                            ) : (
                              <>
                                <Check size={11} className="delivered-check-icon" />
                                <span>Delivered</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="task-chat-error-toast">
            <span>{error}</span>
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {/* Bottom Input Area */}
        <div className="task-chat-footer">
          <form className="task-chat-input-form" onSubmit={handleSendMessage}>
            <textarea
              ref={inputRef}
              className="task-chat-textarea"
              placeholder={showTabs 
                ? (activeTab === 'super_admin' ? 'Message Super Admin... (Enter to send)' : `Message ${task.delegatedTo?.name ? task.delegatedTo.name.split(' ')[0] : 'Staff'}... (Enter to send)`)
                : 'Type a message... (Enter to send, Shift+Enter for newline)'
              }
              value={newMessage}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={sending}
            />
            <button 
              type="submit" 
              className="task-chat-send-btn" 
              disabled={!newMessage.trim() || sending}
              title="Send Message"
            >
              {sending ? <RefreshCw size={16} className="spinning" /> : <Send size={16} />}
            </button>
          </form>
          <div className="task-chat-shortcuts">
            <span>Press <strong>Enter ↵</strong> to send</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskChatDrawer;
