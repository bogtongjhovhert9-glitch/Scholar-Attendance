import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { Scholar, AttendanceLog, AdminUser } from '../src/types/index.js';
import { getManilaDate, getManilaTime, calculateHours } from '../src/lib/manilaTime.js';

// Load Firebase configuration
const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export interface DatabaseSchema {
  admins: (AdminUser & { password_hash: string })[];
  scholars: Scholar[];
  attendance_logs: AttendanceLog[];
  login_attempts: Record<string, { count: number; lockedUntil: number }>;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const BACKUP_FILE = path.join(DATA_DIR, 'database.json');

// In-memory cache synced in real-time from Firestore
let db: DatabaseSchema = {
  admins: [],
  scholars: [],
  attendance_logs: [],
  login_attempts: {},
};

// In-memory tracker for duplicate scan block within 1 minute
const scholarLastScanTime: Map<string, number> = new Map();

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function saveLocalBackup() {
  try {
    ensureDataDir();
    const tempFile = `${BACKUP_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tempFile, BACKUP_FILE);
  } catch (err) {
    // silent backup error
  }
}

function deduplicateById<T extends { id: string }>(items: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    if (item && item.id) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

export function generateSecureToken(): string {
  return 'osc_' + crypto.randomBytes(16).toString('hex');
}

export async function initDatabase(): Promise<void> {
  console.log(`Initializing Centralized Cloud Database on Firestore (Project: ${firebaseConfig.projectId})...`);

  // 1. Subscribe to real-time changes from Firestore for Scholars
  const scholarsCol = collection(firestoreDb, 'scholars');
  onSnapshot(scholarsCol, (snapshot) => {
    const list: Scholar[] = [];
    snapshot.forEach((d) => {
      const data = d.data() as Scholar;
      list.push({ ...data, id: data.id || d.id });
    });
    db.scholars = deduplicateById(list);
    saveLocalBackup();
  });

  // 2. Subscribe to real-time changes from Firestore for Attendance Logs
  const attendanceCol = collection(firestoreDb, 'attendance_logs');
  onSnapshot(attendanceCol, (snapshot) => {
    const list: AttendanceLog[] = [];
    snapshot.forEach((d) => {
      const data = d.data() as AttendanceLog;
      list.push({ ...data, id: data.id || d.id });
    });
    db.attendance_logs = deduplicateById(list);
    saveLocalBackup();
  });

  // 3. Subscribe to real-time changes from Firestore for Admins
  const adminsCol = collection(firestoreDb, 'admins');
  onSnapshot(adminsCol, (snapshot) => {
    const list: (AdminUser & { password_hash: string })[] = [];
    snapshot.forEach((d) => {
      const data = d.data() as AdminUser & { password_hash: string };
      list.push({ ...data, id: data.id || d.id });
    });
    db.admins = deduplicateById(list);
    saveLocalBackup();
  });

  // Check if collections are empty in cloud database and seed initial data if needed
  try {
    const scholarsSnap = await getDocs(scholarsCol);
    const adminsSnap = await getDocs(adminsCol);

    // Seed default admin in cloud if none exists
    if (adminsSnap.empty) {
      console.log('Seeding initial administrator account to Cloud Firestore...');
      const defaultAdminSalt = bcrypt.genSaltSync(10);
      const defaultAdminHash = bcrypt.hashSync('admin12345', defaultAdminSalt);

      const defaultAdmin: AdminUser & { password_hash: string } = {
        id: 'admin_1',
        username: 'admin',
        password_hash: defaultAdminHash,
        role: 'superadmin',
        must_change_password: true,
        created_at: new Date().toISOString(),
      };

      await setDoc(doc(firestoreDb, 'admins', defaultAdmin.id), defaultAdmin);
      db.admins = [defaultAdmin];
    }

    // Seed initial scholars in cloud if none exists
    if (scholarsSnap.empty) {
      console.log('Seeding initial duty scholars roster to Cloud Firestore...');
      const sampleScholars: Scholar[] = [
        {
          id: 'sch_1',
          id_number: '2023-01429',
          full_name: 'Maria Clara Santos',
          course_program: 'BS Information Technology',
          year_level: '3rd Year',
          assigned_office: 'Office of Student Affairs',
          contact_number: '0917-555-0192',
          status: 'Active',
          qr_token: 'osc_' + crypto.randomBytes(16).toString('hex'),
          created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'sch_2',
          id_number: '2023-02105',
          full_name: 'Joshua Miguel Dela Cruz',
          course_program: 'BS Computer Science',
          year_level: '2nd Year',
          assigned_office: 'University Library',
          contact_number: '0928-555-0341',
          status: 'Active',
          qr_token: 'osc_' + crypto.randomBytes(16).toString('hex'),
          created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'sch_3',
          id_number: '2022-00891',
          full_name: 'Bea Angelica Reyes',
          course_program: 'BS Business Administration',
          year_level: '4th Year',
          assigned_office: 'Guidance & Counseling Office',
          contact_number: '0919-555-0812',
          status: 'Active',
          qr_token: 'osc_' + crypto.randomBytes(16).toString('hex'),
          created_at: new Date(Date.now() - 40 * 86400000).toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'sch_4',
          id_number: '2024-03410',
          full_name: 'Ethan Gabriel Bautista',
          course_program: 'BS Civil Engineering',
          year_level: '1st Year',
          assigned_office: "Registrar's Office",
          contact_number: '0939-555-0428',
          status: 'Active',
          qr_token: 'osc_' + crypto.randomBytes(16).toString('hex'),
          created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'sch_5',
          id_number: '2023-01874',
          full_name: 'Alyssa Nicole Mendoza',
          course_program: 'BS Accountancy',
          year_level: '3rd Year',
          assigned_office: 'Admissions Office',
          contact_number: '0915-555-0963',
          status: 'Active',
          qr_token: 'osc_' + crypto.randomBytes(16).toString('hex'),
          created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'sch_6',
          id_number: '2022-04512',
          full_name: 'Christian Dave Ramos',
          course_program: 'BS Hospitality Management',
          year_level: '4th Year',
          assigned_office: 'OSC Main Office',
          contact_number: '0927-555-0715',
          status: 'Active',
          qr_token: 'osc_' + crypto.randomBytes(16).toString('hex'),
          created_at: new Date(Date.now() - 35 * 86400000).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      for (const scholar of sampleScholars) {
        await setDoc(doc(firestoreDb, 'scholars', scholar.id), scholar);
      }
      db.scholars = sampleScholars;

      // Seed initial sample attendance logs
      const todayManila = getManilaDate();
      const sampleLogs: AttendanceLog[] = [
        {
          id: 'log_seed_1',
          scholar_id: sampleScholars[0].id,
          scholar_name: sampleScholars[0].full_name,
          scholar_id_number: sampleScholars[0].id_number,
          assigned_office: sampleScholars[0].assigned_office,
          date: todayManila,
          time_in: '08:00:00',
          time_out: '12:00:00',
          total_hours: 4.0,
          manually_edited: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'log_seed_2',
          scholar_id: sampleScholars[1].id,
          scholar_name: sampleScholars[1].full_name,
          scholar_id_number: sampleScholars[1].id_number,
          assigned_office: sampleScholars[1].assigned_office,
          date: todayManila,
          time_in: '08:30:00',
          time_out: null, // Currently on duty
          total_hours: null,
          manually_edited: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'log_seed_3',
          scholar_id: sampleScholars[2].id,
          scholar_name: sampleScholars[2].full_name,
          scholar_id_number: sampleScholars[2].id_number,
          assigned_office: sampleScholars[2].assigned_office,
          date: todayManila,
          time_in: '09:00:00',
          time_out: null, // Currently on duty
          total_hours: null,
          manually_edited: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      for (const log of sampleLogs) {
        await setDoc(doc(firestoreDb, 'attendance_logs', log.id), log);
      }
      db.attendance_logs = sampleLogs;
    }

    console.log('Centralized Firestore database fully initialized and synchronized.');
  } catch (err) {
    console.warn('Note on Firestore init:', err);
  }
}

export function getDatabase(): DatabaseSchema {
  return db;
}

export function findScholarByQrToken(token: string): Scholar | undefined {
  const clean = token.trim();
  return db.scholars.find((s) => s.qr_token === clean);
}

export function findScholarById(id: string): Scholar | undefined {
  return db.scholars.find((s) => s.id === id);
}

export function getAllScholars(): Scholar[] {
  return deduplicateById(db.scholars).sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export async function createScholar(data: Omit<Scholar, 'id' | 'qr_token' | 'created_at' | 'updated_at'>): Promise<Scholar> {
  const newScholar: Scholar = {
    id: 'sch_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    ...data,
    qr_token: generateSecureToken(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Write directly to centralized Cloud Firestore
  await setDoc(doc(firestoreDb, 'scholars', newScholar.id), newScholar);
  if (!db.scholars.some((s) => s.id === newScholar.id)) {
    db.scholars.push(newScholar);
  }
  saveLocalBackup();
  return newScholar;
}

export async function updateScholar(id: string, updates: Partial<Omit<Scholar, 'id' | 'qr_token' | 'created_at'>>): Promise<Scholar | null> {
  const index = db.scholars.findIndex((s) => s.id === id);
  if (index === -1) return null;
  const current = db.scholars[index];
  const updated: Scholar = {
    ...current,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  // Update in centralized Cloud Firestore
  await updateDoc(doc(firestoreDb, 'scholars', id), {
    ...updates,
    updated_at: updated.updated_at,
  });

  db.scholars[index] = updated;

  // Also update scholar name and id number in attendance logs if changed
  if (updates.full_name || updates.id_number || updates.assigned_office) {
    db.attendance_logs.forEach((log) => {
      if (log.scholar_id === id) {
        if (updates.full_name) log.scholar_name = updates.full_name;
        if (updates.id_number) log.scholar_id_number = updates.id_number;
        if (updates.assigned_office) log.assigned_office = updates.assigned_office;
        updateDoc(doc(firestoreDb, 'attendance_logs', log.id), {
          scholar_name: log.scholar_name,
          scholar_id_number: log.scholar_id_number,
          assigned_office: log.assigned_office,
        }).catch(() => {});
      }
    });
  }

  saveLocalBackup();
  return updated;
}

export async function regenerateScholarQrToken(id: string): Promise<Scholar | null> {
  const index = db.scholars.findIndex((s) => s.id === id);
  if (index === -1) return null;
  const newToken = generateSecureToken();
  const now = new Date().toISOString();

  // Update in centralized Cloud Firestore
  await updateDoc(doc(firestoreDb, 'scholars', id), {
    qr_token: newToken,
    updated_at: now,
  });

  db.scholars[index].qr_token = newToken;
  db.scholars[index].updated_at = now;
  saveLocalBackup();
  return db.scholars[index];
}

export async function deleteScholar(id: string): Promise<boolean> {
  const initialLen = db.scholars.length;
  // Delete from centralized Cloud Firestore
  await deleteDoc(doc(firestoreDb, 'scholars', id));
  db.scholars = db.scholars.filter((s) => s.id !== id);
  if (db.scholars.length !== initialLen) {
    saveLocalBackup();
    return true;
  }
  return false;
}

/**
 * Handle public QR code scan:
 * Writes directly to centralized Firestore so all other open devices and admin terminals
 * reflect the attendance entry immediately!
 */
export async function processScan(token: string): Promise<{
  success: boolean;
  type?: 'time_in' | 'time_out';
  message: string;
  scholar?: Scholar;
  timestamp?: string;
  total_hours?: number;
}> {
  if (!token || !token.trim()) {
    return { success: false, message: 'Invalid QR code' };
  }

  const scholar = findScholarByQrToken(token.trim());
  if (!scholar) {
    return { success: false, message: 'Scholar not found' };
  }

  if (scholar.status !== 'Active') {
    return { success: false, message: 'Scholar account is inactive' };
  }

  // Duplicate scan check: 1 minute (60,000 ms)
  const nowMs = Date.now();
  const lastScan = scholarLastScanTime.get(scholar.id);
  if (lastScan && nowMs - lastScan < 60000) {
    return { success: false, message: 'Already scanned, please wait' };
  }

  const today = getManilaDate();
  const currentTime = getManilaTime();

  // Find all logs for this scholar today
  const todayLogs = db.attendance_logs.filter(
    (log) => log.scholar_id === scholar.id && log.date === today
  );

  // Check if there is an active session (has time_in, time_out is null)
  const activeLog = todayLogs.find((log) => !log.time_out);

  if (activeLog) {
    // Next scan: Time Out
    const totalHours = calculateHours(activeLog.time_in, currentTime);
    activeLog.time_out = currentTime;
    activeLog.total_hours = totalHours;
    activeLog.updated_at = new Date().toISOString();
    scholarLastScanTime.set(scholar.id, nowMs);

    // Save to Cloud Firestore
    await updateDoc(doc(firestoreDb, 'attendance_logs', activeLog.id), {
      time_out: currentTime,
      total_hours: totalHours,
      updated_at: activeLog.updated_at,
    });

    saveLocalBackup();

    return {
      success: true,
      type: 'time_out',
      message: 'Time Out recorded',
      scholar,
      timestamp: currentTime,
      total_hours: totalHours,
    };
  } else {
    // First scan of the day: Time In
    const newLog: AttendanceLog = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      scholar_id: scholar.id,
      scholar_name: scholar.full_name,
      scholar_id_number: scholar.id_number,
      assigned_office: scholar.assigned_office,
      date: today,
      time_in: currentTime,
      time_out: null,
      total_hours: null,
      manually_edited: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Save to Cloud Firestore
    await setDoc(doc(firestoreDb, 'attendance_logs', newLog.id), newLog);
    if (!db.attendance_logs.some((l) => l.id === newLog.id)) {
      db.attendance_logs.unshift(newLog);
    }
    scholarLastScanTime.set(scholar.id, nowMs);
    saveLocalBackup();

    return {
      success: true,
      type: 'time_in',
      message: 'Time In recorded',
      scholar,
      timestamp: currentTime,
    };
  }
}

// Attendance CRUD for Admin
export function getAllAttendanceLogs(): AttendanceLog[] {
  return deduplicateById(db.attendance_logs).sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return (b.time_in || '').localeCompare(a.time_in || '');
  });
}

export async function createManualAttendance(data: {
  scholar_id: string;
  date: string;
  time_in: string;
  time_out?: string | null;
  notes?: string;
}): Promise<AttendanceLog | null> {
  const scholar = findScholarById(data.scholar_id);
  if (!scholar) return null;

  const totalHours = data.time_out ? calculateHours(data.time_in, data.time_out) : null;

  const newLog: AttendanceLog = {
    id: 'log_m_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    scholar_id: scholar.id,
    scholar_name: scholar.full_name,
    scholar_id_number: scholar.id_number,
    assigned_office: scholar.assigned_office,
    date: data.date,
    time_in: data.time_in,
    time_out: data.time_out || null,
    total_hours: totalHours,
    manually_edited: true,
    notes: data.notes,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Save to Cloud Firestore
  await setDoc(doc(firestoreDb, 'attendance_logs', newLog.id), newLog);
  if (!db.attendance_logs.some((l) => l.id === newLog.id)) {
    db.attendance_logs.unshift(newLog);
  }
  saveLocalBackup();
  return newLog;
}

export async function updateAttendanceLog(
  id: string,
  data: {
    date?: string;
    time_in?: string;
    time_out?: string | null;
    notes?: string;
  }
): Promise<AttendanceLog | null> {
  const log = db.attendance_logs.find((l) => l.id === id);
  if (!log) return null;

  if (data.date) log.date = data.date;
  if (data.time_in) log.time_in = data.time_in;
  if (data.time_out !== undefined) log.time_out = data.time_out;
  if (data.notes !== undefined) log.notes = data.notes;

  if (log.time_in && log.time_out) {
    log.total_hours = calculateHours(log.time_in, log.time_out);
  } else {
    log.total_hours = null;
  }

  log.manually_edited = true;
  log.updated_at = new Date().toISOString();

  // Update in Cloud Firestore
  await updateDoc(doc(firestoreDb, 'attendance_logs', id), {
    date: log.date,
    time_in: log.time_in,
    time_out: log.time_out,
    total_hours: log.total_hours,
    manually_edited: true,
    notes: log.notes || null,
    updated_at: log.updated_at,
  });

  saveLocalBackup();
  return log;
}

export async function deleteAttendanceLog(id: string): Promise<boolean> {
  const initialLen = db.attendance_logs.length;
  // Delete from Cloud Firestore
  await deleteDoc(doc(firestoreDb, 'attendance_logs', id));
  db.attendance_logs = db.attendance_logs.filter((l) => l.id !== id);
  if (db.attendance_logs.length !== initialLen) {
    saveLocalBackup();
    return true;
  }
  return false;
}

// Admin management
export function findAdminByUsername(username: string) {
  return db.admins.find((a) => a.username.toLowerCase() === username.toLowerCase());
}

export function findAdminById(id: string) {
  return db.admins.find((a) => a.id === id);
}

export function getAllAdmins(): AdminUser[] {
  return db.admins.map(({ password_hash, ...rest }) => rest);
}

export async function createAdmin(username: string, passwordPlain: string, role: 'admin' | 'superadmin' = 'admin'): Promise<AdminUser | null> {
  if (findAdminByUsername(username)) return null;
  const hash = bcrypt.hashSync(passwordPlain, 10);
  const newAdmin: AdminUser & { password_hash: string } = {
    id: 'admin_' + Date.now(),
    username: username.trim(),
    password_hash: hash,
    role,
    must_change_password: false,
    created_at: new Date().toISOString(),
  };

  // Save to Cloud Firestore
  await setDoc(doc(firestoreDb, 'admins', newAdmin.id), newAdmin);
  db.admins.push(newAdmin);
  saveLocalBackup();
  const { password_hash, ...rest } = newAdmin;
  return rest;
}

export async function deleteAdmin(id: string): Promise<boolean> {
  if (db.admins.length <= 1) return false;
  const initialLen = db.admins.length;
  await deleteDoc(doc(firestoreDb, 'admins', id));
  db.admins = db.admins.filter((a) => a.id !== id);
  if (db.admins.length !== initialLen) {
    saveLocalBackup();
    return true;
  }
  return false;
}

export async function updateAdminPassword(adminId: string, newPasswordPlain: string): Promise<boolean> {
  const admin = db.admins.find((a) => a.id === adminId);
  if (!admin) return false;
  const hash = bcrypt.hashSync(newPasswordPlain, 10);
  admin.password_hash = hash;
  admin.must_change_password = false;

  // Update in Cloud Firestore
  await updateDoc(doc(firestoreDb, 'admins', adminId), {
    password_hash: hash,
    must_change_password: false,
  });

  saveLocalBackup();
  return true;
}

// Rate Limiter tracking
export function checkLoginLockout(key: string): { locked: boolean; waitMinutes?: number } {
  const record = db.login_attempts[key];
  if (!record) return { locked: false };
  if (record.lockedUntil > Date.now()) {
    const waitMs = record.lockedUntil - Date.now();
    return { locked: true, waitMinutes: Math.ceil(waitMs / 60000) };
  }
  return { locked: false };
}

export function recordFailedLogin(key: string): { locked: boolean; remainingAttempts: number; waitMinutes?: number } {
  const now = Date.now();
  const record = db.login_attempts[key] || { count: 0, lockedUntil: 0 };
  
  if (record.lockedUntil > now) {
    const waitMs = record.lockedUntil - now;
    return { locked: true, remainingAttempts: 0, waitMinutes: Math.ceil(waitMs / 60000) };
  }

  record.count += 1;
  if (record.count >= 5) {
    record.lockedUntil = now + 15 * 60 * 1000;
    record.count = 0;
    db.login_attempts[key] = record;
    saveLocalBackup();
    return { locked: true, remainingAttempts: 0, waitMinutes: 15 };
  } else {
    db.login_attempts[key] = record;
    saveLocalBackup();
    return { locked: false, remainingAttempts: 5 - record.count };
  }
}

export function resetLoginAttempts(key: string) {
  if (db.login_attempts[key]) {
    delete db.login_attempts[key];
    saveLocalBackup();
  }
}
