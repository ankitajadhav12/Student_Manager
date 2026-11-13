import { useMemo, useState, type FormEvent } from "react";
import { CalendarClock, Coffee, Edit2, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { useToast } from "../../context/ToastContext";
import {
  createTimetableEntry,
  deleteTimetableEntry,
  updateTimetableEntry,
} from "../../services/firestoreService";
import { DAYS_OF_WEEK, type DayOfWeek, type TimetableEntry } from "../../types";
import {
  formatTime12h,
  getLectureStatus,
  getTodayDayName,
} from "../../utils/dateUtils";
import { ConfirmModal, EmptyState, Modal } from "../ui/CommonUI";

export function TimetablePage() {
  const { user } = useAuth();
  const { timetable, subjects } = useData();
  const { showToast } = useToast();

  const todayName = getTodayDayName();
  const defaultSelectedDay: DayOfWeek =
    todayName === "Sunday" ? "Monday" : todayName;

  const [viewMode, setViewMode] = useState<"weekly" | "daily">("weekly");
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(defaultSelectedDay);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TimetableEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TimetableEntry | null>(null);

  // Form
  const [day, setDay] = useState<DayOfWeek>(defaultSelectedDay);
  const [entryType, setEntryType] = useState<"lecture" | "break">("lecture");
  const [subjectName, setSubjectName] = useState("");
  const [facultyName, setFacultyName] = useState("");
  const [classroom, setClassroom] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [busy, setBusy] = useState(false);

  const now = new Date();

  const entriesByDay = useMemo(() => {
    const map = new Map<DayOfWeek, TimetableEntry[]>();
    DAYS_OF_WEEK.forEach((d) => map.set(d, []));
    timetable.forEach((item) => {
      const list = map.get(item.day) || [];
      list.push(item);
      map.set(item.day, list);
    });
    DAYS_OF_WEEK.forEach((d) => {
      const list = map.get(d) || [];
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    });
    return map;
  }, [timetable]);

  const openModal = (prefillDay?: DayOfWeek, entry?: TimetableEntry) => {
    if (entry) {
      setEditing(entry);
      setDay(entry.day);
      setEntryType(entry.entryType);
      setSubjectName(entry.subjectName);
      setFacultyName(entry.facultyName);
      setClassroom(entry.classroom);
      setStartTime(entry.startTime);
      setEndTime(entry.endTime);
    } else {
      setEditing(null);
      setDay(prefillDay || selectedDay);
      setEntryType("lecture");
      setSubjectName("");
      setFacultyName("");
      setClassroom("");
      setStartTime("09:00");
      setEndTime("10:00");
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!subjectName.trim()) {
      showToast("Please enter a subject or break title.", "error");
      return;
    }
    if (endTime <= startTime) {
      showToast("End time must be after start time.", "error");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        day,
        entryType,
        subjectName: subjectName.trim(),
        facultyName: entryType === "break" ? "" : facultyName.trim(),
        classroom: entryType === "break" ? "" : classroom.trim(),
        startTime,
        endTime,
      };
      if (editing) {
        await updateTimetableEntry(editing.id, payload);
        showToast("Timetable slot updated.", "success");
      } else {
        await createTimetableEntry(user.uid, payload);
        showToast("Timetable slot added.", "success");
      }
      setModalOpen(false);
    } catch {
      showToast("Could not save timetable slot.", "error");
    } finally {
      setBusy(false);
    }
  };

  const renderSlotCard = (entry: TimetableEntry) => {
    const status = getLectureStatus(entry, now);
    const isBreak = entry.entryType === "break";
    return (
      <div
        key={entry.id}
        className={`group rounded-xl border p-3.5 transition-colors ${
          status === "current"
            ? "border-indigo-400 bg-indigo-50/70 dark:border-indigo-700 dark:bg-indigo-950/40"
            : status === "upcoming"
              ? "border-cyan-300 bg-cyan-50/40 dark:border-cyan-900 dark:bg-cyan-950/20"
              : isBreak
                ? "border-dashed border-slate-300 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-800/30"
                : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {isBreak && <Coffee className="h-3.5 w-3.5 shrink-0 text-amber-600" />}
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {entry.subjectName}
              </p>
            </div>
            <p className="mt-0.5 font-mono text-xs text-slate-600 tabular-nums dark:text-slate-400">
              {formatTime12h(entry.startTime)} – {formatTime12h(entry.endTime)}
            </p>
          </div>
          <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => openModal(entry.day, entry)}
              aria-label="Edit slot"
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDeleteTarget(entry)}
              aria-label="Delete slot"
              className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {!isBreak && (entry.facultyName || entry.classroom) && (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {[entry.facultyName, entry.classroom ? `Room ${entry.classroom}` : ""]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}

        {(status === "current" || status === "upcoming") && (
          <p className="mt-2 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
            {status === "current" ? "Happening now" : "Up next today"}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
            Weekly College Timetable
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Monday to Saturday lectures and break periods · Today is {todayName}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setViewMode("weekly")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "weekly"
                  ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-slate-50"
                  : "text-slate-600 dark:text-slate-300"
              }`}
            >
              Weekly View
            </button>
            <button
              type="button"
              onClick={() => setViewMode("daily")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "daily"
                  ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-slate-50"
                  : "text-slate-600 dark:text-slate-300"
              }`}
            >
              Daily View
            </button>
          </div>

          <button
            type="button"
            onClick={() => openModal()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-700 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            Add Lecture / Break
          </button>
        </div>
      </div>

      {timetable.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="h-5 w-5" />}
          title="Your timetable is empty"
          description="Add your Monday–Saturday lectures, faculty details, classrooms, and break periods."
          actionLabel="Add First Lecture"
          onAction={() => openModal()}
        />
      ) : viewMode === "weekly" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {DAYS_OF_WEEK.map((d) => {
            const slots = entriesByDay.get(d) || [];
            const isToday = d === todayName;
            return (
              <div
                key={d}
                className={`rounded-2xl border p-4 ${
                  isToday
                    ? "border-indigo-300 bg-white dark:border-indigo-800 dark:bg-slate-900"
                    : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                }`}
              >
                <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
                      {d}
                    </h3>
                    {isToday && (
                      <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                        · Today
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => openModal(d)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </button>
                </div>

                {slots.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-400">No classes scheduled</p>
                ) : (
                  <div className="space-y-2.5">{slots.map(renderSlotCard)}</div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Daily View */
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
            {DAYS_OF_WEEK.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedDay(d)}
                className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors ${
                  selectedDay === d
                    ? "bg-indigo-600 text-white"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {d}
                {d === todayName ? " (Today)" : ""}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-50">
                {selectedDay} Schedule
              </h3>
              <button
                type="button"
                onClick={() => openModal(selectedDay)}
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              >
                <Plus className="h-3.5 w-3.5" />
                Add to {selectedDay}
              </button>
            </div>
            {(entriesByDay.get(selectedDay) || []).length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">
                No entries scheduled for {selectedDay}.
              </p>
            ) : (
              <div className="space-y-3">
                {(entriesByDay.get(selectedDay) || []).map(renderSlotCard)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Timetable Slot Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Timetable Slot" : "Add Timetable Slot"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Day of Week
              </label>
              <select
                value={day}
                onChange={(e) => setDay(e.target.value as DayOfWeek)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {DAYS_OF_WEEK.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Slot Type
              </label>
              <select
                value={entryType}
                onChange={(e) => {
                  const val = e.target.value as "lecture" | "break";
                  setEntryType(val);
                  if (val === "break" && !subjectName) setSubjectName("Lunch Break");
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="lecture">Lecture / Lab</option>
                <option value="break">Break Period</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
              {entryType === "break" ? "Break Label" : "Subject Name"}
            </label>
            <input
              type="text"
              required
              list="timetable-subject-suggestions"
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              placeholder={entryType === "break" ? "Lunch Break" : "e.g. Computer Networks"}
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
            <datalist id="timetable-subject-suggestions">
              {subjects.map((s) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>
          </div>

          {entryType === "lecture" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Faculty Name
                </label>
                <input
                  type="text"
                  value={facultyName}
                  onChange={(e) => setFacultyName(e.target.value)}
                  placeholder="Dr. Meera Nair"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Classroom / Lab
                </label>
                <input
                  type="text"
                  value={classroom}
                  onChange={(e) => setClassroom(e.target.value)}
                  placeholder="LH-204"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Start Time
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                End Time
              </label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium dark:border-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy ? "Saving..." : editing ? "Save Changes" : "Add Slot"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteTimetableEntry(deleteTarget.id);
          showToast("Timetable slot removed.", "success");
          setDeleteTarget(null);
        }}
        title="Delete Timetable Entry"
        message={`Remove "${deleteTarget?.subjectName}" on ${deleteTarget?.day}?`}
      />
    </div>
  );
}
