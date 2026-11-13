import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "./firebase";
import {
  FIELD_LIMITS,
  type Assignment,
  type CalendarEvent,
  type Examination,
  type Note,
  type NotificationItem,
  type NotificationPrefs,
  type PriorityLevel,
  type StudySession,
  type Subject,
  type Task,
  type ThemePreference,
  type TimetableEntry,
  type UserProfile,
} from "../types";

const clampStr = (val: string | undefined | null, max: number) =>
  (val ?? "").trim().slice(0, max);

const clampNum = (val: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(val) ? Math.round(val) : min));

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  assignments24h: true,
  examReminders: true,
  studyTargetAlerts: true,
  eventReminders: true,
  browserPushEnabled: false,
};

// --- Generic user-scoped subscription ---
export function subscribeUserCollection<T>(
  collectionName: string,
  userId: string,
  onData: (items: T[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db, collectionName), where("userId", "==", userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, collectionName);
      } catch (wrapped) {
        if (onError) onError(wrapped as Error);
      }
    }
  );
}

export function subscribeUserProfile(
  userId: string,
  onData: (profile: UserProfile | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const ref = doc(db, "users", userId);
  return onSnapshot(
    ref,
    (snap) => {
      onData(snap.exists() ? (snap.data() as UserProfile) : null);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, `users/${userId}`);
      } catch (wrapped) {
        if (onError) onError(wrapped as Error);
      }
    }
  );
}

// --- User Profile ---
export async function createUserProfile(
  profile: Omit<UserProfile, "createdAt" | "updatedAt">
): Promise<void> {
  const path = `users/${profile.userId}`;
  try {
    await setDoc(doc(db, "users", profile.userId), {
      userId: profile.userId,
      fullName: clampStr(profile.fullName, FIELD_LIMITS.fullName) || "Student",
      email: clampStr(profile.email, FIELD_LIMITS.email),
      college: clampStr(profile.college, FIELD_LIMITS.college),
      degree: clampStr(profile.degree, FIELD_LIMITS.degree),
      branch: clampStr(profile.branch, FIELD_LIMITS.branch),
      semester: clampStr(profile.semester, FIELD_LIMITS.semester),
      academicYear: clampStr(profile.academicYear, FIELD_LIMITS.academicYear),
      profileImage: (profile.profileImage || "").slice(0, FIELD_LIMITS.profileImage),
      themePreference: profile.themePreference || "light",
      notificationPrefs: profile.notificationPrefs || DEFAULT_NOTIFICATION_PREFS,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateUserProfileDetails(
  userId: string,
  updates: Pick<
    UserProfile,
    "fullName" | "college" | "degree" | "branch" | "semester" | "academicYear" | "profileImage"
  >
): Promise<void> {
  const path = `users/${userId}`;
  try {
    await updateDoc(doc(db, "users", userId), {
      fullName: clampStr(updates.fullName, FIELD_LIMITS.fullName) || "Student",
      college: clampStr(updates.college, FIELD_LIMITS.college),
      degree: clampStr(updates.degree, FIELD_LIMITS.degree),
      branch: clampStr(updates.branch, FIELD_LIMITS.branch),
      semester: clampStr(updates.semester, FIELD_LIMITS.semester),
      academicYear: clampStr(updates.academicYear, FIELD_LIMITS.academicYear),
      profileImage: (updates.profileImage || "").slice(0, FIELD_LIMITS.profileImage),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateUserPreferences(
  userId: string,
  themePreference: ThemePreference,
  notificationPrefs: NotificationPrefs
): Promise<void> {
  const path = `users/${userId}`;
  try {
    await updateDoc(doc(db, "users", userId), {
      themePreference,
      notificationPrefs,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// --- Subjects ---
export async function createSubject(
  userId: string,
  data: Omit<Subject, "id" | "userId" | "completedTopics" | "completedTopicNames" | "createdAt" | "updatedAt">
): Promise<string> {
  const id = createId();
  const path = `subjects/${id}`;
  try {
    await setDoc(doc(db, "subjects", id), {
      userId,
      name: clampStr(data.name, FIELD_LIMITS.subjectName),
      code: clampStr(data.code, FIELD_LIMITS.subjectCode),
      color: clampStr(data.color, 30) || "#4F46E5",
      dailyTargetMinutes: clampNum(data.dailyTargetMinutes, 0, 720),
      weeklyTargetMinutes: clampNum(data.weeklyTargetMinutes, 0, 5040),
      totalTopics: clampNum(data.totalTopics, 0, 500),
      completedTopics: 0,
      completedTopicNames: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateSubject(
  subjectId: string,
  data: Pick<Subject, "name" | "code" | "color" | "dailyTargetMinutes" | "weeklyTargetMinutes" | "totalTopics">
): Promise<void> {
  const path = `subjects/${subjectId}`;
  try {
    await updateDoc(doc(db, "subjects", subjectId), {
      name: clampStr(data.name, FIELD_LIMITS.subjectName),
      code: clampStr(data.code, FIELD_LIMITS.subjectCode),
      color: clampStr(data.color, 30) || "#4F46E5",
      dailyTargetMinutes: clampNum(data.dailyTargetMinutes, 0, 720),
      weeklyTargetMinutes: clampNum(data.weeklyTargetMinutes, 0, 5040),
      totalTopics: clampNum(data.totalTopics, 0, 500),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateSubjectTopics(
  subjectId: string,
  completedTopicNames: string[],
  completedTopics: number
): Promise<void> {
  const path = `subjects/${subjectId}`;
  const safeNames = completedTopicNames
    .map((t) => clampStr(t, 160))
    .filter(Boolean)
    .slice(0, 100);
  try {
    await updateDoc(doc(db, "subjects", subjectId), {
      completedTopics: clampNum(completedTopics, 0, 500),
      completedTopicNames: safeNames,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteSubject(subjectId: string): Promise<void> {
  const path = `subjects/${subjectId}`;
  try {
    await deleteDoc(doc(db, "subjects", subjectId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Tasks ---
export async function createTask(
  userId: string,
  data: Omit<Task, "id" | "userId" | "createdAt" | "updatedAt">
): Promise<string> {
  const id = createId();
  const path = `tasks/${id}`;
  try {
    await setDoc(doc(db, "tasks", id), {
      userId,
      title: clampStr(data.title, FIELD_LIMITS.title),
      description: clampStr(data.description, FIELD_LIMITS.description),
      category: data.category,
      priority: data.priority,
      dueDate: clampStr(data.dueDate, 20),
      completed: Boolean(data.completed),
      subjectId: clampStr(data.subjectId, 128),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateTask(
  taskId: string,
  data: Omit<Task, "id" | "userId" | "createdAt" | "updatedAt">
): Promise<void> {
  const path = `tasks/${taskId}`;
  try {
    await updateDoc(doc(db, "tasks", taskId), {
      title: clampStr(data.title, FIELD_LIMITS.title),
      description: clampStr(data.description, FIELD_LIMITS.description),
      category: data.category,
      priority: data.priority,
      dueDate: clampStr(data.dueDate, 20),
      completed: Boolean(data.completed),
      subjectId: clampStr(data.subjectId, 128),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function toggleTaskComplete(taskId: string, completed: boolean): Promise<void> {
  const path = `tasks/${taskId}`;
  try {
    await updateDoc(doc(db, "tasks", taskId), {
      completed,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateTaskPriority(taskId: string, priority: PriorityLevel): Promise<void> {
  const path = `tasks/${taskId}`;
  try {
    await updateDoc(doc(db, "tasks", taskId), {
      priority,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteTask(taskId: string): Promise<void> {
  const path = `tasks/${taskId}`;
  try {
    await deleteDoc(doc(db, "tasks", taskId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Assignments ---
export async function createAssignment(
  userId: string,
  data: Omit<Assignment, "id" | "userId" | "createdAt" | "updatedAt">
): Promise<string> {
  const id = createId();
  const path = `assignments/${id}`;
  try {
    await setDoc(doc(db, "assignments", id), {
      userId,
      subjectId: clampStr(data.subjectId, 128),
      subjectName: clampStr(data.subjectName, FIELD_LIMITS.subjectName) || "General",
      title: clampStr(data.title, FIELD_LIMITS.title),
      description: clampStr(data.description, FIELD_LIMITS.description),
      deadline: clampStr(data.deadline, 40),
      priority: data.priority,
      status: data.status,
      submittedAt: clampStr(data.submittedAt, 40),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateAssignment(
  assignmentId: string,
  data: Omit<Assignment, "id" | "userId" | "createdAt" | "updatedAt">
): Promise<void> {
  const path = `assignments/${assignmentId}`;
  try {
    await updateDoc(doc(db, "assignments", assignmentId), {
      subjectId: clampStr(data.subjectId, 128),
      subjectName: clampStr(data.subjectName, FIELD_LIMITS.subjectName) || "General",
      title: clampStr(data.title, FIELD_LIMITS.title),
      description: clampStr(data.description, FIELD_LIMITS.description),
      deadline: clampStr(data.deadline, 40),
      priority: data.priority,
      status: data.status,
      submittedAt: clampStr(data.submittedAt, 40),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function toggleAssignmentStatus(
  assignmentId: string,
  status: "pending" | "submitted"
): Promise<void> {
  const path = `assignments/${assignmentId}`;
  try {
    await updateDoc(doc(db, "assignments", assignmentId), {
      status,
      submittedAt: status === "submitted" ? new Date().toISOString() : "",
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteAssignment(assignmentId: string): Promise<void> {
  const path = `assignments/${assignmentId}`;
  try {
    await deleteDoc(doc(db, "assignments", assignmentId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Timetable ---
export async function createTimetableEntry(
  userId: string,
  data: Omit<TimetableEntry, "id" | "userId" | "createdAt" | "updatedAt">
): Promise<string> {
  const id = createId();
  const path = `timetable/${id}`;
  try {
    await setDoc(doc(db, "timetable", id), {
      userId,
      day: data.day,
      entryType: data.entryType,
      subjectName: clampStr(data.subjectName, FIELD_LIMITS.subjectName),
      facultyName: clampStr(data.facultyName, FIELD_LIMITS.facultyName),
      classroom: clampStr(data.classroom, FIELD_LIMITS.classroom),
      startTime: data.startTime.slice(0, 5),
      endTime: data.endTime.slice(0, 5),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateTimetableEntry(
  entryId: string,
  data: Omit<TimetableEntry, "id" | "userId" | "createdAt" | "updatedAt">
): Promise<void> {
  const path = `timetable/${entryId}`;
  try {
    await updateDoc(doc(db, "timetable", entryId), {
      day: data.day,
      entryType: data.entryType,
      subjectName: clampStr(data.subjectName, FIELD_LIMITS.subjectName),
      facultyName: clampStr(data.facultyName, FIELD_LIMITS.facultyName),
      classroom: clampStr(data.classroom, FIELD_LIMITS.classroom),
      startTime: data.startTime.slice(0, 5),
      endTime: data.endTime.slice(0, 5),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteTimetableEntry(entryId: string): Promise<void> {
  const path = `timetable/${entryId}`;
  try {
    await deleteDoc(doc(db, "timetable", entryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Study Sessions ---
export async function createStudySession(
  userId: string,
  data: Omit<StudySession, "id" | "userId" | "createdAt" | "updatedAt">
): Promise<string> {
  const id = createId();
  const path = `study_sessions/${id}`;
  try {
    await setDoc(doc(db, "study_sessions", id), {
      userId,
      subjectId: clampStr(data.subjectId, 128),
      subjectName: clampStr(data.subjectName, FIELD_LIMITS.subjectName),
      topic: clampStr(data.topic, FIELD_LIMITS.title),
      date: data.date.slice(0, 10),
      durationMinutes: clampNum(data.durationMinutes, 1, 1440),
      notes: clampStr(data.notes, FIELD_LIMITS.studyNotes),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteStudySession(sessionId: string): Promise<void> {
  const path = `study_sessions/${sessionId}`;
  try {
    await deleteDoc(doc(db, "study_sessions", sessionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Notes ---
export async function createNote(
  userId: string,
  data: Omit<Note, "id" | "userId" | "createdAt" | "updatedAt">
): Promise<string> {
  const id = createId();
  const path = `notes/${id}`;
  try {
    await setDoc(doc(db, "notes", id), {
      userId,
      subjectId: clampStr(data.subjectId, 128),
      subjectName: clampStr(data.subjectName, FIELD_LIMITS.subjectName),
      title: clampStr(data.title, FIELD_LIMITS.title),
      content: (data.content || "").slice(0, FIELD_LIMITS.noteContent),
      pinned: Boolean(data.pinned),
      archived: Boolean(data.archived),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateNote(
  noteId: string,
  data: Omit<Note, "id" | "userId" | "createdAt" | "updatedAt">
): Promise<void> {
  const path = `notes/${noteId}`;
  try {
    await updateDoc(doc(db, "notes", noteId), {
      subjectId: clampStr(data.subjectId, 128),
      subjectName: clampStr(data.subjectName, FIELD_LIMITS.subjectName),
      title: clampStr(data.title, FIELD_LIMITS.title),
      content: (data.content || "").slice(0, FIELD_LIMITS.noteContent),
      pinned: Boolean(data.pinned),
      archived: Boolean(data.archived),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function toggleNotePinned(noteId: string, pinned: boolean): Promise<void> {
  const path = `notes/${noteId}`;
  try {
    await updateDoc(doc(db, "notes", noteId), {
      pinned,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function toggleNoteArchived(noteId: string, archived: boolean): Promise<void> {
  const path = `notes/${noteId}`;
  try {
    await updateDoc(doc(db, "notes", noteId), {
      archived,
      pinned: archived ? false : undefined,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function setNoteArchiveState(
  noteId: string,
  archived: boolean,
  pinned: boolean
): Promise<void> {
  const path = `notes/${noteId}`;
  try {
    await updateDoc(doc(db, "notes", noteId), {
      archived,
      pinned: archived ? false : pinned,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteNote(noteId: string): Promise<void> {
  const path = `notes/${noteId}`;
  try {
    await deleteDoc(doc(db, "notes", noteId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Examinations ---
export async function createExamination(
  userId: string,
  data: Omit<Examination, "id" | "userId" | "createdAt" | "updatedAt">
): Promise<string> {
  const id = createId();
  const path = `examinations/${id}`;
  try {
    await setDoc(doc(db, "examinations", id), {
      userId,
      subjectId: clampStr(data.subjectId, 128),
      subjectName: clampStr(data.subjectName, FIELD_LIMITS.subjectName),
      examType: data.examType,
      examDate: data.examDate.slice(0, 10),
      examTime: data.examTime.slice(0, 5),
      venue: clampStr(data.venue, FIELD_LIMITS.venue),
      syllabus: clampStr(data.syllabus, FIELD_LIMITS.syllabus),
      prepStatus: data.prepStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateExamination(
  examId: string,
  data: Omit<Examination, "id" | "userId" | "createdAt" | "updatedAt">
): Promise<void> {
  const path = `examinations/${examId}`;
  try {
    await updateDoc(doc(db, "examinations", examId), {
      subjectId: clampStr(data.subjectId, 128),
      subjectName: clampStr(data.subjectName, FIELD_LIMITS.subjectName),
      examType: data.examType,
      examDate: data.examDate.slice(0, 10),
      examTime: data.examTime.slice(0, 5),
      venue: clampStr(data.venue, FIELD_LIMITS.venue),
      syllabus: clampStr(data.syllabus, FIELD_LIMITS.syllabus),
      prepStatus: data.prepStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateExamPrepStatus(
  examId: string,
  prepStatus: Examination["prepStatus"]
): Promise<void> {
  const path = `examinations/${examId}`;
  try {
    await updateDoc(doc(db, "examinations", examId), {
      prepStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteExamination(examId: string): Promise<void> {
  const path = `examinations/${examId}`;
  try {
    await deleteDoc(doc(db, "examinations", examId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Events ---
export async function createEvent(
  userId: string,
  data: Omit<CalendarEvent, "id" | "userId" | "createdAt" | "updatedAt">
): Promise<string> {
  const id = createId();
  const path = `events/${id}`;
  try {
    await setDoc(doc(db, "events", id), {
      userId,
      title: clampStr(data.title, FIELD_LIMITS.title),
      category: data.category,
      date: data.date.slice(0, 10),
      time: clampStr(data.time, 10),
      description: clampStr(data.description, FIELD_LIMITS.description),
      reminderEnabled: Boolean(data.reminderEnabled),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateEvent(
  eventId: string,
  data: Omit<CalendarEvent, "id" | "userId" | "createdAt" | "updatedAt">
): Promise<void> {
  const path = `events/${eventId}`;
  try {
    await updateDoc(doc(db, "events", eventId), {
      title: clampStr(data.title, FIELD_LIMITS.title),
      category: data.category,
      date: data.date.slice(0, 10),
      time: clampStr(data.time, 10),
      description: clampStr(data.description, FIELD_LIMITS.description),
      reminderEnabled: Boolean(data.reminderEnabled),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteEvent(eventId: string): Promise<void> {
  const path = `events/${eventId}`;
  try {
    await deleteDoc(doc(db, "events", eventId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Notifications ---
export async function createNotification(
  userId: string,
  data: Omit<NotificationItem, "id" | "userId" | "createdAt" | "updatedAt">
): Promise<string> {
  const id = createId();
  const path = `notifications/${id}`;
  try {
    await setDoc(doc(db, "notifications", id), {
      userId,
      title: clampStr(data.title, FIELD_LIMITS.title),
      message: clampStr(data.message, 500),
      type: data.type,
      read: Boolean(data.read),
      sourceId: clampStr(data.sourceId, 128),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const path = `notifications/${notificationId}`;
  try {
    await updateDoc(doc(db, "notifications", notificationId), {
      read: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteNotification(notificationId: string): Promise<void> {
  const path = `notifications/${notificationId}`;
  try {
    await deleteDoc(doc(db, "notifications", notificationId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Account Deletion Cleanup ---
export async function deleteAllUserData(userId: string): Promise<void> {
  const collections = [
    "tasks",
    "assignments",
    "timetable",
    "study_sessions",
    "subjects",
    "notes",
    "examinations",
    "events",
    "notifications",
  ];

  for (const colName of collections) {
    try {
      const q = query(collection(db, colName), where("userId", "==", userId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, colName);
    }
  }

  try {
    await deleteDoc(doc(db, "users", userId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
  }
}
