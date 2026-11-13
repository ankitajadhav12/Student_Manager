import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  BookOpen,
  Check,
  Clock,
  Edit2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { useToast } from "../../context/ToastContext";
import {
  createStudySession,
  createSubject,
  deleteStudySession,
  deleteSubject,
  updateSubject,
  updateSubjectTopics,
} from "../../services/firestoreService";
import { SUBJECT_COLORS, type Subject } from "../../types";
import {
  formatDisplayDate,
  formatMinutesToHours,
  getWeekStartDateKey,
  toLocalDateKey,
} from "../../utils/dateUtils";
import { ConfirmModal, EmptyState, Modal } from "../ui/CommonUI";

export function StudyPlannerPage() {
  const { user } = useAuth();
  const { subjects, studySessions } = useData();
  const { showToast } = useToast();

  // Subject Modal
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subject | null>(null);
  const [subName, setSubName] = useState("");
  const [subCode, setSubCode] = useState("");
  const [subColor, setSubColor] = useState<string>(SUBJECT_COLORS[0].hex);
  const [dailyTarget, setDailyTarget] = useState(45);
  const [weeklyTarget, setWeeklyTarget] = useState(300);
  const [totalTopics, setTotalTopics] = useState(12);
  const [subBusy, setSubBusy] = useState(false);

  // Study Session Modal
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [sessSubjectId, setSessSubjectId] = useState("");
  const [sessTopic, setSessTopic] = useState("");
  const [sessDate, setSessDate] = useState(toLocalDateKey());
  const [sessMinutes, setSessMinutes] = useState(45);
  const [sessNotes, setSessNotes] = useState("");
  const [sessBusy, setSessBusy] = useState(false);

  // Topic Drawer / Modal
  const [topicSubject, setTopicSubject] = useState<Subject | null>(null);
  const [newTopicName, setNewTopicName] = useState("");

  // Live Study Timer
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerSubjectId, setTimerSubjectId] = useState("");

  // Delete confirm
  const [deleteSubTarget, setDeleteSubTarget] = useState<Subject | null>(null);

  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => setTimerSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  useEffect(() => {
    if (!timerSubjectId && subjects[0]) {
      setTimerSubjectId(subjects[0].id);
    }
  }, [subjects, timerSubjectId]);

  const weekStart = getWeekStartDateKey();
  const monthPrefix = toLocalDateKey().slice(0, 7);

  const weeklyMinutes = useMemo(
    () =>
      studySessions
        .filter((s) => s.date >= weekStart)
        .reduce((sum, s) => sum + s.durationMinutes, 0),
    [studySessions, weekStart]
  );

  const monthlyMinutes = useMemo(
    () =>
      studySessions
        .filter((s) => s.date.startsWith(monthPrefix))
        .reduce((sum, s) => sum + s.durationMinutes, 0),
    [studySessions, monthPrefix]
  );

  const sortedSessions = useMemo(
    () => [...studySessions].sort((a, b) => b.date.localeCompare(a.date)),
    [studySessions]
  );

  const openSubjectModal = (sub?: Subject) => {
    if (sub) {
      setEditingSub(sub);
      setSubName(sub.name);
      setSubCode(sub.code);
      setSubColor(sub.color);
      setDailyTarget(sub.dailyTargetMinutes);
      setWeeklyTarget(sub.weeklyTargetMinutes);
      setTotalTopics(sub.totalTopics);
    } else {
      setEditingSub(null);
      setSubName("");
      setSubCode("");
      setSubColor(SUBJECT_COLORS[subjects.length % SUBJECT_COLORS.length].hex);
      setDailyTarget(45);
      setWeeklyTarget(300);
      setTotalTopics(12);
    }
    setSubModalOpen(true);
  };

  const handleSaveSubject = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !subName.trim()) return;
    setSubBusy(true);
    try {
      if (editingSub) {
        await updateSubject(editingSub.id, {
          name: subName.trim(),
          code: subCode.trim(),
          color: subColor,
          dailyTargetMinutes: Number(dailyTarget),
          weeklyTargetMinutes: Number(weeklyTarget),
          totalTopics: Number(totalTopics),
        });
        showToast("Subject updated.", "success");
      } else {
        await createSubject(user.uid, {
          name: subName.trim(),
          code: subCode.trim(),
          color: subColor,
          dailyTargetMinutes: Number(dailyTarget),
          weeklyTargetMinutes: Number(weeklyTarget),
          totalTopics: Number(totalTopics),
        });
        showToast("Subject added.", "success");
      }
      setSubModalOpen(false);
    } catch {
      showToast("Could not save subject.", "error");
    } finally {
      setSubBusy(false);
    }
  };

  const openSessionModal = (preselectedSubjectId?: string, preMinutes?: number) => {
    setSessSubjectId(preselectedSubjectId || subjects[0]?.id || "");
    setSessTopic("");
    setSessDate(toLocalDateKey());
    setSessMinutes(preMinutes || 45);
    setSessNotes("");
    setSessionModalOpen(true);
  };

  const handleSaveSession = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const subject = subjects.find((s) => s.id === sessSubjectId);
    if (!subject || !sessTopic.trim()) {
      showToast("Select a subject and enter the topic studied.", "error");
      return;
    }
    setSessBusy(true);
    try {
      await createStudySession(user.uid, {
        subjectId: subject.id,
        subjectName: subject.name,
        topic: sessTopic.trim(),
        date: sessDate,
        durationMinutes: Math.max(1, Number(sessMinutes)),
        notes: sessNotes.trim(),
      });
      showToast("Study session logged.", "success");
      setSessionModalOpen(false);
      if (timerSeconds > 0) {
        setTimerRunning(false);
        setTimerSeconds(0);
      }
    } catch {
      showToast("Failed to log study session.", "error");
    } finally {
      setSessBusy(false);
    }
  };

  const handleAddCompletedTopic = async (e: FormEvent) => {
    e.preventDefault();
    if (!topicSubject || !newTopicName.trim()) return;
    const currentList = topicSubject.completedTopicNames || [];
    const updated = [...currentList, newTopicName.trim()];
    try {
      await updateSubjectTopics(topicSubject.id, updated, updated.length);
      setTopicSubject({
        ...topicSubject,
        completedTopicNames: updated,
        completedTopics: updated.length,
      });
      setNewTopicName("");
      showToast("Completed topic recorded.", "success");
    } catch {
      showToast("Failed to update completed topics.", "error");
    }
  };

  const handleRemoveCompletedTopic = async (idx: number) => {
    if (!topicSubject) return;
    const updated = (topicSubject.completedTopicNames || []).filter((_, i) => i !== idx);
    try {
      await updateSubjectTopics(topicSubject.id, updated, updated.length);
      setTopicSubject({
        ...topicSubject,
        completedTopicNames: updated,
        completedTopics: updated.length,
      });
    } catch {
      showToast("Failed to remove topic.", "error");
    }
  };

  const formatClock = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      {/* Top Statistics + Focus Timer */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-7">
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Active Subjects</p>
            <p className="font-mono mt-2 text-2xl font-bold text-slate-900 tabular-nums dark:text-slate-50">
              {subjects.length}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {subjects.reduce((s, sub) => s + sub.completedTopics, 0)} topics mastered
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">This Week</p>
            <p className="font-mono mt-2 text-2xl font-bold text-slate-900 tabular-nums dark:text-slate-50">
              {formatMinutesToHours(weeklyMinutes)}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Goal: {formatMinutesToHours(subjects.reduce((s, sub) => s + sub.weeklyTargetMinutes, 0))}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">This Month</p>
            <p className="font-mono mt-2 text-2xl font-bold text-slate-900 tabular-nums dark:text-slate-50">
              {formatMinutesToHours(monthlyMinutes)}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {studySessions.length} total sessions
            </p>
          </div>
        </div>

        {/* Live Focus Stopwatch */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Live Study Timer
            </span>
            <select
              value={timerSubjectId}
              onChange={(e) => setTimerSubjectId(e.target.value)}
              disabled={subjects.length === 0}
              className="max-w-[170px] rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {subjects.length === 0 ? (
                <option value="">Add a subject first</option>
              ) : (
                subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="font-mono text-2xl font-bold tracking-tight text-slate-900 tabular-nums dark:text-slate-50">
              {formatClock(timerSeconds)}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={subjects.length === 0}
                onClick={() => setTimerRunning((r) => !r)}
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
              >
                {timerRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {timerRunning ? "Pause" : "Start"}
              </button>
              <button
                type="button"
                disabled={timerSeconds === 0}
                onClick={() => {
                  setTimerRunning(false);
                  setTimerSeconds(0);
                }}
                aria-label="Reset timer"
                className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              {timerSeconds >= 60 && (
                <button
                  type="button"
                  onClick={() => {
                    setTimerRunning(false);
                    openSessionModal(timerSubjectId, Math.max(1, Math.round(timerSeconds / 60)));
                  }}
                  className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                >
                  Save
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Subjects Grid */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
              Subjects & Weekly Targets
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage your semester subjects, study targets, and completed syllabus topics.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {subjects.length > 0 && (
              <button
                type="button"
                onClick={() => openSessionModal()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Clock className="h-3.5 w-3.5 text-violet-600" />
                Log Session
              </button>
            )}
            <button
              type="button"
              onClick={() => openSubjectModal()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              Add Subject
            </button>
          </div>
        </div>

        {subjects.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="h-5 w-5" />}
            title="No subjects configured"
            description="Create your semester subjects to set daily/weekly study goals and log sessions."
            actionLabel="Add First Subject"
            onAction={() => openSubjectModal()}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {subjects.map((sub) => {
              const loggedThisWeek = studySessions
                .filter((s) => s.subjectId === sub.id && s.date >= weekStart)
                .reduce((sum, s) => sum + s.durationMinutes, 0);
              const weekPct =
                sub.weeklyTargetMinutes > 0
                  ? Math.min(100, Math.round((loggedThisWeek / sub.weeklyTargetMinutes) * 100))
                  : 0;
              const topicPct =
                sub.totalTopics > 0
                  ? Math.min(100, Math.round((sub.completedTopics / sub.totalTopics) * 100))
                  : 0;

              return (
                <div
                  key={sub.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: sub.color }}
                        />
                        <div className="min-w-0">
                          <h3 className="font-display truncate text-base font-semibold text-slate-900 dark:text-slate-50">
                            {sub.name}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {sub.code || "Course"} · Daily target {sub.dailyTargetMinutes}m
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openSubjectModal(sub)}
                          aria-label="Edit subject"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteSubTarget(sub)}
                          aria-label="Delete subject"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      <div>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-slate-500 dark:text-slate-400">Weekly Study Goal</span>
                          <span className="font-mono text-slate-700 tabular-nums dark:text-slate-300">
                            {formatMinutesToHours(loggedThisWeek)} / {formatMinutesToHours(sub.weeklyTargetMinutes)} ({weekPct}%)
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${weekPct}%`, backgroundColor: sub.color }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-slate-500 dark:text-slate-400">Syllabus Topics</span>
                          <span className="font-mono text-slate-700 tabular-nums dark:text-slate-300">
                            {sub.completedTopics}/{sub.totalTopics} ({topicPct}%)
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div
                            className="h-full rounded-full bg-cyan-600"
                            style={{ width: `${topicPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => openSessionModal(sub.id)}
                      className="flex-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      Log Study
                    </button>
                    <button
                      type="button"
                      onClick={() => setTopicSubject(sub)}
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Topics ({sub.completedTopics})
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Study Session Log History */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-50">
              Recent Study Sessions
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Organized by subject, date, topic, and duration
            </p>
          </div>
        </div>

        {sortedSessions.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No study sessions logged yet. Start the timer or click &ldquo;Log Study&rdquo; on any subject.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3 pr-4">Subject</th>
                  <th className="pb-3 pr-4">Topic</th>
                  <th className="pb-3 pr-4 text-right">Duration</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sortedSessions.slice(0, 20).map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3 pr-4 font-mono text-xs text-slate-600 tabular-nums dark:text-slate-400">
                      {formatDisplayDate(s.date)}
                    </td>
                    <td className="py-3 pr-4 font-medium text-slate-900 dark:text-slate-100">
                      {s.subjectName}
                    </td>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                      {s.topic}
                      {s.notes && (
                        <span className="block text-xs text-slate-400">{s.notes}</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-xs font-semibold text-indigo-600 tabular-nums dark:text-indigo-400">
                      {formatMinutesToHours(s.durationMinutes)}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => deleteStudySession(s.id)}
                        aria-label="Delete study session"
                        className="rounded p-1 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Add/Edit Subject Modal */}
      <Modal
        open={subModalOpen}
        onClose={() => setSubModalOpen(false)}
        title={editingSub ? "Edit Subject" : "Add Subject"}
      >
        <form onSubmit={handleSaveSubject} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Subject Name
              </label>
              <input
                type="text"
                required
                value={subName}
                onChange={(e) => setSubName(e.target.value)}
                placeholder="e.g. Data Structures & Algorithms"
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Code
              </label>
              <input
                type="text"
                value={subCode}
                onChange={(e) => setSubCode(e.target.value)}
                placeholder="CS301"
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Daily Target (min)
              </label>
              <input
                type="number"
                min={0}
                max={720}
                value={dailyTarget}
                onChange={(e) => setDailyTarget(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Weekly Goal (min)
              </label>
              <input
                type="number"
                min={0}
                max={5040}
                value={weeklyTarget}
                onChange={(e) => setWeeklyTarget(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Total Syllabus Topics
              </label>
              <input
                type="number"
                min={1}
                max={500}
                value={totalTopics}
                onChange={(e) => setTotalTopics(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Accent Color
            </label>
            <div className="flex flex-wrap gap-2">
              {SUBJECT_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSubColor(c.hex)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                    subColor === c.hex
                      ? "border-slate-900 bg-slate-100 dark:border-white dark:bg-slate-800"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.hex }} />
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setSubModalOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium dark:border-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={subBusy}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {subBusy ? "Saving..." : editingSub ? "Update Subject" : "Add Subject"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Log Study Session Modal */}
      <Modal
        open={sessionModalOpen}
        onClose={() => setSessionModalOpen(false)}
        title="Log Study Session"
      >
        <form onSubmit={handleSaveSession} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Subject
            </label>
            <select
              required
              value={sessSubjectId}
              onChange={(e) => setSessSubjectId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Topic Studied
            </label>
            <input
              type="text"
              required
              value={sessTopic}
              onChange={(e) => setSessTopic(e.target.value)}
              placeholder="e.g. Dynamic Programming on Trees"
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Date
              </label>
              <input
                type="date"
                required
                value={sessDate}
                onChange={(e) => setSessDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Duration (minutes)
              </label>
              <input
                type="number"
                required
                min={1}
                max={1440}
                value={sessMinutes}
                onChange={(e) => setSessMinutes(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Session Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={sessNotes}
              onChange={(e) => setSessNotes(e.target.value)}
              placeholder="Key problems solved or pages covered..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setSessionModalOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium dark:border-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sessBusy}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {sessBusy ? "Logging..." : "Save Session"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Completed Topics Modal */}
      <Modal
        open={Boolean(topicSubject)}
        onClose={() => setTopicSubject(null)}
        title={`Completed Topics · ${topicSubject?.name || ""}`}
        subtitle={`Progress: ${topicSubject?.completedTopics || 0} of ${topicSubject?.totalTopics || 0} total syllabus topics`}
      >
        <form onSubmit={handleAddCompletedTopic} className="mb-4 flex gap-2">
          <input
            type="text"
            value={newTopicName}
            onChange={(e) => setNewTopicName(e.target.value)}
            placeholder="Add completed topic name..."
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-700"
          >
            Add
          </button>
        </form>

        {(topicSubject?.completedTopicNames || []).length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            No topics marked complete yet.
          </p>
        ) : (
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {(topicSubject?.completedTopicNames || []).map((topic, idx) => (
              <div
                key={`${topic}_${idx}`}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
              >
                <span className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                  <Check className="h-4 w-4 text-emerald-600" />
                  {topic}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveCompletedTopic(idx)}
                  className="text-xs text-slate-400 hover:text-rose-600"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={Boolean(deleteSubTarget)}
        onClose={() => setDeleteSubTarget(null)}
        onConfirm={async () => {
          if (!deleteSubTarget) return;
          await deleteSubject(deleteSubTarget.id);
          showToast("Subject removed.", "success");
          setDeleteSubTarget(null);
        }}
        title="Delete Subject"
        message={`Delete "${deleteSubTarget?.name}"? Existing study session logs will remain in your history.`}
      />
    </div>
  );
}
