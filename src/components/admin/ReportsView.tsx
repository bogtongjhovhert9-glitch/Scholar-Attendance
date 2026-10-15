import React, { useState, useEffect } from 'react';
import { Download, FileSpreadsheet, Printer, Calendar, Filter, Users, Clock, Cloud } from 'lucide-react';
import * as XLSX from 'xlsx';
import { ScholarReportSummary } from '../../types/index.js';
import { getManilaDate } from '../../lib/manilaTime.js';
import { useRealtimeData } from '../../lib/useRealtimeData.js';

interface ReportsViewProps {
  token: string;
}

export default function ReportsView({ token }: ReportsViewProps) {
  const [reports, setReports] = useState<ScholarReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Real-time synchronization directly from Cloud Firestore
  const { realtimeScholars, realtimeLogs, isCloudConnected } = useRealtimeData();

  // Date filters
  const today = getManilaDate();
  // Default to 1st day of current month to today
  const firstDayOfMonth = today.slice(0, 8) + '01';
  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [officeFilter, setOfficeFilter] = useState('all');

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const query = new URLSearchParams();
      if (startDate) query.set('startDate', startDate);
      if (endDate) query.set('endDate', endDate);
      if (officeFilter !== 'all') query.set('office', officeFilter);

      const res = await fetch(`/api/admin/reports?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to generate attendance report');
      const data = await res.json();
      setReports(data);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [token, startDate, endDate, officeFilter]);

  // When realtimeLogs or realtimeScholars update in Cloud Firestore, compute reports live!
  useEffect(() => {
    if (realtimeScholars.length > 0) {
      let scholars = [...realtimeScholars];
      if (officeFilter !== 'all') {
        scholars = scholars.filter((s) => s.assigned_office.toLowerCase() === officeFilter.toLowerCase());
      }

      let logs = [...realtimeLogs];
      if (startDate) logs = logs.filter((l) => l.date >= startDate);
      if (endDate) logs = logs.filter((l) => l.date <= endDate);

      const summary: ScholarReportSummary[] = scholars.map((s) => {
        const sLogs = logs.filter((l) => l.scholar_id === s.id);
        const uniqueDays = new Set(sLogs.map((l) => l.date)).size;
        const totalHours = sLogs.reduce((acc, l) => acc + (l.total_hours || 0), 0);
        const avg = uniqueDays > 0 ? totalHours / uniqueDays : 0;

        return {
          scholar_id: s.id,
          scholar_name: s.full_name,
          id_number: s.id_number,
          assigned_office: s.assigned_office,
          course_program: s.course_program,
          year_level: s.year_level,
          status: s.status,
          total_days_attended: uniqueDays,
          total_hours_rendered: Math.round(totalHours * 100) / 100,
          average_hours_per_day: Math.round(avg * 100) / 100,
        };
      });

      setReports(summary);
      setLoading(false);
    }
  }, [realtimeScholars, realtimeLogs, startDate, endDate, officeFilter]);

  // Calculations for summary metrics
  const totalHoursCombined = reports.reduce((acc, r) => acc + r.total_hours_rendered, 0);
  const totalDaysCombined = reports.reduce((acc, r) => acc + r.total_days_attended, 0);
  const activeContributors = reports.filter((r) => r.total_hours_rendered > 0).length;
  const avgHoursPerActiveScholar = activeContributors > 0 ? totalHoursCombined / activeContributors : 0;

  // Distinct offices for filter
  const distinctOffices = Array.from(new Set(reports.map((r) => r.assigned_office))).filter(Boolean);

  // Export to CSV
  const handleExportCsv = () => {
    const headers = [
      'ID Number',
      'Scholar Name',
      'Course & Year',
      'Assigned Office',
      'Status',
      'Days Attended',
      'Total Hours Rendered',
      'Average Hours/Day',
    ];

    const rows = reports.map((r) => [
      `"${r.id_number}"`,
      `"${r.scholar_name.replace(/"/g, '""')}"`,
      `"${r.course_program} (${r.year_level})"`,
      `"${r.assigned_office.replace(/"/g, '""')}"`,
      `"${r.status}"`,
      r.total_days_attended,
      r.total_hours_rendered,
      r.average_hours_per_day,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `OSC_Duty_Hours_Report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to Excel (.xlsx) using xlsx library
  const handleExportExcel = () => {
    const dataForSheet = reports.map((r) => ({
      'ID Number': r.id_number,
      'Scholar Name': r.scholar_name,
      'Course/Program': r.course_program,
      'Year Level': r.year_level,
      'Assigned Office': r.assigned_office,
      'Account Status': r.status,
      'Days Attended': r.total_days_attended,
      'Total Hours Rendered': r.total_hours_rendered,
      'Average Hours / Day': r.average_hours_per_day,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Summary');

    // Auto-size columns
    const colWidths = [
      { wch: 15 },
      { wch: 28 },
      { wch: 28 },
      { wch: 12 },
      { wch: 26 },
      { wch: 14 },
      { wch: 16 },
      { wch: 20 },
      { wch: 18 },
    ];
    worksheet['!cols'] = colWidths;

    XLSX.writeFile(workbook, `OSC_Duty_Hours_Report_${startDate}_to_${endDate}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-neutral-900 tracking-tight">Attendance Reports & Hours Summary</h2>
            {isCloudConnected && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Cloud className="w-3 h-3" />
                Live Cloud Sync
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500">
            Calculate cumulative rendered duty hours per scholar for clearance, payroll, and academic verification across all devices.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={reports.length === 0}
            className="px-3.5 py-2 text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-neutral-500" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleExportExcel}
            disabled={reports.length === 0}
            className="px-3.5 py-2 text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Excel (.xlsx)</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="no-print p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
          {error}
        </div>
      )}

      {/* Date & Office Filters */}
      <div className="no-print bg-white p-4 rounded-xl border border-neutral-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-neutral-500 font-medium">Reporting Period:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 border border-neutral-300 rounded-lg font-mono text-xs focus:outline-none focus:border-blue-600"
            />
            <span className="text-neutral-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 border border-neutral-300 rounded-lg font-mono text-xs focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-neutral-500 font-medium">Office:</span>
            <select
              value={officeFilter}
              onChange={(e) => setOfficeFilter(e.target.value)}
              className="px-3 py-1.5 border border-neutral-300 rounded-lg bg-white text-xs focus:outline-none focus:border-blue-600"
            >
              <option value="all">All Duty Offices</option>
              {distinctOffices.map((off) => (
                <option key={off} value={off}>
                  {off}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={fetchReports}
          className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 border border-neutral-200 hover:bg-neutral-50 rounded-lg cursor-pointer"
        >
          Apply Filter
        </button>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block">
            Total Hours Rendered
          </span>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-neutral-900">
            {Math.round(totalHoursCombined * 100) / 100} hrs
          </div>
          <span className="text-[11px] text-neutral-400">Selected period aggregate</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block">
            Total Duty Shifts
          </span>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-neutral-900">
            {totalDaysCombined}
          </div>
          <span className="text-[11px] text-neutral-400">Total attendance days logged</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block">
            Active Duty Scholars
          </span>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-neutral-900">
            {activeContributors} / {reports.length}
          </div>
          <span className="text-[11px] text-neutral-400">Scholars with logged shifts</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block">
            Average Hours / Scholar
          </span>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-blue-600">
            {Math.round(avgHoursPerActiveScholar * 10) / 10} hrs
          </div>
          <span className="text-[11px] text-neutral-400">Per active contributor</span>
        </div>
      </div>

      {/* Printable Report Header (Visible only when printed) */}
      <div className="print-only mb-6 border-b-2 border-neutral-900 pb-4">
        <h1 className="text-xl font-bold text-neutral-900 uppercase tracking-wider">
          OSC Duty Scholars Attendance System
        </h1>
        <h2 className="text-base font-semibold text-neutral-700 mt-1">
          Official Duty Hours Summary Report
        </h2>
        <div className="flex justify-between items-center text-xs text-neutral-600 mt-2">
          <span>Reporting Period: {startDate} to {endDate}</span>
          <span>Generated: {getManilaDate()} (Philippine Standard Time)</span>
        </div>
      </div>

      {/* Summary Table */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold">
                <th className="py-3 px-4">Scholar Name</th>
                <th className="py-3 px-4">ID Number</th>
                <th className="py-3 px-4">Program & Year</th>
                <th className="py-3 px-4">Assigned Office</th>
                <th className="py-3 px-4 text-center">Days Attended</th>
                <th className="py-3 px-4 text-right">Total Hours</th>
                <th className="py-3 px-4 text-right">Avg Hours/Day</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading && reports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-neutral-400">
                    Calculating attendance report from centralized database...
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-neutral-400">
                    No scholars found.
                  </td>
                </tr>
              ) : (
                reports.map((r, idx) => (
                  <tr key={`report-row-${r.scholar_id || idx}-${idx}`} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="py-3 px-4 font-semibold text-neutral-900">
                      {r.scholar_name}
                    </td>
                    <td className="py-3 px-4 font-mono text-neutral-600">
                      {r.id_number}
                    </td>
                    <td className="py-3 px-4 text-neutral-600">
                      {r.course_program} ({r.year_level})
                    </td>
                    <td className="py-3 px-4 text-neutral-700 font-medium">
                      {r.assigned_office}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-center text-neutral-800">
                      {r.total_days_attended}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-right font-bold text-neutral-900">
                      {r.total_hours_rendered.toFixed(2)} hrs
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-right text-neutral-700">
                      {r.average_hours_per_day.toFixed(2)} hrs
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={r.status === 'Active' ? 'text-emerald-700 font-semibold' : 'text-neutral-400'}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {reports.length > 0 && (
              <tfoot>
                <tr className="bg-neutral-50 font-bold border-t-2 border-neutral-200 text-neutral-900">
                  <td colSpan={4} className="py-3 px-4 text-neutral-800">
                    Total Combined
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-center">
                    {totalDaysCombined}
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-right text-blue-700">
                    {totalHoursCombined.toFixed(2)} hrs
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
