export interface Employee {
  id: number;
  name: string;
  color: string;
  department: string;
  access_token: string;
  created_at: string;
}

export const DEPARTMENTS = ['Gestion Clientèle', 'Gestion Riad'] as const;
export type Department = (typeof DEPARTMENTS)[number];

export interface ScheduleTemplate {
  id: number;
  employee_id: number;
  day_of_week: number; // 0=Lundi ... 6=Dimanche
  start_time: string | null;
  end_time: string | null;
  start_time2: string | null;
  end_time2: string | null;
}

export interface ScheduleException {
  id: number;
  employee_id: number;
  date: string; // YYYY-MM-DD
  start_time: string | null;
  end_time: string | null;
  start_time2: string | null;
  end_time2: string | null;
  note: string | null;
}

export type LeaveType = 'cp' | 'cm';

export interface DaySchedule {
  start_time: string | null;
  end_time: string | null;
  start_time2: string | null;
  end_time2: string | null;
  is_off: boolean;
  is_exception: boolean;
  is_leave: boolean;          // true for CP or CM
  leave_type: LeaveType | null;
  note?: string | null;
  hours: number;
}

export interface PaidLeave {
  id: number;
  employee_id: number;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  leave_type: LeaveType;
  note: string | null;
  created_at: string;
}

export interface EmployeeWeek {
  employee: Employee;
  days: Record<string, DaySchedule>;
  totalHours: number;
}

export interface MonthStats {
  employee: Employee;
  totalHours: number;
  weeklyBreakdown: Record<string, number>;
}

export const EMPLOYEE_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#14B8A6', '#3B82F6', '#8B5CF6', '#EC4899',
  '#06B6D4', '#84CC16',
];

export const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
export const DAYS_FULL_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
