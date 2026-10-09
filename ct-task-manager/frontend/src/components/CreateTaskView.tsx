import React, { useState, useRef, useEffect } from 'react';
import { History, Clock, UploadCloud, Plus, ArrowRight, ChevronDown, ArrowLeft, X, Search, Building2 } from 'lucide-react';
import { api } from '../services/api';
import './CreateTaskView.css';

// Auto-compress image files to ~500KB max
const compressImage = (file: File, maxSizeKB: number = 500): Promise<File> => {
  return new Promise((resolve) => {
    // Only compress image files
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }
    // If already small enough, skip
    if (file.size <= maxSizeKB * 1024) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // Scale down if very large
        const maxDimension = 1920;
        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);

        // Try progressively lower quality
        let quality = 0.8;
        const tryCompress = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) { resolve(file); return; }
              if (blob.size > maxSizeKB * 1024 && quality > 0.1) {
                quality -= 0.1;
                tryCompress();
              } else {
                const compressed = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressed);
              }
            },
            'image/jpeg',
            quality
          );
        };
        tryCompress();
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

const compressFiles = async (files: File[]): Promise<File[]> => {
  return Promise.all(files.map(f => compressImage(f)));
};

interface CreateTaskViewProps {
  onSubmit: (taskData: any) => Promise<void>;
  onCancel: () => void;
  availableAssignees: any[];
  departments?: any[];
  preselectedParentTask?: string | null;
  currentUser?: any;
}

const CreateTaskView: React.FC<CreateTaskViewProps> = ({ onSubmit, onCancel, availableAssignees, departments = [], preselectedParentTask, currentUser }) => {
  const [loading, setLoading] = useState(false);
  const [isSubtaskMode, setIsSubtaskMode] = useState(!!preselectedParentTask);
  const [parentTaskId, setParentTaskId] = useState(preselectedParentTask || '');
  
  const [tasksToCreate, setTasksToCreate] = useState<Array<{
    title: string;
    description: string;
    deadline: string;
    assignedTo: string[];
    files: File[];
    requiredExtensions: string[];
  }>>([
    {
      title: '',
      description: '',
      deadline: '',
      assignedTo: [],
      files: [],
      requiredExtensions: []
    }
  ]);
  const [activeTab, setActiveTab] = useState(0);

  const availableExtensions = ['.pdf', '.docx', '.xlsx', '.pptx', '.csv', '.jpg', '.png', '.zip'];
  
  const toggleExtension = (ext: string) => {
    setTasksToCreate(prev => {
      const newTasks = [...prev];
      const task = { ...newTasks[activeTab] };
      task.requiredExtensions = task.requiredExtensions.includes(ext) 
        ? task.requiredExtensions.filter(e => e !== ext)
        : [...task.requiredExtensions, ext];
      newTasks[activeTab] = task;
      return newTasks;
    });
  };

  const [mainTasks, setMainTasks] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [isAssignDropdownOpen, setIsAssignDropdownOpen] = useState(false);
  const [isChipsExpanded, setIsChipsExpanded] = useState(false);
  const [assignSearchQuery, setAssignSearchQuery] = useState('');
  const [assignRoleFilter, setAssignRoleFilter] = useState<'all' | 'team' | 'admin' | 'staff'>('all');
  const [assignDeptFilter, setAssignDeptFilter] = useState<string>('all');
  const [departmentList, setDepartmentList] = useState<string[]>([]);
  const assignDropdownRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load / build department list for filtering
  useEffect(() => {
    const updateDeptList = async () => {
      let depts: string[] = [];
      if (departments && departments.length > 0) {
        depts = departments.map(d => typeof d === 'string' ? d : d.name).filter(Boolean);
      } else if (currentUser?.role === 'super_admin') {
        try {
          const res = await api.getDepartments();
          if (res.success && res.data?.departments) {
            depts = res.data.departments.map((d: any) => d.name).filter(Boolean);
          }
        } catch (err) {
          console.error('Failed to load departments', err);
        }
      }
      const assigneeDepts = availableAssignees.map(a => a.department).filter(Boolean);
      const unique = Array.from(new Set([...depts, ...assigneeDepts])).sort((a, b) => a.localeCompare(b));
      setDepartmentList(unique);
    };

    updateDeptList();
  }, [departments, availableAssignees, currentUser]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (assignDropdownRef.current && !assignDropdownRef.current.contains(event.target as Node)) {
        setIsAssignDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchMainTasks = async () => {
      try {
        const res = await api.getTasks({ taskType: 'main', limit: 1000 });
        setMainTasks(res.data.tasks || []);
      } catch (error) {
        console.error('Failed to fetch main tasks:', error);
      }
    };
    fetchMainTasks();
  }, []);

  // Helpers for multi-assignee selection
  const currentAssignedIds: string[] = Array.isArray(tasksToCreate[activeTab]?.assignedTo)
    ? (tasksToCreate[activeTab]?.assignedTo as string[])
    : (tasksToCreate[activeTab]?.assignedTo ? [tasksToCreate[activeTab]?.assignedTo as string] : []);

  const toggleAssignee = (userId: string) => {
    setTasksToCreate(prev => {
      const copy = [...prev];
      const cur = { ...copy[activeTab] };
      const list = Array.isArray(cur.assignedTo) ? [...cur.assignedTo] : (cur.assignedTo ? [cur.assignedTo] : []);
      const idx = list.indexOf(userId);
      if (idx >= 0) {
        list.splice(idx, 1);
      } else {
        list.push(userId);
      }
      cur.assignedTo = list;
      copy[activeTab] = cur;
      return copy;
    });
  };

  const clearAssignees = () => {
    setTasksToCreate(prev => {
      const copy = [...prev];
      const cur = { ...copy[activeTab] };
      cur.assignedTo = [];
      copy[activeTab] = cur;
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const forms = tasksToCreate.map(task => {
        const formData = new FormData();
        formData.append('title', task.title);
        formData.append('description', task.description);
        formData.append('deadline', task.deadline);
        formData.append('isSubtask', String(isSubtaskMode));
        if (isSubtaskMode && parentTaskId) {
          formData.append('parentTaskId', parentTaskId);
        }
        const assignees = Array.isArray(task.assignedTo)
          ? task.assignedTo
          : (task.assignedTo ? [task.assignedTo] : []);

        if (assignees.length > 0) {
          assignees.forEach(id => {
            formData.append('assignedTo', id);
          });
        }
        task.files.forEach(file => {
          formData.append('attachments', file);
        });
        formData.append('requiredCompletionExtensions', JSON.stringify(task.requiredExtensions));
        return formData;
      });

      await onSubmit(isSubtaskMode ? forms : forms[0]);
    } finally {
      setLoading(false);
    }
  };

  const filteredMainTasks = mainTasks.filter(mt => {
    const q = searchQuery.toLowerCase();
    return (mt.taskId && mt.taskId.toLowerCase().includes(q)) || 
           (mt.title && mt.title.toLowerCase().includes(q));
  });

  const selectedTask = mainTasks.find(mt => mt._id === parentTaskId);

  const formatNameString = (userObj: any) => {
    if (!userObj) return 'Unassigned';
    const isMe = currentUser && (userObj._id === currentUser.id || userObj.id === currentUser.id);
    const name = isMe ? 'me' : userObj.name;
    const staffId = userObj.universityId ? ` (ID: ${userObj.universityId})` : '';
    const dept = userObj.isSuperAdminTeamMember ? ' • Super Admin Team' : (userObj.department ? ` • ${userObj.department}` : '');
    return `${name}${staffId}${dept}`;
  };

  const filteredAssignees = availableAssignees.filter(a => {
    // Role / Team filter
    if (assignRoleFilter === 'team') {
      if (!a.isSuperAdminTeamMember) return false;
    } else {
      if (assignRoleFilter === 'admin' && !a.role?.includes('admin')) return false;
      if (assignRoleFilter === 'staff' && a.role !== 'staff') return false;
      
      // Department filter (only applies when not in My Team)
      if (currentUser?.role === 'super_admin' && assignDeptFilter !== 'all') {
        if (!a.department || a.department.trim().toLowerCase() !== assignDeptFilter.trim().toLowerCase()) {
          return false;
        }
      }
    }

    // Search query filter
    if (assignSearchQuery) {
      const q = assignSearchQuery.toLowerCase();
      return (a.name && a.name.toLowerCase().includes(q)) || 
             (a.role && a.role.toLowerCase().includes(q)) || 
             (a.department && a.department.toLowerCase().includes(q)) ||
             (a.universityId && a.universityId.toLowerCase().includes(q));
    }
    return true;
  });

  const selectedAssignees = availableAssignees.filter(a =>
    currentAssignedIds.includes(a.id || a._id)
  );

  const isAllFilteredSelected = filteredAssignees.length > 0 && filteredAssignees.every(a => currentAssignedIds.includes(a.id || a._id));

  const selectAllFiltered = () => {
    setTasksToCreate(prev => {
      const copy = [...prev];
      const cur = { ...copy[activeTab] };
      const currentSet = new Set(Array.isArray(cur.assignedTo) ? cur.assignedTo : (cur.assignedTo ? [cur.assignedTo] : []));
      
      if (isAllFilteredSelected) {
        filteredAssignees.forEach(a => currentSet.delete(a.id || a._id));
      } else {
        filteredAssignees.forEach(a => currentSet.add(a.id || a._id));
      }
      cur.assignedTo = Array.from(currentSet);
      copy[activeTab] = cur;
      return copy;
    });
  };

  return (
    <div className="create-task-view">
      <div className="ct-header">
        <div className="ct-title-area">
          <button type="button" className="ct-back-btn" onClick={onCancel}>
            <ArrowLeft size={16} /> Back to Tasks
          </button>
          <h1>Create Task</h1>
          <p>Deploy new administrative or faculty assignments.</p>
        </div>
        <button className="ct-recent-btn">
          <History size={16} /> RECENT ACTIVITY
        </button>
      </div>

      <form className="ct-content-grid" onSubmit={handleSubmit}>
        
        {/* Left Form Section */}
        <div className="ct-form-section">
          
          <label className="ct-label">TASK CLASSIFICATION</label>
          <div className="ct-classification">
            <button 
              type="button"
              className={`ct-class-btn ${!isSubtaskMode ? 'active' : ''}`}
              onClick={() => setIsSubtaskMode(false)}
            >
              Main Task
            </button>
            <button 
              type="button"
              className={`ct-class-btn ${isSubtaskMode ? 'active' : ''}`}
              onClick={() => setIsSubtaskMode(true)}
            >
              Subtask
            </button>
          </div>

          {isSubtaskMode && (
            <div className="ct-subtask-tabs-container">
              <div className="ct-subtask-tabs">
                {tasksToCreate.map((task, idx) => (
                  <div 
                    key={idx} 
                    className={`ct-subtask-tab ${activeTab === idx ? 'active' : ''}`}
                    onClick={() => setActiveTab(idx)}
                  >
                    <span>
                      {task.title || `Subtask ${idx + 1}`}
                    </span>
                    {tasksToCreate.length > 1 && (
                      <button 
                        type="button"
                        className="ct-tab-close"
                        onClick={(e) => {
                          e.stopPropagation();
                          const n = tasksToCreate.filter((_, i) => i !== idx);
                          setTasksToCreate(n);
                          if (activeTab >= n.length) setActiveTab(n.length - 1);
                        }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
                <button 
                  type="button" 
                  className="ct-add-tab-btn"
                  onClick={() => {
                    setTasksToCreate([...tasksToCreate, {
                      title: '', description: '', deadline: '', assignedTo: [], files: [], requiredExtensions: []
                    }]);
                    setActiveTab(tasksToCreate.length);
                  }}
                  title="Add another subtask"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          )}

          {isSubtaskMode && (
            <div className="ct-input-group" ref={dropdownRef}>
              <label className="ct-label">SELECT PARENT TASK</label>
              <div className="ct-custom-select-wrapper">
                <div 
                  className={`ct-custom-select ${isDropdownOpen ? 'open' : ''}`}
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  {selectedTask ? `#${selectedTask.taskId} - ${selectedTask.title}` : <span className="placeholder">Select a main task...</span>}
                  <ChevronDown className="ct-select-icon" size={16} />
                </div>
                
                {isDropdownOpen && (
                  <div className="ct-dropdown-menu">
                    <div className="ct-dropdown-search">
                      <Search size={14} className="ct-search-icon" />
                      <input 
                        type="text" 
                        placeholder="Search ID or Title..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                    </div>
                    <ul className="ct-dropdown-list">
                      <li 
                        className={`ct-dropdown-item ${!parentTaskId ? 'selected' : ''}`}
                        onClick={() => {
                          setParentTaskId('');
                          setIsDropdownOpen(false);
                        }}
                      >
                        None
                      </li>
                      {filteredMainTasks.length === 0 && (
                        <li className="ct-dropdown-item empty">No tasks found</li>
                      )}
                      {filteredMainTasks.map(mt => (
                        <li 
                          key={mt._id}
                          className={`ct-dropdown-item ${parentTaskId === mt._id ? 'selected' : ''}`}
                          onClick={() => {
                            setParentTaskId(mt._id);
                            setIsDropdownOpen(false);
                            setSearchQuery('');
                          }}
                        >
                          <span className="ct-dropdown-task-id">#{mt.taskId}</span>
                          <span className="ct-dropdown-task-title">{mt.title}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              {/* Hidden input for HTML5 validation if needed */}
              <input type="hidden" required={isSubtaskMode} value={parentTaskId} />
            </div>
          )}

          <div className="ct-input-group">
            <label className="ct-label">TASK TITLE</label>
            <input 
              type="text" 
              className="ct-title-input" 
              placeholder="e.g., Finalize Q3 Departmental Budget" 
              required
              value={tasksToCreate[activeTab].title}
              onChange={e => setTasksToCreate(prev => { const n = [...prev]; const t = {...n[activeTab]}; t.title = e.target.value; n[activeTab] = t; return n; })}
            />
          </div>

          <div className="ct-input-group">
            <label className="ct-label">DESCRIPTION</label>
            <textarea 
              className="ct-desc-input" 
              placeholder="Detailed requirements and context for the assignee..."
              required
              value={tasksToCreate[activeTab].description}
              onChange={e => setTasksToCreate(prev => { const n = [...prev]; const t = {...n[activeTab]}; t.description = e.target.value; n[activeTab] = t; return n; })}
            />
          </div>

          <div className="ct-row">
            <div className="ct-input-group">
              <div className="ct-label-between">
                <label className="ct-label">ASSIGN TO</label>
                {currentAssignedIds.length > 0 && (
                  <span className="ct-assignee-counter-tag">
                    {currentAssignedIds.length} {currentAssignedIds.length === 1 ? 'person' : 'people'} selected
                  </span>
                )}
              </div>
              <div className="ct-custom-select-wrapper" ref={assignDropdownRef}>
                <div 
                  className={`ct-custom-select ct-multi-select ${isAssignDropdownOpen ? 'open' : ''}`}
                  onClick={() => setIsAssignDropdownOpen(!isAssignDropdownOpen)}
                >
                  {selectedAssignees.length === 0 ? (
                    <span className="placeholder">Unassigned (Click to select assignees)</span>
                  ) : (
                    <div className="ct-selected-chips-container">
                      {(isChipsExpanded ? selectedAssignees : selectedAssignees.slice(0, 2)).map(u => (
                        <span key={u._id || u.id} className="ct-selected-chip" title={formatNameString(u)} onClick={(e) => e.stopPropagation()}>
                          <span className="ct-chip-name">{currentUser && ((u._id || u.id) === currentUser.id || (u._id || u.id) === currentUser._id) ? 'me' : u.name}</span>
                          {u.universityId && <span className="ct-chip-id">({u.universityId})</span>}
                          <button
                            type="button"
                            className="ct-chip-remove"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleAssignee(u._id || u.id);
                            }}
                            title="Remove assignee"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                      {selectedAssignees.length > 2 && (
                        isChipsExpanded ? (
                          <button
                            type="button"
                            className="ct-selected-count-badge clickable collapse-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsChipsExpanded(false);
                            }}
                            title="Click to collapse"
                          >
                            Show less ▴
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="ct-selected-count-badge clickable"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsChipsExpanded(true);
                            }}
                            title="Click to view all selected assignees"
                          >
                            +{selectedAssignees.length - 2} more
                          </button>
                        )
                      )}
                    </div>
                  )}
                  <ChevronDown className="ct-select-icon" size={16} />
                </div>
                
                {isAssignDropdownOpen && (
                  <div className="ct-dropdown-menu">
                    <div className="ct-dropdown-search-container">
                      <div className="ct-dropdown-search">
                        <Search size={14} className="ct-search-icon" />
                        <input 
                          type="text" 
                          placeholder="Search users..." 
                          value={assignSearchQuery}
                          onChange={(e) => setAssignSearchQuery(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                      </div>
                      
                      {currentUser?.role === 'super_admin' && (
                        <div className="ct-dropdown-filter-controls">
                          <div className="ct-dept-filter-wrapper">
                            <Building2 size={13} className="ct-dept-filter-icon" />
                            <select 
                              className="ct-dept-filter-select"
                              value={assignRoleFilter === 'team' ? 'all' : assignDeptFilter}
                              onChange={(e) => {
                                e.stopPropagation();
                                setAssignDeptFilter(e.target.value);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              disabled={assignRoleFilter === 'team'}
                              style={assignRoleFilter === 'team' ? { opacity: 0.55, cursor: 'not-allowed', backgroundColor: '#f1f5f9' } : {}}
                              title={assignRoleFilter === 'team' ? 'Department filter is disabled for My Team' : undefined}
                            >
                              <option value="all">
                                {assignRoleFilter === 'team' ? 'Department: N/A (My Team)' : `All Departments (${availableAssignees.length})`}
                              </option>
                              {assignRoleFilter !== 'team' && departmentList.map(dept => {
                                const count = availableAssignees.filter(a => a.department && a.department.toLowerCase() === dept.toLowerCase()).length;
                                return (
                                  <option key={dept} value={dept}>
                                    {dept} {count > 0 ? `(${count})` : ''}
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          <div className="ct-role-filters">
                            <button 
                              type="button"
                              className={`ct-role-filter-btn ${assignRoleFilter === 'all' ? 'active' : ''}`}
                              onClick={(e) => { e.stopPropagation(); setAssignRoleFilter('all'); }}
                            >All</button>
                            <button 
                              type="button"
                              className={`ct-role-filter-btn ${assignRoleFilter === 'team' ? 'active' : ''}`}
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setAssignRoleFilter('team'); 
                                setAssignDeptFilter('all'); 
                              }}
                            >My Team</button>
                            <button 
                              type="button"
                              className={`ct-role-filter-btn ${assignRoleFilter === 'admin' ? 'active' : ''}`}
                              onClick={(e) => { e.stopPropagation(); setAssignRoleFilter('admin'); }}
                            >Admins</button>
                            <button 
                              type="button"
                              className={`ct-role-filter-btn ${assignRoleFilter === 'staff' ? 'active' : ''}`}
                              onClick={(e) => { e.stopPropagation(); setAssignRoleFilter('staff'); }}
                            >Staff</button>
                          </div>
                        </div>
                      )}

                      {/* Multi-Select Toolbar */}
                      <div className="ct-dropdown-toolbar">
                        <span className="ct-dropdown-toolbar-count">{filteredAssignees.length} matching users</span>
                        {filteredAssignees.length > 0 && (
                          <button
                            type="button"
                            className="ct-quick-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectAllFiltered();
                            }}
                          >
                            {isAllFilteredSelected ? 'Deselect Filtered' : 'Select All Filtered'}
                          </button>
                        )}
                      </div>
                    </div>

                    <ul className="ct-dropdown-list">
                      <li 
                        className={`ct-dropdown-item ${currentAssignedIds.length === 0 ? 'selected' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          clearAssignees();
                        }}
                      >
                        <input
                          type="checkbox"
                          className="ct-checkbox"
                          checked={currentAssignedIds.length === 0}
                          readOnly
                        />
                        <span className="placeholder">Unassigned (Clear all assignees)</span>
                      </li>
                      {filteredAssignees.length === 0 && (
                        <li className="ct-dropdown-item empty">No users found</li>
                      )}
                      {filteredAssignees.map(a => {
                        const userId = a.id || a._id;
                        const isSelected = currentAssignedIds.includes(userId);
                        return (
                          <li 
                            key={userId}
                            className={`ct-dropdown-item ${isSelected ? 'selected' : ''} ct-assignee-item`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleAssignee(userId);
                            }}
                          >
                            <input
                              type="checkbox"
                              className="ct-checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="ct-assignee-info">
                              <div className="ct-assignee-primary">
                                <span className="ct-assignee-name">{currentUser && (userId === currentUser.id || userId === currentUser._id) ? 'me' : a.name}</span>
                                {a.isSuperAdminTeamMember && (
                                  <span className="ct-role-tag" style={{ background: '#eff6ff', color: '#2563eb', borderColor: '#bfdbfe' }}>
                                    Team
                                  </span>
                                )}
                                {a.role?.includes('admin') && <span className="ct-role-tag admin">Admin</span>}
                                {a.role === 'staff' && !a.isSuperAdminTeamMember && <span className="ct-role-tag staff">Staff</span>}
                              </div>
                              <span className="ct-assignee-dept">
                                {a.isSuperAdminTeamMember ? 'Super Admin Team' : (a.department || '')}
                              </span>
                            </div>
                            <span className="ct-assignee-role">ID: {a.universityId || 'N/A'}</span>
                          </li>
                        );
                      })}
                    </ul>

                    <div className="ct-dropdown-footer">
                      <div className="ct-dropdown-footer-left">
                        <span className="ct-dropdown-footer-text">
                          {currentAssignedIds.length} {currentAssignedIds.length === 1 ? 'assignee' : 'assignees'} chosen
                        </span>
                        {currentAssignedIds.length > 0 && (
                          <button
                            type="button"
                            className="ct-footer-clear-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              clearAssignees();
                            }}
                          >
                            Clear all
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        className="ct-dropdown-done-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsAssignDropdownOpen(false);
                          setAssignSearchQuery('');
                        }}
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="ct-input-group">
              <label className="ct-label">DEADLINE</label>
              <input 
                type="datetime-local" 
                className="ct-date" 
                required
                value={tasksToCreate[activeTab].deadline}
                onChange={e => setTasksToCreate(prev => { const n = [...prev]; const t = {...n[activeTab]}; t.deadline = e.target.value; n[activeTab] = t; return n; })}
              />
            </div>
          </div>
        </div>

        {/* Right Sidebar Section */}
        <div className="ct-sidebar">
          
          <label className="ct-label" style={{ marginBottom: '1rem' }}>PRIORITY PREVIEW</label>
          <div className="ct-info-card">
            <div className="ct-info-icon">
              <Clock size={20} />
            </div>
            <div className="ct-info-text">
              <h4>Set deadline</h4>
              <p>Priority is automatically calculated based on the due date.</p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <label className="ct-label" style={{ margin: 0 }}>SUPPORTING MATERIALS</label>
            <Plus size={16} color="#64748b" />
          </div>
          
          <div className="ct-upload-area" onClick={() => fileInputRef.current?.click()}>
            <UploadCloud size={24} />
            <p>Drag and drop files or click<br/>to browse</p>
            <input 
              type="file" 
              multiple 
              style={{ display: 'none' }} 
              ref={fileInputRef}
              onChange={async (e) => {
                if (e.target.files) {
                  const rawFiles = Array.from(e.target.files!);
                  const compressed = await compressFiles(rawFiles);
                  setTasksToCreate(prev => {
                    const n = [...prev];
                    const task = { ...n[activeTab] };
                    task.files = compressed;
                    n[activeTab] = task;
                    return n;
                  });
                }
              }}
            />
          </div>
          {tasksToCreate[activeTab].files.length > 0 && (
            <div className="ct-files-list">
              {tasksToCreate[activeTab].files.map((file, i) => (
                <div key={i} className="ct-file-item">
                  <span className="ct-file-name">{file.name}</span>
                  <button type="button" onClick={(e) => { 
                    e.stopPropagation(); 
                    setTasksToCreate(prev => {
                      const n = [...prev];
                      const task = { ...n[activeTab] };
                      task.files = task.files.filter((_, idx) => idx !== i);
                      n[activeTab] = task;
                      return n;
                    });
                  }}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <label className="ct-label" style={{ marginTop: '2rem', marginBottom: '1rem' }}>REQUIRED COMPLETION FORMATS</label>
          <div className="ct-extensions-grid">
            {availableExtensions.map(ext => (
              <button
                key={ext}
                type="button"
                className={`ct-ext-btn ${tasksToCreate[activeTab].requiredExtensions.includes(ext) ? 'active' : ''}`}
                onClick={() => toggleExtension(ext)}
              >
                {ext}
              </button>
            ))}
          </div>
          
        </div>

        {/* Footer Actions */}
        <div className="ct-actions">
          <button type="button" className="ct-btn-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="ct-btn-submit" disabled={loading}>
            Create Task{tasksToCreate.length > 1 ? 's' : ''} <ArrowRight size={16} />
          </button>
        </div>

      </form>
    </div>
  );
};

export default CreateTaskView;
