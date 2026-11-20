import React, { useState, useEffect, useRef } from 'react';

export default function NotificationBell({ onOpenDailyLog, onOpenProjectDetail, onRefreshData, allowedProjectIds }) {
  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef(null);

  const fetchAlerts = async () => {
    const token = localStorage.getItem('easyLangToken');
    if (!token) return;

    try {
      const res = await fetch('http://localhost:5156/api/automations/alerts', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const incomingAlerts = data.alerts || [];
        setAlerts(incomingAlerts);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to fetch automated alerts:', err);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 25000); // Check every 25s
    return () => clearInterval(interval);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleDismiss = async (e, alertId) => {
    e.stopPropagation();
    const token = localStorage.getItem('easyLangToken');
    if (!token) return;

    try {
      const res = await fetch(`http://localhost:5156/api/automations/alerts/${alertId}/dismiss`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, isDismissed: true } : a));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Failed to dismiss alert:', err);
    }
  };

  const handleDismissAll = async () => {
    const token = localStorage.getItem('easyLangToken');
    if (!token) return;

    try {
      setIsLoading(true);
      const res = await fetch('http://localhost:5156/api/automations/alerts/dismiss-all', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setAlerts(prev => prev.map(a => ({ ...a, isDismissed: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Failed to dismiss all alerts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Scope alerts to allowed projects if provided
  const visibleAlerts = alerts.filter(a => {
    if (allowedProjectIds !== undefined && allowedProjectIds !== null && Array.isArray(allowedProjectIds)) {
      if (a.projectId && !allowedProjectIds.includes(a.projectId)) {
        return false;
      }
    }
    return true;
  });

  const effectiveUnreadCount = visibleAlerts.filter(a => !a.isDismissed).length;

  const filteredAlerts = visibleAlerts.filter(a => {
    if (filter === 'UNREAD') return !a.isDismissed;
    if (filter === 'MISSING') return a.alertType === 'MissingDailyLog' || a.alertType === 'MissingWeeklyEstimation';
    if (filter === 'SETBACK') return a.alertType === 'RevisionCorrection';
    return true;
  });

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchAlerts();
        }}
        title="Automated Notifications & Alerts"
        className="relative p-2 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition-colors cursor-pointer"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {effectiveUnreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center shadow-xs animate-pulse">
            {effectiveUnreadCount > 9 ? '9+' : effectiveUnreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden text-xs">
          {/* Header */}
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-900 text-sm">System Alerts</span>
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-indigo-100 text-indigo-700">
                Sprint 4
              </span>
            </div>
            {effectiveUnreadCount > 0 && (
              <button
                type="button"
                onClick={handleDismissAll}
                disabled={isLoading}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
              >
                Clear all unread
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="px-3 pt-2.5 pb-2 bg-white border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                filter === 'ALL' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({visibleAlerts.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('UNREAD')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                filter === 'UNREAD' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Unread ({effectiveUnreadCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('MISSING')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                filter === 'MISSING' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Missing Logs
            </button>
            <button
              type="button"
              onClick={() => setFilter('SETBACK')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                filter === 'SETBACK' ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Setbacks
            </button>
          </div>

          {/* Alert List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {filteredAlerts.length === 0 ? (
              <div className="py-8 px-4 text-center text-slate-400">
                <span className="text-2xl block mb-1">🎉</span>
                <p className="font-semibold text-slate-700">No active alerts</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  All daily work records and estimations are up to date.
                </p>
              </div>
            ) : (
              filteredAlerts.map(alert => {
                const isMissingDaily = alert.alertType === 'MissingDailyLog';
                const isMissingWeekly = alert.alertType === 'MissingWeeklyEstimation';
                const isSetback = alert.alertType === 'RevisionCorrection';

                return (
                  <div
                    key={alert.id}
                    className={`p-3 transition-colors flex items-start gap-2.5 ${
                      alert.isDismissed ? 'bg-white opacity-60' : 'bg-indigo-50/30'
                    }`}
                  >
                    {/* Severity / Type Icon */}
                    <div className="shrink-0 mt-0.5">
                      {isMissingDaily && (
                        <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
                          ⚠️
                        </span>
                      )}
                      {isMissingWeekly && (
                        <span className="w-6 h-6 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-bold text-xs">
                          ⏰
                        </span>
                      )}
                      {isSetback && (
                        <span className="w-6 h-6 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-xs">
                          🔄
                        </span>
                      )}
                      {!isMissingDaily && !isMissingWeekly && !isSetback && (
                        <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                          🔔
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="font-bold text-slate-900 truncate">{alert.title}</h4>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                        {alert.message}
                      </p>

                      {/* Action buttons */}
                      <div className="mt-2 flex items-center gap-2">
                        {isMissingDaily && (onOpenProjectDetail || onOpenDailyLog) && alert.activityId && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsOpen(false);
                              if (onOpenProjectDetail) {
                                onOpenProjectDetail(alert.activityId);
                              } else if (onOpenDailyLog) {
                                onOpenDailyLog(alert.activityId);
                              }
                            }}
                            className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold transition-colors cursor-pointer"
                          >
                            Log Work Now
                          </button>
                        )}
                        {isMissingWeekly && onOpenProjectDetail && alert.activityId && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsOpen(false);
                              onOpenProjectDetail(alert.activityId);
                            }}
                            className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold transition-colors cursor-pointer"
                          >
                            Submit Estimation
                          </button>
                        )}
                        {!alert.isDismissed && (
                          <button
                            type="button"
                            onClick={(e) => handleDismiss(e, alert.id)}
                            className="text-[10px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            Dismiss
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Close ✕ button */}
                    {!alert.isDismissed && (
                      <button
                        type="button"
                        onClick={(e) => handleDismiss(e, alert.id)}
                        className="text-slate-300 hover:text-slate-500 p-0.5 shrink-0 cursor-pointer"
                        title="Dismiss"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-center text-[10px] text-slate-400">
            Powered by Automated Background Engine &bull; Syncs End-of-Day
          </div>
        </div>
      )}
    </div>
  );
}
