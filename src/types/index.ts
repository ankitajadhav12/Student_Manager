import type { Timestamp } from "firebase/firestore";

export type AppRoute =
  | "dashboard"
  | "tasks"
  | "study-planner"
  | "timetable"
  | "assignments"
  | "notes"
  | "exams"
  | "events"
  | "analytics"
  | "ai-assistant"
  | "profile"
  | "settings";

export type PriorityLevel = "Low" | "Medium" | "High";
export type TaskCategory = "Academic" | "Personal" | "Projects" | "College Activities" | "Other";
export type DayOfWeek = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday";
export type ExamType = "Mid-Term" | "Final" | "Quiz" | "Practical" | "Viva" | "Other";
export type PrepStatus = "Not Started" | "In Progress" | "Revising" | "Ready";
export type EventCategory = "College Event" | "Personal" | "Deadline" | "Study Group" | "Other";
export type ThemePreference = "light" | "dark" | "system";

export interface NotificationPrefs {
  assignments24h: boolean;
  examReminders: boolean;
  studyTargetAlerts: boolean;
  eventReminders: boolean;
  browserPushEnabled: boolean;
}

export interface UserProfile {
  userId: string;
  fullName: string;
  email: string;
  college: string;
  degree: string;
  branch: string;
  semester: string;
  academicYear: string;
  profileImage: string;
  themePreference: ThemePreference;
  notificationPrefs: NotificationPrefs;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Subject {
  id: string;
  userId: string;
  name: string;
  code: string;
  color: string;
  dailyTargetMinutes: number;
  weeklyTargetMinutes: number;
  totalTopics: number;
  completedTopics: number;
  completedTopicNames: string[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: TaskCategory;
  priority: PriorityLevel;
  dueDate: string;
  completed: boolean;
  subjectId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Assignment {
  id: string;
  userId: string;
  subjectId: string;
  subjectName: string;
  title: string;
  description: string;
  deadline: string;
  priority: PriorityLevel;
  status: "pending" | "submitted";
  submittedAt: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface TimetableEntry {
  id: string;
  userId: string;
  day: DayOfWeek;
  entryType: "lecture" | "break";
  subjectName: string;
  facultyName: string;
  classroom: string;
  startTime: string;
  endTime: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface StudySession {
  id: string;
  userId: string;
  subjectId: string;
  subjectName: string;
  topic: string;
  date: string;
  durationMinutes: number;
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Note {
  id: string;
  userId: string;
  subjectId: string;
  subjectName: string;
  title: string;
  content: string;
  pinned: boolean;
  archived: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Examination {
  id: string;
  userId: string;
  subjectId: string;
  subjectName: string;
  examType: ExamType;
  examDate: string;
  examTime: string;
  venue: string;
  syllabus: string;
  prepStatus: PrepStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  category: EventCategory;
  date: string;
  time: string;
  description: string;
  reminderEnabled: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "assignment" | "exam" | "event" | "study";
  read: boolean;
  sourceId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export const FIELD_LIMITS = {
  fullName: 100,
  email: 150,
  college: 150,
  degree: 100,
  branch: 100,
  semester: 30,
  academicYear: 30,
  profileImage: 250000,
  subjectName: 100,
  subjectCode: 24,
  title: 160,
  description: 2000,
  noteContent: 100000,
  syllabus: 5000,
  facultyName: 100,
  classroom: 50,
  venue: 100,
  studyNotes: 1000,
} as const;

export const SUBJECT_COLORS = [
  { id: "indigo", label: "Indigo", hex: "#4F46E5" },
  { id: "violet", label: "Violet", hex: "#7C3AED" },
  { id: "cyan", label: "Cyan", hex: "#0891B2" },
  { id: "emerald", label: "Emerald", hex: "#059669" },
  { id: "amber", label: "Amber", hex: "#D97706" },
  { id: "rose", label: "Rose", hex: "#E11D48" },
] as const;

export const DAYS_OF_WEEK: DayOfWeek[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
