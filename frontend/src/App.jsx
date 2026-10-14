import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import TranslatorDashboard from './components/TranslatorDashboard';
import ChiefEditorDashboard from './components/ChiefEditorDashboard';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('easyLangToken');
  });
  const [userProfile, setUserProfile] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isVerifyingSession, setIsVerifyingSession] = useState(true);

  // Authenticate and verify user profile
  useEffect(() => {
    const token = localStorage.getItem('easyLangToken');
    if (!token) {
      setIsAuthenticated(false);
      setUserProfile(null);
      setIsVerifyingSession(false);
      return;
    }

    const verifySession = async () => {
      try {
        const res = await fetch('http://localhost:5156/api/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
          const data = await res.json();
          setUserProfile({
            id: data.id,
            initials: data.initials,
            role: data.role
          });
          setIsAuthenticated(true);
          setIsVerifyingSession(false);
          return;
        }
      } catch (e) {
        // Fallback to client-side token parsing if backend is temporarily unreachable
      }

      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const role = payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || payload.role || 'Translator';
        const initials = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || payload.unique_name || payload.name || 'U';
        const id = parseInt(payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] || payload.nameid || '1');

        setUserProfile({ id, initials, role });
        setIsAuthenticated(true);
      } catch (err) {
        console.error("Invalid token format, logging out", err);
        localStorage.removeItem('easyLangToken');
        setIsAuthenticated(false);
        setUserProfile(null);
      } finally {
        setIsVerifyingSession(false);
      }
    };

    verifySession();
  }, [isAuthenticated]);

  const handleLoginSuccess = (userData) => {
    if (userData) {
      setUserProfile(userData);
    }
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('easyLangToken');
    setIsAuthenticated(false);
    setUserProfile(null);
  };

  // Strictly route by user role: users can ONLY see their assigned dashboard
  const renderDashboardByRole = () => {
    if (!userProfile) return null;

    const role = userProfile.role;
    if (role === 'Translator') {
      return <TranslatorDashboard userProfile={userProfile} onLogout={handleLogout} />;
    }
    if (role === 'Chief Editor') {
      return <ChiefEditorDashboard userProfile={userProfile} onLogout={handleLogout} />;
    }
    // Project Manager, Manager, Admin
    return <Dashboard userProfile={userProfile} onLogout={handleLogout} />;
  };

  if (isVerifyingSession && localStorage.getItem('easyLangToken')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-semibold tracking-wider uppercase">Loading Workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-800">
      {!isAuthenticated ? (
        isRegistering ? (
          <Register 
            onRegisterSuccess={() => setIsRegistering(false)} 
            onSwitchToLogin={() => setIsRegistering(false)} 
          />
        ) : (
          <Login 
            onLogin={handleLoginSuccess} 
            onSwitchToRegister={() => setIsRegistering(true)} 
          />
        )
      ) : (
        renderDashboardByRole()
      )}
    </div>
  );
}