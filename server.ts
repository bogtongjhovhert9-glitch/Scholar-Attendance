import express, { Request, Response } from 'express';
import path from 'path';
import QRCode from 'qrcode';
import bcrypt from 'bcryptjs';
import {
  initDatabase,
  getDatabase,
  processScan,
  getAllScholars,
  createScholar,
  updateScholar,
  deleteScholar,
  regenerateScholarQrToken,
  findScholarById,
  getAllAttendanceLogs,
  createManualAttendance,
  updateAttendanceLog,
  deleteAttendanceLog,
  getAllAdmins,
  createAdmin,
  deleteAdmin,
  updateAdminPassword,
  findAdminById,
} from './server/db.js';
import { handleLogin, requireAuth, AuthenticatedRequest } from './server/auth.js';
import { getManilaDate, calculateHours } from './src/lib/manilaTime.js';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Initialize database with initial seeds
await initDatabase();

// --- PUBLIC SCANNER ENDPOINT ---
app.post('/api/scan', async (req: Request, res: Response) => {
  const { qr_token } = req.body;
  if (!qr_token || typeof qr_token !== 'string') {
    res.status(400).json({ success: false, message: 'Invalid QR code' });
    return;
  }

  const result = await processScan(qr_token);
  if (!result.success) {
    res.status(200).json({
      success: false,
      message: result.message,
    });
    return;
  }

  res.status(200).json({
    success: true,
    type: result.type,
    message: result.message,
    scholar_name: result.scholar?.full_name,
    id_number: result.scholar?.id_number,
    assigned_office: result.scholar?.assigned_office,
    timestamp: result.timestamp,
    total_hours: result.total_hours,
    date: getManilaDate(),
  });
});

// --- QR CODE GENERATION IMAGE ENDPOINT ---
app.get('/api/qr-image/:token', async (req: Request, res: Response) => {
  const { token } = req.params;
  if (!token) {
    res.status(400).send('Missing token');
    return;
  }
  try {
    const pngBuffer = await QRCode.toBuffer(token, {
      type: 'png',
      width: 400,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(pngBuffer);
  } catch (err) {
    res.status(500).send('Failed to generate QR code');
  }
});

// --- AUTHENTICATION ENDPOINTS ---
app.post('/api/auth/login', handleLogin);

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const admin = findAdminById(req.adminUser!.id);
  if (!admin) {
    res.status(404).json({ error: 'Admin not found' });
    return;
  }
  res.json({
    id: admin.id,
    username: admin.username,
    role: admin.role,
    must_change_password: admin.must_change_password,
  });
});

app.post('/api/auth/change-password', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Current and new password are required' });
    return;
  }

  if (newPassword.length < 6) {
    res.status(400).json({ error: 'New password must be at least 6 characters long' });
    return;
  }

  const admin = findAdminById(req.adminUser!.id);
  if (!admin) {
    res.status(404).json({ error: 'Admin not found' });
    return;
  }

  const isMatch = bcrypt.compareSync(currentPassword, admin.password_hash);
  if (!isMatch) {
    res.status(400).json({ error: 'Incorrect current password' });
    return;
  }

  await updateAdminPassword(admin.id, newPassword);
  res.json({ success: true, message: 'Password updated successfully' });
});

app.post('/api/auth/logout', (_req: Request, res: Response) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

// --- ADMIN DASHBOARD ---
app.get('/api/admin/dashboard', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const today = getManilaDate();

  const todayLogs = db.attendance_logs.filter((log) => log.date === today);
  const presentScholarIds = new Set(todayLogs.map((l) => l.scholar_id));
  const currentlyOnDuty = todayLogs.filter((l) => !l.time_out);
  const totalHoursToday = todayLogs.reduce((acc, l) => acc + (l.total_hours || 0), 0);

  res.json({
    today_present_count: presentScholarIds.size,
    currently_on_duty_count: currentlyOnDuty.length,
    total_scholars_count: db.scholars.length,
    active_scholars_count: db.scholars.filter((s) => s.status === 'Active').length,
    today_total_hours: Math.round(totalHoursToday * 100) / 100,
    today_scans: todayLogs,
  });
});

// --- ADMIN SCHOLARS CRUD ---
app.get('/api/admin/scholars', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  res.json(getAllScholars());
});

app.post('/api/admin/scholars', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { full_name, id_number, course_program, year_level, assigned_office, contact_number, status } = req.body;

  if (!full_name || !id_number || !assigned_office) {
    res.status(400).json({ error: 'Full name, ID number, and assigned office are required' });
    return;
  }

  // Check unique ID number
  const existing = getAllScholars().find(
    (s) => s.id_number.trim().toLowerCase() === id_number.trim().toLowerCase()
  );
  if (existing) {
    res.status(400).json({ error: 'A scholar with this ID number already exists' });
    return;
  }

  const created = await createScholar({
    full_name: full_name.trim(),
    id_number: id_number.trim(),
    course_program: course_program ? course_program.trim() : 'N/A',
    year_level: year_level ? year_level.trim() : 'N/A',
    assigned_office: assigned_office.trim(),
    contact_number: contact_number ? contact_number.trim() : '',
    status: status === 'Inactive' ? 'Inactive' : 'Active',
  });

  res.status(201).json(created);
});

app.put('/api/admin/scholars/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const updates = req.body;

  const updated = await updateScholar(id, updates);
  if (!updated) {
    res.status(404).json({ error: 'Scholar not found' });
    return;
  }

  res.json(updated);
});

app.post('/api/admin/scholars/:id/regenerate-qr', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const updated = await regenerateScholarQrToken(id);
  if (!updated) {
    res.status(404).json({ error: 'Scholar not found' });
    return;
  }
  res.json({ success: true, qr_token: updated.qr_token, scholar: updated });
});

app.delete('/api/admin/scholars/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const deleted = await deleteScholar(id);
  if (!deleted) {
    res.status(404).json({ error: 'Scholar not found' });
    return;
  }
  res.json({ success: true, message: 'Scholar deleted' });
});

// --- ADMIN ATTENDANCE CRUD & FILTERS ---
app.get('/api/admin/attendance', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { startDate, endDate, scholarId, office, search } = req.query;
  let logs = getAllAttendanceLogs();

  if (startDate && typeof startDate === 'string') {
    logs = logs.filter((l) => l.date >= startDate);
  }
  if (endDate && typeof endDate === 'string') {
    logs = logs.filter((l) => l.date <= endDate);
  }
  if (scholarId && typeof scholarId === 'string' && scholarId !== 'all') {
    logs = logs.filter((l) => l.scholar_id === scholarId);
  }
  if (office && typeof office === 'string' && office !== 'all') {
    logs = logs.filter((l) => l.assigned_office.toLowerCase() === office.toLowerCase());
  }
  if (search && typeof search === 'string' && search.trim()) {
    const q = search.trim().toLowerCase();
    logs = logs.filter(
      (l) =>
        l.scholar_name.toLowerCase().includes(q) ||
        l.scholar_id_number.toLowerCase().includes(q) ||
        l.assigned_office.toLowerCase().includes(q) ||
        (l.notes && l.notes.toLowerCase().includes(q))
    );
  }

  res.json(logs);
});

app.post('/api/admin/attendance', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { scholar_id, date, time_in, time_out, notes } = req.body;
  if (!scholar_id || !date || !time_in) {
    res.status(400).json({ error: 'Scholar ID, date, and Time In are required' });
    return;
  }

  const newLog = await createManualAttendance({
    scholar_id,
    date,
    time_in,
    time_out,
    notes,
  });

  if (!newLog) {
    res.status(404).json({ error: 'Scholar not found' });
    return;
  }

  res.status(201).json(newLog);
});

app.put('/api/admin/attendance/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { date, time_in, time_out, notes } = req.body;

  const updated = await updateAttendanceLog(id, { date, time_in, time_out, notes });
  if (!updated) {
    res.status(404).json({ error: 'Attendance record not found' });
    return;
  }

  res.json(updated);
});

app.delete('/api/admin/attendance/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const deleted = await deleteAttendanceLog(id);
  if (!deleted) {
    res.status(404).json({ error: 'Attendance record not found' });
    return;
  }
  res.json({ success: true, message: 'Record deleted' });
});

// --- ADMIN REPORTS (HOURS PER SCHOLAR) ---
app.get('/api/admin/reports', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { startDate, endDate, office } = req.query;
  const db = getDatabase();
  let logs = db.attendance_logs;

  if (startDate && typeof startDate === 'string') {
    logs = logs.filter((l) => l.date >= startDate);
  }
  if (endDate && typeof endDate === 'string') {
    logs = logs.filter((l) => l.date <= endDate);
  }

  let scholars = db.scholars;
  if (office && typeof office === 'string' && office !== 'all') {
    scholars = scholars.filter((s) => s.assigned_office.toLowerCase() === office.toLowerCase());
  }

  const summary = scholars.map((s) => {
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

  res.json(summary);
});

// --- ADMIN ACCOUNT SETTINGS ---
app.get('/api/admin/admins', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  res.json(getAllAdmins());
});

app.post('/api/admin/admins', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { username, password, role } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }

  const created = await createAdmin(username, password, role || 'admin');
  if (!created) {
    res.status(400).json({ error: 'Admin username already taken' });
    return;
  }
  res.status(201).json(created);
});

app.delete('/api/admin/admins/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  if (req.adminUser?.id === id) {
    res.status(400).json({ error: 'You cannot delete your own account' });
    return;
  }

  const success = await deleteAdmin(id);
  if (!success) {
    res.status(400).json({ error: 'Cannot delete the only remaining admin' });
    return;
  }
  res.json({ success: true });
});

// --- VITE MIDDLEWARE (DEV) & STATIC SERVING (PROD) ---
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OSC Duty Scholars Attendance System server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
