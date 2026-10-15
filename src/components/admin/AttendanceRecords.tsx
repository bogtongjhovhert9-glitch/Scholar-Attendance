import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, Calendar, Filter, Clock, AlertCircle, Cloud } from 'lucide-react';
import { AttendanceLog, Scholar } from '../../types/index.js';
import { formatTimeDisplay, getManilaDate } from '../../lib/manilaTime.js';
import { useRealtimeData } from '../../lib/useRealtimeData.js';

interface AttendanceRecordsProps {
  token: string;
}

export default function AttendanceRecords({ token }: AttendanceRecordsProps) {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [scholars, setScholars] = useState<Scholar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Real-time synchronization directly from Cloud Firestore
  const { realtimeScholars, realtimeLogs, isCloudConnected } = useRealtimeData();

  // Filters
  const [search, setSearch] = useState('');
  const [scholarFilter, setScholarFilter] = useState('all');
  const [officeFilter, setOfficeFilter] = useState('all');
  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<AttendanceLog | null>(null);
  const [deleteConfirmLog, setDeleteConfirmLog] = useState<AttendanceLog | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [formScholarId, setFormScholarId] = useState('');
  const [formDate, setFormDate] = useState(getManilaDate());
  const [formTimeIn, setFormTimeIn] = useState('08:00');
  const [formTimeOut, setFormTimeOut] = useState('12:00');
  const [formNotes, setFormNotes] = useState('');

  const fetchScholars = async () => {
    try {
      const res = await fetch('/api/admin/scholars', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setScholars(data);
        if (data.length > 0 && !formScholarId) {
          setFormScholarId(data[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const queryParams = new URLSearchParams();

      if (datePreset === 'today') {
        const today = getManilaDate();
        queryParams.set('startDate', today);
        queryParams.set('endDate', today);
      } else if (datePreset === 'yesterday') {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const yest = getManilaDate(d);
        queryParams.set('startDate', yest);
        queryParams.set('endDate', yest);
      } else if (datePreset === 'week') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        queryParams.set('startDate', getManilaDate(d));
        queryParams.set('endDate', getManilaDate());
      } else if (datePreset === 'month') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        queryParams.set('startDate', getManilaDate(d));
        queryParams.set('endDate', getManilaDate());
      } else if (datePreset === 'custom') {
        if (startDate) queryParams.set('startDate', startDate);
        if (endDate) queryParams.set('endDate', endDate);
      }

      if (scholarFilter !== 'all') {
        queryParams.set('scholarId', scholarFilter);
      }
      if (officeFilter !== 'all') {
        queryParams.set('office', officeFilter);
      }
      if (search.trim()) {
        queryParams.set('search', search.trim());
      }

      const res = await fetch(`/api/admin/attendance?${queryParams.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load attendance records');
      const data = await res.json();
      setLogs(data);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScholars();
  }, [token]);

  useEffect(() => {
    fetchLogs();
  }, [token, datePreset, startDate, endDate, scholarFilter, officeFilter, search]);

  // When realtimeLogs updates from Cloud Firestore, re-filter if no search is blocking
  useEffect(() => {
    if (realtimeLogs.length > 0) {
      let filtered = [...realtimeLogs];
      if (datePreset === 'today') {
        const today = getManilaDate();
        filtered = filtered.filter((l) => l.date === today);
      } else if (datePreset === 'yesterday') {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const yest = getManilaDate(d);
        filtered = filtered.filter((l) => l.date === yest);
      } else if (datePreset === 'week') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        const weekAgo = getManilaDate(d);
        filtered = filtered.filter((l) => l.date >= weekAgo);
      } else if (datePreset === 'month') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        const monthAgo = getManilaDate(d);
        filtered = filtered.filter((l) => l.date >= monthAgo);
      } else if (datePreset === 'custom') {
        if (startDate) filtered = filtered.filter((l) => l.date >= startDate);
        if (endDate) filtered = filtered.filter((l) => l.date <= endDate);
      }

      if (scholarFilter !== 'all') {
        filtered = filtered.filter((l) => l.scholar_id === scholarFilter);
      }
      if (officeFilter !== 'all') {
        filtered = filtered.filter((l) => l.assigned_office.toLowerCase() === officeFilter.toLowerCase());
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        filtered = filtered.filter(
          (l) =>
            l.scholar_name.toLowerCase().includes(q) ||
            l.scholar_id_number.toLowerCase().includes(q) ||
            l.assigned_office.toLowerCase().includes(q) ||
            (l.notes && l.notes.toLowerCase().includes(q))
        );
      }

      setLogs(filtered);
      setLoading(false);
    }
  }, [realtimeLogs]);

  useEffect(() => {
    if (realtimeScholars.length > 0) {
      setScholars(realtimeScholars);
    }
  }, [realtimeScholars]);

  const handleOpenAdd = () => {
    setFormDate(getManilaDate());
    setFormTimeIn('08:00');
    setFormTimeOut('12:00');
    setFormNotes('Missed scan / manual adjustment');
    setModalError(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (log: AttendanceLog) => {
    setEditingLog(log);
    setFormScholarId(log.scholar_id);
    setFormDate(log.date);
    setFormTimeIn(log.time_in ? log.time_in.slice(0, 5) : '08:00');
    setFormTimeOut(log.time_out ? log.time_out.slice(0, 5) : '');
    setFormNotes(log.notes || '');
    setModalError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!formDate || !formTimeIn) {
      setModalError('Date and Time In are required');
      return;
    }

    setSubmitting(true);
    try {
      const timeInFull = formTimeIn.length === 5 ? `${formTimeIn}:00` : formTimeIn;
      const timeOutFull = formTimeOut ? (formTimeOut.length === 5 ? `${formTimeOut}:00` : formTimeOut) : null;

      if (editingLog) {
        const res = await fetch(`/api/admin/attendance/${editingLog.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            date: formDate,
            time_in: timeInFull,
            time_out: timeOutFull,
            notes: formNotes.trim() || undefined,
          }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || 'Failed to update record');
        }
        setEditingLog(null);
      } else {
        const res = await fetch('/api/admin/attendance', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            scholar_id: formScholarId,
            date: formDate,
            time_in: timeInFull,
            time_out: timeOutFull,
            notes: formNotes.trim() || undefined,
          }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || 'Failed to create record');
        }
        setIsAddModalOpen(false);
      }

      fetchLogs();
    } catch (err: unknown) {
      setModalError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmLog) return;
    try {
      const res = await fetch(`/api/admin/attendance/${deleteConfirmLog.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete attendance record');
      setDeleteConfirmLog(null);
      fetchLogs();
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  const distinctOffices = Array.from(new Set(scholars.map((s) => s.assigned_office))).filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-neutral-900 tracking-tight">Attendance Logs & Records</h2>
            {isCloudConnected && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Cloud className="w-3 h-3" />
                Live Cloud Sync
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500">
            Audit and manage official time in and time out records for all duty scholars synchronized across all devices.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2 transition-colors self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Manual Entry</span>
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
          {error}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search box */}
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by scholar name, ID, office, or note..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:border-blue-600"
            />
          </div>

          {/* Scholar filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500 whitespace-nowrap">Scholar:</span>
            <select
              value={scholarFilter}
              onChange={(e) => setScholarFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-neutral-200 rounded-lg bg-white focus:outline-none focus:border-blue-600 max-w-[180px] truncate"
            >
              <option value="all">All Scholars</option>
              {scholars.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
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
        </div>

        {/* Date Presets Row */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-neutral-100 text-xs">
          <span className="text-neutral-500 font-medium mr-1">Date Period:</span>
          <div className="flex flex-wrap items-center gap-1">
            {[
              { id: 'all', label: 'All Records' },
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'week', label: 'Last 7 Days' },
              { id: 'month', label: 'Last 30 Days' },
              { id: 'custom', label: 'Custom Range' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setDatePreset(p.id as typeof datePreset)}
                className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                  datePreset === p.id
                    ? 'bg-neutral-800 text-white font-semibold'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {datePreset === 'custom' && (
            <div className="flex items-center gap-2 ml-auto">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2 py-1 text-xs border border-neutral-300 rounded font-mono"
              />
              <span className="text-neutral-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2 py-1 text-xs border border-neutral-300 rounded font-mono"
              />
            </div>
          )}
        </div>
      </div>

      {/* Table of Records */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Scholar Name</th>
                <th className="py-3 px-4">ID Number</th>
                <th className="py-3 px-4">Assigned Office</th>
                <th className="py-3 px-4">Time In</th>
                <th className="py-3 px-4">Time Out</th>
                <th className="py-3 px-4">Total Hours</th>
                <th className="py-3 px-4">Status & Notes</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-neutral-400">
                    Loading attendance records from centralized cloud database...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-neutral-400">
                    No attendance records found matching criteria.
                  </td>
                </tr>
              ) : (
                Array.from(new Map(logs.map((log) => [log.id, log])).values()).map((log, idx) => {
                  const isOnDuty = !log.time_out;
                  return (
                    <tr key={`att-record-${log.id || idx}-${idx}`} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-neutral-700 whitespace-nowrap">
                        {log.date}
                      </td>
                      <td className="py-3 px-4 font-semibold text-neutral-900 whitespace-nowrap">
                        {log.scholar_name}
                      </td>
                      <td className="py-3 px-4 font-mono text-neutral-600 whitespace-nowrap">
                        {log.scholar_id_number}
                      </td>
                      <td className="py-3 px-4 text-neutral-600 whitespace-nowrap">
                        {log.assigned_office}
                      </td>
                      <td className="py-3 px-4 font-mono text-neutral-900 whitespace-nowrap">
                        {formatTimeDisplay(log.time_in)}
                      </td>
                      <td className="py-3 px-4 font-mono text-neutral-900 whitespace-nowrap">
                        {log.time_out ? formatTimeDisplay(log.time_out) : (
                          <span className="text-blue-600 font-semibold">On Duty</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-neutral-900 whitespace-nowrap">
                        {log.total_hours !== null ? `${log.total_hours} hrs` : '--'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          {log.manually_edited && (
                            <span className="text-[11px] font-semibold text-amber-700">
                              Manually Edited
                            </span>
                          )}
                          {log.notes && (
                            <span className="text-[11px] text-neutral-500 italic truncate max-w-xs">
                              {log.notes}
                            </span>
                          )}
                          {!log.manually_edited && !log.notes && (
                            <span className="text-[11px] text-neutral-400">Auto Scan</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(log)}
                            title="Edit Record"
                            className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmLog(log)}
                            title="Delete Record"
                            className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Attendance Modal */}
      {(isAddModalOpen || editingLog) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-neutral-200 max-w-md w-full p-6 text-neutral-900">
            <h3 className="text-lg font-bold text-neutral-900 mb-1">
              {editingLog ? 'Edit Attendance Entry' : 'Add Manual Attendance Entry'}
            </h3>
            <p className="text-xs text-neutral-500 mb-4">
              {editingLog
                ? 'Adjust times for this record. Will be marked as "Manually Edited".'
                : 'Log a missed scan or supervisor override. Will be flagged as "Manually Edited".'}
            </p>

            {modalError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {!editingLog ? (
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Select Scholar *
                  </label>
                  <select
                    value={formScholarId}
                    onChange={(e) => setFormScholarId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg bg-white focus:outline-none focus:border-blue-600"
                    required
                  >
                    {scholars.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name} ({s.id_number} - {s.assigned_office})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-xs">
                  <span className="font-semibold text-neutral-900">{editingLog.scholar_name}</span>
                  <span className="text-neutral-500"> ({editingLog.scholar_id_number} · {editingLog.assigned_office})</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Duty Date *
                </label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg font-mono focus:outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Time In (24h) *
                  </label>
                  <input
                    type="time"
                    step="1"
                    value={formTimeIn}
                    onChange={(e) => setFormTimeIn(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg font-mono focus:outline-none focus:border-blue-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Time Out (optional)
                  </label>
                  <input
                    type="time"
                    step="1"
                    value={formTimeOut}
                    onChange={(e) => setFormTimeOut(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg font-mono focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Reason / Adjustment Note
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Scholar forgot ID badge; confirmed by supervisor"
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingLog(null);
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
                  {submitting ? 'Saving to Cloud...' : editingLog ? 'Save Changes' : 'Record Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirmLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-neutral-200 max-w-md w-full p-6 text-neutral-900">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-600">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-neutral-900">Delete Attendance Record</h3>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed mb-4">
              Are you sure you want to permanently delete this attendance entry for{' '}
              <strong>{deleteConfirmLog.scholar_name}</strong> on {deleteConfirmLog.date}? This change will sync across all devices.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmLog(null)}
                className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 border border-neutral-300 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
