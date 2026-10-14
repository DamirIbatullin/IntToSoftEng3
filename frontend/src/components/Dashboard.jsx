import React, { useState, useEffect } from 'react';

export default function Dashboard({ userProfile, onLogout }) {
  const [projects, setProjects] = useState([]);
  const [translatorsList, setTranslatorsList] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [errors, setErrors] = useState({});
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  
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
    // Fetch Translators
    const fetchTranslators = async () => {
      try {
        const res = await fetch('http://localhost:5156/api/employees/translators');
        if (res.ok) {
          const data = await res.json();
          setTranslatorsList(data);
        }
      } catch (err) {
        console.error("Could not fetch translators", err);
      }
    };
    fetchTranslators();

    // Fetch existing projects
    const fetchProjects = async () => {
      try {
        const res = await fetch('http://localhost:5156/api/projects');
        if (res.ok) {
          const data = await res.json();
          setProjects(data);
        }
      } catch (err) {
        console.error("Could not fetch projects", err);
      }
    };
    fetchProjects();
  }, []);

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
      complexityLevel: formData.complexityLevel,
      dueDate: formData.dueDate,
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
        // Refresh projects from backend to get real DB sync
        const res = await fetch('http://localhost:5156/api/projects');
        if (res.ok) {
          const data = await res.json();
          setProjects(data);
        }
      } else {
        console.error("Failed to create project");
      }
    } catch (err) {
      console.error("Error connecting to backend", err);
    }
  };

  const filteredProjects = projects.filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      p.id?.toString().includes(q) ||
      p.name?.toLowerCase().includes(q) ||
      p.translator?.toLowerCase().includes(q)
    );
  });

  const totalProjects = filteredProjects.length;
  const totalPages = Math.max(1, Math.ceil(totalProjects / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalProjects);
  const currentProjects = filteredProjects.slice(startIndex, endIndex);

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
            Action items first, then watchlist and capacity overview.
          </p>
        </header>

        {/* Needs Attention Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 mb-6 shadow-2xs">
          <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-slate-900">
            <div className="flex items-center gap-2">
              <span className="text-amber-500">⚠️</span>
              <span>Needs Attention ({projects.filter(p => p.complexity === 'High').length})</span>
              <span className="text-slate-400 font-normal">▾</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {projects.filter(p => p.complexity === 'High').length} items need a decision this week.
          </p>
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
                className="bg-[#4f46e5] hover:bg-[#4338ca] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
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
              </select>
            </div>
          </div>

          {/* Table matching Figma with 5 per page */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                  <th className="py-3 px-5">Project</th>
                  <th className="py-3 px-5">Responsible Translator</th>
                  <th className="py-3 px-5 w-36">Progress</th>
                  <th className="py-3 px-5 min-w-[130px] whitespace-nowrap">Status</th>
                  <th className="py-3 px-5">Expected Total</th>
                  <th className="py-3 px-5">Due Date</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentProjects.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-400 text-xs">
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

                        <td className="py-4 px-5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800">
                              {progressNum.toFixed(0)}%
                            </span>
                            <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-300 ${
                                  project.status === 'Completed' ? 'bg-emerald-500' : 'bg-indigo-600'
                                }`}
                                style={{ width: `${Math.min(100, progressNum)}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Status Column - dynamically synced with daily work logging */}
                        <td className="py-4 px-5 min-w-[130px] whitespace-nowrap">
                          {project.status === 'On Track' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                              On Track
                            </span>
                          ) : project.status === 'Completed' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                              Completed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                              Pending Start
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-5 text-xs font-bold text-slate-800">
                          {project.reviewHours != null ? `${project.reviewHours}h` : '68h'}
                        </td>

                        <td className="py-4 px-5 text-xs text-slate-600 font-medium whitespace-nowrap">
                          {displayDate}
                        </td>

                        <td className="py-4 px-5 text-right whitespace-nowrap">
                          <span className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer">
                            [Details &rarr;]
                          </span>
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

      {/* Modal: Create New Activity matching Figma popup exactly */}
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
                    <option value="3">DD (Chief Editor)</option>
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
                    Backup / Additional Chief Editor
                  </label>
                  <select 
                    name="backupChiefEditorId"
                    value={formData.backupChiefEditorId}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs sm:text-sm bg-white text-slate-500"
                  >
                    <option value="">Optional</option>
                    <option value="3">DD (Dulat)</option>
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