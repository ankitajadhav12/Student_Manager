import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { subscribeUserCollection } from "../services/firestoreService";
import type {
  Assignment,
  CalendarEvent,
  Examination,
  Note,
  NotificationItem,
  StudySession,
  Subject,
  Task,
  TimetableEntry,
} from "../types";
import { getDaysRemaining, getHoursUntilDeadline } from "../utils/dateUtils";

export interface DerivedAlert {
  id: string;
  title: string;
  message: string;
  type: "assignment" | "exam" | "event";
  urgent: boolean;
}

interface DataContextValue {
  subjects: Subject[];
  tasks: Task[];
  assignments: Assignment[];
  timetable: TimetableEntry[];
  studySessions: StudySession[];
  notes: Note[];
  examinations: Examination[];
  events: CalendarEvent[];
  notifications: NotificationItem[];
  derivedAlerts: DerivedAlert[];
  loading: boolean;
  dataError: string | null;
}

const DataContext = createContext<DataContextValue | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, profile, authReady } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [examinations, setExaminations] = useState<Examination[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingCount, setLoadingCount] = useState(0);
  const [dataError, setDataError] = useState<string | null>(null);

  const canSync = Boolean(authReady && user && user.emailVerified && profile);

  useEffect(() => {
    if (!canSync || !user) {
      setSubjects([]);
      setTasks([]);
      setAssignments([]);
      setTimetable([]);
      setStudySessions([]);
      setNotes([]);
      setExaminations([]);
      setEvents([]);
      setNotifications([]);
      setLoadingCount(0);
      setDataError(null);
      return;
    }

    setLoadingCount(9);
    const loadedFlags = new Set<string>();
    const markLoaded = (name: string) => {
      if (!loadedFlags.has(name)) {
        loadedFlags.add(name);
        setLoadingCount(9 - loadedFlags.size);
      }
    };
    const onErr = (err: Error) => {
      setDataError(err.message);
    };

    const unsubs = [
      subscribeUserCollection<Subject>(
        "subjects",
        user.uid,
        (items) => {
          setSubjects(items);
          markLoaded("subjects");
        },
        onErr
      ),
      subscribeUserCollection<Task>(
        "tasks",
        user.uid,
        (items) => {
          setTasks(items);
          markLoaded("tasks");
        },
        onErr
      ),
      subscribeUserCollection<Assignment>(
        "assignments",
        user.uid,
        (items) => {
          setAssignments(items);
          markLoaded("assignments");
        },
        onErr
      ),
      subscribeUserCollection<TimetableEntry>(
        "timetable",
        user.uid,
        (items) => {
          setTimetable(items);
          markLoaded("timetable");
        },
        onErr
      ),
      subscribeUserCollection<StudySession>(
        "study_sessions",
        user.uid,
        (items) => {
          setStudySessions(items);
          markLoaded("study_sessions");
        },
        onErr
      ),
      subscribeUserCollection<Note>(
        "notes",
        user.uid,
        (items) => {
          setNotes(items);
          markLoaded("notes");
        },
        onErr
      ),
      subscribeUserCollection<Examination>(
        "examinations",
        user.uid,
        (items) => {
          setExaminations(items);
          markLoaded("examinations");
        },
        onErr
      ),
      subscribeUserCollection<CalendarEvent>(
        "events",
        user.uid,
        (items) => {
          setEvents(items);
          markLoaded("events");
        },
        onErr
      ),
      subscribeUserCollection<NotificationItem>(
        "notifications",
        user.uid,
        (items) => {
          setNotifications(items);
          markLoaded("notifications");
        },
        onErr
      ),
    ];

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [canSync, user]);

  const derivedAlerts = useMemo<DerivedAlert[]>(() => {
    const alerts: DerivedAlert[] = [];
    const prefs = profile?.notificationPrefs;

    if (!prefs || prefs.assignments24h) {
      assignments
        .filter((a) => a.status === "pending")
        .forEach((a) => {
          const hrs = getHoursUntilDeadline(a.deadline);
          if (hrs <= 24 && hrs > -72) {
            alerts.push({
              id: `assign_${a.id}`,
              title: hrs < 0 ? `Overdue: ${a.title}` : `Due within 24h: ${a.title}`,
              message: `${a.subjectName} assignment ${hrs < 0 ? "was due" : `due in ${Math.max(1, Math.round(hrs))}h`}`,
              type: "assignment",
              urgent: true,
            });
          }
        });
    }

    if (!prefs || prefs.examReminders) {
      examinations.forEach((ex) => {
        const days = getDaysRemaining(ex.examDate);
        if (days >= 0 && days <= 7) {
          alerts.push({
            id: `exam_${ex.id}`,
            title: `${ex.subjectName} ${ex.examType}`,
            message:
              days === 0
                ? `Scheduled today at ${ex.examTime}`
                : `In ${days} day${days === 1 ? "" : "s"} (${ex.examDate})`,
            type: "exam",
            urgent: days <= 2,
          });
        }
      });
    }

    if (!prefs || prefs.eventReminders) {
      events
        .filter((ev) => ev.reminderEnabled)
        .forEach((ev) => {
          const days = getDaysRemaining(ev.date);
          if (days >= 0 && days <= 2) {
            alerts.push({
              id: `event_${ev.id}`,
              title: ev.title,
              message: days === 0 ? `Today ${ev.time ? `at ${ev.time}` : ""}` : `In ${days} day(s)`,
              type: "event",
              urgent: days === 0,
            });
          }
        });
    }

    return alerts;
  }, [assignments, examinations, events, profile]);

  return (
    <DataContext.Provider
      value={{
        subjects,
        tasks,
        assignments,
        timetable,
        studySessions,
        notes,
        examinations,
        events,
        notifications,
        derivedAlerts,
        loading: canSync && loadingCount > 0,
        dataError,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
