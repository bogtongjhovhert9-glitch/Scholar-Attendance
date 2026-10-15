import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, RefreshCw, AlertCircle, CheckCircle2, XCircle, Clock, Calendar, Upload } from 'lucide-react';
import { formatManilaDateTimeDisplay, formatTimeDisplay } from '../lib/manilaTime.js';
import { playSuccessBeep, playErrorTone } from '../lib/sound.js';
import { ScanResponse } from '../types/index.js';

export default function PublicScanner() {
  // Live clock state
  const [currentDateTime, setCurrentDateTime] = useState(formatManilaDateTimeDisplay());
  const [cameraPermissionError, setCameraPermissionError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  
  // Scan result state
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [countdown, setCountdown] = useState<number>(3);

  // Manual token input state (discreet simulation tool for testing without physical camera)
  const [manualToken, setManualToken] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isCooldownRef = useRef<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Live Philippine clock updater
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentDateTime(formatManilaDateTimeDisplay());
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Process QR code string
  const handleDecodedText = useCallback(async (decodedText: string) => {
    if (isCooldownRef.current || isProcessing) return;
    isCooldownRef.current = true;
    setIsProcessing(true);

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_token: decodedText.trim() }),
      });

      const data: ScanResponse = await res.json();

      if (data.success) {
        playSuccessBeep();
        setScanResult(data);
      } else {
        playErrorTone();
        setScanResult({
          success: false,
          message: data.message || 'Invalid QR code',
        });
      }
    } catch (err) {
      playErrorTone();
      setScanResult({
        success: false,
        message: 'Network error communicating with attendance server',
      });
    } finally {
      setIsProcessing(false);
      setCountdown(3);

      // Countdown ticker for the 3 seconds
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      let remaining = 3;
      countdownIntervalRef.current = setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);
        if (remaining <= 0 && countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
        }
      }, 1000);

      // Auto dismiss after 3 seconds and resume scanning
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setScanResult(null);
        isCooldownRef.current = false;
      }, 3000);
    }
  }, [isProcessing]);

  // Stop camera stream cleanly
  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
      } catch (err) {
        // ignore errors during stop
      }
    }
  };

  // Start camera scanner with robust error recovery
  const startScanner = useCallback(async (cameraId?: string, mode?: 'environment' | 'user') => {
    try {
      setCameraPermissionError(null);
      await stopScanner();

      const qrRegionId = 'qr-reader-region';
      const container = document.getElementById(qrRegionId);
      if (!container) return;

      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(qrRegionId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
      }

      // Query available camera devices
      let devices: Array<{ id: string; label: string }> = [];
      try {
        const found = await Html5Qrcode.getCameras();
        if (found && found.length > 0) {
          devices = found.map((d) => ({
            id: d.id,
            label: d.label || `Camera ${d.id.slice(0, 5)}...`,
          }));
          setAvailableCameras(devices);
        }
      } catch (e) {
        // proceed even if getCameras enumeration is initially restricted
      }

      const activeMode = mode || facingMode;
      const qrConfig = {
        fps: 15,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minDim = Math.min(viewfinderWidth, viewfinderHeight);
          const size = Math.floor(minDim * 0.72);
          return { width: size, height: size };
        },
        aspectRatio: 1.0,
      };

      const startWithConfig = async (config: any) => {
        if (!html5QrCodeRef.current) return;
        await html5QrCodeRef.current.start(
          config,
          qrConfig,
          (decodedText) => {
            handleDecodedText(decodedText);
          },
          () => {
            // Frame error (no QR detected in frame), silent
          }
        );
      };

      if (cameraId) {
        // Specific camera selected by user
        await startWithConfig(cameraId);
        setSelectedCameraId(cameraId);
      } else {
        // Automatic fallback: try preferred facingMode -> alternate mode -> first camera ID
        try {
          await startWithConfig({ facingMode: activeMode });
        } catch (firstErr) {
          console.warn(`Camera start failed with facingMode "${activeMode}", trying alternative camera...`, firstErr);
          const fallbackMode = activeMode === 'environment' ? 'user' : 'environment';
          try {
            await startWithConfig({ facingMode: fallbackMode });
            setFacingMode(fallbackMode);
          } catch (secondErr) {
            console.warn(`Camera start failed with fallbackMode "${fallbackMode}", trying devices list...`, secondErr);
            if (devices.length > 0) {
              await startWithConfig(devices[0].id);
              setSelectedCameraId(devices[0].id);
            } else {
              throw secondErr;
            }
          }
        }
      }

      setIsScanning(true);
    } catch (err: unknown) {
      console.warn('Camera start error:', err);
      setIsScanning(false);
      const errMsg = (err as Error)?.message || String(err);
      if (
        errMsg.includes('Permission') ||
        errMsg.includes('NotAllowedError') ||
        errMsg.includes('Permission denied')
      ) {
        setCameraPermissionError(
          'Camera permission was denied. Please allow camera access in your browser address bar permissions to scan QR codes.'
        );
      } else if (
        errMsg.includes('NotFoundError') ||
        errMsg.includes('DevicesNotFoundError') ||
        errMsg.includes('OverconstrainedError')
      ) {
        setCameraPermissionError(
          'No compatible camera was found or the requested camera is unavailable. You can switch cameras or scan a QR image below.'
        );
      } else {
        setCameraPermissionError(
          'Unable to start camera feed. Please check camera permissions or switch to another camera.'
        );
      }
    }
  }, [facingMode, handleDecodedText]);

  // Toggle switch front/rear camera
  const handleSwitchCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    setSelectedCameraId('');
    startScanner(undefined, nextMode);
  };

  // Scan QR code from an uploaded image file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('qr-reader-region', {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
      }
      const decodedText = await html5QrCodeRef.current.scanFile(file, false);
      if (decodedText) {
        handleDecodedText(decodedText);
      }
    } catch (err) {
      playErrorTone();
      setScanResult({
        success: false,
        message: 'No readable QR code found in the image. Please try a clearer picture.',
      });
    } finally {
      e.target.value = '';
    }
  };

  useEffect(() => {
    startScanner();
    return () => {
      stopScanner();
      if (timerRef.current) clearTimeout(timerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 flex flex-col justify-between selection:bg-neutral-800">
      {/* Top Header - Pure text title and live Philippine time */}
      <header className="w-full pt-6 pb-4 px-4 sm:px-6 max-w-xl mx-auto text-center border-b border-neutral-800">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-2">
          OSC Duty Scholars Attendance
        </h1>

        {/* Live Philippine Date and Clock */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs sm:text-sm text-neutral-400 font-medium">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-neutral-400" />
            <span>{currentDateTime.dayStr}, {currentDateTime.dateStr}</span>
          </div>
          <span className="text-neutral-600 hidden sm:inline" aria-hidden="true">·</span>
          <div className="flex items-center gap-1.5 font-mono tabular-nums text-neutral-200 bg-neutral-800/80 px-2.5 py-0.5 rounded">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span>{currentDateTime.timeStr} PST</span>
          </div>
        </div>
      </header>

      {/* Main Scanner Container */}
      <main className="flex-1 w-full max-w-xl mx-auto px-4 py-4 sm:py-6 flex flex-col items-center justify-center relative">
        {/* Full-width Result Card (displayed for 3 seconds on scan) */}
        {scanResult && (
          <div className="w-full absolute inset-x-4 top-4 z-40 sm:static sm:mb-4 animate-in fade-in slide-in-from-top duration-200">
            {scanResult.success ? (
              <div className="w-full bg-neutral-800 border-2 border-emerald-500/80 rounded-xl p-5 shadow-2xl relative overflow-hidden">
                {/* 3-second auto-dismiss progress line */}
                <div 
                  className="absolute bottom-0 left-0 h-1 bg-emerald-500 transition-all duration-100 ease-linear"
                  style={{ width: `${(countdown / 3) * 100}%` }}
                />

                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs uppercase tracking-wider font-semibold text-emerald-400">
                        {scanResult.type === 'time_in' ? 'Time In Recorded' : 'Time Out Recorded'}
                      </span>
                      <span className="text-xs font-mono text-neutral-400 tabular-nums">
                        resuming in {countdown}s
                      </span>
                    </div>

                    <h2 className="text-lg sm:text-xl font-bold text-white truncate mt-0.5">
                      {scanResult.scholar_name}
                    </h2>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-neutral-300">
                      <span className="font-mono text-neutral-300">ID: {scanResult.id_number}</span>
                      {scanResult.assigned_office && (
                        <>
                          <span className="text-neutral-600">·</span>
                          <span className="text-neutral-400 truncate">{scanResult.assigned_office}</span>
                        </>
                      )}
                    </div>

                    <div className="mt-2.5 pt-2.5 border-t border-neutral-700/60 flex items-center justify-between text-xs text-neutral-300">
                      <div className="flex items-center gap-1 font-mono">
                        <Clock className="w-3.5 h-3.5 text-neutral-400" />
                        <span>Logged at: {formatTimeDisplay(scanResult.timestamp)}</span>
                      </div>
                      {scanResult.type === 'time_out' && scanResult.total_hours !== undefined && (
                        <div className="font-semibold text-emerald-400">
                          Shift Duration: {scanResult.total_hours} hrs
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full bg-neutral-800 border-2 border-rose-500/80 rounded-xl p-5 shadow-2xl relative overflow-hidden">
                <div 
                  className="absolute bottom-0 left-0 h-1 bg-rose-500 transition-all duration-100 ease-linear"
                  style={{ width: `${(countdown / 3) * 100}%` }}
                />
                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-lg bg-rose-500/20 text-rose-400 shrink-0">
                    <XCircle className="w-8 h-8" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs uppercase tracking-wider font-semibold text-rose-400">
                        Scan Unsuccessful
                      </span>
                      <span className="text-xs font-mono text-neutral-400 tabular-nums">
                        resuming in {countdown}s
                      </span>
                    </div>
                    <p className="text-base sm:text-lg font-semibold text-white mt-1">
                      {scanResult.message}
                    </p>
                    <p className="text-xs text-neutral-400 mt-1">
                      Please make sure you are scanning an authorized scholar QR code.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Camera Scanner Viewport */}
        <div className="w-full flex flex-col items-center">
          <div className="w-full aspect-square max-w-[380px] bg-neutral-950 rounded-2xl overflow-hidden relative border border-neutral-800 shadow-2xl flex flex-col items-center justify-center">
            {/* HTML5 QR Code Mount Node */}
            <div
              id="qr-reader-region"
              className="w-full h-full overflow-hidden [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
            />

            {/* Viewfinder Target Reticle Overlay */}
            {isScanning && !cameraPermissionError && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
                <div className="w-56 h-56 relative">
                  {/* Four corner markers */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-3 border-l-3 border-blue-500 rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-3 border-r-3 border-blue-500 rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-3 border-l-3 border-blue-500 rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-3 border-r-3 border-blue-500 rounded-br-lg" />

                  {/* Gentle pulsing scanning line */}
                  <div className="absolute inset-x-2 top-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-bounce opacity-70" />
                </div>
              </div>
            )}

            {/* Camera Permission / Error Fallback */}
            {cameraPermissionError && (
              <div className="absolute inset-0 bg-neutral-900/95 p-6 flex flex-col items-center justify-center text-center z-20">
                <AlertCircle className="w-10 h-10 text-amber-400 mb-2.5 shrink-0" />
                <h3 className="text-base font-semibold text-white mb-1.5">Camera Unavailable</h3>
                <p className="text-xs text-neutral-300 leading-relaxed mb-4 max-w-xs">
                  {cameraPermissionError}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={() => startScanner()}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors shadow"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry Camera
                  </button>
                  <button
                    onClick={handleSwitchCamera}
                    className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-neutral-700 transition-colors"
                  >
                    <Camera className="w-3.5 h-3.5 text-neutral-400" />
                    Switch Camera
                  </button>
                  <label className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-neutral-700 transition-colors cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Upload QR Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Scanner Controls: Camera switcher & Camera selection */}
          <div className="w-full max-w-[380px] mt-4 flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={handleSwitchCamera}
                className="flex-1 py-2.5 px-3 bg-neutral-800/90 hover:bg-neutral-700/90 text-neutral-200 hover:text-white rounded-xl text-xs font-medium flex items-center justify-center gap-2 border border-neutral-700/60 transition-all active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5 text-neutral-400" />
                <span>Switch ({facingMode === 'environment' ? 'Rear' : 'Front'})</span>
              </button>

              <label className="flex-1 py-2.5 px-3 bg-neutral-800/90 hover:bg-neutral-700/90 text-neutral-200 hover:text-white rounded-xl text-xs font-medium flex items-center justify-center gap-2 border border-neutral-700/60 transition-all cursor-pointer active:scale-95 text-center">
                <Upload className="w-3.5 h-3.5 text-neutral-400" />
                <span>Upload QR Image</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {availableCameras.length > 1 && (
              <div className="flex items-center gap-2 bg-neutral-800/60 border border-neutral-700/60 px-3 py-1.5 rounded-xl">
                <span className="text-[11px] text-neutral-400 whitespace-nowrap">Camera:</span>
                <select
                  value={selectedCameraId}
                  onChange={(e) => {
                    setSelectedCameraId(e.target.value);
                    startScanner(e.target.value);
                  }}
                  className="w-full bg-transparent text-xs text-neutral-200 outline-none cursor-pointer"
                >
                  <option value="" className="bg-neutral-900 text-white">Default / Auto</option>
                  {availableCameras.map((cam) => (
                    <option key={cam.id} value={cam.id} className="bg-neutral-900 text-white">
                      {cam.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Scan Instructions */}
          <p className="text-xs text-neutral-500 text-center mt-3 max-w-xs">
            Hold scholar QR code steady in front of camera. First scan records Time In; next scan records Time Out.
          </p>

          {/* Test / Manual Token Trigger (discreet utility for manual testing without physical camera) */}
          <div className="mt-4 pt-3 border-t border-neutral-800/80 w-full max-w-[380px] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setShowManualInput(!showManualInput)}
              className="text-[11px] text-neutral-500 hover:text-neutral-400 underline underline-offset-4 transition-colors"
            >
              {showManualInput ? 'Hide Manual Token Scanner' : 'Test with QR Token string'}
            </button>

            {showManualInput && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (manualToken.trim()) {
                    handleDecodedText(manualToken.trim());
                    setManualToken('');
                  }
                }}
                className="w-full mt-2 flex gap-2"
              >
                <input
                  type="text"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="Paste scholar qr_token (e.g. osc_...)"
                  className="flex-1 bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs px-3 py-2 rounded-lg font-mono focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={!manualToken.trim() || isProcessing}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold whitespace-nowrap"
                >
                  Scan
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Public Footer: Clean text only, strictly no admin mentions or links */}
      <footer className="w-full py-4 text-center text-[11px] text-neutral-600 border-t border-neutral-800/60">
        Office of Student Conduct & Scholarship Services
      </footer>
    </div>
  );
}
