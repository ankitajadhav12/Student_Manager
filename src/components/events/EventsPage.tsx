import { useMemo, useState, type FormEvent } from "react";
import {
  Bell,
  BellOff,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Plus,
  Trash2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { useToast } from "../../context/ToastContext";
import { requestNotificationPermission } from "../../services/firebase";
import { createEvent, deleteEvent, updateEvent } from "../../services/firestoreService";
import type { CalendarEvent, EventCategory } from "../../types";
import { formatDisplayDate, formatTime12h, toLocalDateKey } from "../../utils/dateUtils";
import { ConfirmModal, EmptyState, Modal } from "../ui/CommonUI";

const EVENT_CATEGORIES: EventCategory[] = [
  "College Event",
  "Personal",
  "Deadline",
  "Study Group",
  "Other",
];

export function EventsPage() {
  const { user } = useAuth();
  const { events } = useData();
  const { showToast } = useToast();

  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [cursorDate, setCursorDate] = useState(() => new Date());
  const [notifStatus, setNotifStatus] = useState<string>(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
    return window.Notification.permission;
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CalendarEvent | null>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<EventCategory>("College Event");
  const [date, setDate] = useState(toLocalDateKey());
  const [time, setTime] = useState("14:00");
  const [description, setDescription] = useState("");
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [busy, setBusy] = useState(false);

  const openModal = (prefillDate?: string, ev?: CalendarEvent) => {
    if (ev) {
      setEditing(ev);
      setTitle(ev.title);
      setCategory(ev.category);
      setDate(ev.date);
      setTime(ev.time);
      setDescription(ev.description);
      setReminderEnabled(ev.reminderEnabled);
    } else {
      setEditing(null);
      setTitle("");
      setCategory("College Event");
      setDate(prefillDate || toLocalDateKey());
      setTime("14:00");
      setDescription("");
      setReminderEnabled(true);
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim()) return;
    setBusy(true);
    try {
      const payload = {
        title: title.trim(),
        category,
        date,
        time,
        description: description.trim(),
        reminderEnabled,
      };
      if (editing) {
        await updateEvent(editing.id, payload);
        showToast("Event updated.", "success");
      } else {
        await createEvent(user.uid, payload);
        showToast("Event added.", "success");
      }
      setModalOpen(false);
    } catch {
      showToast("Failed to save event.", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleEnableNotifications = async () => {
    const res = await requestNotificationPermission();
    setNotifStatus(res.status);
    if (res.granted) {
      showToast(
        res.fcmSupported
          ? "Browser notifications & messaging support enabled."
          : "Browser notifications enabled.",
        "success"
      );
    } else if (res.status === "unsupported") {
      showToast("Browser notifications are unsupported here. In-app reminders remain active.", "info");
    } else {
      showToast("Notification permission was not granted. In-app reminders remain active.", "info");
    }
  };

  const monthCells = useMemo(() => {
    const y = cursorDate.getFullYear();
    const m = cursorDate.getMonth();
    const startOffset = new Date(y, m, 1).getDay();
    const totalDays = new Date(y, m + 1, 0).getDate();
    const cells: { dateKey: string | null; dayNum: number | null }[] = [];
    for (let i = 0; i < startOffset; i++) cells.push({ dateKey: null, dayNum: null });
    for (let d = 1; d <= totalDays; d++) {
      cells.push({ dateKey: toLocalDateKey(new Date(y, m, d)), dayNum: d });
    }
    return cells;
  }, [cursorDate]);

  const weekCells = useMemo(() => {
    const start = new Date(cursorDate);
    start.setDate(cursorDate.getDate() - cursorDate.getDay());
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return {
        dateKey: toLocalDateKey(d),
        label: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      };
    });
  }, [cursorDate]);

  const upcomingEvents = useMemo(
    () =>
      [...events]
        .filter((ev) => ev.date >= toLocalDateKey())
        .sort((a, b) => a.date.localeCompare(b.date)),
    [events]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
            Events & Reminders Calendar
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage college fests, club meetings, deadlines, and personal reminders.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {notifStatus !== "granted" && (
            <button
              type="button"
              onClick={handleEnableNotifications}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Bell className="h-3.5 w-3.5 text-cyan-600" />
              Enable Alerts
            </button>
          )}
          <div className="flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setViewMode("month")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                viewMode === "month"
                  ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-slate-50"
                  : "text-slate-600 dark:text-slate-300"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setViewMode("week")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                viewMode === "week"
                  ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-slate-50"
                  : "text-slate-600 dark:text-slate-300"
              }`}
            >
              Weekly
            </button>
          </div>
          <button
            type="button"
            onClick={() => openModal()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Add Event
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Calendar View */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-8 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-50">
              {cursorDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const next = new Date(cursorDate);
                  if (viewMode === "month") next.setMonth(next.getMonth() - 1);
                  else next.setDate(next.getDate() - 7);
                  setCursorDate(next);
                }}
                aria-label="Previous period"
                className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setCursorDate(new Date())}
                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = new Date(cursorDate);
                  if (viewMode === "month") next.setMonth(next.getMonth() + 1);
                  else next.setDate(next.getDate() + 7);
                  setCursorDate(next);
                }}
                aria-label="Next period"
                className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {viewMode === "month" ? (
            <>
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="py-2">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {monthCells.map((cell, idx) => {
                  if (!cell.dateKey) {
                    return (
                      <div
                        key={`e_${idx}`}
                        className="min-h-24 rounded-lg bg-slate-50/40 dark:bg-slate-950/30"
                      />
                    );
                  }
                  const dayEvents = events.filter((e) => e.date === cell.dateKey);
                  const isToday = cell.dateKey === toLocalDateKey();
                  return (
                    <div
                      key={cell.dateKey}
                      className={`min-h-24 rounded-lg border p-1.5 ${
                        isToday
                          ? "border-indigo-400 bg-indigo-50/30 dark:border-indigo-700 dark:bg-indigo-950/20"
                          : "border-slate-200 dark:border-slate-800"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-mono text-xs font-medium text-slate-700 dark:text-slate-300">
                          {cell.dayNum}
                        </span>
                        <button
                          type="button"
                          onClick={() => openModal(cell.dateKey!)}
                          aria-label={`Add event on ${cell.dateKey}`}
                          className="rounded p-0.5 text-slate-400 hover:text-indigo-600"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map((ev) => (
                          <button
                            key={ev.id}
                            type="button"
                            onClick={() => openModal(ev.date, ev)}
                            className="block w-full truncate rounded bg-violet-100/80 px-1.5 py-0.5 text-left text-[11px] font-medium text-violet-800 dark:bg-violet-950 dark:text-violet-300"
                          >
                            {ev.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="space-y-2.5">
              {weekCells.map((day) => {
                const dayEvents = events.filter((e) => e.date === day.dateKey);
                return (
                  <div
                    key={day.dateKey}
                    className="flex flex-col justify-between gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center dark:border-slate-800"
                  >
                    <div className="w-40 shrink-0 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {day.label}
                    </div>
                    <div className="flex flex-1 flex-wrap gap-2">
                      {dayEvents.length === 0 ? (
                        <span className="text-xs text-slate-400">No events</span>
                      ) : (
                        dayEvents.map((ev) => (
                          <button
                            key={ev.id}
                            type="button"
                            onClick={() => openModal(ev.date, ev)}
                            className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-200"
                          >
                            {ev.time ? `${formatTime12h(ev.time)} · ` : ""}
                            {ev.title}
                          </button>
                        ))
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => openModal(day.dateKey)}
                      className="self-start text-xs font-medium text-indigo-600 hover:underline sm:self-center dark:text-indigo-400"
                    >
                      + Add
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming Events List */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-display mb-4 text-base font-semibold text-slate-900 dark:text-slate-50">
            Upcoming Events
          </h3>

          {upcomingEvents.length === 0 ? (
            <EmptyState
              icon={<CalendarIcon className="h-5 w-5" />}
              title="No upcoming events"
              description="Schedule college events, club meets, or personal milestones."
              actionLabel="Add Event"
              onAction={() => openModal()}
            />
          ) : (
            <div className="space-y-3">
              {upcomingEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-violet-600 dark:text-violet-400">
                        {ev.category}
                      </p>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {ev.title}
                      </h4>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openModal(ev.date, ev)}
                        aria-label="Edit event"
                        className="rounded p-1 text-slate-400 hover:text-slate-700"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(ev)}
                        aria-label="Delete event"
                        className="rounded p-1 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
                    {formatDisplayDate(ev.date)}
                    {ev.time ? ` at ${formatTime12h(ev.time)}` : ""}
                  </p>
                  {ev.description && (
                    <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
                      {ev.description}
                    </p>
                  )}
                  <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-slate-500">
                    {ev.reminderEnabled ? (
                      <>
                        <Bell className="h-3 w-3 text-indigo-600" /> Reminder active
                      </>
                    ) : (
                      <>
                        <BellOff className="h-3 w-3" /> Reminder off
                      </>
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Event" : "Add Event"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Event Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Annual Tech Symposium / Project Demo"
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as EventCategory)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {EVENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Time
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Location, agenda, or preparation notes..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={reminderEnabled}
              onChange={(e) => setReminderEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            Show reminder alert ahead of this event
          </label>

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
              {busy ? "Saving..." : editing ? "Save Changes" : "Add Event"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteEvent(deleteTarget.id);
          showToast("Event deleted.", "success");
          setDeleteTarget(null);
        }}
        title="Delete Event"
        message={`Remove "${deleteTarget?.title}" from your calendar?`}
      />
    </div>
  );
}
