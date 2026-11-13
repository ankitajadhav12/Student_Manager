import { useMemo, useState, type FormEvent } from "react";
import { Award, Calendar, Edit2, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { useToast } from "../../context/ToastContext";
import {
  createExamination,
  deleteExamination,
  updateExamination,
  updateExamPrepStatus,
} from "../../services/firestoreService";
import type { Examination, ExamType, PrepStatus } from "../../types";
import {
  formatDisplayDate,
  formatTime12h,
  getDaysRemaining,
  toLocalDateKey,
} from "../../utils/dateUtils";
import { ConfirmModal, EmptyState, Modal } from "../ui/CommonUI";

const EXAM_TYPES: ExamType[] = ["Mid-Term", "Final", "Quiz", "Practical", "Viva", "Other"];
const PREP_STATUSES: PrepStatus[] = ["Not Started", "In Progress", "Revising", "Ready"];

export function ExamsPage() {
  const { user } = useAuth();
  const { examinations, subjects } = useData();
  const { showToast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Examination | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Examination | null>(null);

  const [subjectId, setSubjectId] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [examType, setExamType] = useState<ExamType>("Mid-Term");
  const [examDate, setExamDate] = useState(toLocalDateKey());
  const [examTime, setExamTime] = useState("09:30");
  const [venue, setVenue] = useState("");
  const [syllabus, setSyllabus] = useState("");
  const [prepStatus, setPrepStatus] = useState<PrepStatus>("Not Started");
  const [busy, setBusy] = useState(false);

  const now = new Date();

  const sortedExams = useMemo(
    () => [...examinations].sort((a, b) => a.examDate.localeCompare(b.examDate)),
    [examinations]
  );

  const openModal = (exam?: Examination) => {
    if (exam) {
      setEditing(exam);
      setSubjectId(exam.subjectId);
      setSubjectName(exam.subjectName);
      setExamType(exam.examType);
      setExamDate(exam.examDate);
      setExamTime(exam.examTime);
      setVenue(exam.venue);
      setSyllabus(exam.syllabus);
      setPrepStatus(exam.prepStatus);
    } else {
      setEditing(null);
      setSubjectId(subjects[0]?.id || "");
      setSubjectName(subjects[0]?.name || "");
      setExamType("Mid-Term");
      setExamDate(toLocalDateKey());
      setExamTime("09:30");
      setVenue("");
      setSyllabus("");
      setPrepStatus("Not Started");
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const chosenSub = subjects.find((s) => s.id === subjectId);
    const finalName = chosenSub?.name || subjectName.trim();
    if (!finalName) {
      showToast("Subject name is required.", "error");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        subjectId: chosenSub?.id || "",
        subjectName: finalName,
        examType,
        examDate,
        examTime,
        venue: venue.trim(),
        syllabus: syllabus.trim(),
        prepStatus,
      };
      if (editing) {
        await updateExamination(editing.id, payload);
        showToast("Examination updated.", "success");
      } else {
        await createExamination(user.uid, payload);
        showToast("Examination scheduled.", "success");
      }
      setModalOpen(false);
    } catch {
      showToast("Could not save examination.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
            Examination Manager
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Track upcoming exams, countdowns, syllabus scope, and preparation progress.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openModal()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          Add Examination
        </button>
      </div>

      {sortedExams.length === 0 ? (
        <EmptyState
          icon={<Award className="h-5 w-5" />}
          title="No examinations scheduled"
          description="Add your mid-terms, finals, practicals, or quizzes to track countdowns and syllabus readiness."
          actionLabel="Schedule Exam"
          onAction={() => openModal()}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {sortedExams.map((exam) => {
            const days = getDaysRemaining(exam.examDate, now);
            const countdownLabel =
              days < 0
                ? `${Math.abs(days)}d ago`
                : days === 0
                  ? "Today"
                  : days === 1
                    ? "Tomorrow"
                    : `${days} days left`;

            return (
              <div
                key={exam.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                        {exam.examType}
                        {exam.venue ? ` · ${exam.venue}` : ""}
                      </p>
                      <h3 className="font-display mt-0.5 text-lg font-bold text-slate-900 dark:text-slate-50">
                        {exam.subjectName}
                      </h3>
                    </div>

                    <span
                      className={`font-mono shrink-0 rounded-lg border px-2.5 py-1 text-xs font-semibold tabular-nums ${
                        days >= 0 && days <= 3
                          ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
                          : days < 0
                            ? "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                            : "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300"
                      }`}
                    >
                      {countdownLabel}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-2 font-mono text-xs text-slate-600 tabular-nums dark:text-slate-400">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {formatDisplayDate(exam.examDate)} at {formatTime12h(exam.examTime)}
                    </span>
                  </div>

                  {exam.syllabus && (
                    <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                      <span className="mb-1 block font-semibold text-slate-800 dark:text-slate-200">
                        Syllabus
                      </span>
                      {exam.syllabus}
                    </div>
                  )}
                </div>

                <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 dark:text-slate-400">Prep:</label>
                    <select
                      value={exam.prepStatus}
                      onChange={async (e) => {
                        const status = e.target.value as PrepStatus;
                        await updateExamPrepStatus(exam.id, status);
                        showToast(`Preparation status set to ${status}.`, "info");
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                    >
                      {PREP_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openModal(exam)}
                      aria-label="Edit examination"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(exam)}
                      aria-label="Delete examination"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Examination" : "Schedule Examination"}
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
                    if (found) setSubjectName(found.name);
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
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  placeholder="e.g. Linear Algebra"
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
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  placeholder="e.g. Linear Algebra"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Exam Type
              </label>
              <select
                value={examType}
                onChange={(e) => setExamType(e.target.value as ExamType)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {EXAM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Date
              </label>
              <input
                type="date"
                required
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Time
              </label>
              <input
                type="time"
                required
                value={examTime}
                onChange={(e) => setExamTime(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Preparation Status
              </label>
              <select
                value={prepStatus}
                onChange={(e) => setPrepStatus(e.target.value as PrepStatus)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {PREP_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Venue / Hall (Optional)
            </label>
            <input
              type="text"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="Examination Hall B"
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Syllabus Topics
            </label>
            <textarea
              rows={3}
              value={syllabus}
              onChange={(e) => setSyllabus(e.target.value)}
              placeholder="Chapters 1–5, Eigenvalues, Matrix Decomposition..."
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
              {busy ? "Saving..." : editing ? "Save Changes" : "Schedule Exam"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteExamination(deleteTarget.id);
          showToast("Examination removed.", "success");
          setDeleteTarget(null);
        }}
        title="Delete Examination"
        message={`Remove ${deleteTarget?.subjectName} (${deleteTarget?.examType})?`}
      />
    </div>
  );
}
