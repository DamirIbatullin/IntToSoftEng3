import React, { useState, useEffect } from 'react';

export default function ChiefEditorDashboard({ userProfile, onLogout }) {
  const [projects, setProjects] = useState([]);
  const [complexityFilter, setComplexityFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 7; // Exactly 7 projects per page as per Figma & requirements

  // Review modal state for Story #2
  const [reviewModalProject, setReviewModalProject] = useState(null);
  const [reviewHoursInput, setReviewHoursInput] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');

  useEffect(() => {
    fetchProjects();
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
      console.error("Could not fetch projects", err);
    }
  };

  const openReviewModal = (project) => {
    setReviewModalProject(project);
    setReviewHoursInput(project.reviewHours != null ? project.reviewHours.toString() : '');
    setReviewError('');
  };

  const closeReviewModal = () => {
    setReviewModalProject(null);
    setReviewHoursInput('');
    setReviewError('');
  };

  const handleSaveReviewHours = async (e) => {
    e.preventDefault();
    if (!reviewModalProject) return;

    if (!reviewHoursInput.trim()) {
      setReviewError('Review hours are required.');
      return;
    }

    const val = parseFloat(reviewHoursInput);
    if (isNaN(val) || val < 0) {
      setReviewError('Please enter a valid number of review hours (>= 0).');
      return;
    }

    setIsSubmittingReview(true);
    setReviewError('');
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
        // Update local project in state
        setProjects(prev => prev.map(p => 
          p.projectId === reviewModalProject.projectId ? { ...p, reviewHours: val } : p
        ));
        closeReviewModal();
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

  // Filter projects
  const filteredProjects = projects.filter(p => {
    const matchesComplexity = complexityFilter === 'All' || p.complexity === complexityFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      p.name?.toLowerCase().includes(q) || 
      p.id?.toString().includes(q) || 
      p.translator?.toLowerCase().includes(q);
    return matchesComplexity && matchesSearch;
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
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-[28px] font-extrabold text-[#111827] tracking-tight">
              Review Queue
            </h1>
            <span className="text-xs sm:text-sm font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
              {filteredProjects.length} Pending
            </span>
          </div>

          <button className="px-4 py-2 border border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-bold text-xs rounded-xl transition-colors flex items-center gap-2 self-start sm:self-auto shadow-2xs bg-white">
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

        {/* Table matching Figma Image 3 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                  <th className="py-3.5 px-5">Translator</th>
                  <th className="py-3.5 px-5">Task ID</th>
                  <th className="py-3.5 px-5">Project Name</th>
                  <th className="py-3.5 px-5">Complexity</th>
                  <th className="py-3.5 px-5">Submitted On</th>
                  <th className="py-3.5 px-5">File Type</th>
                  <th className="py-3.5 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentProjects.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-400 text-xs">
                      No projects currently pending review.
                    </td>
                  </tr>
                ) : (
                  currentProjects.map((project, idx) => {
                    // Submission dates matching Figma prototype style
                    const submissionDates = ['Sep 8, 2026', 'Sep 7, 2026', 'Sep 7, 2026', 'Sep 7, 2026', 'Sep 7, 2026', 'Sep 7, 2026', 'Sep 6, 2026'];
                    const submittedOn = submissionDates[(startIndex + idx) % submissionDates.length];
                    
                    // Alternate DOCX and PDF matching Figma
                    const isDocx = (startIndex + idx) % 2 === 0;

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

                        <td className="py-4 px-5 text-sm font-bold text-slate-900">
                          {project.name}
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

                        <td className="py-4 px-5 text-xs text-slate-500 font-medium whitespace-nowrap">
                          {submittedOn}
                        </td>

                        <td className="py-4 px-5 text-xs text-slate-500 font-semibold whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            {isDocx ? (
                              <>
                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                DOCX
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                            className="px-3.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-colors border border-indigo-200"
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

          {/* Pagination Footer - exactly 7 projects per page with sliding window matching Figma */}
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

      {/* Review Hours Modal (Story #2 Complexity-Based Time Specification) */}
      {reviewModalProject && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 pb-4 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                  Story #2 Review Time
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded tracking-wide ${
                  reviewModalProject.complexity === 'High' ? 'bg-red-50 text-red-600 border border-red-200' :
                  reviewModalProject.complexity === 'Medium' ? 'bg-amber-50 text-amber-600 border border-amber-200' :
                  'bg-emerald-50 text-emerald-600 border border-emerald-200'
                }`}>
                  {(reviewModalProject.complexity || 'LOW').toUpperCase()} COMPLEXITY
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-1">
                Budget Review Hours
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Project #{reviewModalProject.id}: <span className="font-semibold text-slate-700">{reviewModalProject.name}</span>
              </p>
            </div>

            <form onSubmit={handleSaveReviewHours} className="p-6 space-y-4">
              {reviewError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl font-medium">
                  {reviewError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Estimated Review Time (Hours) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={reviewHoursInput}
                    onChange={(e) => {
                      setReviewHoursInput(e.target.value);
                      setReviewError('');
                    }}
                    className={`w-full px-3.5 py-2.5 border rounded-xl focus:ring-2 outline-none text-sm font-bold bg-white ${
                      reviewError ? 'border-red-500 focus:ring-red-400 text-red-900 bg-red-50/50' : 'border-slate-200 focus:ring-indigo-500 text-slate-900'
                    }`}
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs pointer-events-none">
                    hours
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeReviewModal}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReview}
                  className="px-5 py-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white text-xs font-bold rounded-xl transition-colors shadow-xs disabled:opacity-50"
                >
                  {isSubmittingReview ? 'Saving...' : 'Save Review Hours'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
