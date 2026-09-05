import React, { useEffect, useState, useRef } from 'react';
import { api } from '../services/api';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  CheckCircle, ClipboardList, Building2, BarChart3, ChevronRight, 
  Trophy, Star, Crown, X, Shield, FileSpreadsheet, FileText, Download, ChevronDown
} from 'lucide-react';
import { 
  exportNaacToExcel, exportNaacToPdf, 
  exportDepartmentToExcel, exportDepartmentToPdf 
} from '../utils/naacExport';
import './NaacDashboardPage.css';

interface UserReport {
  _id: string;
  name: string;
  universityId?: string;
  role: string;
  department?: string;
  email?: string;
  phone?: string;
  tasksGiven: number;
  tasksPending: number;
  tasksInReview: number;
  tasksCompleted: number;
  totalRatings?: number;
  averageRating?: number;
  onTimeRate?: number;
  rank?: number;
}

interface DepartmentReport {
  department: string;
  code?: string;
  totalTasksGiven: number;
  totalTasksPending: number;
  totalTasksInReview: number;
  totalTasksCompleted: number;
  totalRatings?: number;
  averageRating?: number;
  rank?: number;
  users: UserReport[];
  completionRate?: number;
}

const NaacDashboardPage: React.FC = () => {
  const [data, setData] = useState<DepartmentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedDept, setExpandedDept] = useState<string | null>(null);
  const [selectedDeptModal, setSelectedDeptModal] = useState<DepartmentReport | null>(null);

  // Chart label display mode: 'short' (Super Admin Short Code), 'full' (Full Department Name)
  const [chartLabelMode, setChartLabelMode] = useState<'short' | 'full'>('short');

  // Unified Export Dropdown States
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isDeptExportMenuOpen, setIsDeptExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const deptExportMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setIsExportMenuOpen(false);
      }
      if (deptExportMenuRef.current && !deptExportMenuRef.current.contains(e.target as Node)) {
        setIsDeptExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleExpand = (dept: string) => {
    setExpandedDept(expandedDept === dept ? null : dept);
  };

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        const res = await api.getNaacReport();
        const processedData = (res.data || []).map((d: DepartmentReport) => ({
          ...d,
          completionRate: d.totalTasksGiven > 0 ? Math.round((d.totalTasksCompleted / d.totalTasksGiven) * 100) : 0
        }));
        setData(processedData);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch NAAC report');
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, []);

  const totalDepts = data.length;
  const activeDeptsCount = data.filter(d => d.totalTasksGiven > 0).length;
  const totalGiven = data.reduce((sum, d) => sum + d.totalTasksGiven, 0);
  const totalCompleted = data.reduce((sum, d) => sum + d.totalTasksCompleted, 0);
  const totalPending = data.reduce((sum, d) => sum + d.totalTasksPending, 0);
  const totalReview = data.reduce((sum, d) => sum + d.totalTasksInReview, 0);
  const overallRate = totalGiven > 0 ? ((totalCompleted / totalGiven) * 100).toFixed(1) : '0.0';

  const totalUsers = data.reduce((sum, d) => sum + d.users.length, 0);
  const activeUsers = data.reduce((sum, d) => sum + d.users.filter(u => u.tasksGiven > 0).length, 0);
  const resourceUtilization = totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(1) : '0.0';

  const getChartTickLabel = (deptName: string): string => {
    const item = data.find(d => d.department.toLowerCase() === deptName.toLowerCase());
    const code = item?.code?.trim();
    
    if (chartLabelMode === 'short') {
      // If Super Admin set a short code, use that code. If no code was set, show department name.
      return code ? code : deptName;
    }
    // Full Name: Return exact department name set by Super Admin
    return deptName;
  };

  if (loading) return <div className="naac-loading"><div className="naac-spinner" /><span>Loading NAAC Report & Leaderboard...</span></div>;
  if (error) return <div className="naac-error">{error}</div>;

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div className="naac-dashboard-wrapper">
      <div className="naac-dashboard">
        
        {/* Header Section */}
        <div className="naac-header">
          <div className="naac-header-text">
            <h1>NAAC Reports & Ratings Dashboard</h1>
            <p>Comprehensive university-wide performance, department rankings & ratings.</p>
          </div>
          <div className="naac-header-actions">
            <div className="naac-export-dropdown-wrapper" ref={exportMenuRef}>
              <button 
                className="naac-unified-export-btn"
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                aria-expanded={isExportMenuOpen}
              >
                <Download size={16} />
                <span>Export Report</span>
                <ChevronDown size={14} className={`export-chevron ${isExportMenuOpen ? 'open' : ''}`} />
              </button>

              {isExportMenuOpen && (
                <div className="naac-export-dropdown-menu">
                  <div className="naac-export-menu-header">Download University Report</div>
                  
                  <button 
                    className="naac-export-menu-item"
                    onClick={() => {
                      exportNaacToExcel(data, {
                        totalDepts,
                        activeDeptsCount,
                        totalGiven,
                        totalCompleted,
                        totalPending,
                        totalReview,
                        overallRate,
                        resourceUtilization
                      });
                      setIsExportMenuOpen(false);
                    }}
                  >
                    <div className="export-menu-icon excel">
                      <FileSpreadsheet size={18} />
                    </div>
                    <div className="export-menu-text">
                      <div className="export-menu-title">Excel Spreadsheet (.xlsx)</div>
                      <div className="export-menu-desc">Executive summary, department rankings & staff roster</div>
                    </div>
                  </button>

                  <button 
                    className="naac-export-menu-item"
                    onClick={() => {
                      exportNaacToPdf(data, {
                        totalDepts,
                        activeDeptsCount,
                        totalGiven,
                        totalCompleted,
                        totalPending,
                        totalReview,
                        overallRate,
                        resourceUtilization
                      });
                      setIsExportMenuOpen(false);
                    }}
                  >
                    <div className="export-menu-icon pdf">
                      <FileText size={18} />
                    </div>
                    <div className="export-menu-text">
                      <div className="export-menu-title">PDF Document (.pdf)</div>
                      <div className="export-menu-desc">Audit-ready institutional evaluation report</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* KPI Grid Section */}
        <div className="naac-kpi-grid">
          <div className="naac-kpi-card">
            <div className="kpi-top">
              <div className="kpi-icon-box"><CheckCircle size={20} /></div>
            </div>
            <div className="kpi-bottom">
              <span className="kpi-label">Overall Completion</span>
              <span className="kpi-value">{overallRate}%</span>
            </div>
          </div>
          
          <div className="naac-kpi-card">
            <div className="kpi-top">
              <div className="kpi-icon-box orange"><ClipboardList size={20} /></div>
            </div>
            <div className="kpi-bottom">
              <span className="kpi-label">Pending Tasks</span>
              <span className="kpi-value">{totalPending + totalReview}</span>
            </div>
          </div>

          <div className="naac-kpi-card">
            <div className="kpi-top">
              <div className="kpi-icon-box gray"><Building2 size={20} /></div>
            </div>
            <div className="kpi-bottom">
              <span className="kpi-label">Active Departments</span>
              <span className="kpi-value">{activeDeptsCount}/{totalDepts}</span>
            </div>
          </div>

          <div className="naac-kpi-card">
            <div className="kpi-top">
              <div className="kpi-icon-box blue"><BarChart3 size={20} /></div>
            </div>
            <div className="kpi-bottom">
              <span className="kpi-label">Resource Utilization</span>
              <span className="kpi-value">{resourceUtilization}%</span>
            </div>
          </div>
        </div>

        {/* Top Rated Departments Leaderboard Section */}
        <div className="naac-section-card">
          <div className="section-header-flex">
            <div>
              <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Trophy size={20} color="#f59e0b" /> Top Rated Departments Leaderboard
              </h3>
              <p className="section-subtitle">Ranked by average star rating across all staff and department admins. Click any department to view staff ratings.</p>
            </div>
          </div>

          <div className="naac-lb-grid">
            {data.map((dept, index) => {
              const rank = dept.rank || (index + 1);
              const admin = dept.users.find(u => u.role === 'department_admin');
              const avgRating = dept.averageRating || 0;
              const totalRatings = dept.totalRatings || 0;

              return (
                <div 
                  key={dept.department} 
                  className={`naac-lb-card ${rank === 1 ? 'gold-card' : rank === 2 ? 'silver-card' : rank === 3 ? 'bronze-card' : ''}`}
                  onClick={() => setSelectedDeptModal(dept)}
                >
                  <div className="naac-lb-card-header">
                    <span className={`naac-rank-badge rank-${rank <= 3 ? rank : 'default'}`}>
                      {rank === 1 ? '🥇 Rank #1' : rank === 2 ? '🥈 Rank #2' : rank === 3 ? '🥉 Rank #3' : `Rank #${rank}`}
                    </span>
                    <div className="naac-score-pill">
                      <Star size={14} fill={avgRating > 0 ? '#eab308' : 'none'} color="#eab308" />
                      <strong>{avgRating > 0 ? avgRating.toFixed(1) : '—'}</strong>
                      <span>/ 5.0</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                    <h4 className="naac-lb-dept-name" style={{ margin: 0 }}>{dept.department}</h4>
                    {dept.code && (
                      <span className="dept-code-badge" title={`Department Short Code: ${dept.code}`}>
                        {dept.code}
                      </span>
                    )}
                  </div>
                  
                  <div className="naac-lb-admin-line">
                    <Shield size={13} />
                    <span>Admin: <strong>{admin ? admin.name : 'No Admin Assigned'}</strong></span>
                  </div>

                  <div className="naac-lb-stats-row">
                    <div className="naac-lb-stat">
                      <span className="naac-lb-stat-lbl">Staff</span>
                      <span className="naac-lb-stat-num">{dept.users.length}</span>
                    </div>
                    <div className="naac-lb-stat">
                      <span className="naac-lb-stat-lbl">Ratings</span>
                      <span className="naac-lb-stat-num">{totalRatings}</span>
                    </div>
                    <div className="naac-lb-stat">
                      <span className="naac-lb-stat-lbl">Completed</span>
                      <span className="naac-lb-stat-num">{dept.totalTasksCompleted}</span>
                    </div>
                    <div className="naac-lb-stat">
                      <span className="naac-lb-stat-lbl">Progress</span>
                      <span className="naac-lb-stat-num">{dept.completionRate}%</span>
                    </div>
                  </div>

                  <button className="naac-lb-view-btn">
                    View Staff & Ratings <ChevronRight size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart Section */}
        <div className="naac-section-card">
          <div className="section-header-flex" style={{ flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
            <div>
              <h3 className="section-title">Task Progression & Completion Rate</h3>
              <p className="section-subtitle">Comparison across university departments & schools</p>
            </div>
            <div className="naac-chart-header-controls">
              {/* Legend */}
              <div className="naac-chart-legend-group">
                <span className="naac-legend-item">
                  <span className="naac-legend-dot" style={{ backgroundColor: '#021c3b' }}></span> Completed
                </span>
                <span className="naac-legend-item">
                  <span className="naac-legend-dot" style={{ backgroundColor: '#5c728a' }}></span> In Progress
                </span>
                <span className="naac-legend-item">
                  <span className="naac-legend-dot" style={{ backgroundColor: '#dadddf' }}></span> Pending
                </span>
              </div>

              {/* X-Axis Label Toggles */}
              <div className="naac-axis-control-wrapper">
                <span className="naac-toggle-lbl">X-Axis:</span>
                <div className="naac-label-toggle-group">
                  <button 
                    type="button"
                    className={`naac-toggle-btn ${chartLabelMode === 'short' ? 'active' : ''}`}
                    onClick={() => setChartLabelMode('short')}
                    title="Display Department Short Code set by Super Admin"
                  >
                    Short Code
                  </button>
                  <button 
                    type="button"
                    className={`naac-toggle-btn ${chartLabelMode === 'full' ? 'active' : ''}`}
                    onClick={() => setChartLabelMode('full')}
                    title="Display Full Department Name set by Super Admin"
                  >
                    Full Name
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <div style={{ width: '100%', height: chartLabelMode === 'full' ? 390 : 360, marginTop: '20px' }}>
            <ResponsiveContainer>
              <BarChart
                data={data}
                margin={{ top: 20, right: 15, left: -15, bottom: chartLabelMode === 'full' ? 35 : 15 }}
                barGap={4}
                barSize={18}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9ecef" />
                <XAxis 
                  dataKey="department" 
                  axisLine={false} 
                  tickLine={false} 
                  interval={0}
                  tickFormatter={getChartTickLabel}
                  tick={{ 
                    fontSize: chartLabelMode === 'full' ? 9.5 : 10.5, 
                    fill: '#475569', 
                    fontWeight: 600 
                  }}
                  dy={chartLabelMode === 'full' ? 14 : 10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#6c757d' }}
                />
                <Tooltip 
                  cursor={{fill: '#f8f9fa'}}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  labelFormatter={(label: any) => {
                    const deptName = String(label || '');
                    const item = data.find(d => d.department.toLowerCase() === deptName.toLowerCase());
                    const code = item?.code?.trim();
                    return code ? `${deptName} (${code})` : deptName;
                  }}
                />
                <Bar dataKey="totalTasksCompleted" name="Completed" fill="#021c3b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="totalTasksInReview" name="In Progress" fill="#5c728a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="totalTasksPending" name="Pending" fill="#dadddf" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Departmental Breakdown List */}
        <div className="naac-section-card">
          <div className="section-header-flex">
            <div>
              <h3 className="section-title">Departmental Breakdown & Task Metrics</h3>
              <p className="section-subtitle">Detailed task status and staff distributions per department.</p>
            </div>
          </div>

          <div className="breakdown-table-container">
            <table className="breakdown-table">
              <thead>
                <tr>
                  <th>RANK & DEPARTMENT</th>
                  <th className="text-center">AVG RATING</th>
                  <th className="text-center">TOTAL TASKS</th>
                  <th>STATUS DISTRIBUTION</th>
                  <th className="text-center">OVERALL PROGRESS</th>
                  <th className="text-center">DETAILS</th>
                </tr>
              </thead>
              <tbody>
                {data.map((dept, index) => {
                  const rank = dept.rank || (index + 1);
                  const admin = dept.users.find(u => u.role === 'department_admin');
                  const adminName = admin ? admin.name : 'No Admin Assigned';
                  const initials = admin ? getInitials(adminName) : dept.department.substring(0, 2).toUpperCase();

                  const progress = dept.completionRate || 0;
                  let progressColor = '#021c3b';
                  if (progress < 40) progressColor = '#ef4444';
                  else if (progress < 75) progressColor = '#f59e0b';
                  else if (progress > 90) progressColor = '#10b981';

                  const avgRating = dept.averageRating || 0;

                  return (
                    <React.Fragment key={dept.department}>
                      <tr 
                        className="breakdown-row"
                        onClick={() => toggleExpand(dept.department)}
                        style={{ cursor: 'pointer' }}
                      >
                        {/* Department & Admin */}
                        <td>
                          <div className="dept-admin-cell">
                            <span className={`naac-table-rank ${rank <= 3 ? `rank-${rank}` : ''}`}>#{rank}</span>
                            <div className={`avatar bg-color-${index % 5}`}>{initials}</div>
                            <div className="dept-admin-info">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                                <span className="dept-name-full">{dept.department}</span>
                                {dept.code && (
                                  <span className="dept-code-badge" style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem' }} title={`Department Code: ${dept.code}`}>
                                    {dept.code}
                                  </span>
                                )}
                              </div>
                              <span className="admin-name">{adminName} {admin ? '• Admin' : ''}</span>
                            </div>
                          </div>
                        </td>

                        {/* Avg Rating */}
                        <td className="text-center">
                          <div className="dept-rating-cell" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                            <Star size={14} fill={avgRating > 0 ? '#eab308' : 'none'} color="#eab308" />
                            <span>{avgRating > 0 ? avgRating.toFixed(1) : '—'}</span>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>/5</span>
                          </div>
                        </td>
                        
                        {/* Total Tasks */}
                        <td className="text-center">
                          <span className="total-tasks-val">{dept.totalTasksGiven}</span>
                        </td>

                        {/* Status Distribution */}
                        <td>
                          <div className="status-pills">
                            <span className="status-pill comp">{dept.totalTasksCompleted} Comp</span>
                            <span className="status-pill rev">{dept.totalTasksInReview} Rev</span>
                            <span className="status-pill pend">{dept.totalTasksPending} Pend</span>
                          </div>
                        </td>

                        {/* Overall Progress */}
                        <td className="text-center">
                          <div className="progress-cell">
                            <div className="progress-bar-flat-bg">
                              <div 
                                className="progress-bar-flat-fill" 
                                style={{ width: `${progress}%`, backgroundColor: progressColor }}
                              ></div>
                            </div>
                            <span className="progress-val">{progress}%</span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="text-center">
                          <button 
                            className="btn btn-sm btn-secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDeptModal(dept);
                            }}
                            style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                          >
                            Staff Ratings
                          </button>
                        </td>
                      </tr>
                      
                      {expandedDept === dept.department && (
                        <tr className="expanded-row-container">
                          <td colSpan={6} className="expanded-cell">
                            <table className="user-table">
                              <thead>
                                <tr>
                                  <th>NAME</th>
                                  <th>ROLE</th>
                                  <th className="text-center">RATING</th>
                                  <th className="text-center">TOTAL</th>
                                  <th className="text-center">PENDING</th>
                                  <th className="text-center">IN REVIEW</th>
                                  <th className="text-center">COMPLETED</th>
                                  <th className="text-center">PROGRESS</th>
                                </tr>
                              </thead>
                              <tbody>
                                {dept.users.map(user => {
                                  const userCompletion = user.tasksGiven > 0 ? Math.round((user.tasksCompleted / user.tasksGiven) * 100) : 0;
                                  const uAvg = user.averageRating || 0;
                                  return (
                                    <tr key={user._id}>
                                      <td>
                                        <div className="user-name-cell">
                                          <div className="user-avatar">{getInitials(user.name)}</div>
                                          <span>{user.name}</span>
                                        </div>
                                      </td>
                                      <td>
                                        <span className={`user-role ${user.role === 'department_admin' ? 'admin' : ''}`}>
                                          {user.role === 'department_admin' ? 'Dept Admin' : 'Staff'}
                                        </span>
                                      </td>
                                      <td className="text-center">
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
                                          <Star size={13} fill={uAvg > 0 ? '#eab308' : 'none'} color="#eab308" />
                                          <span>{uAvg > 0 ? uAvg.toFixed(1) : '—'}</span>
                                        </div>
                                      </td>
                                      <td className="text-center font-semibold">{user.tasksGiven}</td>
                                      <td className="text-center"><span className="status-dot pending"></span>{user.tasksPending}</td>
                                      <td className="text-center"><span className="status-dot review"></span>{user.tasksInReview}</td>
                                      <td className="text-center"><span className="status-dot completed"></span>{user.tasksCompleted}</td>
                                      <td>
                                        <div className="user-progress-bar">
                                          <div className="progress-bar-fill" style={{ width: `${userCompletion}%`, backgroundColor: userCompletion === 100 ? '#10b981' : '#6366f1' }}></div>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal: Department Staff Ratings & Performance List */}
      {selectedDeptModal && (
        <div className="naac-modal-overlay" onClick={() => setSelectedDeptModal(null)}>
          <div className="naac-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="naac-modal-header">
              <div className="naac-modal-title-area">
                <div className="naac-modal-title-row">
                  <Building2 size={22} color="#0f172a" />
                  <h2>{selectedDeptModal.department}</h2>
                  <span className={`naac-rank-badge rank-${selectedDeptModal.rank && selectedDeptModal.rank <= 3 ? selectedDeptModal.rank : 'default'}`}>
                    Rank #{selectedDeptModal.rank || 1}
                  </span>
                </div>
                <p className="naac-modal-subtitle">
                  Complete staff & admin ratings ranking for this department. Admin is displayed at the top of the roster.
                </p>
              </div>
              <button className="naac-modal-close" onClick={() => setSelectedDeptModal(null)}>
                <X size={20} />
              </button>
            </div>

            {/* Department Summary Banner in Modal */}
            <div className="naac-modal-dept-stats">
              <div className="naac-dept-summary-card">
                <span className="dept-stat-lbl">Department Overall Rating</span>
                <div className="dept-stat-star-box">
                  <Star size={20} fill={selectedDeptModal.averageRating && selectedDeptModal.averageRating > 0 ? '#eab308' : 'none'} color="#eab308" />
                  <span className="dept-stat-big-score">{selectedDeptModal.averageRating && selectedDeptModal.averageRating > 0 ? selectedDeptModal.averageRating.toFixed(1) : '—'}</span>
                  <span className="dept-stat-max">/ 5.0</span>
                </div>
                <span className="dept-stat-sub">{selectedDeptModal.totalRatings || 0} Ratings recorded</span>
              </div>

              <div className="naac-dept-summary-card">
                <span className="dept-stat-lbl">Total Team Members</span>
                <span className="dept-stat-big-num">{selectedDeptModal.users.length}</span>
                <span className="dept-stat-sub">Admins & Staff</span>
              </div>

              <div className="naac-dept-summary-card">
                <span className="dept-stat-lbl">Tasks Completed</span>
                <span className="dept-stat-big-num">{selectedDeptModal.totalTasksCompleted}</span>
                <span className="dept-stat-sub">{selectedDeptModal.completionRate}% Completion Rate</span>
              </div>
            </div>

            {/* Department-specific Export Actions Bar */}
            <div className="naac-modal-export-bar">
              <div className="naac-modal-export-info">
                <Shield size={15} color="#475569" />
                <span>Department NAAC Audit:</span>
              </div>
              <div className="naac-modal-export-wrapper" ref={deptExportMenuRef}>
                <button 
                  className="naac-modal-unified-btn"
                  onClick={() => setIsDeptExportMenuOpen(!isDeptExportMenuOpen)}
                  aria-expanded={isDeptExportMenuOpen}
                >
                  <Download size={14} />
                  <span>Export Department Data</span>
                  <ChevronDown size={13} className={`export-chevron ${isDeptExportMenuOpen ? 'open' : ''}`} />
                </button>

                {isDeptExportMenuOpen && (
                  <div className="naac-export-dropdown-menu dept-modal-menu">
                    <button 
                      className="naac-export-menu-item"
                      onClick={() => {
                        exportDepartmentToExcel(selectedDeptModal);
                        setIsDeptExportMenuOpen(false);
                      }}
                    >
                      <div className="export-menu-icon excel">
                        <FileSpreadsheet size={16} />
                      </div>
                      <div className="export-menu-text">
                        <div className="export-menu-title">Excel (.xlsx)</div>
                        <div className="export-menu-desc">Staff roster & rating scores</div>
                      </div>
                    </button>

                    <button 
                      className="naac-export-menu-item"
                      onClick={() => {
                        exportDepartmentToPdf(selectedDeptModal);
                        setIsDeptExportMenuOpen(false);
                      }}
                    >
                      <div className="export-menu-icon pdf">
                        <FileText size={16} />
                      </div>
                      <div className="export-menu-text">
                        <div className="export-menu-title">PDF Report (.pdf)</div>
                        <div className="export-menu-desc">Department audit document</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Members Leaderboard Table */}
            <div className="naac-modal-table-wrapper">
              <table className="naac-modal-table">
                <thead>
                  <tr>
                    <th>RANK</th>
                    <th>MEMBER</th>
                    <th>ROLE</th>
                    <th className="text-center">AVG RATING</th>
                    <th className="text-center">REVIEWS</th>
                    <th className="text-center">TASKS COMPLETED</th>
                    <th className="text-center">ON-TIME %</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDeptModal.users.map((u, idx) => {
                    const isAdmin = u.role === 'department_admin';
                    const uAvg = u.averageRating || 0;
                    return (
                      <tr key={u._id} className={isAdmin ? 'naac-admin-row' : ''}>
                        <td className="naac-modal-rank-cell">
                          {isAdmin ? (
                            <span className="naac-modal-admin-badge" title="Department Admin">
                              <Crown size={14} /> ADMIN
                            </span>
                          ) : (
                            <span className={`pp-rank-badge pp-rank-${u.rank && u.rank <= 3 ? u.rank : 'default'}`}>
                              {u.rank === 1 ? '🥇 #1' : u.rank === 2 ? '🥈 #2' : u.rank === 3 ? '🥉 #3' : `#${u.rank || (idx + 1)}`}
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="naac-modal-user-cell">
                            <div className="naac-modal-avatar" style={{ backgroundImage: `url(https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=${isAdmin ? '1e3a8a' : '0f172a'}&color=fff)` }} />
                            <div>
                              <span className="naac-modal-user-name">{u.name}</span>
                              <span className="naac-modal-user-id">ID: {u.universityId || 'N/A'}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`naac-role-pill ${isAdmin ? 'admin' : 'staff'}`}>
                            {isAdmin ? 'Dept Admin' : 'Staff'}
                          </span>
                        </td>
                        <td className="text-center">
                          <div className="naac-modal-rating">
                            <Star size={14} fill={uAvg > 0 ? '#eab308' : 'none'} color="#eab308" />
                            <strong>{uAvg > 0 ? uAvg.toFixed(1) : '—'}</strong>
                            <span>/5.0</span>
                          </div>
                        </td>
                        <td className="text-center font-bold">
                          {u.totalRatings || 0}
                        </td>
                        <td className="text-center font-bold">
                          {u.tasksCompleted}
                        </td>
                        <td className="text-center text-green-600 font-bold">
                          {u.onTimeRate !== undefined ? `${u.onTimeRate}%` : '100%'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default NaacDashboardPage;
