import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Edit2,
  List,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { useToast } from "../../context/ToastContext";
import {
  createTask,
  deleteTask,
  toggleTaskComplete,
  updateTask,
} from "../../services/firestoreService";
import type { PriorityLevel, Task, TaskCategory } from "../../types";
import { formatDisplayDate, toLocalDateKey } from "../../utils/dateUtils";
import { ConfirmModal, EmptyState, Modal, PriorityLabel } from "../ui/CommonUI";

const CATEGORIES: TaskCategory[] = [
  "Academic",
  "Personal",
  "Projects",
  "College Activities",
  "Other",
];

const PRIORITY_WEIGHT: Record<PriorityLevel, number> = {
  High: 3,
  Medium: 2,
  Low: 1,
};

export function TaskFormModal({
  open,
  onClose,
  editingTask,
  defaultDate,
}: {
  open: boolean;
  onClose: () => void;
  editingTask?: Task | null;
  defaultDate?: string;
}) {
  const { user } = useAuth();
  const { subjects } = useData();
  const { showToast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TaskCategory>("Academic");
  const [priority, setPriority] = useState<PriorityLevel>("Medium");
  const [dueDate, setDueDate] = useState(toLocalDateKey());
  const [subjectId, setSubjectId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingTask) {
      setTitle(editingTask.title);
      setDescription(editingTask.description);
      setCategory(editingTask.category);
      setPriority(editingTask.priority);
      setDueDate(editingTask.dueDate);
      setSubjectId(editingTask.subjectId);
    } else {
      setTitle("");
      setDescription("");
      setCategory("Academic");
      setPriority("Medium");
      setDueDate(defaultDate || toLocalDateKey());
      setSubjectId("");
    }
  }, [open, editingTask, defaultDate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!title.trim()) {
      showToast("Task title is required.", "error");
      return;
    }
    setBusy(true);
    try {
      if (editingTask) {
        await updateTask(editingTask.id, {
          title: title.trim(),
          description: description.trim(),
          category,
          priority,
          dueDate,
          subjectId,
          completed: editingTask.completed,
        });
        showToast("Task updated.", "success");
      } else {
        await createTask(user.uid, {
          title: title.trim(),
          description: description.trim(),
          category,
          priority,
          dueDate,
          subjectId,
          completed: false,
        });
        showToast("Task created.", "success");
      }
      onClose();
    } catch {
      showToast("Could not save task.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingTask ? "Edit Task" : "Create Task"}
      subtitle="Organize coursework, deadlines, or personal goals."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
            Task Title
          </label>
          <input
            type="text"
            required
            maxLength={160}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Complete Operating Systems Lab 4"
            className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TaskCategory)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as PriorityLevel)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Linked Subject (Optional)
            </label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="">General / None</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
            Description
          </label>
          <textarea
            rows={3}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Notes, subtasks, or links..."
            className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? "Saving..." : editingTask ? "Save Changes" : "Create Task"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function TasksPage() {
  const { tasks, subjects } = useData();
  const { showToast } = useToast();

  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "completed">("all");
  const [sortBy, setSortBy] = useState<"dueDate" | "priority">("dueDate");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [defaultDate, setDefaultDate] = useState<string>("");
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [calMonth, setCalMonth] = useState(() => new Date());

  const subjectMap = useMemo(
    () => new Map(subjects.map((s) => [s.id, s.name])),
    [subjects]
  );

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        if (search.trim()) {
          const q = search.toLowerCase();
          if (
            !t.title.toLowerCase().includes(q) &&
            !t.description.toLowerCase().includes(q)
          ) {
            return false;
          }
        }
        if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
        if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
        if (statusFilter === "pending" && t.completed) return false;
        if (statusFilter === "completed" && !t.completed) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
        if (sortBy === "priority") {
          const diff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
          if (diff !== 0) return diff;
          return (a.dueDate || "9999").localeCompare(b.dueDate || "9999");
        }
        return (a.dueDate || "9999").localeCompare(b.dueDate || "9999");
      });
  }, [tasks, search, categoryFilter, priorityFilter, statusFilter, sortBy]);

  const calendarDays = useMemo(() => {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { dateKey: string | null; dayNum: number | null }[] = [];
    for (let i = 0; i < startOffset; i++) cells.push({ dateKey: null, dayNum: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, month, d);
      cells.push({ dateKey: toLocalDateKey(dt), dayNum: d });
    }
    return cells;
  }, [calMonth]);

  const handleToggle = async (task: Task) => {
    try {
      await toggleTaskComplete(task.id, !task.completed);
    } catch {
      showToast("Failed to update task.", "error");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteTask(deleteTarget.id);
      showToast("Task deleted.", "success");
      setDeleteTarget(null);
    } catch {
      showToast("Failed to delete task.", "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
            Task Management
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {tasks.filter((t) => !t.completed).length} pending ·{" "}
            {tasks.filter((t) => t.completed).length} completed
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                viewMode === "list"
                  ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-slate-50"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300"
              }`}
            >
              <List className="h-3.5 w-3.5" />
              List
            </button>
            <button
              type="button"
              onClick={() => setViewMode("calendar")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                viewMode === "calendar"
                  ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-slate-50"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300"
              }`}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              Calendar
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingTask(null);
              setDefaultDate("");
              setModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-700 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            New Task
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks by title or notes..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
        >
          <option value="all">All Priorities</option>
          <option value="High">High Priority</option>
          <option value="Medium">Medium Priority</option>
          <option value="Low">Low Priority</option>
        </select>

        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "pending" | "completed")}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "dueDate" | "priority")}
            aria-label="Sort tasks"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          >
            <option value="dueDate">Sort: Due Date</option>
            <option value="priority">Sort: Priority</option>
          </select>
        </div>
      </div>

      {viewMode === "list" ? (
        filteredTasks.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-5 w-5" />}
            title={tasks.length === 0 ? "No tasks yet" : "No matching tasks"}
            description={
              tasks.length === 0
                ? "Add your first academic or personal task to stay organized."
                : "Try clearing one of your search or category filters."
            }
            actionLabel="Create Task"
            onAction={() => {
              setEditingTask(null);
              setModalOpen(true);
            }}
          />
        ) : (
          <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <button
                    type="button"
                    onClick={() => handleToggle(task)}
                    aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
                    className="mt-0.5 shrink-0"
                  >
                    {task.completed ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Circle className="h-5 w-5 text-slate-400 hover:text-indigo-600" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-semibold ${
                        task.completed
                          ? "text-slate-400 line-through dark:text-slate-500"
                          : "text-slate-900 dark:text-slate-100"
                      }`}
                    >
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                        {task.description}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {task.category}
                      {task.subjectId && subjectMap.get(task.subjectId)
                        ? ` · ${subjectMap.get(task.subjectId)}`
                        : ""}
                      {task.dueDate ? ` · Due ${formatDisplayDate(task.dueDate)}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-4 self-end sm:self-center">
                  <PriorityLabel priority={task.priority} />
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTask(task);
                        setModalOpen(true);
                      }}
                      aria-label="Edit task"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(task)}
                      aria-label="Delete task"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Calendar View */
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-50">
              {calMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
                }
                aria-label="Previous month"
                className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setCalMonth(new Date())}
                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() =>
                  setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
                }
                aria-label="Next month"
                className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((cell, idx) => {
              if (!cell.dateKey) {
                return <div key={`empty_${idx}`} className="min-h-24 rounded-lg bg-slate-50/40 dark:bg-slate-950/30" />;
              }
              const dayTasks = filteredTasks.filter((t) => t.dueDate === cell.dateKey);
              const isToday = cell.dateKey === toLocalDateKey();
              return (
                <div
                  key={cell.dateKey}
                  className={`min-h-24 rounded-lg border p-1.5 text-left ${
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
                      onClick={() => {
                        setEditingTask(null);
                        setDefaultDate(cell.dateKey!);
                        setModalOpen(true);
                      }}
                      title="Add task on this date"
                      className="rounded p-0.5 text-slate-400 hover:bg-slate-200/60 hover:text-indigo-600 dark:hover:bg-slate-800"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    {dayTasks.slice(0, 3).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setEditingTask(t);
                          setModalOpen(true);
                        }}
                        className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium ${
                          t.completed
                            ? "bg-slate-100 text-slate-400 line-through dark:bg-slate-800 dark:text-slate-500"
                            : "bg-indigo-100/80 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                        }`}
                      >
                        {t.title}
                      </button>
                    ))}
                    {dayTasks.length > 3 && (
                      <p className="px-1 text-[10px] text-slate-500">
                        +{dayTasks.length - 3} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <TaskFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editingTask={editingTask}
        defaultDate={defaultDate}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Task"
        message={`Remove "${deleteTarget?.title}" permanently?`}
      />
    </div>
  );
}
