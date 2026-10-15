import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  QrCode,
  ClipboardList,
  BarChart3,
  Settings,
  LogOut,
  AlertCircle,
  KeyRound,
} from 'lucide-react';
import AdminDashboard from './admin/AdminDashboard.js';
import ScholarManagement from './admin/ScholarManagement.js';
import QrCodeManager from './admin/QrCodeManager.js';
import AttendanceRecords from './admin/AttendanceRecords.js';
import ReportsView from './admin/ReportsView.js';
import AdminSettings from './admin/AdminSettings.js';
import ChangePasswordModal from './admin/ChangePasswordModal.js';
import { Scholar } from '../types/index.js';

export default function AdminPortal() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('osc_admin_token'));
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    username: string;
    role: string;
    must_change_password: boolean;
  } | null>(() => {
    const saved = localStorage.getItem('osc_admin_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Login form state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [lockoutNotice, setLockoutNotice] = useState<string | null>(null);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'scholars' | 'qrcodes' | 'attendance' | 'reports' | 'settings'>('dashboard');

  // Scholar selected for QR code view shortcut
  const [selectedScholarForQr, setSelectedScholarForQr] = useState<Scholar | null>(null);

  // Validate token on mount
  useEffect(() => {
    if (!token) return;
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) {
          handleLogout();
        } else {
          return res.json();
        }
      })
      .then((user) => {
        if (user) {
          setCurrentUser(user);
          localStorage.setItem('osc_admin_user', JSON.stringify(user));
        }
      })
      .catch(() => {
        handleLogout();
      });
  }, [token]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLockoutNotice(null);

    if (!loginUsername || !loginPassword) {
      setLoginError('Please enter both username and password.');
      return;
    }

    setLoginLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          setLockoutNotice(data.error);
        } else {
          setLoginError(data.error || 'Invalid credentials');
        }
        return;
      }

      setToken(data.token);
      setCurrentUser(data.user);
      localStorage.setItem('osc_admin_token', data.token);
      localStorage.setItem('osc_admin_user', JSON.stringify(data.user));
    } catch (err: unknown) {
      setLoginError('Unable to connect to authentication server. Please check your network.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (e) {
      // ignore
    } finally {
      setToken(null);
      setCurrentUser(null);
      localStorage.removeItem('osc_admin_token');
      localStorage.removeItem('osc_admin_user');
      setActiveTab('dashboard');
    }
  };

  // Shortcut from scholar table to QR code manager
  const handleOpenScholarQr = (scholar: Scholar) => {
    setSelectedScholarForQr(scholar);
    setActiveTab('qrcodes');
  };

  // If unauthenticated: render secure login screen
  if (!token || !currentUser) {
    return (
      <div className="min-h-screen bg-neutral-100 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-sm">
          {/* Header text-only branding (strictly no logo or icons) */}
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold tracking-tight text-neutral-900">
              OSC Duty Scholars Attendance System
            </h1>
            <p className="text-xs text-neutral-500 mt-1 uppercase tracking-wider font-semibold">
              Administrator Access Portal
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200/80 p-6 sm:p-8">
            {lockoutNotice ? (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <div>
                  <p className="font-semibold">Security Lockout Active</p>
                  <p className="mt-0.5">{lockoutNotice}</p>
                </div>
              </div>
            ) : loginError ? (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{loginError}</span>
              </div>
            ) : null}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  autoComplete="username"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 border border-neutral-300 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 border border-neutral-300 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
              >
                {loginLoading ? 'Authenticating...' : 'Sign In to Portal'}
              </button>
            </form>

            {/* Seeded account notice */}
            <div className="mt-6 pt-4 border-t border-neutral-100 text-[11px] text-neutral-500 text-center">
              <span className="font-semibold text-neutral-700">Initial Setup:</span> Default username is <code className="bg-neutral-100 px-1 py-0.5 rounded text-neutral-800">admin</code> with password <code className="bg-neutral-100 px-1 py-0.5 rounded text-neutral-800">admin12345</code>. You will be prompted to change it immediately upon first login.
            </div>
          </div>

          <div className="text-center mt-4 text-[11px] text-neutral-400">
            Internal Administrative Console · Confidential
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col selection:bg-neutral-200">
      {/* Mandatory First-Time Password Change Modal */}
      {currentUser.must_change_password && (
        <ChangePasswordModal
          token={token}
          isMandatory={true}
          onSuccess={() => {
            const updated = { ...currentUser, must_change_password: false };
            setCurrentUser(updated);
            localStorage.setItem('osc_admin_user', JSON.stringify(updated));
          }}
        />
      )}

      {/* Top Bar Contract (Text-only titles, strictly no logo) */}
      <header className="no-print bg-white border-b border-neutral-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand zone: Pure text wordmark */}
          <div className="flex items-center gap-2">
            <span className="text-base sm:text-lg font-bold tracking-tight text-neutral-900 whitespace-nowrap">
              OSC Duty Scholars Attendance
            </span>
            <span className="text-neutral-400 hidden sm:inline" aria-hidden="true">|</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 hidden sm:inline">
              Admin Portal
            </span>
          </div>

          {/* User profile & Logout */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col text-right">
              <span className="text-xs font-semibold text-neutral-900">{currentUser.username}</span>
              <span className="text-[10px] text-neutral-500 capitalize">{currentUser.role}</span>
            </div>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Log Out of Admin Portal"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-neutral-100 flex overflow-x-auto no-scrollbar">
          <nav className="flex space-x-1 sm:space-x-4 py-2">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'scholars', label: 'Scholars Roster', icon: Users },
              { id: 'qrcodes', label: 'QR Badges', icon: QrCode },
              { id: 'attendance', label: 'Attendance Records', icon: ClipboardList },
              { id: 'reports', label: 'Reports & Export', icon: BarChart3 },
              { id: 'settings', label: 'Admin Settings', icon: Settings },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold shadow-2xs'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'dashboard' && (
          <AdminDashboard
            token={token}
            onNavigateTab={(tab) => setActiveTab(tab as typeof activeTab)}
          />
        )}
        {activeTab === 'scholars' && (
          <ScholarManagement
            token={token}
            onOpenQrCard={handleOpenScholarQr}
          />
        )}
        {activeTab === 'qrcodes' && (
          <QrCodeManager
            token={token}
            initialScholar={selectedScholarForQr}
            onClearInitialScholar={() => setSelectedScholarForQr(null)}
          />
        )}
        {activeTab === 'attendance' && (
          <AttendanceRecords token={token} />
        )}
        {activeTab === 'reports' && (
          <ReportsView token={token} />
        )}
        {activeTab === 'settings' && (
          <AdminSettings token={token} currentUser={currentUser} />
        )}
      </main>

      {/* Admin Footer */}
      <footer className="no-print bg-white border-t border-neutral-200 py-3 text-center text-[11px] text-neutral-400">
        OSC Duty Scholars Attendance System · Administrative Portal
      </footer>
    </div>
  );
}
