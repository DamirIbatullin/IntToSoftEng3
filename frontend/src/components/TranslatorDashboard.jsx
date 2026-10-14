import React, { useState, useEffect, useRef } from 'react';
import DailyLogModal from './DailyLogModal';
import TranslatorProjectDetail from './TranslatorProjectDetail';

export default function TranslatorDashboard({ userProfile, onLogout }) {
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActivityForLog, setSelectedActivityForLog] = useState(null);
  const [selectedProjectDetail, setSelectedProjectDetail] = useState(null);
  const [quickWorkInput, setQuickWorkInput] = useState('');
  const [quickWorkSuccess, setQuickWorkSuccess] = useState('');
  const [quickWorkError, setQuickWorkError] = useState('');
  const [overheadCategory, setOverheadCategory] = useState('Lunch');
  const [overheadHours, setOverheadHours] = useState('0.0');
  const [overheadSuccess, setOverheadSuccess] = useState('');
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    fetchActivities('');
  }, []);

  const fetchActivities = async (query = '') => {
    const token = localStorage.getItem('easyLangToken');
    if (!token) return;

    try {
      setIsLoading(true);
      const url = query 
        ? `http://localhost:5156/api/projects/my-activities?search=${encodeURIComponent(query)}`
        : 'http://localhost:5156/api/projects/my-activities';

      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        setActivities(data);

        // If an activity was selected or saved in localStorage, update/restore selectedProjectDetail
        const savedId = localStorage.getItem('easyLangSelectedActivityId');
        if (savedId) {
          const matched = data.find(a => a.activityId.toString() === savedId.toString());
          if (matched) {
            setSelectedProjectDetail(matched);
          }
        } else if (selectedProjectDetail) {
          const matched = data.find(a => a.activityId === selectedProjectDetail.activityId);
          if (matched) {
            setSelectedProjectDetail(matched);
          }
        }
      }
    } catch (err) {
      console.error('Could not fetch activities', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      fetchActivities(val);
    }, 250);
  };

  // Featured activity is the first in-progress activity or the first assigned activity
  const featuredActivity = activities.find(a => parseFloat(a.cumulativeProgress || 0) < 100) || activities[0];

  const handleQuickAddWork = async (e) => {
    e.preventDefault();
    setQuickWorkError('');
    setQuickWorkSuccess('');

    if (!featuredActivity) {
      setQuickWorkError('No active project selected.');
      return;
    }

    const val = parseFloat(quickWorkInput);
    if (isNaN(val) || val <= 0) {
      setQuickWorkError('Please enter a valid percentage > 0.00%');
      return;
    }

    const currentCumulative = parseFloat(featuredActivity.cumulativeProgress || 0);
    if (currentCumulative + val > 100.001) {
      setQuickWorkError(`Exceeds 100%. Remaining allowed: ${(100 - currentCumulative).toFixed(2)}%`);
      return;
    }

    try {
      const token = localStorage.getItem('easyLangToken');
      const res = await fetch(`http://localhost:5156/api/activities/${featuredActivity.activityId}/daily-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          progressPercentage: parseFloat(val.toFixed(2)),
          notes: 'Daily quota record'
        })
      });

      const data = await res.json();
      if (res.ok) {
        setQuickWorkSuccess(`Recorded +${val.toFixed(2)}% successfully!`);
        setQuickWorkInput('');
        fetchActivities(searchQuery);
        setTimeout(() => setQuickWorkSuccess(''), 3000);
      } else {
        setQuickWorkError(data.error || 'Failed to log work.');
      }
    } catch (err) {
      setQuickWorkError('Failed to connect to backend.');
    }
  };

  const handleLogOverhead = (e) => {
    e.preventDefault();
    setOverheadSuccess(`Logged ${overheadHours}h to ${overheadCategory}`);
    setTimeout(() => setOverheadSuccess(''), 3000);
  };

  const handleOpenProjectDetail = (act) => {
    if (act?.activityId) {
      localStorage.setItem('easyLangSelectedActivityId', act.activityId.toString());
    }
    setSelectedProjectDetail(act);
  };

  const handleCloseProjectDetail = () => {
    localStorage.removeItem('easyLangSelectedActivityId');
    setSelectedProjectDetail(null);
    fetchActivities(searchQuery);
  };

  const handleRefreshFromDetail = (newTotal) => {
    if (selectedProjectDetail && newTotal !== undefined && newTotal !== null) {
      setSelectedProjectDetail(prev => prev ? { ...prev, cumulativeProgress: parseFloat(newTotal) } : null);
    }
    fetchActivities(searchQuery);
  };

  return (
    <div className="flex min-h-screen bg-[#f8fafc] font-sans text-slate-800">
      
      {/* Figma Dark Left Sidebar */}
      <aside className="w-16 md:w-20 bg-[#111827] flex flex-col items-center py-6 shadow-xl z-20 shrink-0 relative">
        <button 
          className="bg-[#1f2937] hover:bg-[#374151] p-2.5 rounded-xl text-white mb-8 transition-colors"
          title="Menu"
          aria-label="Navigation Menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* User Initials Avatar */}
        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center justify-center font-bold text-xs">
          {userProfile?.initials || 'TR'}
        </div>

        {/* Logout at bottom */}
        <button 
          onClick={onLogout} 
          title="Sign Out"
          className="text-slate-400 hover:text-red-400 p-2.5 rounded-xl hover:bg-slate-800 transition-colors absolute bottom-6"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </aside>

      {/* Main Workspace Body */}
      <div className="flex-1 w-full overflow-x-hidden p-4 sm:p-6 md:p-8 max-w-7xl">
        {selectedProjectDetail ? (
          <TranslatorProjectDetail 
            activity={selectedProjectDetail} 
            onBack={handleCloseProjectDetail}
            onRefreshActivities={handleRefreshFromDetail}
          />
        ) : (
          <>
            {/* Header matching Figma */}
            <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl sm:text-[28px] font-extrabold text-[#111827] tracking-tight">
                  Translator Workspace
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Manage daily quotas, update workload, and submit files
                </p>
              </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-indigo-50/80 text-indigo-700 border border-indigo-200/80 shadow-2xs">
            <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span>Weekly status report due by Friday, 18:00</span>
          </div>
        </header>

        {/* Live Search Bar (Story #4) */}
        <div className="mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input 
              type="text" 
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search projects by ID or name"
              className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  fetchActivities('');
                }}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Top 2 Cards: Today Action Card & Overhead Activities Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          
          {/* Card 1: Today / Action Needed (Featured Activity) */}
          <div className="lg:col-span-2 bg-white rounded-2xl border-2 border-indigo-500/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
            {featuredActivity ? (
              <>
                <div>
                  <div className="flex items-center justify-between text-xs font-bold mb-1">
                    <span className="text-indigo-600 truncate">{featuredActivity.projectName}</span>
                    <span className="text-slate-500">ID {featuredActivity.projectNumber}-{featuredActivity.activityNumber}</span>
                  </div>
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900 mb-3">
                    Today / Action Needed
                  </h2>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center text-xs font-semibold text-slate-600 mb-1.5">
                      <span>Progress</span>
                      <span className="font-bold text-slate-900">
                        {parseFloat(featuredActivity.cumulativeProgress || 0).toFixed(2)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-indigo-600 h-full transition-all duration-300"
                        style={{ width: `${Math.min(100, parseFloat(featuredActivity.cumulativeProgress || 0))}%` }}
                      />
                    </div>
                  </div>

                  {/* Quick Inline Log: Today's Work */}
                  <form onSubmit={handleQuickAddWork} className="space-y-2 mb-4">
                    <label className="block text-xs font-bold text-slate-700">
                      Today's work
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <input 
                          type="text"
                          inputMode="decimal"
                          value={quickWorkInput}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d*(\.\d{0,2})?$/.test(val)) {
                              setQuickWorkInput(val);
                              setQuickWorkError('');
                            }
                          }}
                          className={`w-full px-4 py-2 text-sm border rounded-xl focus:ring-2 outline-none text-slate-900 ${
                            quickWorkError ? 'border-red-500 focus:ring-red-400 bg-red-50/50' : 'border-slate-200 focus:ring-indigo-500'
                          }`}
                        />
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs pointer-events-none">
                          %
                        </span>
                      </div>
                      <button 
                        type="submit"
                        className="px-4 py-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white text-xs font-bold rounded-xl shadow-xs transition-colors whitespace-nowrap"
                      >
                        + Add today's work
                      </button>
                    </div>

                    {quickWorkSuccess && (
                      <p className="text-xs text-emerald-600 font-semibold">{quickWorkSuccess}</p>
                    )}
                    {quickWorkError && (
                      <p className="text-xs text-red-500 font-semibold">{quickWorkError}</p>
                    )}
                  </form>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400 font-medium block">Weekly estimate reminder</span>
                    <span className="text-slate-800 font-semibold">Weekly estimate due Friday</span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => handleOpenProjectDetail(featuredActivity)}
                    className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
                  >
                    Open detailed log modal &rarr;
                  </button>
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-slate-400 text-sm">
                No active translation project assigned yet.
              </div>
            )}
          </div>

          {/* Card 2: Overhead Tasks */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-1">Overhead Tasks</h2>
              <p className="text-xs text-slate-500 mb-4">
                Log non-billable time without leaving the workspace.
              </p>

              <form onSubmit={handleLogOverhead} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                    <select 
                      value={overheadCategory}
                      onChange={(e) => setOverheadCategory(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-800"
                    >
                      <option value="Lunch">Lunch</option>
                      <option value="Vacation">Vacation</option>
                      <option value="Illness">Illness</option>
                      <option value="Courses">Courses</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Hours</label>
                    <input 
                      type="number"
                      step="0.5"
                      min="0"
                      value={overheadHours}
                      onChange={(e) => setOverheadHours(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800"
                    />
                  </div>
                </div>

                {overheadSuccess && (
                  <p className="text-xs text-emerald-600 font-semibold">{overheadSuccess}</p>
                )}

                <button 
                  type="submit"
                  className="w-full py-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                >
                  + Log Overhead
                </button>
              </form>
            </div>

            <p className="text-[11px] text-slate-400 mt-4 italic">
              Overhead tasks are tracked for internal payroll & availability planning.
            </p>
          </div>
        </div>

        {/* My Projects Table (Matching Figma Image 1) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">My Projects</h2>
            <span className="text-xs font-semibold text-slate-400">
              {activities.length} total projects
            </span>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading assigned projects...
            </div>
          ) : activities.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              {searchQuery ? `No projects found matching "${searchQuery}"` : 'No translation projects currently assigned to your account.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-5">Project</th>
                    <th className="py-3 px-5 w-48">Progress</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5 text-right">Next Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activities.map((act) => {
                    const progress = parseFloat(act.cumulativeProgress || 0);
                    const isCompleted = progress >= 100;
                    const hasWorkToday = act.logsCount > 0;

                    let statusLabel = 'Work entry missing';
                    let statusColor = 'bg-amber-50 text-amber-700 border-amber-200';

                    if (isCompleted) {
                      statusLabel = 'Completed';
                      statusColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                    } else if (hasWorkToday) {
                      statusLabel = 'In Progress';
                      statusColor = 'bg-indigo-50 text-indigo-700 border-indigo-200';
                    }

                    return (
                      <tr key={act.activityId} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-4 px-5">
                          <p className="text-sm font-bold text-slate-900">{act.projectName}</p>
                          <p className="text-xs text-slate-400 font-medium mt-0.5">
                            ID {act.projectNumber}-{act.activityNumber} {act.activityName && `&bull; ${act.activityName}`}
                          </p>
                        </td>

                        <td className="py-4 px-5">
                          <div className="space-y-1">
                            <span className="text-xs font-bold text-slate-800">
                              {progress.toFixed(2)}%
                            </span>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${isCompleted ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                                style={{ width: `${Math.min(100, progress)}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-5">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusColor}`}>
                            {statusLabel}
                          </span>
                        </td>

                        <td className="py-4 px-5 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenProjectDetail(act)}
                            className="px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors border border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                          >
                            Add work
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </>
        )}
      </div>

      {/* Daily Work Log Modal (Two-Decimal Precision) */}
      {selectedActivityForLog && (
        <DailyLogModal
          activity={selectedActivityForLog}
          onClose={() => setSelectedActivityForLog(null)}
          onLogSuccess={(newTotal) => {
            fetchActivities(searchQuery);
          }}
        />
      )}
    </div>
  );
}
