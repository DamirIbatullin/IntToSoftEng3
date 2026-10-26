import React, { useState, useEffect } from 'react';

export default function DailyLogModal({ activity, onClose, onLogSuccess }) {
  const [activeTab, setActiveTab] = useState('newLog'); // 'newLog' | 'history'
  const [progressPercentage, setProgressPercentage] = useState('');
  const [pagesTranslated, setPagesTranslated] = useState('');
  const [hoursSpent, setHoursSpent] = useState('');
  const [logDate, setLogDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  
  const [historyLogs, setHistoryLogs] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const currentCumulative = parseFloat(activity?.cumulativeProgress || 0);
  const remainingProgress = Math.max(0, 100 - currentCumulative);

  // Computed new total based on current input
  const inputPercentageNum = parseFloat(progressPercentage) || 0;
  const projectedTotal = (currentCumulative + inputPercentageNum).toFixed(2);
  const isOverLimit = parseFloat(projectedTotal) > 100.00;

  useEffect(() => {
    fetchHistory();
  }, [activity.activityId]);

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const token = localStorage.getItem('easyLangToken');
      const res = await fetch(`http://localhost:5156/api/activities/${activity.activityId}/daily-logs`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setHistoryLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Could not fetch daily logs history', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handlePercentageChange = (val) => {
    const normalized = val.replace(',', '.');
    // Enforce two-decimal precision format: regex matches up to 2 decimal places
    if (normalized === '' || /^\d*(\.\d{0,2})?$/.test(normalized)) {
      setProgressPercentage(normalized);
      setErrorMessage('');
    }
  };

  const setPresetPercentage = (amount) => {
    const capped = Math.min(amount, remainingProgress);
    setProgressPercentage(capped.toFixed(2));
    setErrorMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const normalizedPct = String(progressPercentage ?? '').trim().replace(',', '.');
    const val = parseFloat(normalizedPct);
    if (!normalizedPct || isNaN(val) || val <= 0) {
      setErrorMessage('Please enter a valid daily completed percentage greater than 0%.');
      return;
    }

    if (val > 100) {
      setErrorMessage('Progress percentage cannot exceed 100.00%.');
      return;
    }

    if (currentCumulative + val > 100.001) {
      setErrorMessage(`Cumulative progress cannot exceed 100.00%. Remaining allowed: ${remainingProgress.toFixed(2)}%.`);
      return;
    }

    const normalizedPages = String(pagesTranslated ?? '').trim().replace(',', '.');
    const parsedPages = normalizedPages !== '' ? parseFloat(normalizedPages) : null;
    if (normalizedPages !== '' && (!/^-?\d+(\.\d+)?$/.test(normalizedPages) || isNaN(parsedPages) || parsedPages < 0)) {
      setErrorMessage('Please enter a valid number of translated pages (>= 0).');
      return;
    }

    const normalizedHours = String(hoursSpent ?? '').trim().replace(',', '.');
    const parsedHours = normalizedHours !== '' ? parseFloat(normalizedHours) : null;
    if (normalizedHours !== '' && (!/^-?\d+(\.\d+)?$/.test(normalizedHours) || isNaN(parsedHours) || parsedHours < 0)) {
      setErrorMessage('Please enter a valid amount of hours spent (>= 0).');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('easyLangToken');
      const payload = {
        progressPercentage: parseFloat(val.toFixed(2)),
        pagesTranslated: parsedPages !== null ? parseFloat(parsedPages.toFixed(2)) : null,
        hoursSpent: parsedHours !== null ? parseFloat(parsedHours.toFixed(2)) : null,
        logDate: logDate,
        notes: notes.trim() || null
      };

      const res = await fetch(`http://localhost:5156/api/activities/${activity.activityId}/daily-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage('Daily progress logged successfully!');
        setProgressPercentage('');
        setPagesTranslated('');
        setHoursSpent('');
        setNotes('');
        fetchHistory();
        if (onLogSuccess) {
          onLogSuccess(data.cumulativeProgress, data.remainingHoursEstimate);
        }
        setTimeout(() => {
          setSuccessMessage('');
          setActiveTab('history');
        }, 1200);
      } else {
        setErrorMessage(data.error || 'Failed to log daily progress.');
      }
    } catch (err) {
      setErrorMessage('Network error: Could not reach backend server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLog = async (logId) => {
    if (!window.confirm('Are you sure you want to delete this daily work record?')) return;
    try {
      const token = localStorage.getItem('easyLangToken');
      const res = await fetch(`http://localhost:5156/api/activities/${activity.activityId}/daily-logs/${logId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        fetchHistory();
        if (onLogSuccess) {
          onLogSuccess(data.cumulativeProgress, data.remainingHoursEstimate);
        }
      }
    } catch (err) {
      console.error('Failed to delete log', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-5 sm:p-6 text-white relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center transition-all"
            aria-label="Close modal"
          >
            ✕
          </button>
          <div className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white mb-2">
            Project #{activity.projectNumber}
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Log Daily Progress</h2>
          <p className="text-indigo-100 text-xs sm:text-sm mt-1 truncate">
            {activity.projectName}
          </p>

          {/* Progress Overview Bar */}
          <div className="mt-4 bg-black/20 rounded-xl p-3">
            <div className="flex justify-between text-xs font-medium mb-1.5">
              <span>Current Progress: <strong className="font-bold text-white">{currentCumulative.toFixed(2)}%</strong></span>
              <span>Remaining: <strong className="font-bold text-white">{remainingProgress.toFixed(2)}%</strong></span>
            </div>
            <div className="w-full bg-white/20 h-2.5 rounded-full overflow-hidden flex">
              <div 
                className="bg-emerald-400 h-full transition-all duration-300"
                style={{ width: `${Math.min(100, currentCumulative)}%` }}
              />
              {inputPercentageNum > 0 && !isOverLimit && (
                <div 
                  className="bg-amber-300 h-full transition-all duration-300 animate-pulse"
                  style={{ width: `${Math.min(remainingProgress, inputPercentageNum)}%` }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-sm font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('newLog')}
            className={`flex-1 py-3 text-center transition-colors border-b-2 ${
              activeTab === 'newLog'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Record Work Today
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 text-center transition-colors border-b-2 flex items-center justify-center gap-2 ${
              activeTab === 'history'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Work History</span>
            <span className="bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded-full font-bold">
              {historyLogs.length}
            </span>
          </button>
        </div>

        {/* Tab 1: New Daily Log Input */}
        {activeTab === 'newLog' && (
          <form onSubmit={handleSubmit} noValidate className="p-5 sm:p-6 space-y-4">
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl font-medium">
                {errorMessage}
              </div>
            )}

            {successMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs sm:text-sm rounded-xl flex items-center gap-2">
                <svg className="w-5 h-5 shrink-0 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>{successMessage}</span>
              </div>
            )}

            {/* Percentage Input with 2-Decimal Precision */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs sm:text-sm font-bold text-slate-800">
                  Daily Completed Percentage <span className="text-red-500">*</span>
                </label>
              </div>

              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={progressPercentage}
                  onChange={(e) => handlePercentageChange(e.target.value)}
                  className={`w-full px-4 py-3 text-lg font-bold border rounded-xl outline-none transition-all pr-12 ${
                    isOverLimit || (errorMessage && (!progressPercentage || parseFloat(progressPercentage) <= 0))
                      ? 'border-red-500 focus:ring-2 focus:ring-red-400 text-red-600 bg-red-50/50'
                      : 'border-slate-200 focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white'
                  }`}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base pointer-events-none">
                  %
                </span>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[5, 10, 15, 25].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setPresetPercentage(preset)}
                    disabled={preset > remainingProgress}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-40 disabled:hover:bg-indigo-50 transition-colors"
                  >
                    +{preset}.00%
                  </button>
                ))}
                {remainingProgress > 0 && (
                  <button
                    type="button"
                    onClick={() => setPresetPercentage(remainingProgress)}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors ml-auto"
                  >
                    All Remaining ({remainingProgress.toFixed(2)}%)
                  </button>
                )}
              </div>

              {/* Live Auto-Math Calculation */}
              {inputPercentageNum > 0 && (
                <div className={`mt-2.5 p-2.5 rounded-lg text-xs font-medium flex items-center justify-between ${
                  isOverLimit ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-700'
                }`}>
                  <span>
                    {currentCumulative.toFixed(2)}% + <strong className="text-indigo-600">{inputPercentageNum.toFixed(2)}%</strong> =
                  </span>
                  <span className="font-bold text-sm">
                    {projectedTotal}% / 100.00%
                  </span>
                </div>
              )}
            </div>

            {/* Optional Pages & Hours row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pages Translated
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={pagesTranslated}
                  onChange={(e) => {
                    setPagesTranslated(e.target.value);
                    setErrorMessage('');
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Hours Spent
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={hoursSpent}
                  onChange={(e) => {
                    setHoursSpent(e.target.value);
                    setErrorMessage('');
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800"
                />
              </div>
            </div>

            {/* Date Picker */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Log Date
              </label>
              <input
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 bg-white"
              />
            </div>

            {/* Notes / Description */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Daily Work Summary / Notes <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                rows="2"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
              >
                {isSubmitting ? 'Recording...' : 'Submit Daily Record'}
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: History List */}
        {activeTab === 'history' && (
          <div className="p-5 sm:p-6 max-h-[420px] overflow-y-auto">
            {isLoadingHistory ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                Loading history records...
              </div>
            ) : historyLogs.length === 0 ? (
              <div className="py-12 text-center">
                <svg className="w-12 h-12 mx-auto text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-sm font-semibold text-slate-700">No daily logs yet</p>
                <p className="text-xs text-slate-400 mt-0.5">Switch to "Record Work Today" to log your first progress.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {historyLogs.map((item) => (
                  <div key={item.id} className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl flex items-start justify-between gap-3 hover:bg-slate-100/60 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                          +{parseFloat(item.progressPercentage).toFixed(2)}%
                        </span>
                        <span className="text-xs font-semibold text-slate-700">
                          {item.logDate}
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mt-1.5">
                        {item.pagesTranslated != null && (
                          <span>Pages: <strong className="text-slate-700">{parseFloat(item.pagesTranslated).toFixed(2)}</strong></span>
                        )}
                        {item.hoursSpent != null && (
                          <span>Hours: <strong className="text-slate-700">{parseFloat(item.hoursSpent).toFixed(1)}h</strong></span>
                        )}
                      </div>

                      {item.notes && (
                        <p className="text-xs text-slate-600 mt-1.5 italic bg-white p-2 rounded border border-slate-100">
                          "{item.notes}"
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteLog(item.id)}
                      title="Delete record"
                      className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
