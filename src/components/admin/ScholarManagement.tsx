import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, QrCode, Edit2, Trash2, Check, X, AlertCircle, Cloud } from 'lucide-react';
import { Scholar } from '../../types/index.js';
import { useRealtimeData } from '../../lib/useRealtimeData.js';

interface ScholarManagementProps {
  token: string;
  onOpenQrCard: (scholar: Scholar) => void;
}

export default function ScholarManagement({ token, onOpenQrCard }: ScholarManagementProps) {
  const [scholars, setScholars] = useState<Scholar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Real-time synchronization from Cloud Firestore
  const { realtimeScholars, isCloudConnected } = useRealtimeData();

  // Search and filter states
  const [search, setSearch] = useState('');
  const [officeFilter, setOfficeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingScholar, setEditingScholar] = useState<Scholar | null>(null);
  const [deleteConfirmScholar, setDeleteConfirmScholar] = useState<Scholar | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [courseProgram, setCourseProgram] = useState('');
  const [yearLevel, setYearLevel] = useState('1st Year');
  const [assignedOffice, setAssignedOffice] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');

  const fetchScholars = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/scholars', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load scholars');
      const data = await res.json();
      setScholars(data);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScholars();
  }, [token]);

  // When Cloud Firestore pushes real-time updates from ANY device, sync immediately!
  useEffect(() => {
    if (realtimeScholars.length > 0) {
      setScholars(realtimeScholars);
      setLoading(false);
    }
  }, [realtimeScholars]);

  const resetForm = () => {
    setFullName('');
    setIdNumber('');
    setCourseProgram('');
    setYearLevel('1st Year');
    setAssignedOffice('');
    setContactNumber('');
    setStatus('Active');
    setModalError(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (scholar: Scholar) => {
    setEditingScholar(scholar);
    setFullName(scholar.full_name);
    setIdNumber(scholar.id_number);
    setCourseProgram(scholar.course_program);
    setYearLevel(scholar.year_level);
    setAssignedOffice(scholar.assigned_office);
    setContactNumber(scholar.contact_number);
    setStatus(scholar.status);
    setModalError(null);
  };

  const handleSubmitSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!fullName.trim() || !idNumber.trim() || !assignedOffice.trim()) {
      setModalError('Full name, ID number, and assigned office are required.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingScholar) {
        // Update in centralized database
        const res = await fetch(`/api/admin/scholars/${editingScholar.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            full_name: fullName.trim(),
            id_number: idNumber.trim(),
            course_program: courseProgram.trim(),
            year_level: yearLevel.trim(),
            assigned_office: assignedOffice.trim(),
            contact_number: contactNumber.trim(),
            status,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update scholar');
        setEditingScholar(null);
      } else {
        // Create in centralized database
        const res = await fetch('/api/admin/scholars', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            full_name: fullName.trim(),
            id_number: idNumber.trim(),
            course_program: courseProgram.trim(),
            year_level: yearLevel.trim(),
            assigned_office: assignedOffice.trim(),
            contact_number: contactNumber.trim(),
            status,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to add scholar');
        setIsAddModalOpen(false);
      }

      resetForm();
      fetchScholars();
    } catch (err: unknown) {
      setModalError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (scholar: Scholar) => {
    const newStatus = scholar.status === 'Active' ? 'Inactive' : 'Active';
    try {
      const res = await fetch(`/api/admin/scholars/${scholar.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      fetchScholars();
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmScholar) return;
    try {
      const res = await fetch(`/api/admin/scholars/${deleteConfirmScholar.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete scholar');
      setDeleteConfirmScholar(null);
      fetchScholars();
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  // Distinct offices for filter
  const distinctOffices = Array.from(new Set(scholars.map((s) => s.assigned_office))).filter(Boolean);

  // Filtered scholars list
  const filteredScholars = scholars.filter((s) => {
    const matchesSearch =
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.id_number.toLowerCase().includes(search.toLowerCase()) ||
      s.assigned_office.toLowerCase().includes(search.toLowerCase()) ||
      s.course_program.toLowerCase().includes(search.toLowerCase());

    const matchesOffice = officeFilter === 'all' || s.assigned_office === officeFilter;
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;

    return matchesSearch && matchesOffice && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header and Add button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-neutral-900 tracking-tight">Duty Scholars Directory</h2>
            {isCloudConnected && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Cloud className="w-3 h-3" />
                Live Cloud Sync
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500">
            Manage scholar profiles, assign duty offices, and generate attendance QR codes synchronized across all devices.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2 transition-colors self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Scholar</span>
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
          {error}
        </div>
      )}

      {/* Filter toolbar */}
      <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, ID number, program, or office..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:border-blue-600"
          />
        </div>

        {/* Office filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500 whitespace-nowrap">Office:</span>
          <select
            value={officeFilter}
            onChange={(e) => setOfficeFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-neutral-200 rounded-lg bg-white focus:outline-none focus:border-blue-600"
          >
            <option value="all">All Offices</option>
            {distinctOffices.map((off) => (
              <option key={off} value={off}>
                {off}
              </option>
            ))}
          </select>
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500 whitespace-nowrap">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-neutral-200 rounded-lg bg-white focus:outline-none focus:border-blue-600"
          >
            <option value="all">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Scholars Table */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold">
                <th className="py-3 px-4">ID Number</th>
                <th className="py-3 px-4">Full Name</th>
                <th className="py-3 px-4">Program & Year</th>
                <th className="py-3 px-4">Assigned Office</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading && scholars.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-neutral-400">
                    Loading scholars from cloud database...
                  </td>
                </tr>
              ) : filteredScholars.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-neutral-400">
                    No scholars found matching the filters.
                  </td>
                </tr>
              ) : (
                filteredScholars.map((scholar, idx) => (
                  <tr key={`scholar-${scholar.id || idx}-${idx}`} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-neutral-900">
                      {scholar.id_number}
                    </td>
                    <td className="py-3 px-4 font-semibold text-neutral-900">
                      {scholar.full_name}
                    </td>
                    <td className="py-3 px-4 text-neutral-600">
                      {scholar.course_program} ({scholar.year_level})
                    </td>
                    <td className="py-3 px-4 text-neutral-700 font-medium">
                      {scholar.assigned_office}
                    </td>
                    <td className="py-3 px-4 font-mono text-neutral-500">
                      {scholar.contact_number || '—'}
                    </td>
                    <td className="py-3 px-4">
                      {scholar.status === 'Active' ? (
                        <span className="text-emerald-700 font-semibold">Active</span>
                      ) : (
                        <span className="text-neutral-400 font-semibold">Inactive</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onOpenQrCard(scholar)}
                          title="View / Print QR Code"
                          className="p-1.5 text-neutral-600 hover:text-blue-600 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(scholar)}
                          title="Edit Scholar"
                          className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(scholar)}
                          title={scholar.status === 'Active' ? 'Deactivate' : 'Activate'}
                          className={`p-1.5 rounded transition-colors cursor-pointer ${
                            scholar.status === 'Active'
                              ? 'text-neutral-500 hover:text-amber-600 hover:bg-amber-50'
                              : 'text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          {scholar.status === 'Active' ? (
                            <X className="w-4 h-4" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmScholar(scholar)}
                          title="Delete Scholar"
                          className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Scholar Modal */}
      {(isAddModalOpen || editingScholar) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-neutral-200 max-w-lg w-full p-6 text-neutral-900">
            <h3 className="text-lg font-bold text-neutral-900 mb-1">
              {editingScholar ? 'Edit Scholar Information' : 'Add New Duty Scholar'}
            </h3>
            <p className="text-xs text-neutral-500 mb-4">
              Enter scholar details to register them into the centralized attendance roster.
            </p>

            {modalError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitSave} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Maria Clara Santos"
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-blue-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    ID Number *
                  </label>
                  <input
                    type="text"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    placeholder="e.g. 2024-00123"
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg font-mono focus:outline-none focus:border-blue-600"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Course / Program
                  </label>
                  <input
                    type="text"
                    value={courseProgram}
                    onChange={(e) => setCourseProgram(e.target.value)}
                    placeholder="e.g. BS Information Technology"
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Year Level
                  </label>
                  <select
                    value={yearLevel}
                    onChange={(e) => setYearLevel(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg bg-white focus:outline-none focus:border-blue-600"
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                    <option value="5th Year">5th Year</option>
                    <option value="Postgraduate">Postgraduate</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Assigned Office or Duty Area *
                  </label>
                  <input
                    type="text"
                    value={assignedOffice}
                    onChange={(e) => setAssignedOffice(e.target.value)}
                    placeholder="e.g. Office of Student Affairs"
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-blue-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Contact Number
                  </label>
                  <input
                    type="text"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    placeholder="e.g. 0917-123-4567"
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg font-mono focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Status
                </label>
                <div className="flex gap-4 pt-1">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      checked={status === 'Active'}
                      onChange={() => setStatus('Active')}
                      className="text-blue-600"
                    />
                    <span>Active</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      checked={status === 'Inactive'}
                      onChange={() => setStatus('Inactive')}
                      className="text-blue-600"
                    />
                    <span>Inactive</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingScholar(null);
                  }}
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 border border-neutral-300 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {submitting
                    ? 'Saving to Cloud...'
                    : editingScholar
                    ? 'Save Changes'
                    : 'Add Scholar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmScholar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-neutral-200 max-w-md w-full p-6 text-neutral-900">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-600">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-neutral-900">Confirm Deletion</h3>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed mb-4">
              Are you sure you want to remove scholar{' '}
              <strong className="text-neutral-900">{deleteConfirmScholar.full_name}</strong> (ID:{' '}
              {deleteConfirmScholar.id_number})? This action will remove them from all devices in the cloud system.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmScholar(null)}
                className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 border border-neutral-300 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors cursor-pointer"
              >
                Delete Scholar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
