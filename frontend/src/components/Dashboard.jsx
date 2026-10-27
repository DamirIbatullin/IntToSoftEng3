import React, { useState, useEffect } from 'react';

export default function Dashboard({ userProfile, onLogout }) {
  const [projects, setProjects] = useState([]);
  const [translatorsList, setTranslatorsList] = useState([]);
  const [chiefEditorsList, setChiefEditorsList] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [errors, setErrors] = useState({});
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [isAttentionExpanded, setIsAttentionExpanded] = useState(false);
  const pageSize = 5;

  // Story #8: Reassign Editors Modal state
  const [reassignModalProject, setReassignModalProject] = useState(null);
  const [leadEditorInput, setLeadEditorInput] = useState('');
  const [secondaryEditorInput, setSecondaryEditorInput] = useState('');
  const [reassignmentNoteInput, setReassignmentNoteInput] = useState('');
  const [isSubmittingReassign, setIsSubmittingReassign] = useState(false);
  const [reassignFeedback, setReassignFeedback] = useState({ error: '', success: '' });

  const [formData, setFormData] = useState({
    name: '',
    dueDate: '',
    primaryTranslatorId: '',
    leadChiefEditorId: '',
    assistingTranslatorId: '',
    backupChiefEditorId: '',
    estimatedHours: '',
    reviewHours: '',
    complexityLevel: ''
  });

  useEffect(() => {
    fetchTranslators();
    fetchChiefEditors();
    fetchProjects();
  }, []);

  const fetchTranslators = async () => {
    try {
      const res = await fetch('http://localhost:5156/api/employees/translators');
      if (res.ok) {
        const data = await res.json();
        setTranslatorsList(data);
      }
    } catch (err) {
      console.error('Could not fetch translators', err);
    }
  };

  const fetchChiefEditors = async () => {
    try {
      const res = await fetch('http://localhost:5156/api/employees/chief-editors');
      if (res.ok) {
        const data = await res.json();
        setChiefEditorsList(data);
      }
    } catch (err) {
      console.error('Could not fetch chief editors', err);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch('http://localhost:5156/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (err) {
      console.error('Could not fetch projects', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleAddProject = async (e) => {
    e.preventDefault();
    
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Project title is required.';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Project title cannot exceed 100 characters.';
    }
    
    if (!formData.dueDate) {
      newErrors.dueDate = 'Due date is required.';
    }

    if (!formData.primaryTranslatorId) {
      newErrors.primaryTranslatorId = 'Responsible translator is required.';
    }

    if (!formData.leadChiefEditorId) {
      newErrors.leadChiefEditorId = 'Lead Chief Editor is required.';
    }

    if (!formData.complexityLevel) {
      newErrors.complexityLevel = 'Complexity level is required.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    
    const randomProjectNumber = Math.floor(Math.random() * 90000) + 10000;
    
    const payload = {
      projectNumber: randomProjectNumber,
      name: formData.name.trim(),
      primaryTranslatorId: parseInt(formData.primaryTranslatorId),
      leadChiefEditorId: parseInt(formData.leadChiefEditorId),
      backupChiefEditorId: formData.backupChiefEditorId ? parseInt(formData.backupChiefEditorId) : null,
      complexityLevel: formData.complexityLevel,
      dueDate: formData.dueDate,
      estimatedHours: formData.estimatedHours ? parseFloat(formData.estimatedHours) : null,
      reviewHours: formData.reviewHours ? parseFloat(formData.reviewHours) : null
    };

    try {
      const token = localStorage.getItem('easyLangToken');
      const response = await fetch('http://localhost:5156/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setFormData({
          name: '',
          dueDate: '',
          primaryTranslatorId: '',
          leadChiefEditorId: '',
          assistingTranslatorId: '',
          backupChiefEditorId: '',
          estimatedHours: '',
          reviewHours: '',
          complexityLevel: ''
        });
        
        setIsModalOpen(false);
        fetchProjects();
        fetchChiefEditors();
      } else {
        console.error('Failed to create project');
      }
    } catch (err) {
      console.error('Error connecting to backend', err);
    }
  };

  // Story #8: Open Reassign Editors Modal
  const openReassignModal = (project) => {
    setReassignModalProject(project);
    setLeadEditorInput((project.chiefEditorId || 3).toString());
    setSecondaryEditorInput(project.secondaryChiefEditorId ? project.secondaryChiefEditorId.toString() : '');
    setReassignmentNoteInput(project.reassignmentNote || '');
    setReassignFeedback({ error: '', success: '' });
  };

  const closeReassignModal = () => {
    setReassignModalProject(null);
    setReassignFeedback({ error: '', success: '' });
  };

  const handleSaveReassignment = async (e) => {
    e.preventDefault();
    if (!reassignModalProject) return;

    const leadId = parseInt(leadEditorInput);
    const secId = secondaryEditorInput ? parseInt(secondaryEditorInput) : null;

    if (secId && secId === leadId) {
      setReassignFeedback({
        error: 'Temporary / Secondary Chief Editor must be different from the Lead Chief Editor.',
        success: ''
      });
      return;
    }

    setIsSubmittingReassign(true);
    setReassignFeedback({ error: '', success: '' });

    try {
      const token = localStorage.getItem('easyLangToken');
      const res = await fetch(`http://localhost:5156/api/projects/${reassignModalProject.projectId}/reassign-editor`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          chiefEditorId: leadId,
          secondaryChiefEditorId: secId,
          reassignmentNote: reassignmentNoteInput.trim() || null
        })
      });

      const data = await res.json();
      if (res.ok) {
        setReassignFeedback({
          error: '',
          success: data.message || 'Editor allocation and database permissions updated successfully!'
        });
        await fetchProjects();
        await fetchChiefEditors();
        setTimeout(() => {
          closeReassignModal();
        }, 900);
      } else {
        setReassignFeedback({ error: data.error || 'Failed to reassign editor.', success: '' });
      }
    } catch (err) {
      setReassignFeedback({ error: 'Network error connecting to backend.', success: '' });
    } finally {
      setIsSubmittingReassign(false);
    }
  };

  const filteredProjects = projects.filter(p => {
    const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
    if (!matchesStatus) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      p.id?.toString().includes(q) ||
      p.name?.toLowerCase().includes(q) ||
      p.translator?.toLowerCase().includes(q) ||
      p.chiefEditor?.toLowerCase().includes(q) ||
      p.secondaryChiefEditor?.toLowerCase().includes(q)
    );
  });

  const attentionProjects = projects.filter(
    p => p.complexity === 'High' || p.status === 'In Review' || p.status === 'Revision Requested'
  );

  const totalProjects = filteredProjects.length;
  const totalPages = Math.max(1, Math.ceil(totalProjects / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalProjects);
  const currentProjects = filteredProjects.slice(startIndex, endIndex);

  const renderProjectStatusBadge = (project) => {
    if (project.status === 'In Review') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
          In Review
        </span>
      );
    }
    if (project.status === 'Revision Requested') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
          Revision Requested
        </span>
      );
    }
    if (project.status === 'Approved') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          Approved
        </span>
      );
    }
    if (project.status === 'On Track') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          On Track
        </span>
      );
    }
    if (project.status === 'Completed') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
          Completed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
        Pending Start
      </span>
    );
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
        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center justify-center font-bold text-xs">
          {userProfile?.initials || 'PM'}
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
        
        {/* Header matching Figma Image 4 */}
        <header className="mb-6">
          <h1 className="text-2xl sm:text-[28px] font-extrabold text-[#111827] tracking-tight">
            Project Manager Portal
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Action items first, then watchlist, Friday review estimates, and Chief Editor capacity overview.
          </p>
        </header>

        {/* Needs Attention Card (Interactive for Bottleneck / Editor Reassignment) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 mb-6 shadow-2xs">
          <div
            onClick={() => setIsAttentionExpanded(prev => !prev)}
            className="flex items-center justify-between text-xs sm:text-sm font-bold text-slate-900 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="text-amber-500">⚠️</span>
              <span>Needs Attention ({attentionProjects.length})</span>
              <span className="text-slate-400 font-normal">{isAttentionExpanded ? '▴' : '▾'}</span>
            </div>
            <span className="text-xs text-indigo-600 font-bold hover:underline">
              {isAttentionExpanded ? 'Hide Bottlenecks' : 'Review & Reassign Editors'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {attentionProjects.length} high-complexity or Friday review items may need temporary Chief Editor allocation this week.
          </p>

          {isAttentionExpanded && attentionProjects.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 max-h-60 overflow-y-auto">
              {attentionProjects.slice(0, 6).map((proj) => (
                <div key={proj.projectId} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-bold text-indigo-600 mr-2">#{proj.id}</span>
                    <span className="font-bold text-slate-900">{proj.name}</span>
                    <span className="text-slate-500 ml-2">
                      &bull; Lead CE: <strong>{proj.chiefEditor || 'DD'}</strong>
                      {proj.secondaryChiefEditor && (
                        <span className="text-indigo-600 font-bold"> + {proj.secondaryChiefEditor} (Temp)</span>
                      )}
                      {proj.remainingHoursEstimate != null && (
                        <span className="text-amber-700 font-bold"> &bull; Est. {proj.remainingHoursEstimate}h remaining</span>
                      )}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openReassignModal(proj)}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg border border-indigo-200 transition-colors shrink-0 self-start sm:self-center cursor-pointer"
                  >
                    Reassign / Share Editor
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Project Watchlist Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden mb-8">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">Project Watchlist</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {projects.length} Active Projects Overview
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-[#4f46e5] hover:bg-[#4338ca] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                + Create Project
              </button>

              <div className="relative">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search projects..." 
                  className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 w-44 sm:w-56"
                />
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              <select 
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-600 bg-white outline-none"
              >
                <option value="All">Status: All</option>
                <option value="On Track">On Track</option>
                <option value="In Review">In Review (Friday)</option>
                <option value="Revision Requested">Revision Requested</option>
                <option value="Approved">Approved</option>
                <option value="Pending Start">Pending Start</option>
              </select>
            </div>
          </div>

          {/* Table matching Figma with 5 per page + Story #8 Editor Allocation */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                  <th className="py-3 px-5">Project</th>
                  <th className="py-3 px-5">Translator</th>
                  <th className="py-3 px-5">Chief Editor(s)</th>
                  <th className="py-3 px-5 w-36">Progress</th>
                  <th className="py-3 px-5 min-w-[130px] whitespace-nowrap">Status</th>
                  <th className="py-3 px-5">Expected / Est.</th>
                  <th className="py-3 px-5">Due Date</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentProjects.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-400 text-xs">
                      No active projects found.
                    </td>
                  </tr>
                ) : (
                  currentProjects.map((project, idx) => {
                    const formatDate = (dateStr) => {
                      if (!dateStr) return 'Not set';
                      const d = new Date(dateStr);
                      if (isNaN(d.getTime())) return dateStr;
                      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                    };
                    const displayDate = formatDate(project.dueDate || project.createdAt);
                    const progressNum = parseFloat(project.progress != null ? project.progress : 0);

                    return (
                      <tr key={project.projectId || idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-indigo-600">#{project.id}</span>
                            <span className="text-sm font-bold text-slate-900">{project.name}</span>
                          </div>
                        </td>

                        <td className="py-4 px-5 text-xs font-medium text-slate-600">
                          {project.translator}
                        </td>

                        <td className="py-4 px-5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200">
                              {project.chiefEditor || 'DD'}
                            </span>
                            {project.secondaryChiefEditor && (
                              <span
                                className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-200"
                                title={project.reassignmentNote || 'Temporary Secondary Editor'}
                              >
                                + {project.secondaryChiefEditor} (Temp)
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-4 px-5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800">
                              {progressNum.toFixed(0)}%
                            </span>
                            <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-300 ${
                                  project.status === 'Completed' || project.status === 'Approved' ? 'bg-emerald-500' : 'bg-indigo-600'
                                }`}
                                style={{ width: `${Math.min(100, progressNum)}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-5 min-w-[130px] whitespace-nowrap">
                          {renderProjectStatusBadge(project)}
                        </td>

                        <td className="py-4 px-5 text-xs font-bold text-slate-800 whitespace-nowrap">
                          <span>{project.reviewHours != null ? `${project.reviewHours}h` : '68h'}</span>
                          {project.remainingHoursEstimate != null && (
                            <span className="block text-[10px] font-semibold text-indigo-600">
                              Rem. Est: {project.remainingHoursEstimate}h
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-5 text-xs text-slate-600 font-medium whitespace-nowrap">
                          {displayDate}
                        </td>

                        <td className="py-4 px-5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openReassignModal(project)}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer hover:underline"
                          >
                            [Reassign / Details &rarr;]
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer matching Figma exactly */}
          <div className="p-4 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500 font-medium">
              Showing {totalProjects === 0 ? 0 : `${startIndex + 1}-${endIndex}`} of {totalProjects} projects
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 flex items-center justify-center text-xs font-bold transition-colors"
                title="Previous page"
              >
                &lt;
              </button>

              {(() => {
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

                return getVisiblePages().map(pageNum => (
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
                ));
              })()}

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 flex items-center justify-center text-xs font-bold transition-colors"
                title="Next page"
              >
                &gt;
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Story #8: Reassign Editors & Project Review Allocation Modal */}
      {reassignModalProject && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden my-auto border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-5 sm:p-6 text-white relative">
              <button
                type="button"
                onClick={closeReassignModal}
                className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center transition-all"
              >
                ✕
              </button>
              <div className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white mb-2">
                Story #8 &bull; Editorial Workload Allocation
              </div>
              <h3 className="text-xl font-bold tracking-tight">
                Reassign Chief Editors &amp; Share Review Load
              </h3>
              <p className="text-indigo-100 text-xs mt-1">
                Project #{reassignModalProject.id}: {reassignModalProject.name}
              </p>
            </div>

            <form onSubmit={handleSaveReassignment} noValidate className="p-5 sm:p-6 space-y-4">
              {reassignFeedback.error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl font-semibold">
                  {reassignFeedback.error}
                </div>
              )}
              {reassignFeedback.success && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl font-semibold">
                  {reassignFeedback.success}
                </div>
              )}

              {/* Project Summary Box */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 block">Translator</span>
                  <strong className="text-slate-800">{reassignModalProject.translator}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Status &amp; Progress</span>
                  <strong className="text-slate-800">{reassignModalProject.status} ({parseFloat(reassignModalProject.progress || 0).toFixed(0)}%)</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Remaining Est.</span>
                  <strong className="text-indigo-700">
                    {reassignModalProject.remainingHoursEstimate != null ? `${reassignModalProject.remainingHoursEstimate}h` : 'Pending Friday'}
                  </strong>
                </div>
              </div>

              {/* Chief Editor Availability Overview */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Chief Editor Capacity &amp; Availability
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {chiefEditorsList.map((ce) => (
                    <div
                      key={ce.id}
                      onClick={() => {
                        if (ce.id.toString() !== leadEditorInput) {
                          setSecondaryEditorInput(ce.id.toString());
                        }
                      }}
                      className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        secondaryEditorInput === ce.id.toString()
                          ? 'border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-600'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-900">{ce.initials}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          ce.isFree
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {ce.availabilityStatus}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 truncate">
                        {ce.totalAssignedProjects} projects &bull; {ce.totalReviewHours}h
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dropdown 1: Primary Lead Chief Editor */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Lead Chief Editor (Primary) <span className="text-red-500">*</span>
                </label>
                <select
                  value={leadEditorInput}
                  onChange={(e) => setLeadEditorInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-semibold border border-slate-200 rounded-xl bg-white text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {chiefEditorsList.map(ce => (
                    <option key={ce.id} value={ce.id}>
                      {ce.displayName} — {ce.availabilityStatus} ({ce.totalAssignedProjects} active projects)
                    </option>
                  ))}
                </select>
              </div>

              {/* Dropdown 2: Temporary / Secondary Chief Editor for Bottleneck Relief */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Temporary / Secondary Chief Editor (Bottleneck Relief)
                </label>
                <select
                  value={secondaryEditorInput}
                  onChange={(e) => setSecondaryEditorInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-semibold border border-indigo-200 rounded-xl bg-indigo-50/30 text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">None (Single Lead Editor only)</option>
                  {chiefEditorsList
                    .filter(ce => ce.id.toString() !== leadEditorInput)
                    .map(ce => (
                      <option key={ce.id} value={ce.id}>
                        {ce.displayName} — {ce.availabilityStatus} ({ce.totalAssignedProjects} projects)
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Grants secondary editor database permissions (<code className="text-indigo-600">ProjectEditorAccess</code>) to review submissions, log defects, and toggle task status.
                </p>
              </div>

              {/* Reassignment Note */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reassignment / Handover Note <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={reassignmentNoteInput}
                  onChange={(e) => setReassignmentNoteInput(e.target.value)}
                  placeholder="e.g., Temporary Friday bottleneck support for high-complexity legal review"
                  className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeReassignModal}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReassign}
                  className="px-5 py-2.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingReassign ? 'Updating Allocation...' : 'Save Editor Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create New Project matching Figma popup */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[620px] overflow-hidden my-auto border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="p-6 pb-4">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">Create New Project</h2>
              <p className="text-xs text-slate-500 mt-1">Set up a new translation project and assign the core team.</p>
            </div>
            
            <form onSubmit={handleAddProject} className="p-6 pt-2 space-y-4" noValidate>
              
              {/* Row 1: Title and Due Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Project Title <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={`w-full px-3.5 py-2.5 border rounded-xl focus:ring-2 outline-none text-xs sm:text-sm ${
                      errors.name ? 'border-red-500 focus:ring-red-500 bg-red-50/50 text-red-900' : 'border-slate-200 focus:ring-indigo-500 text-slate-900'
                    }`}
                  />
                  {errors.name && <p className="mt-1 text-xs text-red-500 font-semibold">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Due Date <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input 
                      type="date" 
                      name="dueDate"
                      value={formData.dueDate}
                      onChange={handleInputChange}
                      className={`w-full px-3.5 py-2.5 border rounded-xl focus:ring-2 outline-none text-xs sm:text-sm bg-white ${
                        errors.dueDate ? 'border-red-500 focus:ring-red-500 bg-red-50/50 text-red-900' : 'border-slate-200 focus:ring-indigo-500 text-slate-800'
                      }`}
                    />
                  </div>
                  {errors.dueDate && <p className="mt-1 text-xs text-red-500 font-semibold">{errors.dueDate}</p>}
                </div>
              </div>

              {/* Row 2: Responsible Translator and Lead Chief Editor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Responsible Translator <span className="text-red-500">*</span>
                  </label>
                  <select 
                    name="primaryTranslatorId"
                    value={formData.primaryTranslatorId}
                    onChange={handleInputChange}
                    className={`w-full px-3.5 py-2.5 border rounded-xl focus:ring-2 outline-none text-xs sm:text-sm bg-white ${
                      errors.primaryTranslatorId ? 'border-red-500 focus:ring-red-500 bg-red-50/50' : 'border-slate-200 focus:ring-indigo-500 text-slate-900'
                    }`}
                  >
                    <option value="" disabled>Select primary translator</option>
                    {translatorsList.map(t => (
                      <option key={t.id} value={t.id}>{t.initials} (Translator)</option>
                    ))}
                  </select>
                  {errors.primaryTranslatorId && <p className="mt-1 text-xs text-red-500 font-semibold">{errors.primaryTranslatorId}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Lead Chief Editor <span className="text-red-500">*</span>
                  </label>
                  <select 
                    name="leadChiefEditorId"
                    value={formData.leadChiefEditorId}
                    onChange={handleInputChange}
                    className={`w-full px-3.5 py-2.5 border rounded-xl focus:ring-2 outline-none text-xs sm:text-sm bg-white ${
                      errors.leadChiefEditorId ? 'border-red-500 focus:ring-red-500 bg-red-50/50' : 'border-slate-200 focus:ring-indigo-500 text-slate-700'
                    }`}
                  >
                    <option value="" disabled>Select lead reviewer</option>
                    {chiefEditorsList.length > 0 ? (
                      chiefEditorsList.map(ce => (
                        <option key={ce.id} value={ce.id}>{ce.displayName}</option>
                      ))
                    ) : (
                      <option value="3">DD (Chief Editor)</option>
                    )}
                  </select>
                  {errors.leadChiefEditorId && <p className="mt-1 text-xs text-red-500 font-semibold">{errors.leadChiefEditorId}</p>}
                </div>
              </div>

              {/* Row 3: Assisting Translators and Backup / Additional Chief Editor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Assisting Translators
                  </label>
                  <select 
                    name="assistingTranslatorId"
                    value={formData.assistingTranslatorId}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs sm:text-sm bg-white text-slate-500"
                  >
                    <option value="">Optional</option>
                    {translatorsList.slice(0, 15).map(t => (
                      <option key={t.id} value={t.id}>{t.initials}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Backup / Secondary Chief Editor
                  </label>
                  <select 
                    name="backupChiefEditorId"
                    value={formData.backupChiefEditorId}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs sm:text-sm bg-white text-slate-500"
                  >
                    <option value="">Optional</option>
                    {chiefEditorsList.map(ce => (
                      <option key={ce.id} value={ce.id}>{ce.displayName}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 4: Estimated Hours & Review Hours */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Estimated Translation Hours
                  </label>
                  <div className="relative">
                    <input 
                      type="number" 
                      name="estimatedHours"
                      min="0"
                      value={formData.estimatedHours}
                      onChange={handleInputChange}
                      className="w-full px-3.5 py-2.5 pr-8 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs sm:text-sm text-slate-900"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs pointer-events-none">
                      h
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Review / Checking Hours
                  </label>
                  <div className="relative">
                    <input 
                      type="number" 
                      name="reviewHours"
                      min="0"
                      value={formData.reviewHours}
                      onChange={handleInputChange}
                      className="w-full px-3.5 py-2.5 pr-8 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs sm:text-sm text-slate-900"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs pointer-events-none">
                      h
                    </span>
                  </div>
                </div>
              </div>

              {/* Row 5: Complexity Level */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Complexity Level <span className="text-red-500">*</span>
                </label>
                <select 
                  name="complexityLevel"
                  value={formData.complexityLevel}
                  onChange={handleInputChange}
                  className={`w-full px-3.5 py-2.5 border rounded-xl focus:ring-2 outline-none text-xs sm:text-sm bg-white ${
                    errors.complexityLevel ? 'border-red-500 focus:ring-red-500 bg-red-50/50' : 'border-slate-200 focus:ring-indigo-500 text-slate-700'
                  }`}
                >
                  <option value="">Select complexity</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
                {errors.complexityLevel && <p className="mt-1 text-xs text-red-500 font-semibold">{errors.complexityLevel}</p>}
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                >
                  Continue
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
