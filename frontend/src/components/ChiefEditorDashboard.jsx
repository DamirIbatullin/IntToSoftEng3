import React, { useState, useEffect } from 'react';

export default function ChiefEditorDashboard({ userProfile, onLogout }) {
  const [projects, setProjects] = useState([]);
  const [chiefEditors, setChiefEditors] = useState([]);
  const [complexityFilter, setComplexityFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 7; // 7 projects per page as per Figma & requirements

  // Editorial Review & Defect Logging Modal state (Story #7 & Story #2)
  const [reviewModalProject, setReviewModalProject] = useState(null);
  const [activeModalTab, setActiveModalTab] = useState('defects'); // 'defects' | 'budget'
  const [reviewDetails, setReviewDetails] = useState(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Story #7 Defect Form state
  const [errorCategory, setErrorCategory] = useState('Terminology');
  const [severity, setSeverity] = useState('Major');
  const [locationReference, setLocationReference] = useState('');
  const [revisionComment, setRevisionComment] = useState('');
  const [sendBackToTranslator, setSendBackToTranslator] = useState(true);
  const [isSubmittingDefect, setIsSubmittingDefect] = useState(false);
  const [defectFeedback, setDefectFeedback] = useState({ error: '', success: '' });

  // Story #2 Review Hours state
  const [reviewHoursInput, setReviewHoursInput] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState('');

  // Story #8 Request Assistant Editor Modal state
  const [isAssistantModalOpen, setIsAssistantModalOpen] = useState(false);
  const [assistantProjectId, setAssistantProjectId] = useState('');
  const [selectedSecondaryEditorId, setSelectedSecondaryEditorId] = useState('');
  const [assistantNote, setAssistantNote] = useState('');
  const [assistantFeedback, setAssistantFeedback] = useState({ error: '', success: '' });

  useEffect(() => {
    fetchProjects();
    fetchChiefEditors();
  }, []);

  const fetchProjects = async () => {
    try {
      const token = localStorage.getItem('easyLangToken');
      const res = await fetch('http://localhost:5156/api/projects', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (err) {
      console.error('Could not fetch projects', err);
    }
  };

  const fetchChiefEditors = async () => {
    try {
      const res = await fetch('http://localhost:5156/api/employees/chief-editors');
      if (res.ok) {
        const data = await res.json();
        setChiefEditors(data);
      }
    } catch (err) {
      console.error('Could not fetch chief editors', err);
    }
  };

  const openReviewModal = async (project) => {
    setReviewModalProject(project);
    setActiveModalTab('defects');
    setReviewHoursInput(project.reviewHours != null ? project.reviewHours.toString() : '');
    setReviewError('');
    setReviewSuccess('');
    setDefectFeedback({ error: '', success: '' });
    setRevisionComment('');
    setLocationReference('');
    setErrorCategory('Terminology');
    setSeverity('Major');
    setSendBackToTranslator(true);

    setIsLoadingDetails(true);
    try {
      const token = localStorage.getItem('easyLangToken');
      const res = await fetch(`http://localhost:5156/api/projects/${project.projectId}/review-details`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReviewDetails(data);
      } else {
        setReviewDetails(null);
      }
    } catch (err) {
      console.error('Failed to load review details', err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const closeReviewModal = () => {
    setReviewModalProject(null);
    setReviewDetails(null);
    setReviewHoursInput('');
    setReviewError('');
    setReviewSuccess('');
    setDefectFeedback({ error: '', success: '' });
  };

  // Story #7: Log Defect & Send Back to Translator
  const handleLogDefect = async (e) => {
    e.preventDefault();
    if (!reviewModalProject) return;

    const activityId = reviewDetails?.activityId || reviewModalProject.activityId;
    if (!activityId) {
      setDefectFeedback({ error: 'No activity linked to this project.', success: '' });
      return;
    }

    if (!revisionComment.trim()) {
      setDefectFeedback({ error: 'Revision comment is required to log a translation mistake.', success: '' });
      return;
    }

    setIsSubmittingDefect(true);
    setDefectFeedback({ error: '', success: '' });

    try {
      const token = localStorage.getItem('easyLangToken');
      const res = await fetch(`http://localhost:5156/api/activities/${activityId}/defects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          errorCategory,
          severity,
          locationReference: locationReference.trim() || null,
          revisionComment: revisionComment.trim(),
          sendBackToTranslator
        })
      });

      const data = await res.json();
      if (res.ok) {
        setDefectFeedback({
          error: '',
          success: data.message || 'Mistake logged successfully!'
        });
        setRevisionComment('');
        setLocationReference('');

        // Refresh review details & projects list
        const detailRes = await fetch(`http://localhost:5156/api/projects/${reviewModalProject.projectId}/review-details`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (detailRes.ok) {
          const detailData = await detailRes.json();
          setReviewDetails(detailData);
        }
        fetchProjects();
        if (data.status) {
          setReviewModalProject(prev => prev ? { ...prev, status: data.status } : null);
        }
      } else {
        setDefectFeedback({ error: data.error || 'Failed to log defect.', success: '' });
      }
    } catch (err) {
      setDefectFeedback({ error: 'Failed to connect to backend server.', success: '' });
    } finally {
      setIsSubmittingDefect(false);
    }
  };

  // Story #7: Status Toggle (Send Back to Translator / In Review / Approve)
  const handleToggleActivityStatus = async (targetStatus) => {
    if (!reviewModalProject) return;
    const activityId = reviewDetails?.activityId || reviewModalProject.activityId;
    if (!activityId) return;

    setDefectFeedback({ error: '', success: '' });
    try {
      const token = localStorage.getItem('easyLangToken');
      const res = await fetch(`http://localhost:5156/api/activities/${activityId}/review-status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: targetStatus,
          revisionComment: revisionComment.trim() || null,
          errorCategory,
          severity,
          locationReference: locationReference.trim() || null
        })
      });

      const data = await res.json();
      if (res.ok) {
        setRevisionComment('');
        setDefectFeedback({
          error: '',
          success: targetStatus === 'Revision Requested'
            ? 'Task sent back to Translator for correction (Status: Revision Requested).'
            : `Task status updated to '${targetStatus}'.`
        });
        setReviewModalProject(prev => prev ? { ...prev, status: targetStatus } : null);
        setReviewDetails(prev => prev ? { ...prev, status: targetStatus } : null);

        const detailRes = await fetch(`http://localhost:5156/api/projects/${reviewModalProject.projectId}/review-details`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (detailRes.ok) {
          setReviewDetails(await detailRes.json());
        }
        fetchProjects();
      } else {
        setDefectFeedback({ error: data.error || 'Could not update status.', success: '' });
      }
    } catch (err) {
      setDefectFeedback({ error: 'Network error while updating status.', success: '' });
    }
  };

  const handleToggleResolveDefect = async (defectId) => {
    const activityId = reviewDetails?.activityId || reviewModalProject?.activityId;
    if (!activityId) return;
    try {
      const token = localStorage.getItem('easyLangToken');
      const res = await fetch(`http://localhost:5156/api/activities/${activityId}/defects/${defectId}/resolve`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const detailRes = await fetch(`http://localhost:5156/api/projects/${reviewModalProject.projectId}/review-details`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (detailRes.ok) {
          setReviewDetails(await detailRes.json());
        }
        fetchProjects();
      }
    } catch (err) {
      console.error('Failed to toggle defect resolution', err);
    }
  };

  const handleDeleteDefect = async (defectId) => {
    const activityId = reviewDetails?.activityId || reviewModalProject?.activityId;
    if (!activityId) return;
    try {
      const token = localStorage.getItem('easyLangToken');
      const res = await fetch(`http://localhost:5156/api/activities/${activityId}/defects/${defectId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const detailRes = await fetch(`http://localhost:5156/api/projects/${reviewModalProject.projectId}/review-details`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (detailRes.ok) {
          setReviewDetails(await detailRes.json());
        }
        fetchProjects();
      }
    } catch (err) {
      console.error('Failed to delete defect', err);
    }
  };

  const handleSaveReviewHours = async (e) => {
    e.preventDefault();
    if (!reviewModalProject) return;

    const normalized = String(reviewHoursInput ?? '').trim().replace(',', '.');
    if (!normalized) {
      setReviewError('Review hours are required.');
      return;
    }

    const val = parseFloat(normalized);
    if (!/^-?\d+(\.\d+)?$/.test(normalized) || isNaN(val) || val < 0) {
      setReviewError('Please enter a valid number of review hours (>= 0).');
      return;
    }

    setIsSubmittingReview(true);
    setReviewError('');
    setReviewSuccess('');
    try {
      const token = localStorage.getItem('easyLangToken');
      const res = await fetch(`http://localhost:5156/api/projects/${reviewModalProject.projectId}/review`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          reviewHours: val
        })
      });

      if (res.ok) {
        setProjects(prev => prev.map(p => 
          p.projectId === reviewModalProject.projectId ? { ...p, reviewHours: val } : p
        ));
        setReviewModalProject(prev => prev ? { ...prev, reviewHours: val } : null);
        setReviewSuccess('Review hours budget updated successfully!');
      } else {
        const data = await res.json();
        setReviewError(data.error || 'Failed to save review hours.');
      }
    } catch (err) {
      setReviewError('Failed to connect to backend server.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Story #8: Request / Allocate Secondary Assistant Editor
  const handleAllocateAssistantEditor = async (e) => {
    e.preventDefault();
    setAssistantFeedback({ error: '', success: '' });

    if (!assistantProjectId || !selectedSecondaryEditorId) {
      setAssistantFeedback({ error: 'Please select both a project and an available Chief Editor.', success: '' });
      return;
    }

    try {
      const token = localStorage.getItem('easyLangToken');
      const res = await fetch(`http://localhost:5156/api/projects/${assistantProjectId}/reassign-editor`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          secondaryChiefEditorId: parseInt(selectedSecondaryEditorId),
          reassignmentNote: assistantNote.trim() || 'Requested secondary editor for workload sharing'
        })
      });

      const data = await res.json();
      if (res.ok) {
        setAssistantFeedback({ error: '', success: data.message || 'Assistant Chief Editor assigned!' });
        fetchProjects();
        fetchChiefEditors();
        setTimeout(() => {
          setIsAssistantModalOpen(false);
          setAssistantFeedback({ error: '', success: '' });
        }, 1000);
      } else {
        setAssistantFeedback({ error: data.error || 'Could not assign assistant editor.', success: '' });
      }
    } catch (err) {
      setAssistantFeedback({ error: 'Network error.', success: '' });
    }
  };

  // Filter projects
  const filteredProjects = projects.filter(p => {
    const matchesComplexity = complexityFilter === 'All' || p.complexity === complexityFilter;
    const matchesStatus =
      statusFilter === 'All'
        ? true
        : statusFilter === 'My Queue'
          ? (p.chiefEditorId === userProfile?.id || p.secondaryChiefEditorId === userProfile?.id || p.chiefEditor === userProfile?.initials || p.secondaryChiefEditor === userProfile?.initials)
          : p.status === statusFilter;

    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      p.name?.toLowerCase().includes(q) || 
      p.id?.toString().includes(q) || 
      p.translator?.toLowerCase().includes(q);
    return matchesComplexity && matchesStatus && matchesSearch;
  });

  // Pagination with 7 projects per page & sliding 5-button window
  const totalProjects = filteredProjects.length;
  const totalPages = Math.max(1, Math.ceil(totalProjects / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalProjects);
  const currentProjects = filteredProjects.slice(startIndex, endIndex);

  const getVisiblePages = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    let startPage = Math.min(currentPage, Math.max(1, totalPages - 4));
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }
    const pages = [];
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

  const renderStatusBadge = (project) => {
    const st = project.status || 'Pending Start';
    if (st === 'In Review') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
          In Review
        </span>
      );
    }
    if (st === 'Revision Requested') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          Revision Sent
        </span>
      );
    }
    if (st === 'Approved' || st === 'Completed') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {st}
        </span>
      );
    }
    if (st === 'On Track') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          On Track
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
        {st}
      </span>
    );
  };

  const currentStatusInModal = reviewDetails?.status || reviewModalProject?.status || 'In Review';

  return (
    <div className="flex min-h-screen bg-[#f8fafc] font-sans text-slate-800">
      
      {/* Figma Dark Sidebar */}
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
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-400/30 flex items-center justify-center font-bold text-xs">
          {userProfile?.initials || 'CE'}
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

      {/* Main Content */}
      <div className="flex-1 w-full overflow-x-hidden p-4 sm:p-6 md:p-8 max-w-7xl">
        
        {/* Header matching Figma Image 3 */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-[28px] font-extrabold text-[#111827] tracking-tight">
              Review Queue
            </h1>
            <span className="text-xs sm:text-sm font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
              {filteredProjects.length} Active
            </span>
            {projects.filter(p => p.status === 'In Review').length > 0 && (
              <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
                {projects.filter(p => p.status === 'In Review').length} In Friday Review
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setAssistantProjectId(projects[0]?.projectId?.toString() || '');
              const freeEditor = chiefEditors.find(e => e.id !== userProfile?.id) || chiefEditors[0];
              setSelectedSecondaryEditorId(freeEditor ? freeEditor.id.toString() : '');
              setIsAssistantModalOpen(true);
            }}
            className="px-4 py-2 border border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-bold text-xs rounded-xl transition-colors flex items-center gap-2 self-start sm:self-auto shadow-2xs bg-white cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Request Assistant Editor
          </button>
        </header>

        {/* Filter Pills and Search Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            {['All', 'High', 'Medium', 'Low'].map((level) => {
              const label = level === 'All' ? 'All Complexity' : `${level} Complexity`;
              const isActive = complexityFilter === level;
              return (
                <button
                  key={level}
                  onClick={() => {
                    setComplexityFilter(level);
                    setCurrentPage(1);
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isActive 
                      ? 'bg-[#4f46e5] text-white shadow-xs' 
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              );
            })}

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-slate-700 border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="All">Status: All</option>
              <option value="In Review">In Review (Friday Submissions)</option>
              <option value="Revision Requested">Revision Requested</option>
              <option value="Approved">Approved</option>
              <option value="My Queue">Assigned to Me (Primary/Secondary)</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-64">
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search Translator or Task ID..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
              />
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            <div className="text-xs text-slate-500 font-semibold whitespace-nowrap hidden sm:block">
              Sort by: <span className="text-slate-800 font-bold">Submission Date ▾</span>
            </div>
          </div>
        </div>

        {/* Table matching Figma Image 3 + Sprint 3 Status & Defects */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                  <th className="py-3.5 px-5">Translator</th>
                  <th className="py-3.5 px-5">Task ID</th>
                  <th className="py-3.5 px-5">Project &amp; Editors</th>
                  <th className="py-3.5 px-5">Complexity</th>
                  <th className="py-3.5 px-5">Review Status</th>
                  <th className="py-3.5 px-5">Submitted On</th>
                  <th className="py-3.5 px-5">File Type</th>
                  <th className="py-3.5 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentProjects.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-400 text-xs">
                      No projects matching the selected filters.
                    </td>
                  </tr>
                ) : (
                  currentProjects.map((project, idx) => {
                    const submissionDates = ['Sep 8, 2026', 'Sep 7, 2026', 'Sep 7, 2026', 'Sep 7, 2026', 'Sep 7, 2026', 'Sep 7, 2026', 'Sep 6, 2026'];
                    const submittedOn = project.lastSubmittedAt || submissionDates[(startIndex + idx) % submissionDates.length];

                    const fileTypeLabel = project.attachmentType || ((startIndex + idx) % 2 === 0 ? 'DOCX' : 'PDF');
                    const isDocx = fileTypeLabel.toUpperCase() !== 'PDF';

                    return (
                      <tr key={project.projectId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                              {(project.translator || 'TR').substring(0, 2).toUpperCase()}
                            </div>
                            <span className="text-xs font-bold text-slate-900">{project.translator}</span>
                          </div>
                        </td>

                        <td className="py-4 px-5 text-xs font-bold text-indigo-600">
                          #{project.id}
                        </td>

                        <td className="py-4 px-5">
                          <p className="text-sm font-bold text-slate-900">{project.name}</p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-semibold text-slate-500">
                              Lead CE: <strong>{project.chiefEditor || 'DD'}</strong>
                            </span>
                            {project.secondaryChiefEditor && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                + {project.secondaryChiefEditor} (Shared)
                              </span>
                            )}
                            {project.remainingHoursEstimate != null && (
                              <span className="text-[10px] font-semibold text-slate-500">
                                &bull; Est. {project.remainingHoursEstimate}h left
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-4 px-5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded tracking-wide ${
                            project.complexity === 'High' ? 'bg-red-50 text-red-600 border border-red-200' :
                            project.complexity === 'Medium' ? 'bg-amber-50 text-amber-600 border border-amber-200' :
                            'bg-emerald-50 text-emerald-600 border border-emerald-200'
                          }`}>
                            {(project.complexity || 'LOW').toUpperCase()}
                          </span>
                        </td>

                        <td className="py-4 px-5 whitespace-nowrap">
                          <div className="flex flex-col items-start gap-1">
                            {renderStatusBadge(project)}
                            {project.openDefectsCount > 0 && (
                              <span className="text-[10px] font-bold text-red-600">
                                {project.openDefectsCount} open {project.openDefectsCount === 1 ? 'defect' : 'defects'}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-4 px-5 text-xs text-slate-500 font-medium whitespace-nowrap">
                          {submittedOn}
                        </td>

                        <td className="py-4 px-5 text-xs text-slate-500 font-semibold whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5" title={project.attachmentName || ''}>
                            {isDocx ? (
                              <>
                                <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                {fileTypeLabel}
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                                PDF
                              </>
                            )}
                          </span>
                        </td>

                        <td className="py-4 px-5 text-right whitespace-nowrap">
                          <button 
                            onClick={() => openReviewModal(project)}
                            className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-colors border border-indigo-200 cursor-pointer"
                          >
                            {project.reviewHours != null ? `Review (${project.reviewHours}h)` : 'Review'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-4 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500 font-medium">
              Showing {totalProjects === 0 ? 0 : `${startIndex + 1}-${endIndex}`} of {totalProjects} submissions
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 flex items-center justify-center text-xs font-bold transition-colors"
                title="Previous page"
              >
                Previous
              </button>

              {getVisiblePages().map(pageNum => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${
                    currentPage === pageNum
                      ? 'bg-[#4f46e5] text-white shadow-xs'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {pageNum}
                </button>
              ))}

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 flex items-center justify-center text-xs font-bold transition-colors"
                title="Next page"
              >
                Next
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Story #7 & Story #2: Editorial Review, Defect Logging & Status Toggles Modal */}
      {reviewModalProject && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 my-auto animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-5 sm:p-6 pb-4 border-b border-slate-100 bg-slate-50/70 flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                    Editorial Review &amp; Quality Control
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded tracking-wide ${
                    reviewModalProject.complexity === 'High' ? 'bg-red-50 text-red-600 border border-red-200' :
                    reviewModalProject.complexity === 'Medium' ? 'bg-amber-50 text-amber-600 border border-amber-200' :
                    'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  }`}>
                    {(reviewModalProject.complexity || 'LOW').toUpperCase()} COMPLEXITY
                  </span>
                  {renderStatusBadge({ status: currentStatusInModal })}
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1">
                  #{reviewModalProject.id} &mdash; {reviewModalProject.name}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Translator: <strong className="text-slate-700">{reviewModalProject.translator}</strong> &bull; Progress: <strong className="text-slate-700">{parseFloat(reviewModalProject.progress || 0).toFixed(1)}%</strong>
                  {reviewDetails?.remainingHoursEstimate != null && (
                    <> &bull; Remaining Estimate: <strong className="text-indigo-700">{reviewDetails.remainingHoursEstimate}h</strong></>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={closeReviewModal}
                className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300/70 text-slate-600 flex items-center justify-center text-sm font-bold transition-colors shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 bg-white text-xs sm:text-sm font-bold">
              <button
                type="button"
                onClick={() => setActiveModalTab('defects')}
                className={`flex-1 py-3 text-center border-b-2 transition-colors flex items-center justify-center gap-2 ${
                  activeModalTab === 'defects'
                    ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>Story #7: Defect Logging &amp; Status Toggles</span>
                {reviewDetails?.defects?.length > 0 && (
                  <span className="px-2 py-0.5 text-[11px] rounded-full bg-red-100 text-red-700 font-bold">
                    {reviewDetails.defects.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab('budget')}
                className={`flex-1 py-3 text-center border-b-2 transition-colors ${
                  activeModalTab === 'budget'
                    ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Review Hours Budget &amp; Submissions
              </button>
            </div>

            {/* Tab 1: Story #7 Defect Logging & Rejection Workflow */}
            {activeModalTab === 'defects' && (
              <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                {defectFeedback.error && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl font-semibold">
                    {defectFeedback.error}
                  </div>
                )}
                {defectFeedback.success && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl font-semibold">
                    {defectFeedback.success}
                  </div>
                )}

                {/* Status Toggles Bar (Send back to Translator / Keep In Review / Approve) */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                    <span className="text-xs font-bold text-slate-700">
                      Workflow Status Toggle (Send Back or Approve):
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Current: <strong className="text-slate-800">{currentStatusInModal}</strong>
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleActivityStatus('Revision Requested')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        currentStatusInModal === 'Revision Requested'
                          ? 'bg-red-600 text-white border-red-600 shadow-xs'
                          : 'bg-white text-red-700 border-red-200 hover:bg-red-50'
                      }`}
                    >
                      <span>↩ Send Back to Translator</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleActivityStatus('In Review')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        currentStatusInModal === 'In Review'
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50'
                      }`}
                    >
                      <span>⏳ Keep In Review</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleActivityStatus('Approved')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        currentStatusInModal === 'Approved'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                      }`}
                    >
                      <span>✓ Approve Translation</span>
                    </button>
                  </div>
                </div>

                {/* Error Recording Interface with Revision Comment Fields */}
                <form onSubmit={handleLogDefect} noValidate className="space-y-3.5 border border-slate-200 rounded-xl p-4 bg-white">
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Log Translation Mistake / Defect
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Mistake Category
                      </label>
                      <select
                        value={errorCategory}
                        onChange={(e) => setErrorCategory(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-800 font-semibold"
                      >
                        <option value="Terminology">Terminology Error</option>
                        <option value="Mistranslation">Mistranslation / Accuracy</option>
                        <option value="Grammar & Syntax">Grammar &amp; Syntax</option>
                        <option value="Omission">Omission / Incomplete</option>
                        <option value="Formatting">Formatting &amp; Layout</option>
                        <option value="Style & Tone">Style &amp; Register</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Severity Level
                      </label>
                      <select
                        value={severity}
                        onChange={(e) => setSeverity(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-800 font-semibold"
                      >
                        <option value="Minor">Minor</option>
                        <option value="Major">Major</option>
                        <option value="Critical">Critical (Blocker)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Location / Page Ref
                      </label>
                      <input
                        type="text"
                        value={locationReference}
                        onChange={(e) => setLocationReference(e.target.value)}
                        placeholder="e.g., Page 4, Para 2"
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Revision Comment / Required Correction <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows="3"
                      value={revisionComment}
                      onChange={(e) => setRevisionComment(e.target.value)}
                      placeholder="Describe the mistake found in the translation and specify what the translator must revise..."
                      className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 resize-none"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sendBackToTranslator}
                        onChange={(e) => setSendBackToTranslator(e.target.checked)}
                        className="w-4 h-4 accent-red-600 rounded"
                      />
                      <span>Automatically send task back to Translator ("Revision Requested")</span>
                    </label>

                    <button
                      type="submit"
                      disabled={isSubmittingDefect}
                      className={`px-4 py-2 text-xs font-bold rounded-xl text-white shadow-xs transition-colors shrink-0 cursor-pointer ${
                        sendBackToTranslator
                          ? 'bg-red-600 hover:bg-red-700'
                          : 'bg-[#4f46e5] hover:bg-[#4338ca]'
                      }`}
                    >
                      {isSubmittingDefect
                        ? 'Recording...'
                        : sendBackToTranslator
                          ? 'Log Mistake & Send Back'
                          : 'Log Mistake Only'}
                    </button>
                  </div>
                </form>

                {/* Logged Defects History List */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Recorded Mistakes &amp; Revision Comments ({reviewDetails?.defects?.length || 0})
                    </h4>
                  </div>

                  {isLoadingDetails ? (
                    <p className="text-xs text-slate-400 py-4 text-center">Loading defect records...</p>
                  ) : !reviewDetails?.defects || reviewDetails.defects.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center text-xs text-slate-400">
                      No translation defects logged for this project yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {reviewDetails.defects.map((def) => (
                        <div
                          key={def.id}
                          className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-3 ${
                            def.isResolved ? 'bg-slate-50 border-slate-200 opacity-75' : 'bg-red-50/40 border-red-200'
                          }`}
                        >
                          <div className="space-y-1 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${
                                def.severity === 'Critical' ? 'bg-red-100 text-red-700' :
                                def.severity === 'Major' ? 'bg-amber-100 text-amber-800' :
                                'bg-slate-200 text-slate-700'
                              }`}>
                                {def.severity}
                              </span>
                              <span className="font-bold text-slate-900">{def.errorCategory}</span>
                              {def.locationReference && (
                                <span className="text-slate-500">&bull; {def.locationReference}</span>
                              )}
                              <span className="text-slate-400">by {def.editorInitials}</span>
                            </div>
                            <p className={`text-xs ${def.isResolved ? 'line-through text-slate-400' : 'text-slate-800 font-medium'}`}>
                              "{def.revisionComment}"
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleToggleResolveDefect(def.id)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold border border-slate-200 bg-white hover:bg-slate-100 text-slate-700"
                            >
                              {def.isResolved ? 'Reopen' : 'Resolve'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDefect(def.id)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded"
                              title="Delete defect"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Review Hours Budget (Story #2) & Translator Friday Submissions (Story #6) */}
            {activeModalTab === 'budget' && (
              <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                <form onSubmit={handleSaveReviewHours} noValidate className="space-y-4 border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                  <h3 className="text-sm font-bold text-slate-900">
                    Story #2: Budget Review Hours
                  </h3>
                  {reviewError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl font-medium">
                      {reviewError}
                    </div>
                  )}
                  {reviewSuccess && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl font-medium">
                      {reviewSuccess}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Estimated Review Time (Hours) <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={reviewHoursInput}
                          onChange={(e) => {
                            setReviewHoursInput(e.target.value);
                            setReviewError('');
                          }}
                          className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold bg-white text-slate-900"
                        />
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs pointer-events-none">
                          hours
                        </span>
                      </div>
                      <button
                        type="submit"
                        disabled={isSubmittingReview}
                        className="px-4 py-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white text-xs font-bold rounded-xl transition-colors shadow-xs disabled:opacity-50"
                      >
                        {isSubmittingReview ? 'Saving...' : 'Save Review Hours'}
                      </button>
                    </div>
                  </div>
                </form>

                {/* Translator's Friday Submissions & Estimations */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Translator Weekly Estimations &amp; Attached Files ({reviewDetails?.estimations?.length || 0})
                  </h4>
                  {!reviewDetails?.estimations || reviewDetails.estimations.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center text-xs text-slate-400">
                      No Friday estimation submissions recorded by the translator yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {reviewDetails.estimations.map((est) => (
                        <div key={est.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900">{est.submissionDate}</span>
                            <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                              Remaining Est: {parseFloat(est.remainingHours).toFixed(1)}h ({parseFloat(est.remainingPercentage).toFixed(0)}%)
                            </span>
                          </div>
                          {est.attachmentFileName && (
                            <p className="text-indigo-600 font-semibold">
                              📎 Attached File: {est.attachmentFileName} ({est.attachmentFileType || 'DOCX'})
                            </p>
                          )}
                          {est.completedText && (
                            <p className="text-slate-600 italic bg-white p-2 rounded border border-slate-100 mt-1">
                              "{est.completedText}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={closeReviewModal}
                className="px-4 py-2 border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 text-xs font-bold rounded-xl transition-colors"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Story #8: Request / Allocate Assistant Editor Modal */}
      {isAssistantModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 pb-4 border-b border-slate-100">
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                Story #8 &bull; Workload Sharing
              </span>
              <h3 className="text-lg font-bold text-slate-900 mt-1">
                Assign Assistant / Secondary Chief Editor
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Temporarily allocate a free Chief Editor to share review duties and clear bottlenecks.
              </p>
            </div>

            <form onSubmit={handleAllocateAssistantEditor} noValidate className="p-6 space-y-4">
              {assistantFeedback.error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl font-semibold">
                  {assistantFeedback.error}
                </div>
              )}
              {assistantFeedback.success && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl font-semibold">
                  {assistantFeedback.success}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Select Overloaded Project <span className="text-red-500">*</span>
                </label>
                <select
                  value={assistantProjectId}
                  onChange={(e) => setAssistantProjectId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-semibold border border-slate-200 rounded-xl bg-white text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {projects.map(p => (
                    <option key={p.projectId} value={p.projectId}>
                      #{p.id} — {p.name} ({p.complexity})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Available Secondary Chief Editor <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedSecondaryEditorId}
                  onChange={(e) => setSelectedSecondaryEditorId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-semibold border border-slate-200 rounded-xl bg-white text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Chief Editor</option>
                  {chiefEditors.map(ce => (
                    <option key={ce.id} value={ce.id}>
                      {ce.displayName} — {ce.availabilityStatus} ({ce.totalAssignedProjects} projects)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Allocation Note
                </label>
                <input
                  type="text"
                  value={assistantNote}
                  onChange={(e) => setAssistantNote(e.target.value)}
                  placeholder="e.g., Assist with Friday review bottleneck"
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAssistantModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Grant Access &amp; Assign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
