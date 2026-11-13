import { useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Edit2,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { useToast } from "../../context/ToastContext";
import {
  createAssignment,
  deleteAssignment,
  toggleAssignmentStatus,
  updateAssignment,
} from "../../services/firestoreService";
import type { Assignment, PriorityLevel } from "../../types";
import { getHoursUntilDeadline, toLocalDateKey } from "../../utils/dateUtils";
import { ConfirmModal, EmptyState, Modal, PriorityLabel, SemanticStatus } from "../ui/CommonUI";

export function AssignmentsPage() {
  const { user } = useAuth();
  const { assignments, subjects } = useData();
  const { showToast } = useToast();

  const [filter, setFilter] = useState<"all" | "pending" | "completed" | "overdue">("all");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Assignment | null>(null);

  // Form state
  const [subjectId, setSubjectId] = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState(`${toLocalDateKey()}T23:59`);
  const [priority, setPriority] = useState<PriorityLevel>("High");
  const [busy, setBusy] = useState(false);

  const now = new Date();

  const openModal = (item?: Assignment) => {
    if (item) {
      setEditing(item);
      setSubjectId(item.subjectId);
      setCustomSubject(item.subjectName);
      setTitle(item.title);
      setDescription(item.description);
      setDeadline(item.deadline.slice(0, 16));
      setPriority(item.priority);
    } else {
      setEditing(null);
      setSubjectId(subjects[0]?.id || "");
      setCustomSubject(subjects[0]?.name || "");
      setTitle("");
      setDescription("");
      setDeadline(`${toLocalDateKey()}T23:59`);
      setPriority("Medium");
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const selectedSubject = subjects.find((s) => s.id === subjectId);
    const finalSubjectName = selectedSubject?.name || customSubject.trim();
    if (!title.trim() || !finalSubjectName) {
      showToast("Title and subject are required.", "error");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        subjectId: selectedSubject?.id || "",
        subjectName: finalSubjectName,
        title: title.trim(),
        description: description.trim(),
        deadline,
        priority,
        status: editing ? editing.status : ("pending" as const),
        submittedAt: editing ? editing.submittedAt : "",
      };
      if (editing) {
        await updateAssignment(editing.id, payload);
        showToast("Assignment updated.", "success");
      } else {
        await createAssignment(user.uid, payload);
        showToast("Assignment added.", "success");
      }
      setModalOpen(false);
    } catch {
      showToast("Could not save assignment.", "error");
    } finally {
      setBusy(false);
    }
  };

  const filtered = useMemo(() => {
    return assignments
      .filter((a) => {
        if (search.trim()) {
          const q = search.toLowerCase();
          if (
            !a.title.toLowerCase().includes(q) &&
            !a.subjectName.toLowerCase().includes(q)
          ) {
            return false;
          }
        }
        const hrs = getHoursUntilDeadline(a.deadline, now);
        if (filter === "pending") return a.status === "pending";
        if (filter === "completed") return a.status === "submitted";
        if (filter === "overdue") return a.status === "pending" && hrs < 0;
        return true;
      })
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
        return a.deadline.localeCompare(b.deadline);
      });
  }, [assignments, filter, search]);

  const urgent24hCount = assignments.filter((a) => {
    const hrs = getHoursUntilDeadline(a.deadline, now);
    return a.status === "pending" && hrs >= 0 && hrs <= 24;
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
            Assignment Manager
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {assignments.filter((a) => a.status === "pending").length} pending ·{" "}
            {assignments.filter((a) => a.status === "submitted").length} submitted
            {urgent24hCount > 0 ? ` · ${urgent24hCount} due within 24h` : ""}
          </p>
        </div>

        <button
          type="button"
          onClick={() => openModal()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          Add Assignment
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {(
            [
              { id: "all", label: "All" },
              { id: "pending", label: "Pending" },
              { id: "overdue", label: "Overdue" },
              { id: "completed", label: "Submitted" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === tab.id
                  ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-slate-50"
                  : "text-slate-600 dark:text-slate-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assignments or subjects..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" />}
          title={assignments.length === 0 ? "No assignments tracked" : "No matching assignments"}
          description="Keep track of lab reports, coursework submissions, and upcoming 24-hour deadlines."
          actionLabel="Add Assignment"
          onAction={() => openModal()}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => {
            const hrs = getHoursUntilDeadline(a.deadline, now);
            const isOverdue = a.status === "pending" && hrs < 0;
            const isDueSoon = a.status === "pending" && hrs >= 0 && hrs <= 24;
            const parsedDeadline = new Date(a.deadline);

            return (
              <div
                key={a.id}
                className={`flex flex-col justify-between gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center ${
                  isOverdue
                    ? "border-rose-300 bg-rose-50/40 dark:border-rose-900/60 dark:bg-rose-950/20"
                    : isDueSoon
                      ? "border-amber-300 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/20"
                      : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                }`}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium text-indigo-600 dark:text-indigo-400">
                      {a.subjectName}
                    </span>
                    <span aria-hidden="true">·</span>
                    <PriorityLabel priority={a.priority} />
                    <span aria-hidden="true">·</span>
                    {a.status === "submitted" ? (
                      <SemanticStatus status="success" label="Submitted" />
                    ) : isOverdue ? (
                      <SemanticStatus status="danger" label="Overdue" />
                    ) : isDueSoon ? (
                      <SemanticStatus
                        status="warning"
                        label={`Due in ${Math.max(1, Math.round(hrs))}h`}
                      />
                    ) : (
                      <SemanticStatus status="neutral" label="Pending" />
                    )}
                  </div>

                  <h3
                    className={`font-display text-base font-semibold ${
                      a.status === "submitted"
                        ? "text-slate-400 line-through dark:text-slate-500"
                        : "text-slate-900 dark:text-slate-50"
                    }`}
                  >
                    {a.title}
                  </h3>
                  {a.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-400">{a.description}</p>
                  )}
                  <p className="font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
                    Deadline:{" "}
                    {Number.isNaN(parsedDeadline.getTime())
                      ? a.deadline
                      : parsedDeadline.toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={async () => {
                      const next = a.status === "submitted" ? "pending" : "submitted";
                      await toggleAssignmentStatus(a.id, next);
                      showToast(
                        next === "submitted" ? "Marked as submitted." : "Reopened as pending.",
                        "success"
                      );
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      a.status === "submitted"
                        ? "border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        : "bg-emerald-600 text-white hover:bg-emerald-700"
                    }`}
                  >
                    {a.status === "submitted" ? (
                      <>
                        <Clock className="h-3.5 w-3.5" />
                        Reopen
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Mark Submitted
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => openModal(a)}
                    aria-label="Edit assignment"
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(a)}
                    aria-label="Delete assignment"
                    className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {urgent24hCount > 0 && (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>
            You have {urgent24hCount} assignment{urgent24hCount === 1 ? "" : "s"} due within the next 24 hours.
          </span>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Assignment" : "Add Assignment"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Subject
              </label>
              {subjects.length > 0 ? (
                <select
                  value={subjectId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSubjectId(id);
                    const found = subjects.find((s) => s.id === id);
                    if (found) setCustomSubject(found.name);
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="">Other (Type below)</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  required
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  placeholder="e.g. Operating Systems"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              )}
            </div>

            {subjects.length > 0 && !subjectId && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Subject Name
                </label>
                <input
                  type="text"
                  required
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  placeholder="e.g. Machine Learning"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Assignment Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Problem Set 3: Graph Algorithms"
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Submission Deadline
            </label>
            <input
              type="datetime-local"
              required
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Description & Submission Instructions
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="PDF upload on portal, rubric notes..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
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
              {busy ? "Saving..." : editing ? "Save Changes" : "Add Assignment"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteAssignment(deleteTarget.id);
          showToast("Assignment deleted.", "success");
          setDeleteTarget(null);
        }}
        title="Delete Assignment"
        message={`Delete "${deleteTarget?.title}" permanently?`}
      />
    </div>
  );
}
