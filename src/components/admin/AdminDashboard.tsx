import React, { useState, useEffect } from 'react';
import { Users, Clock, CheckCircle2, UserCheck, RefreshCw, ArrowRight, Cloud } from 'lucide-react';
import { DashboardStats } from '../../types/index.js';
import { formatTimeDisplay, getManilaDate } from '../../lib/manilaTime.js';
import { useRealtimeData } from '../../lib/useRealtimeData.js';

interface AdminDashboardProps {
  token: string;
  onNavigateTab: (tab: string) => void;
}

export default function AdminDashboard({ token, onNavigateTab }: AdminDashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Real-time synchronization directly from Cloud Firestore
  const { realtimeScholars, realtimeLogs, isCloudConnected } = useRealtimeData();

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load dashboard metrics');
      const data = await res.json();
      setStats(data);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [token]);

  // When Cloud Firestore pushes real-time updates from any device, sync stats automatically!
  useEffect(() => {
    if (realtimeLogs.length > 0 || realtimeScholars.length > 0) {
      const today = getManilaDate();
      const todayLogs = realtimeLogs.filter((log) => log.date === today);
      const presentScholarIds = new Set(todayLogs.map((l) => l.scholar_id));
      const currentlyOnDuty = todayLogs.filter((l) => !l.time_out);
      const totalHoursToday = todayLogs.reduce((acc, l) => acc + (l.total_hours || 0), 0);

      setStats({
        today_present_count: presentScholarIds.size,
        currently_on_duty_count: currentlyOnDuty.length,
        total_scholars_count: realtimeScholars.length,
        active_scholars_count: realtimeScholars.filter((s) => s.status === 'Active').length,
        today_total_hours: Math.round(totalHoursToday * 100) / 100,
        today_scans: todayLogs,
      });
      setLoading(false);
    }
  }, [realtimeLogs, realtimeScholars]);

  return (
    <div className="space-y-6">
      {/* Top action row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-neutral-900 tracking-tight">Today's Attendance Overview</h2>
            {isCloudConnected && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Cloud className="w-3 h-3" />
                Live Cloud Sync
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500">
            Real-time status of duty scholars logged across all devices in Philippine Standard Time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchStats}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-200 hover:bg-neutral-50 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
          {error}
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Today's Present */}
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Today's Present
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tabular-nums text-neutral-900">
              {loading && !stats ? '--' : stats?.today_present_count || 0}
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Unique scholars timed in today
            </p>
          </div>
        </div>

        {/* Metric 2: Currently On Duty */}
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Currently On Duty
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tabular-nums text-blue-600">
              {loading && !stats ? '--' : stats?.currently_on_duty_count || 0}
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Active shifts (timed in, not out)
            </p>
          </div>
        </div>

        {/* Metric 3: Total Scholars */}
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Total Scholars
            </span>
            <div className="p-2 rounded-lg bg-neutral-100 text-neutral-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tabular-nums text-neutral-900">
              {loading && !stats ? '--' : stats?.total_scholars_count || 0}
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              {stats?.active_scholars_count || 0} active in roster
            </p>
          </div>
        </div>

        {/* Metric 4: Today Total Hours */}
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Hours Logged Today
            </span>
            <div className="p-2 rounded-lg bg-neutral-100 text-neutral-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tabular-nums text-neutral-900">
              {loading && !stats ? '--' : `${stats?.today_total_hours || 0} hrs`}
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Completed duty hours today
            </p>
          </div>
        </div>
      </div>

      {/* Today's Scans Table */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-neutral-900">Today's Attendance Logs</h3>
            <p className="text-xs text-neutral-500">Live entries and shift status for today across all scanner terminals</p>
          </div>
          <button
            onClick={() => onNavigateTab('attendance')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 self-start sm:self-auto cursor-pointer"
          >
            <span>View All Records</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold">
                <th className="py-3 px-4">Scholar Name</th>
                <th className="py-3 px-4">ID Number</th>
                <th className="py-3 px-4">Assigned Office</th>
                <th className="py-3 px-4">Time In</th>
                <th className="py-3 px-4">Time Out</th>
                <th className="py-3 px-4">Shift Hours</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading && !stats ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-neutral-400">
                    Loading today's scans from centralized cloud database...
                  </td>
                </tr>
              ) : stats?.today_scans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-neutral-400">
                    No scans recorded yet today. Scanned badges will appear here automatically in real time.
                  </td>
                </tr>
              ) : (
                Array.from(new Map((stats?.today_scans || []).map((log) => [log.id, log])).values()).map((log, idx) => {
                  const isOnDuty = !log.time_out;
                  return (
                    <tr key={`dash-scan-${log.id || idx}-${idx}`} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="py-3 px-4 font-semibold text-neutral-900">
                        {log.scholar_name}
                      </td>
                      <td className="py-3 px-4 font-mono text-neutral-600">
                        {log.scholar_id_number}
                      </td>
                      <td className="py-3 px-4 text-neutral-600">
                        {log.assigned_office}
                      </td>
                      <td className="py-3 px-4 font-mono text-neutral-900">
                        {formatTimeDisplay(log.time_in)}
                      </td>
                      <td className="py-3 px-4 font-mono text-neutral-900">
                        {formatTimeDisplay(log.time_out)}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-neutral-900">
                        {log.total_hours !== null ? `${log.total_hours} hrs` : '--'}
                      </td>
                      <td className="py-3 px-4">
                        {isOnDuty ? (
                          <span className="inline-flex items-center text-blue-700 font-semibold">
                            On Duty
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-emerald-700 font-semibold">
                            Completed
                          </span>
                        )}
                        {log.manually_edited && (
                          <span className="ml-1.5 text-[10px] text-amber-600 font-medium">
                            (Edited)
                          </span>
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
    </div>
  );
}
