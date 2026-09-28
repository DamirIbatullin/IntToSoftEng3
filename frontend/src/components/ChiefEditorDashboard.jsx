import React, { useState, useEffect } from 'react';

export default function ChiefEditorDashboard({ onLogout }) {
  const [projects, setProjects] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [showRole, setShowRole] = useState(false);
  const [editProjectId, setEditProjectId] = useState(null);
  const [formData, setFormData] = useState({ reviewHours: '' });

  useEffect(() => {
    const token = localStorage.getItem('easyLangToken');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserProfile({
          initials: payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || payload.unique_name || 'U',
          role: payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || payload.role || 'Chief Editor'
        });
      } catch (e) {
        setUserProfile({ initials: 'CE', role: 'Chief Editor' });
      }
    }

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

  const startEdit = (project) => {
    setEditProjectId(project.projectId);
    setFormData({
      reviewHours: project.reviewHours || ''
    });
  };

  const handleUpdateReview = async (projectId) => {
    try {
      const token = localStorage.getItem('easyLangToken');
      const payload = {
        reviewHours: parseFloat(formData.reviewHours)
      };

      const res = await fetch(`http://localhost:5156/api/projects/${projectId}/review`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setEditProjectId(null);
        fetchProjects(); // Refresh the list
      }
    } catch (err) {
      console.error("Failed to update review metrics", err);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      {/* Sidebar */}
      <div className="w-16 md:w-20 bg-[#111827] flex flex-col items-center py-6 shadow-xl z-10 shrink-0 relative">
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

      <div className="flex-1 p-6 md:p-10 w-full overflow-x-hidden">
        <header className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-[28px] font-bold text-[#111827]">Chief Editor Portal</h1>
            <p className="text-sm text-slate-500 mt-1">Specify review hour budgets based on project complexity.</p>
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
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-3 px-4 z-50">
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Role</p>
                  <p className="text-sm font-bold text-slate-800">{userProfile.role}</p>
                </div>
              )}
            </div>
          )}
        </header>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-[17px] font-bold text-slate-900">Project Review Budgeting</h2>
            <p className="text-sm text-slate-500">
              Assign complexity metrics and required review hours.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-white">
                  <th className="py-3 px-5 text-[11px] font-bold text-slate-500 uppercase">Project #</th>
                  <th className="py-3 px-5 text-[11px] font-bold text-slate-500 uppercase">Project Name</th>
                  <th className="py-3 px-5 text-[11px] font-bold text-slate-500 uppercase">Complexity</th>
                  <th className="py-3 px-5 text-[11px] font-bold text-slate-500 uppercase">Review Hours</th>
                  <th className="py-3 px-5 text-[11px] font-bold text-slate-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projects.map((project) => (
                  <tr key={project.projectId} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-5 text-sm font-medium text-indigo-600">#{project.id}</td>
                    <td className="py-3 px-5 text-sm text-slate-800 font-semibold">{project.name}</td>
                    <td className="py-3 px-5 text-sm text-slate-600">
                      {project.complexity || 'Unset'}
                    </td>
                    <td className="py-3 px-5 text-sm">
                      {editProjectId === project.projectId ? (
                        <input 
                          type="number" 
                          className="border rounded p-1 text-sm w-20"
                          value={formData.reviewHours}
                          onChange={(e) => setFormData({...formData, reviewHours: e.target.value})}
                          step="0.5"
                          min="0"
                        />
                      ) : (
                        <span className="font-bold text-slate-900">{project.reviewHours != null ? project.reviewHours + 'h' : 'Unset'}</span>
                      )}
                    </td>
                    <td className="py-3 px-5 text-sm">
                      {editProjectId === project.projectId ? (
                        <div className="flex gap-2">
                          <button 
                            className="bg-indigo-600 text-white px-3 py-1 rounded text-xs font-semibold hover:bg-indigo-700"
                            onClick={() => handleUpdateReview(project.projectId)}
                          >
                            Save
                          </button>
                          <button 
                            className="text-slate-500 hover:text-slate-700 text-xs font-semibold"
                            onClick={() => setEditProjectId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button 
                          className="text-indigo-600 hover:text-indigo-800 font-semibold text-xs"
                          onClick={() => startEdit(project)}
                        >
                          Edit Metrics
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {projects.length === 0 && (
                  <tr>
                    <td colSpan="5" className="py-12 text-center text-slate-500 text-sm">No projects found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
