export interface Scholar {
  id: string;
  id_number: string; // e.g. "2024-00123"
  full_name: string;
  course_program: string;
  year_level: string;
  assigned_office: string;
  contact_number: string;
  status: 'Active' | 'Inactive';
  qr_token: string;
  created_at: string;
  updated_at: string;
}

export interface AttendanceLog {
  id: string;
  scholar_id: string;
  scholar_name: string;
  scholar_id_number: string;
  assigned_office: string;
  date: string; // YYYY-MM-DD (Asia/Manila)
  time_in: string; // HH:mm:ss or display string
  time_out: string | null;
  total_hours: number | null;
  manually_edited: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AdminUser {
  id: string;
  username: string;
  role: 'superadmin' | 'admin';
  must_change_password: boolean;
  created_at: string;
  last_login?: string;
}

export interface ScanResponse {
  success: boolean;
  type?: 'time_in' | 'time_out';
  message: string;
  scholar_name?: string;
  id_number?: string;
  assigned_office?: string;
  timestamp?: string;
  total_hours?: number;
  date?: string;
}

export interface DashboardStats {
  today_present_count: number;
  currently_on_duty_count: number;
  total_scholars_count: number;
  active_scholars_count: number;
  today_total_hours: number;
  today_scans: AttendanceLog[];
}

export interface ScholarReportSummary {
  scholar_id: string;
  scholar_name: string;
  id_number: string;
  assigned_office: string;
  course_program: string;
  year_level: string;
  status: 'Active' | 'Inactive';
  total_days_attended: number;
  total_hours_rendered: number;
  average_hours_per_day: number;
}
