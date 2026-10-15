import React, { useState, useEffect } from 'react';
import { Download, Printer, RefreshCw, QrCode, Search, Check, ShieldAlert } from 'lucide-react';
import { Scholar } from '../../types/index.js';

interface QrCodeManagerProps {
  token: string;
  initialScholar?: Scholar | null;
  onClearInitialScholar?: () => void;
}

export default function QrCodeManager({
  token,
  initialScholar,
  onClearInitialScholar,
}: QrCodeManagerProps) {
  const [scholars, setScholars] = useState<Scholar[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScholar, setSelectedScholar] = useState<Scholar | null>(null);
  const [search, setSearch] = useState('');
  const [isBatchPrintMode, setIsBatchPrintMode] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  const fetchScholars = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/scholars', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setScholars(data);
        if (initialScholar) {
          const match = data.find((s: Scholar) => s.id === initialScholar.id);
          if (match) setSelectedScholar(match);
        } else if (data.length > 0 && !selectedScholar) {
          setSelectedScholar(data[0]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScholars();
  }, [token]);

  useEffect(() => {
    if (initialScholar) {
      setSelectedScholar(initialScholar);
    }
  }, [initialScholar]);

  // Handle regenerating secure QR token
  const handleRegenerateToken = async () => {
    if (!selectedScholar) return;
    setRegenerating(true);
    try {
      const res = await fetch(`/api/admin/scholars/${selectedScholar.id}/regenerate-qr`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to regenerate QR token');
      const data = await res.json();
      
      // Update local state
      const updated = data.scholar;
      setSelectedScholar(updated);
      setScholars((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setConfirmRegenerate(false);
    } catch (err: unknown) {
      alert((err as Error).message);
    } finally {
      setRegenerating(false);
    }
  };

  // Download individual QR code as PNG image
  const handleDownloadPng = async (scholar: Scholar) => {
    try {
      const response = await fetch(`/api/qr-image/${encodeURIComponent(scholar.qr_token)}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `QR_${scholar.id_number}_${scholar.full_name.replace(/\s+/g, '_')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download QR image');
    }
  };

  // Print individual card
  const handlePrintIndividual = () => {
    window.print();
  };

  const filteredScholars = scholars.filter(
    (s) =>
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.id_number.toLowerCase().includes(search.toLowerCase()) ||
      s.assigned_office.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 tracking-tight">QR Code Generator & ID Cards</h2>
          <p className="text-xs text-neutral-500">
            Each scholar receives a cryptographically secure random token encoded into their badge.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsBatchPrintMode(!isBatchPrintMode)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors ${
              isBatchPrintMode
                ? 'bg-neutral-800 text-white'
                : 'bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>{isBatchPrintMode ? 'Exit Batch Print' : 'Batch Print View'}</span>
          </button>
        </div>
      </div>

      {/* BATCH PRINT VIEW */}
      {isBatchPrintMode ? (
        <div className="space-y-4">
          <div className="no-print p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                Batch Print Preparation
              </h4>
              <p className="text-xs text-blue-700 mt-0.5">
                Showing all {filteredScholars.length} scholars formatted for printing on standard Letter or A4 sheets.
              </p>
            </div>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-2 shadow-xs transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Print All Cards Now</span>
            </button>
          </div>

          {/* Printable Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredScholars.map((scholar, idx) => (
              <div
                key={`qr-card-${scholar.id || idx}-${idx}`}
                className="page-break-inside-avoid bg-white border-2 border-dashed border-neutral-300 p-5 rounded-xl flex flex-col items-center text-center shadow-xs"
              >
                {/* Header text-only branding (strictly no logo) */}
                <div className="w-full pb-2 mb-3 border-b border-neutral-200">
                  <span className="text-[10px] font-bold tracking-widest text-neutral-500 uppercase">
                    OSC Duty Scholar Badge
                  </span>
                </div>

                {/* QR Code image */}
                <div className="w-40 h-40 bg-white p-2 border border-neutral-200 rounded-lg flex items-center justify-center">
                  <img
                    src={`/api/qr-image/${encodeURIComponent(scholar.qr_token)}`}
                    alt={`QR code for ${scholar.full_name}`}
                    className="w-full h-full object-contain"
                  />
                </div>

                {/* Scholar Details */}
                <h3 className="text-sm font-bold text-neutral-900 mt-3 truncate max-w-full">
                  {scholar.full_name}
                </h3>
                <p className="text-xs font-mono font-medium text-neutral-600">
                  ID: {scholar.id_number}
                </p>
                <p className="text-xs text-neutral-500 mt-1">
                  {scholar.assigned_office}
                </p>
                <p className="text-[11px] text-neutral-400">
                  {scholar.course_program} ({scholar.year_level})
                </p>

                <div className="w-full pt-2 mt-3 border-t border-neutral-100 text-[9px] text-neutral-400 uppercase tracking-wider">
                  Scan at OSC Duty Station
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* INDIVIDUAL SCHOLAR QR VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Scholar selector list */}
          <div className="no-print lg:col-span-5 bg-white rounded-xl border border-neutral-200 shadow-xs flex flex-col h-[540px]">
            <div className="p-3 border-b border-neutral-200">
              <div className="relative">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter scholar by name or ID..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-neutral-100">
              {filteredScholars.map((s, idx) => (
                <button
                  key={`qr-select-${s.id || idx}-${idx}`}
                  onClick={() => {
                    setSelectedScholar(s);
                    setConfirmRegenerate(false);
                    if (onClearInitialScholar) onClearInitialScholar();
                  }}
                  className={`w-full text-left p-3.5 transition-colors flex items-center justify-between gap-3 ${
                    selectedScholar?.id === s.id ? 'bg-blue-50/70 border-l-4 border-blue-600' : 'hover:bg-neutral-50'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-neutral-900 truncate">{s.full_name}</p>
                    <p className="text-[11px] font-mono text-neutral-500">{s.id_number} · {s.assigned_office}</p>
                  </div>
                  <QrCode className="w-4 h-4 text-neutral-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Active Scholar Card Preview */}
          <div className="lg:col-span-7 flex flex-col items-center">
            {selectedScholar ? (
              <div className="w-full max-w-md flex flex-col items-center">
                {/* Printable Duty Scholar Card */}
                <div
                  id="printable-scholar-card"
                  className="page-break-inside-avoid w-full bg-white border-2 border-neutral-300 rounded-2xl p-6 shadow-md flex flex-col items-center text-center relative"
                >
                  {/* Text Header (No logo or brand icons) */}
                  <div className="w-full pb-3 mb-4 border-b border-neutral-200">
                    <span className="text-xs font-bold tracking-widest text-neutral-800 uppercase block">
                      OSC Duty Scholars Attendance
                    </span>
                    <span className="text-[10px] text-neutral-500 tracking-wider uppercase">
                      Official Scholar Identification Card
                    </span>
                  </div>

                  {/* High resolution QR Code */}
                  <div className="w-48 h-48 bg-white p-2.5 border-2 border-neutral-900 rounded-xl flex items-center justify-center shadow-xs">
                    <img
                      src={`/api/qr-image/${encodeURIComponent(selectedScholar.qr_token)}`}
                      alt={`QR code for ${selectedScholar.full_name}`}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {/* Scholar Metadata */}
                  <div className="mt-4 w-full">
                    <h3 className="text-lg font-bold text-neutral-900 leading-tight">
                      {selectedScholar.full_name}
                    </h3>
                    <p className="text-xs font-mono font-semibold text-neutral-700 mt-1">
                      ID NO: {selectedScholar.id_number}
                    </p>
                    <div className="mt-2 text-xs text-neutral-600 space-y-0.5">
                      <p className="font-medium text-neutral-800">{selectedScholar.assigned_office}</p>
                      <p className="text-neutral-500">{selectedScholar.course_program} · {selectedScholar.year_level}</p>
                    </div>
                  </div>

                  {/* Footer instruction text */}
                  <div className="w-full pt-3 mt-4 border-t border-neutral-100 flex items-center justify-between text-[10px] text-neutral-500">
                    <span>Non-transferable</span>
                    <span className="font-mono text-[9px] text-neutral-400">
                      Token: {selectedScholar.qr_token.slice(0, 10)}...
                    </span>
                  </div>
                </div>

                {/* Interactive Controls (hidden on print) */}
                <div className="no-print w-full mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={() => handleDownloadPng(selectedScholar)}
                    className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PNG</span>
                  </button>
                  <button
                    onClick={handlePrintIndividual}
                    className="px-4 py-2 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Card</span>
                  </button>

                  {/* Regenerate Token Action */}
                  {!confirmRegenerate ? (
                    <button
                      onClick={() => setConfirmRegenerate(true)}
                      className="px-3 py-2 text-neutral-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Regenerate QR Token</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 bg-amber-50 p-1.5 rounded-lg border border-amber-200">
                      <span className="text-[11px] text-amber-800 font-medium">Revoke old QR?</span>
                      <button
                        onClick={handleRegenerateToken}
                        disabled={regenerating}
                        className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-semibold"
                      >
                        {regenerating ? 'Regenerating...' : 'Yes, Replace'}
                      </button>
                      <button
                        onClick={() => setConfirmRegenerate(false)}
                        className="px-2 py-1 bg-white text-neutral-600 border border-neutral-300 rounded text-[11px]"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                <div className="no-print mt-3 text-center">
                  <span className="text-[11px] text-neutral-500 font-mono">
                    Encoded Token: <span className="text-neutral-700 font-semibold">{selectedScholar.qr_token}</span>
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-neutral-400">
                Select a scholar to view their attendance QR badge.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
