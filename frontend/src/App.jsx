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
  const [userRole, setUserRole] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('easyLangToken');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const role = payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || payload.role;
        setUserRole(role);
      } catch (e) {
        console.error("Invalid token", e);
      }
    }
  }, [isAuthenticated]);

  const handleLogout = () => {
    localStorage.removeItem('easyLangToken');
    setIsAuthenticated(false);
    setUserRole(null);
  };

  const renderDashboard = () => {
    if (userRole === 'Translator') {
      return <TranslatorDashboard onLogout={handleLogout} />;
    }
    if (userRole === 'Chief Editor') {
      return <ChiefEditorDashboard onLogout={handleLogout} />;
    }
    // Default to Project Manager dashboard for Manager or Admin for now
    return <Dashboard onLogout={handleLogout} />;
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {!isAuthenticated ? (
        isRegistering ? (
          <Register onRegisterSuccess={() => setIsRegistering(false)} onSwitchToLogin={() => setIsRegistering(false)} />
        ) : (
          <Login onLogin={() => setIsAuthenticated(true)} onSwitchToRegister={() => setIsRegistering(true)} />
        )
      ) : (
        renderDashboard()
      )}
    </div>
  );
}