import React, { useState } from 'react';

export default function Login({ onLogin, onSwitchToRegister }) {
  const [initials, setInitials] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const performLogin = async (loginInitials, loginPassword, fallbackRole = 'Translator') => {
    setErrorMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:5156/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ initials: loginInitials, password: loginPassword })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('easyLangToken', data.token);
        const userObj = data.user || {
          id: 1,
          initials: loginInitials,
          role: data.role || fallbackRole
        };
        onLogin(userObj);
      } else {
        setErrorMessage(data.error || 'Invalid initials or password');
      }
    } catch (err) {
      console.warn('Backend unavailable during login, activating offline demo mode', err);
      // Fallback for demo testing when backend is not actively running
      const demoToken = btoa(JSON.stringify({
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': loginInitials,
        'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': fallbackRole,
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier': '2',
        role: fallbackRole,
        name: loginInitials
      }));
      const simulatedJwt = `header.${demoToken}.signature`;
      localStorage.setItem('easyLangToken', simulatedJwt);
      onLogin({
        id: fallbackRole === 'Translator' ? 2 : (fallbackRole === 'Chief Editor' ? 3 : 1),
        initials: loginInitials,
        role: fallbackRole
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!initials.trim()) newErrors.initials = 'Initials are required.';
    if (!password.trim()) newErrors.password = 'Password is required.';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    setErrors({});
    performLogin(initials, password);
  };

  const handleQuickLogin = (quickInitials, quickPassword, quickRole) => {
    setInitials(quickInitials);
    setPassword(quickPassword);
    setErrors({});
    performLogin(quickInitials, quickPassword, quickRole);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 bg-[radial-gradient(circle_at_10%_10%,#e8effc_0%,#f4f6fa_40%,#f0f4f8_100%)]">
      {/* Brand Header */}
      <div className="flex items-center mb-6 sm:mb-8">
        <div className="bg-indigo-600 rounded-2xl p-2.5 mr-3 shadow-md flex items-center justify-center">
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight tracking-tight">EasyLang</h1>
          <p className="text-[10px] tracking-widest text-slate-500 font-bold uppercase">Activity Monitoring System</p>
        </div>
      </div>

      {/* Login Card */}
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-100 p-6 sm:p-8 md:p-10">
        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Sign In to Workspace</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Multi-device authentication & role-based access</p>
        </div>
        
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-xs sm:text-sm rounded-xl flex items-center gap-2">
            <svg className="w-5 h-5 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs sm:text-sm font-bold text-slate-800">User Initials</label>
              <span className="text-[11px] text-slate-400 font-medium">Up to 4 characters</span>
            </div>
            <input 
              type="text" 
              value={initials}
              onChange={(e) => {
                setInitials(e.target.value.toUpperCase());
                if (errors.initials) setErrors(prev => ({ ...prev, initials: '' }));
              }}
              placeholder="e.g., MZ, DI, DD" 
              maxLength="4"
              className={`w-full px-4 py-2.5 sm:py-3 border rounded-xl focus:ring-2 outline-none transition-all text-sm font-semibold tracking-wider ${
                errors.initials ? 'border-red-500 focus:ring-red-500 bg-red-50/50 text-red-900' : 'border-slate-200 focus:ring-indigo-500 text-slate-900'
              }`}
            />
            {errors.initials && <p className="mt-1 text-xs text-red-500 font-semibold">{errors.initials}</p>}
          </div>
          
          <div>
            <label className="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors(prev => ({ ...prev, password: '' }));
              }}
              placeholder="••••••••" 
              className={`w-full px-4 py-2.5 sm:py-3 border rounded-xl focus:ring-2 outline-none transition-all text-sm tracking-widest ${
                errors.password ? 'border-red-500 focus:ring-red-500 bg-red-50/50 text-red-900' : 'border-slate-200 focus:ring-indigo-500 text-slate-900'
              }`}
            />
            {errors.password && <p className="mt-1 text-xs text-red-500 font-semibold">{errors.password}</p>}
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition-all text-sm mt-2 shadow-sm disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>

        <div className="mt-5 text-center text-xs sm:text-sm text-slate-500">
          Don't have an account?{' '}
          <button 
            type="button" 
            onClick={onSwitchToRegister} 
            className="text-indigo-600 font-bold hover:text-indigo-700 hover:underline"
          >
            Sign up
          </button>
        </div>

        <hr className="border-slate-100 my-6" />

        {/* Quick Access Roles for Testing */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Quick Test Sign-In</h3>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">1-Click Test</span>
          </div>
          <p className="text-[11px] text-slate-400 mb-3">Pre-configured database employee accounts:</p>
          
          <div className="grid grid-cols-3 gap-2">
            <button 
              type="button" 
              onClick={() => handleQuickLogin('MZ', 'Madi2007', 'Translator')} 
              className="flex flex-col items-center p-2.5 border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/70 rounded-xl transition-all text-center group"
            >
              <span className="text-xs font-extrabold text-emerald-800 group-hover:scale-105 transition-transform">Translator</span>
              <span className="text-[10px] text-emerald-600 mt-0.5">MZ (Madi)</span>
            </button>

            <button 
              type="button" 
              onClick={() => handleQuickLogin('DI', 'Damir2006', 'Project Manager')} 
              className="flex flex-col items-center p-2.5 border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/70 rounded-xl transition-all text-center group"
            >
              <span className="text-xs font-extrabold text-indigo-800 group-hover:scale-105 transition-transform">Manager</span>
              <span className="text-[10px] text-indigo-600 mt-0.5">DI (Damir)</span>
            </button>

            <button 
              type="button" 
              onClick={() => handleQuickLogin('DD', 'Dulat2007', 'Chief Editor')} 
              className="flex flex-col items-center p-2.5 border border-purple-200 bg-purple-50/50 hover:bg-purple-100/70 rounded-xl transition-all text-center group"
            >
              <span className="text-xs font-extrabold text-purple-800 group-hover:scale-105 transition-transform">Chief Editor</span>
              <span className="text-[10px] text-purple-600 mt-0.5">DD (Dulat)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}