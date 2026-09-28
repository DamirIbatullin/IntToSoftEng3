import React, { useState } from 'react';

export default function Register({ onRegisterSuccess, onSwitchToLogin }) {
  const [initials, setInitials] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Translator');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:5156/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ initials, password, role })
      });

      const data = await response.json();

      if (response.ok) {
        onRegisterSuccess(); 
      } else {
        setErrorMessage(data.error || 'Registration failed');
      }
    } catch (err) {
      setErrorMessage('Could not connect to the server. Is your C# backend running?');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-[radial-gradient(circle_at_10%_10%,#e8effc_0%,#f4f6fa_40%,#f0f4f8_100%)]">
      {/* Logo */}
      <div className="flex items-center mb-8">
        <div className="bg-indigo-600 rounded-xl p-2 mr-3 shadow-md">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 leading-tight">EasyLang</h1>
          <p className="text-[10px] tracking-wider text-slate-500 font-semibold uppercase">Activity Monitoring System</p>
        </div>
      </div>

      {/* Register Card */}
      <div className="bg-white w-full max-w-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-8 md:p-10">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Sign Up</h2>
        
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <div className="flex justify-between mb-1.5">
              <label className="text-sm font-semibold text-slate-800">User Initials</label>
              <span className="text-xs text-slate-400">(Up to 4 letters)</span>
            </div>
            <input 
              type="text" 
              value={initials}
              onChange={(e) => setInitials(e.target.value.toUpperCase())}
              placeholder="e.g., ABCD" 
              required 
              maxLength="4"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1.5">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm tracking-widest" 
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1.5">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm bg-white"
            >
              <option value="Translator">Translator</option>
              <option value="Manager">Project Manager</option>
              <option value="Chief Editor">Chief Editor</option>
            </select>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-[#111827] hover:bg-black text-white font-medium py-3 rounded-lg transition-colors text-sm mt-2 shadow-sm disabled:opacity-70"
          >
            {isLoading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <button 
            type="button" 
            onClick={onSwitchToLogin} 
            className="text-indigo-600 font-semibold hover:text-indigo-700 hover:underline"
          >
            Log in
          </button>
        </div>
      </div>
    </div>
  );
}
