import React, { useState, useEffect } from 'react';
import { UserPlus, KeyRound, Trash2, Shield, AlertCircle, CheckCircle2 } from 'lucide-react';
import { AdminUser } from '../../types/index.js';
import ChangePasswordModal from './ChangePasswordModal.js';

interface AdminSettingsProps {
  token: string;
  currentUser: { id: string; username: string; role: string };
}

export default function AdminSettings({ token, currentUser }: AdminSettingsProps) {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isAddAdminModalOpen, setIsAddAdminModalOpen] = useState(false);
  const [deleteAdminTarget, setDeleteAdminTarget] = useState<AdminUser | null>(null);

  // New admin form
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'superadmin'>('admin');
  const [addAdminError, setAddAdminError] = useState<string | null>(null);
  const [submittingAdd, setSubmittingAdd] = useState(false);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/admins', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load administrators');
      const data = await res.json();
      setAdmins(data);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, [token]);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddAdminError(null);

    if (!newUsername.trim() || !newPassword.trim()) {
      setAddAdminError('Username and password are required');
      return;
    }
    if (newPassword.length < 6) {
      setAddAdminError('Password must be at least 6 characters long');
      return;
    }

    setSubmittingAdd(true);
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword.trim(),
          role: newRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create administrator');
      }

      setNewUsername('');
      setNewPassword('');
      setIsAddAdminModalOpen(false);
      setSuccessMsg(`Administrator account "${data.username}" created successfully.`);
      fetchAdmins();
    } catch (err: unknown) {
      setAddAdminError((err as Error).message);
    } finally {
      setSubmittingAdd(false);
    }
  };

  const handleDeleteAdmin = async () => {
    if (!deleteAdminTarget) return;
    try {
      const res = await fetch(`/api/admin/admins/${deleteAdminTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to remove admin');
      }

      setDeleteAdminTarget(null);
      setSuccessMsg(`Administrator "${deleteAdminTarget.username}" removed.`);
      fetchAdmins();
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-neutral-900 tracking-tight">Security & Administrator Settings</h2>
        <p className="text-xs text-neutral-500">
          Manage system security, update administrative credentials, and provision staff access.
        </p>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
          {error}
        </div>
      )}

      {/* Password Management Card */}
      <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-neutral-600" />
            <h3 className="text-sm font-bold text-neutral-900">Your Password</h3>
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Logged in as <strong className="text-neutral-800">{currentUser.username}</strong> ({currentUser.role}). Recommended to update passwords periodically.
          </p>
        </div>
        <button
          onClick={() => setIsPasswordModalOpen(true)}
          className="px-4 py-2 text-xs font-semibold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors whitespace-nowrap self-start sm:self-auto"
        >
          Change Password
        </button>
      </div>

      {/* Admin Accounts Roster */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-neutral-900">Authorized Administrators</h3>
            <p className="text-xs text-neutral-500">
              Users with access to scholar roster, attendance logs, and report exports.
            </p>
          </div>
          <button
            onClick={() => {
              setAddAdminError(null);
              setIsAddAdminModalOpen(true);
            }}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2 transition-colors self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add New Admin</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold">
                <th className="py-3 px-4">Username</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Date Created</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-neutral-400">
                    Loading admin accounts...
                  </td>
                </tr>
              ) : (
                admins.map((adm, idx) => {
                  const isCurrent = adm.id === currentUser.id;
                  return (
                    <tr key={`admin-row-${adm.id || idx}-${idx}`} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="py-3 px-4 font-semibold text-neutral-900">
                        {adm.username}
                        {isCurrent && (
                          <span className="ml-2 text-[10px] text-blue-600 font-medium">
                            (Current Session)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 capitalize text-neutral-700">
                        {adm.role}
                      </td>
                      <td className="py-3 px-4">
                        {adm.must_change_password ? (
                          <span className="text-amber-700 font-medium text-[11px]">
                            Password change pending
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-medium text-[11px]">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-neutral-500">
                        {new Date(adm.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!isCurrent && admins.length > 1 ? (
                          <button
                            onClick={() => setDeleteAdminTarget(adm)}
                            className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            title="Remove Administrator"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-[11px] text-neutral-400 italic">Protected</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Change Password Modal */}
      {isPasswordModalOpen && (
        <ChangePasswordModal
          token={token}
          isMandatory={false}
          onSuccess={() => {
            setIsPasswordModalOpen(false);
            setSuccessMsg('Your password has been changed successfully.');
          }}
          onCancel={() => setIsPasswordModalOpen(false)}
        />
      )}

      {/* Add New Admin Modal */}
      {isAddAdminModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-neutral-200 max-w-md w-full p-6 text-neutral-900">
            <h3 className="text-lg font-bold text-neutral-900 mb-1">
              Add Administrator Account
            </h3>
            <p className="text-xs text-neutral-500 mb-4">
              Create an administrative user with full access to the OSC attendance portal.
            </p>

            {addAdminError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{addAdminError}</span>
              </div>
            )}

            <form onSubmit={handleAddAdmin} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. jcruz_admin"
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Temporary Password (min 6 characters) *
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Administrative Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'admin' | 'superadmin')}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg bg-white focus:outline-none focus:border-blue-600"
                >
                  <option value="admin">Administrator (Roster & Attendance Logs)</option>
                  <option value="superadmin">Super Admin (Full Access)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsAddAdminModalOpen(false)}
                  disabled={submittingAdd}
                  className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 border border-neutral-300 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {submittingAdd ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Admin Confirmation Modal */}
      {deleteAdminTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-neutral-200 max-w-md w-full p-6 text-neutral-900">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-600">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-neutral-900">Revoke Admin Access</h3>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed mb-4">
              Are you sure you want to delete administrator account{' '}
              <strong>"{deleteAdminTarget.username}"</strong>? They will no longer be able to log in to the portal.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteAdminTarget(null)}
                className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 border border-neutral-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAdmin}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors"
              >
                Revoke Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
