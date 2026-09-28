import React, { useState, useEffect } from 'react';

export default function TranslatorDashboard({ onLogout }) {
  const [activities, setActivities] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [showRole, setShowRole] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('easyLangToken');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserProfile({
          initials: payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || payload.unique_name || 'U',
          role: payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || payload.role || 'Translator'
        });
      } catch (e) {
        console.error("Invalid token", e);
        setUserProfile({ initials: 'TR', role: 'Translator' });
      }
    }

    const fetchMyActivities = async () => {
      try {
        const res = await fetch('http://localhost:5156/api/projects/my-activities', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setActivities(data);
        }
      } catch (err) {
        console.error("Could not fetch activities", err);
      }
    };
    if (token) {
      fetchMyActivities();
    }
  }, []);

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
            <h1 className="text-[28px] font-bold text-[#111827]">Translator Portal</h1>
            <p className="text-sm text-slate-500 mt-1">Manage your translation activities and progress tracking.</p>
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
        
        {/* Activities List */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-[17px] font-bold text-slate-900">My Assigned Activities</h2>
            <p className="text-sm text-slate-500">
              {activities.length} Active Assignment{activities.length !== 1 && 's'}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-white">
                  <th className="py-3 px-5 text-[11px] font-bold text-slate-500 uppercase">Activity #</th>
                  <th className="py-3 px-5 text-[11px] font-bold text-slate-500 uppercase">Project Name</th>
                  <th className="py-3 px-5 text-[11px] font-bold text-slate-500 uppercase">Project #</th>
                  <th className="py-3 px-5 text-[11px] font-bold text-slate-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activities.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="py-12 text-center">
                      <svg className="mx-auto h-12 w-12 text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <h3 className="text-sm font-semibold text-slate-900">No active tracking data</h3>
                      <p className="text-sm text-slate-500 mt-1">You currently have no projects assigned to you.</p>
                    </td>
                  </tr>
                ) : (
                  activities.map((activity, index) => (
                    <tr key={index} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-5 text-sm font-medium text-indigo-600">ACT-{activity.activityNumber}</td>
                      <td className="py-3 px-5 text-sm text-slate-800 font-semibold">{activity.projectName}</td>
                      <td className="py-3 px-5 text-sm text-slate-600">#{activity.projectNumber}</td>
                      <td className="py-3 px-5 text-sm">
                        <button className="text-indigo-600 hover:text-indigo-800 font-semibold">Update Progress</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
