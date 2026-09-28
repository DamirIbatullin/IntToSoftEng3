import React, { useState, useEffect } from 'react';

export default function Dashboard({ onLogout }) {
  const [projects, setProjects] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [showRole, setShowRole] = useState(false);
  const [translatorsList, setTranslatorsList] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    projectNumber: '',
    name: '',
    primaryTranslatorId: '',
    complexityLevel: ''
  });

  useEffect(() => {
    const token = localStorage.getItem('easyLangToken');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserProfile({
          initials: payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || payload.unique_name || 'U',
          role: payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || payload.role || 'User'
        });
      } catch (e) {
        console.error("Invalid token", e);
        // Fallback for invalid token
        setUserProfile({ initials: '??', role: 'Manager' });
      }
    } else {
      // Demo mode fallback
      setUserProfile({ initials: 'DM', role: 'Manager' });
    }
    
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
  };

  const handleAddProject = async (e) => {
    e.preventDefault();
    
    const payload = {
      projectNumber: parseInt(formData.projectNumber),
      name: formData.name,
      primaryTranslatorId: parseInt(formData.primaryTranslatorId),
      complexityLevel: formData.complexityLevel
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
        // Optimistically add to list
        const translatorName = translatorsList.find(t => t.id === payload.primaryTranslatorId)?.initials || 'Unknown';
        
        const newProject = {
          id: payload.projectNumber,
          name: payload.name,
          translator: translatorName,
          complexity: payload.complexityLevel,
          reviewHours: null
        };

        setProjects([...projects, newProject]);
        
        // Reset form
        setFormData({
          projectNumber: '',
          name: '',
          primaryTranslatorId: '',
          complexityLevel: ''
        });
        
        // Close modal
        setIsModalOpen(false);
      } else {
        console.error("Failed to create project");
      }
    } catch (err) {
      console.error("Error connecting to backend", err);
    }
  };

  return (
    <div className="flex min-h-screen bg-white">
      {/* Sidebar */}
      <div className="w-16 md:w-20 bg-[#111827] flex flex-col items-center py-6 shadow-xl z-20 shrink-0 relative">
        <button className="bg-[#1f2937] p-2 rounded-lg text-white mb-8">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <button 
          onClick={onLogout} 
          className="text-slate-500 hover:text-red-400 p-2 absolute bottom-6"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 w-full overflow-x-hidden flex flex-col">
        {/* Top Navbar */}
        <header className="px-8 py-5 flex justify-between items-center border-b border-slate-100">
          <div>
            <h1 className="text-[28px] font-bold text-[#111827]">Project Manager Portal</h1>
          </div>
          
          {userProfile && (
            <div className="relative">
              <button 
                onClick={() => setShowRole(!showRole)}
                className="w-10 h-10 rounded-full bg-indigo-100 border-2 border-indigo-200 text-indigo-800 font-bold flex items-center justify-center hover:bg-indigo-200 transition-colors shadow-sm"
              >
                {userProfile.initials.substring(0, 2).toUpperCase()}
              </button>
              
              {showRole && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-3 px-4 z-50 animate-in fade-in slide-in-from-top-2">
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Role</p>
                  <p className="text-sm font-bold text-slate-800">{userProfile.role}</p>
                </div>
              )}
            </div>
          )}
        </header>

        {/* Content Body */}
        <div className="p-8 flex-1">
          {/* Project Watchlist Header */}
          <div className="flex justify-between items-end mb-6">
            <div>
              <h2 className="text-[20px] font-bold text-slate-900 tracking-tight">Project Watchlist</h2>
              <p className="text-[13px] font-medium text-slate-500 mt-0.5">
                {projects.length} Active Project{projects.length !== 1 && 's'} Overview
              </p>
            </div>
            
            <div className="flex gap-4">
              {/* Optional Search Bar Placeholder */}
              <input 
                type="text" 
                placeholder="Search projects..." 
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm w-64 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-600"
              />
              {userProfile && ['Manager', 'Project Manager', 'Admin'].includes(userProfile.role) && (
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-medium shadow-sm transition-colors"
                >
                  Create Project
                </button>
              )}
            </div>
          </div>

          {/* Project Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead>
                <tr className="border-b-2 border-slate-100">
                  <th className="py-4 px-2 text-[11px] font-bold text-slate-500 uppercase tracking-widest w-1/12">Project</th>
                  <th className="py-4 px-2 text-[11px] font-bold text-slate-500 uppercase tracking-widest w-4/12"></th>
                  <th className="py-4 px-2 text-[11px] font-bold text-slate-500 uppercase tracking-widest w-3/12">Responsible Translator</th>
                  <th className="py-4 px-2 text-[11px] font-bold text-slate-500 uppercase tracking-widest w-2/12">Complexity</th>
                  <th className="py-4 px-2 text-[11px] font-bold text-slate-500 uppercase tracking-widest w-2/12">Expected Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projects.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-12 text-center text-slate-500">
                      No active projects found.
                    </td>
                  </tr>
                ) : (
                  projects.map((project, index) => (
                    <tr key={index} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="py-4 px-2 text-[13px] font-semibold text-indigo-600">
                        #{project.id}
                      </td>
                      <td className="py-4 px-2 text-[14px] font-bold text-slate-800">
                        {project.name}
                      </td>
                      <td className="py-4 px-2 text-[13px] font-medium text-slate-500">
                        {project.translator}
                      </td>
                      <td className="py-4 px-2 text-[13px] font-medium text-slate-600">
                        {project.complexity || '-'}
                      </td>
                      <td className="py-4 px-2 text-[13px] font-semibold text-slate-700">
                        {project.reviewHours != null ? `${project.reviewHours}h` : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Create New Project</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleAddProject} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Project Name</label>
                  <input 
                    type="text" 
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required 
                    placeholder="e.g. Q3 Financial Report Translation" 
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm outline-none transition-all"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Project Number</label>
                  <input 
                    type="number" 
                    name="projectNumber"
                    value={formData.projectNumber}
                    onChange={handleInputChange}
                    required 
                    placeholder="e.g. 1001" 
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Complexity Level</label>
                  <select 
                    name="complexityLevel"
                    value={formData.complexityLevel}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white outline-none transition-all"
                  >
                    <option value="">None</option>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Primary Translator</label>
                  <select 
                    name="primaryTranslatorId"
                    value={formData.primaryTranslatorId}
                    onChange={handleInputChange}
                    required 
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white outline-none transition-all"
                  >
                    <option value="" disabled>Select Translator...</option>
                    {translatorsList.map(t => (
                      <option key={t.id} value={t.id}>{t.initials}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm shadow-sm transition-colors"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}