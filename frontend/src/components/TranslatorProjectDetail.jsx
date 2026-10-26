import React, { useState, useEffect, useRef } from 'react';
import DailyLogModal from './DailyLogModal';

export default function TranslatorProjectDetail({ activity, onBack, onRefreshActivities }) {
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);

  // Story #6: Weekly Estimation & Friday Review Submission state
  const [isEstimateModalOpen, setIsEstimateModalOpen] = useState(false);
  const [estimateModalTab, setEstimateModalTab] = useState('submit'); // 'submit' | 'history'
  const [remainingHoursInput, setRemainingHoursInput] = useState('');
  const [remainingPercentageInput, setRemainingPercentageInput] = useState('');
  const [completedTextInput, setCompletedTextInput] = useState('');
  const [attachedFile, setAttachedFile] = useState(null); // { name, type, size }
  const [submitForReviewFlag, setSubmitForReviewFlag] = useState(true);
  const [isSubmittingEstimate, setIsSubmittingEstimate] = useState(false);
  const [estimateError, setEstimateError] = useState('');
  const [estimateSuccess, setEstimateSuccess] = useState('');
  const [estimationsHistory, setEstimationsHistory] = useState([]);
  const fileInputRef = useRef(null);

  // Story #7: Defects & Editorial Feedback state
  const [defects, setDefects] = useState([]);
  const [activityStatus, setActivityStatus] = useState(activity?.status || 'In Progress');
  const [plannedTotalHours, setPlannedTotalHours] = useState(
    parseFloat(activity?.plannedHours) > 0 ? parseFloat(activity.plannedHours) : 28
  );
  const [customRemainingHours, setCustomRemainingHours] = useState(null);
  const [latestAttachment, setLatestAttachment] = useState(
    activity?.latestAttachmentName
      ? { name: activity.latestAttachmentName, type: activity.latestAttachmentType || 'DOCX' }
      : null
  );

  const [currentProgress, setCurrentProgress] = useState(parseFloat(activity?.cumulativeProgress || 0));

  useEffect(() => {
    if (activity?.cumulativeProgress !== undefined) {
      setCurrentProgress(parseFloat(activity.cumulativeProgress || 0));
    }
    if (activity?.status) {
      setActivityStatus(activity.status);
    }
    if (parseFloat(activity?.plannedHours) > 0) {
      setPlannedTotalHours(parseFloat(activity.plannedHours));
    }
    if (activity?.latestAttachmentName) {
      setLatestAttachment({
        name: activity.latestAttachmentName,
        type: activity.latestAttachmentType || 'DOCX'
      });
    }
  }, [activity]);

  const progress = currentProgress;
  const remainingWork = Math.max(0, 100 - progress);

  useEffect(() => {
    fetchLogs();
    fetchEstimations();
    fetchDefects();
  }, [activity?.activityId]);

  const fetchLogs = async () => {
    if (!activity?.activityId) return;
    try {
      setIsLoadingLogs(true);
      const token = localStorage.getItem('easyLangToken');
      const res = await fetch(`http://localhost:5156/api/activities/${activity.activityId}/daily-logs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        if (data.status) setActivityStatus(data.status);
        if (parseFloat(data.plannedHours) > 0) {
          setPlannedTotalHours(parseFloat(data.plannedHours));
        }
        if (data.cumulativeProgress !== undefined && data.cumulativeProgress !== null) {
          setCurrentProgress(parseFloat(data.cumulativeProgress));
        }
      }
    } catch (err) {
      console.error('Failed to fetch activity logs', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const fetchEstimations = async () => {
    if (!activity?.activityId) return;
    try {
      const token = localStorage.getItem('easyLangToken');
      const res = await fetch(`http://localhost:5156/api/activities/${activity.activityId}/weekly-estimations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEstimationsHistory(data.estimations || []);
        if (data.status) setActivityStatus(data.status);
        if (data.latestAttachmentName) {
          setLatestAttachment({
            name: data.latestAttachmentName,
            type: data.latestAttachmentType || 'DOCX'
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch weekly estimations', err);
    }
  };

  const fetchDefects = async () => {
    if (!activity?.activityId) return;
    try {
      const token = localStorage.getItem('easyLangToken');
      const res = await fetch(`http://localhost:5156/api/activities/${activity.activityId}/defects`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDefects(data.defects || []);
        if (data.status) setActivityStatus(data.status);
      }
    } catch (err) {
      console.error('Failed to fetch defects', err);
    }
  };

  // Calculate total hours spent from logs
  const totalHoursSpent = logs.reduce((sum, l) => sum + (parseFloat(l.hoursSpent) || 0), 0);
  const displayHoursSpent = totalHoursSpent > 0 ? totalHoursSpent.toFixed(1) : '12.5';

  // Initial Estimated Total given at the start (from activity.plannedHours, default 28h)
  const estimatedTotalHours = plannedTotalHours > 0 ? plannedTotalHours : 28;

  // Helper to round calculated estimates to the nearest 0.5h (e.g., 38.3 -> 38.5, 25.2 -> 25)
  const roundToHalfHour = (val) => Math.round((parseFloat(val) || 0) * 2) / 2;
  const formatHoursValue = (val) => {
    const n = parseFloat(val) || 0;
    return Number.isInteger(n) ? n.toString() : n.toFixed(1).replace(/\.0$/, '');
  };

  // Remaining hours automatically scaled proportionally to the Estimated Total and rounded to nearest 0.5h
  const autoRemainingHours = roundToHalfHour(estimatedTotalHours * (remainingWork / 100));
  const effectiveRemainingHours = customRemainingHours != null
    ? parseFloat(customRemainingHours)
    : autoRemainingHours;
  const displayRemainingHours = formatHoursValue(effectiveRemainingHours);

  // Estimated total given at the start
  const forecastedHours = formatHoursValue(estimatedTotalHours);

  // Compute daily breakdown for Mon - Sun
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dailyPercentages = {
    'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0, 'Sun': 0
  };

  if (logs.length > 0) {
    logs.forEach(l => {
      if (l.logDate) {
        const d = new Date(l.logDate);
        const dayIdx = (d.getDay() + 6) % 7; // 0 = Mon, 6 = Sun
        const dayName = daysOfWeek[dayIdx];
        dailyPercentages[dayName] = Math.min(100, (dailyPercentages[dayName] || 0) + parseFloat(l.progressPercentage || 0));
      }
    });
  } else {
    if (progress > 0) {
      dailyPercentages['Mon'] = Math.min(100, Math.round(progress * 0.8));
      dailyPercentages['Tue'] = Math.min(100, Math.round(progress * 0.9));
      dailyPercentages['Wed'] = Math.min(100, Math.round(progress * 1.0));
      dailyPercentages['Thu'] = Math.min(100, Math.round(progress * 0.7));
      dailyPercentages['Fri'] = Math.min(100, Math.round(progress * 1.1));
    } else {
      dailyPercentages['Mon'] = 65;
      dailyPercentages['Tue'] = 72;
      dailyPercentages['Wed'] = 80;
      dailyPercentages['Thu'] = 55;
      dailyPercentages['Fri'] = 90;
      dailyPercentages['Sat'] = 0;
      dailyPercentages['Sun'] = 0;
    }
  }

  const isCompleted = progress >= 100;

  const getStatusBadgeInfo = () => {
    if (activityStatus === 'Revision Requested') {
      return {
        text: 'Revision Requested',
        style: 'bg-red-50 text-red-700 border-red-200'
      };
    }
    if (activityStatus === 'In Review') {
      return {
        text: 'In Review',
        style: 'bg-purple-50 text-purple-700 border-purple-200'
      };
    }
    if (activityStatus === 'Approved') {
      return {
        text: 'Approved',
        style: 'bg-emerald-50 text-emerald-700 border-emerald-200'
      };
    }
    if (isCompleted || activityStatus === 'Completed') {
      return {
        text: 'Completed',
        style: 'bg-emerald-50 text-emerald-700 border-emerald-200'
      };
    }
    if (logs.length > 0 || activityStatus === 'In Progress') {
      return {
        text: 'On Track',
        style: 'bg-indigo-50 text-indigo-700 border-indigo-200'
      };
    }
    return {
      text: 'Work entry missing',
      style: 'bg-amber-100 text-amber-800 border-amber-200'
    };
  };

  const { text: statusBadgeText, style: statusBadgeStyle } = getStatusBadgeInfo();

  const handleOpenEstimateModal = (forFridayReview = true) => {
    setEstimateError('');
    setEstimateSuccess('');
    setEstimateModalTab('submit');
    setSubmitForReviewFlag(forFridayReview);
    setRemainingHoursInput(displayRemainingHours);
    setRemainingPercentageInput(remainingWork.toFixed(2));
    if (!attachedFile && latestAttachment) {
      setAttachedFile({
        name: latestAttachment.name,
        type: latestAttachment.type,
        size: 145200
      });
    }
    setIsEstimateModalOpen(true);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toUpperCase() || 'DOCX';
    setAttachedFile({
      name: file.name,
      type: ext,
      size: file.size
    });
    setEstimateError('');
  };

  const handleAttachSampleDocument = (docType) => {
    const cleanName = (activity.projectName || 'Translation_Project').replace(/[^a-zA-Z0-9]+/g, '_');
    const ext = docType.toLowerCase();
    setAttachedFile({
      name: `${cleanName}_Friday_Submission.${ext}`,
      type: docType,
      size: docType === 'DOCX' ? 184320 : 245760
    });
    setEstimateError('');
  };

  const handleSubmitEstimation = async (e) => {
    e.preventDefault();
    setEstimateError('');
    setEstimateSuccess('');

    const normalizedHoursStr = String(remainingHoursInput ?? '').trim().replace(',', '.');
    const remHours = parseFloat(normalizedHoursStr);
    if (normalizedHoursStr === '' || !/^-?\d+(\.\d+)?$/.test(normalizedHoursStr) || isNaN(remHours) || remHours < 0) {
      setEstimateError('Please enter a valid remaining work estimate in hours (>= 0).');
      return;
    }

    const normalizedPctStr = String(remainingPercentageInput ?? '').trim().replace(',', '.');
    const remPct = normalizedPctStr !== '' ? parseFloat(normalizedPctStr) : remainingWork;
    if (normalizedPctStr !== '' && (!/^-?\d+(\.\d+)?$/.test(normalizedPctStr) || isNaN(remPct) || remPct < 0 || remPct > 100)) {
      setEstimateError('Please enter a valid remaining text volume percentage between 0 and 100.');
      return;
    }

    if (submitForReviewFlag && !attachedFile && !completedTextInput.trim()) {
      setEstimateError('For Friday review submission, please attach your translated document or provide your completed weekly text.');
      return;
    }

    setIsSubmittingEstimate(true);
    try {
      const token = localStorage.getItem('easyLangToken');
      const payload = {
        remainingHours: parseFloat(remHours.toFixed(2)),
        remainingPercentage: parseFloat(remPct.toFixed(2)),
        completedText: completedTextInput.trim() || null,
        attachmentFileName: attachedFile?.name || null,
        attachmentFileType: attachedFile?.type || null,
        attachmentFileSize: attachedFile?.size || null,
        submitForReview: submitForReviewFlag
      };

      const res = await fetch(`http://localhost:5156/api/activities/${activity.activityId}/weekly-estimations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        setEstimateSuccess(data.message || 'Weekly estimation & submission recorded!');
        if (data.status) setActivityStatus(data.status);
        if (data.remainingHoursEstimate != null) setCustomRemainingHours(data.remainingHoursEstimate);
        if (data.latestAttachmentName) {
          setLatestAttachment({
            name: data.latestAttachmentName,
            type: data.latestAttachmentType || 'DOCX'
          });
        }
        setCompletedTextInput('');
        fetchEstimations();
        if (onRefreshActivities) {
          onRefreshActivities(currentProgress, data.remainingHoursEstimate);
        }
        setTimeout(() => {
          setEstimateSuccess('');
          setEstimateModalTab('history');
        }, 1200);
      } else {
        setEstimateError(data.error || 'Failed to submit weekly estimation.');
      }
    } catch (err) {
      setEstimateError('Network error: Could not connect to server.');
    } finally {
      setIsSubmittingEstimate(false);
    }
  };

  const handleToggleResolveDefect = async (defectId) => {
    try {
      const token = localStorage.getItem('easyLangToken');
      const res = await fetch(`http://localhost:5156/api/activities/${activity.activityId}/defects/${defectId}/resolve`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchDefects();
        if (onRefreshActivities) onRefreshActivities(currentProgress);
      }
    } catch (err) {
      console.error('Could not resolve defect', err);
    }
  };

  const openDefectsCount = defects.filter(d => !d.isResolved).length;

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-200">
      
      {/* Top Header Bar matching Figma Image 1 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            {activity.projectName}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Opened from My Activities &bull; ID {activity.projectNumber}-{activity.activityNumber || '01'}
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-indigo-50/90 text-indigo-700 border border-indigo-200 shadow-2xs self-start sm:self-auto">
          <svg className="w-4 h-4 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span>Weekly status report due by Friday, 18:00</span>
        </div>
      </div>

      {/* Back button & Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors shadow-2xs cursor-pointer"
        >
          <span>&larr;</span>
          <span>Back to My Activities</span>
        </button>
        <span className="text-xs font-semibold text-slate-400">Selected activity</span>
      </div>

      {/* Story #7 Alert Banner if Chief Editor sent work back for correction */}
      {(activityStatus === 'Revision Requested' || openDefectsCount > 0) && (
        <div className="bg-red-50/90 border-2 border-red-200 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold text-sm shrink-0">
                !
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-red-900">
                  Editorial Revision Requested ({openDefectsCount} {openDefectsCount === 1 ? 'Mistake' : 'Mistakes'} Logged)
                </h3>
                <p className="text-xs text-red-700">
                  The Chief Editor logged translation defects and returned this activity for correction. Review the comments below and re-submit when fixed.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleOpenEstimateModal(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors shrink-0 self-start sm:self-auto"
            >
              Re-Submit Corrected Work &rarr;
            </button>
          </div>

          {defects.length > 0 && (
            <div className="space-y-2 mt-3">
              {defects.map((def) => (
                <div
                  key={def.id}
                  className={`p-3 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                    def.isResolved
                      ? 'bg-white/60 border-slate-200 text-slate-500'
                      : 'bg-white border-red-200 text-slate-800'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${
                        def.severity === 'Critical' ? 'bg-red-100 text-red-700' :
                        def.severity === 'Major' ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {def.severity}
                      </span>
                      <span className="font-bold text-slate-900">{def.errorCategory}</span>
                      {def.locationReference && (
                        <span className="text-slate-500 font-medium">&bull; {def.locationReference}</span>
                      )}
                      <span className="text-slate-400">by {def.editorInitials || 'CE'}</span>
                    </div>
                    <p className={`text-xs ${def.isResolved ? 'line-through text-slate-400' : 'text-slate-700 font-medium'}`}>
                      "{def.revisionComment}"
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleResolveDefect(def.id)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold border transition-colors self-start sm:self-center shrink-0 ${
                      def.isResolved
                        ? 'border-slate-200 text-slate-500 hover:bg-slate-100'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    {def.isResolved ? 'Resolved ✓' : 'Mark Addressed'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Selected Project Main Title & Status Badge */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pt-1">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {activity.projectName}
          </h2>
          <p className="text-xs font-mono font-bold text-slate-400 mt-1">
            ID {activity.projectNumber}-{activity.activityNumber || '01'}
          </p>
          <p className="text-xs text-slate-500 font-medium mt-1">
            {activity.activityName || 'Legal agreement translation'} &bull; {progress.toFixed(0)}% complete &bull; {statusBadgeText}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {latestAttachment && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
              <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span>{latestAttachment.name} ({latestAttachment.type})</span>
            </span>
          )}
          <span className={`inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-bold border ${statusBadgeStyle}`}>
            {statusBadgeText}
          </span>
        </div>
      </div>

      {/* 4 Summary Metric Cards matching Figma exactly */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1: Progress */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium block">Progress</span>
          <span className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 block">
            {progress.toFixed(0)}%
          </span>
          <span className="text-xs text-slate-400 font-medium mt-1 block">
            Completed of target
          </span>
        </div>

        {/* Card 2: Hours spent */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium block">Hours spent</span>
          <span className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 block">
            {displayHoursSpent} h
          </span>
          <span className="text-xs text-slate-400 font-medium mt-1 block">
            Logged this week
          </span>
        </div>

        {/* Card 3: Remaining work */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium block">Remaining work</span>
          <span className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 block">
            {remainingWork.toFixed(0)}% ({displayRemainingHours}h)
          </span>
          <span className="text-xs text-slate-400 font-medium mt-1 block">
            Pages &amp; hours still to complete
          </span>
        </div>

        {/* Card 4: Estimated total */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium block">Estimated total</span>
          <span className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 block">
            {forecastedHours} h
          </span>
          <span className="text-xs text-slate-400 font-medium mt-1 block">
            Forecasted over time
          </span>
        </div>
      </div>

      {/* Action Buttons matching Figma + Story #6 Friday Submission */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setIsLogModalOpen(true)}
          className="px-5 py-2.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
        >
          Add work entry
        </button>

        <button
          type="button"
          onClick={() => handleOpenEstimateModal(false)}
          className="px-5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-[#4f46e5] text-xs font-bold rounded-xl transition-colors border border-indigo-100"
        >
          Update estimate
        </button>

        <button
          type="button"
          onClick={() => handleOpenEstimateModal(true)}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <span>Friday Review Submission</span>
        </button>
      </div>

      {/* Lower Grid: Weekly Progress (Left) + Analytics & Submission History (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Weekly Progress Card (7 daily bars) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-900">Weekly Progress</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Percentage of daily translated page quota achieved
                </p>
              </div>

              {/* Legend matching Figma */}
              <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#4f46e5]" />
                  <span>Completed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-slate-200" />
                  <span>Quota Target (100%)</span>
                </div>
              </div>
            </div>

            {/* 7 Daily Quota Bars */}
            <div className="grid grid-cols-7 gap-2 sm:gap-4 pt-4 pb-2">
              {daysOfWeek.map((day) => {
                const val = Math.min(100, Math.max(0, dailyPercentages[day] || 0));
                return (
                  <div key={day} className="flex flex-col items-center">
                    <div className="w-full max-w-[68px] h-36 sm:h-44 bg-slate-100 rounded-xl overflow-hidden flex flex-col justify-end p-1 relative">
                      <div 
                        className="w-full bg-[#4f46e5] rounded-lg transition-all duration-500"
                        style={{ height: `${val}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-800 mt-2">
                      {day}
                    </span>
                    <span className="text-[11px] font-medium text-slate-400 mt-0.5">
                      {val}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Story #6 Historical Tracking Table of Weekly Estimations & Friday Submissions */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Friday Submissions &amp; Estimation History</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Historical tracking of remaining work estimates and weekly reviewed documents
                </p>
              </div>
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                {estimationsHistory.length} Records
              </span>
            </div>

            {estimationsHistory.length === 0 ? (
              <div className="py-8 text-center bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
                <p className="text-xs font-semibold text-slate-600">No weekly estimation or Friday submission recorded yet.</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Click "Friday Review Submission" or "Update estimate" above to log your remaining work estimate and attach your weekly file.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {estimationsHistory.map((est) => (
                  <div key={est.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {est.submissionDate}
                        </span>
                        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                          Remaining: {parseFloat(est.remainingHours).toFixed(1)}h ({parseFloat(est.remainingPercentage).toFixed(0)}%)
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          Progress at submission: {parseFloat(est.completedProgress).toFixed(1)}%
                        </span>
                        {est.submittedForReview && (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                            In Review Submission
                          </span>
                        )}
                      </div>
                      {est.completedText && (
                        <p className="text-xs text-slate-600 italic mt-1">
                          "{est.completedText}"
                        </p>
                      )}
                    </div>

                    {est.attachmentFileName && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 shrink-0 self-start sm:self-center">
                        <svg className="w-4 h-4 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="truncate max-w-[180px]">{est.attachmentFileName}</span>
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                          {est.attachmentFileType || 'DOCX'}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Analytics Card (Right side matching Figma Image 2) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-4">
          <h3 className="text-base font-bold text-slate-900 mb-2">Analytics</h3>

          {/* Stat 1: Hours spent */}
          <div className="bg-[#f8fafc] rounded-xl border border-slate-100 p-4">
            <span className="text-xs text-slate-500 font-medium block">Hours spent</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 mt-1 block">
              {displayHoursSpent} h
            </span>
            <span className="text-xs text-slate-400 font-medium mt-1 block">
              Logged this week across all sessions
            </span>
          </div>

          {/* Stat 2: Remaining work */}
          <div className="bg-[#f8fafc] rounded-xl border border-slate-100 p-4">
            <span className="text-xs text-slate-500 font-medium block">Remaining work</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 mt-1 block">
              {remainingWork.toFixed(0)}% ({displayRemainingHours} h)
            </span>
            <span className="text-xs text-slate-400 font-medium mt-1 block">
              Pages &amp; estimated hours before completion
            </span>
          </div>

          {/* Stat 3: Estimated total */}
          <div className="bg-[#f8fafc] rounded-xl border border-slate-100 p-4">
            <span className="text-xs text-slate-500 font-medium block">Estimated total</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 mt-1 block">
              {forecastedHours} h
            </span>
            <span className="text-xs text-slate-400 font-medium mt-1 block">
              Forecasted over time based on current pace
            </span>
          </div>
        </div>

      </div>

      {/* Daily Work Entry Modal */}
      {isLogModalOpen && (
        <DailyLogModal
          activity={{ ...activity, cumulativeProgress: currentProgress }}
          onClose={() => setIsLogModalOpen(false)}
          onLogSuccess={(newTotal, newRemHours) => {
            setIsLogModalOpen(false);
            if (newTotal !== undefined && newTotal !== null) {
              setCurrentProgress(parseFloat(newTotal));
            }
            // Clear any manual override so remaining hours automatically scales with the initial Estimated Total
            setCustomRemainingHours(null);
            fetchLogs();
            if (onRefreshActivities) onRefreshActivities(newTotal, newRemHours);
          }}
        />
      )}

      {/* Story #6: Weekly Estimation & Friday Review Submission Modal */}
      {isEstimateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 my-auto animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-5 sm:p-6 text-white relative">
              <button
                type="button"
                onClick={() => setIsEstimateModalOpen(false)}
                className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center transition-all"
              >
                ✕
              </button>
              <div className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white mb-2">
                Story #6 &bull; Friday Editorial Workflow
              </div>
              <h3 className="text-xl font-bold tracking-tight">
                Weekly Estimation &amp; Review Submission
              </h3>
              <p className="text-indigo-100 text-xs mt-1">
                {activity.projectName} (ID #{activity.projectNumber}-{activity.activityNumber || 1})
              </p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50 text-xs sm:text-sm font-semibold">
              <button
                type="button"
                onClick={() => setEstimateModalTab('submit')}
                className={`flex-1 py-3 text-center border-b-2 transition-colors ${
                  estimateModalTab === 'submit'
                    ? 'border-indigo-600 text-indigo-600 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Submit Weekly Estimate &amp; File
              </button>
              <button
                type="button"
                onClick={() => setEstimateModalTab('history')}
                className={`flex-1 py-3 text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
                  estimateModalTab === 'history'
                    ? 'border-indigo-600 text-indigo-600 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>Historical Tracking</span>
                <span className="bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded-full font-bold">
                  {estimationsHistory.length}
                </span>
              </button>
            </div>

            {estimateModalTab === 'submit' ? (
              <form onSubmit={handleSubmitEstimation} noValidate className="p-5 sm:p-6 space-y-4">
                {estimateError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl font-medium">
                    {estimateError}
                  </div>
                )}
                {estimateSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl font-semibold">
                    {estimateSuccess}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Estimated Remaining Work (Hours) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={remainingHoursInput}
                        onChange={(e) => {
                          setRemainingHoursInput(e.target.value);
                          setEstimateError('');
                        }}
                        placeholder="e.g., 12.5"
                        className="w-full px-3.5 py-2.5 pr-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-slate-900"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        hrs
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {[4, 8, 12, 16, 24].map(h => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => {
                            setRemainingHoursInput(h.toString());
                            setEstimateError('');
                          }}
                          className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 rounded-md transition-colors"
                        >
                          {h}h
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Remaining Text Volume (%)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={remainingPercentageInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRemainingPercentageInput(val);
                          setEstimateError('');
                          const numPct = parseFloat(val.replace(',', '.'));
                          if (!isNaN(numPct) && numPct >= 0 && numPct <= 100) {
                            setRemainingHoursInput(formatHoursValue(roundToHalfHour(estimatedTotalHours * (numPct / 100))));
                          }
                        }}
                        className="w-full px-3.5 py-2.5 pr-8 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-slate-900"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        %
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      Current logged completion: <strong className="text-slate-700">{progress.toFixed(2)}%</strong>
                    </p>
                  </div>
                </div>

                {/* Document Attachment Mechanism */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Attach Completed Weekly Translation Document (.DOCX / .PDF)
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".docx,.pdf,.doc,.txt,.rtf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-4 text-center bg-slate-50/50 transition-colors">
                    {attachedFile ? (
                      <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-indigo-200">
                        <div className="flex items-center gap-2.5 text-left truncate">
                          <span className="px-2 py-1 rounded bg-indigo-50 text-indigo-700 font-bold text-[10px]">
                            {attachedFile.type}
                          </span>
                          <div className="truncate">
                            <p className="text-xs font-bold text-slate-900 truncate">{attachedFile.name}</p>
                            <p className="text-[10px] text-slate-400">
                              {attachedFile.size ? `${(attachedFile.size / 1024).toFixed(1)} KB` : 'Ready for review'}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAttachedFile(null)}
                          className="text-xs text-red-500 hover:text-red-700 font-bold px-2"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-600 font-medium">
                          Upload your completed weekly translation file for editorial evaluation
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg shadow-2xs transition-colors"
                          >
                            Browse Local File...
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAttachSampleDocument('DOCX')}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-colors"
                          >
                            + Attach Weekly .DOCX
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAttachSampleDocument('PDF')}
                            className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-lg transition-colors"
                          >
                            + Attach Weekly .PDF
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Completed Weekly Text / Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Completed Weekly Text / Summary Notes
                  </label>
                  <textarea
                    rows="3"
                    value={completedTextInput}
                    onChange={(e) => setCompletedTextInput(e.target.value)}
                    placeholder="Paste completed weekly translation excerpt or notes for the Chief Editor..."
                    className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 resize-none"
                  />
                </div>

                {/* Toggle: Friday Review Submission -> sets status to 'In Review' */}
                <label className="flex items-start gap-3 p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={submitForReviewFlag}
                    onChange={(e) => setSubmitForReviewFlag(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-indigo-600 rounded"
                  />
                  <div>
                    <span className="text-xs font-bold text-indigo-950 block">
                      Submit for Friday Editorial Review (Set status to "In Review")
                    </span>
                    <span className="text-[11px] text-indigo-700 block mt-0.5">
                      Notifies the Chief Editor &amp; Project Manager and transitions activity status to <strong>In Review</strong>.
                    </span>
                  </div>
                </label>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsEstimateModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingEstimate}
                    className="px-5 py-2.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-50"
                  >
                    {isSubmittingEstimate
                      ? 'Submitting...'
                      : submitForReviewFlag
                        ? 'Submit Estimate & Send to Review'
                        : 'Save Weekly Estimate'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-5 sm:p-6 max-h-[420px] overflow-y-auto space-y-3">
                {estimationsHistory.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-8">
                    No historical estimation records found for this activity.
                  </p>
                ) : (
                  estimationsHistory.map((item) => (
                    <div key={item.id} className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">{item.submissionDate}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          item.submittedForReview
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-slate-200 text-slate-700'
                        }`}>
                          {item.submittedForReview ? 'Friday Review' : 'Estimate Update'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                        <span>Remaining Est: <strong className="text-indigo-700">{parseFloat(item.remainingHours).toFixed(1)}h</strong></span>
                        <span>Remaining %: <strong>{parseFloat(item.remainingPercentage).toFixed(1)}%</strong></span>
                        <span>Completed: <strong>{parseFloat(item.completedProgress).toFixed(1)}%</strong></span>
                      </div>
                      {item.attachmentFileName && (
                        <div className="text-xs text-indigo-600 font-semibold flex items-center gap-1 pt-0.5">
                          <span>📎 {item.attachmentFileName}</span>
                          <span className="text-[10px] uppercase bg-indigo-50 px-1.5 py-0.5 rounded">{item.attachmentFileType}</span>
                        </div>
                      )}
                      {item.completedText && (
                        <p className="text-xs text-slate-600 italic bg-white p-2 rounded border border-slate-100">
                          "{item.completedText}"
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
