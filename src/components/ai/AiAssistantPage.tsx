import { useState } from "react";
import {
  Award,
  CalendarClock,
  CheckCircle2,
  Compass,
  FileText,
  ListChecks,
  Sparkles,
} from "lucide-react";
import { useData } from "../../context/DataContext";
import { useToast } from "../../context/ToastContext";
import { updateTaskPriority } from "../../services/firestoreService";
import type { PriorityLevel } from "../../types";
import { stripHtml, toLocalDateKey } from "../../utils/dateUtils";

type AiToolTab = "planner" | "suggestions" | "prioritize" | "summarize" | "exam";

interface StudyPlanResult {
  summary?: string;
  weeklyFocus?: string[];
  days?: {
    dayLabel: string;
    blocks: {
      timeSlot: string;
      subject: string;
      topic: string;
      durationMinutes: number;
      goal: string;
    }[];
  }[];
}

interface SuggestionsResult {
  headline?: string;
  suggestions?: {
    subject: string;
    recommendedTopic: string;
    suggestedMinutes: number;
    urgency: string;
    reason: string;
  }[];
}

interface PrioritizeResult {
  strategyNote?: string;
  prioritizedTasks?: {
    taskId: string;
    title: string;
    rank: number;
    recommendedPriority: PriorityLevel;
    reason: string;
  }[];
}

interface SummarizeResult {
  tldr?: string;
  keyTakeaways?: string[];
  keyTerms?: { term: string; definition: string }[];
  practiceQuestions?: string[];
}

interface ExamPrepResult {
  overview?: string;
  phases?: {
    phaseTitle: string;
    timeframe: string;
    focusTopics: string[];
    studyMethod: string;
  }[];
  readinessChecklist?: string[];
}

export function AiAssistantPage() {
  const { subjects, tasks, assignments, examinations, studySessions, notes } = useData();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<AiToolTab>("planner");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Planner inputs
  const [hoursPerDay, setHoursPerDay] = useState(3);
  const [focusPref, setFocusPref] = useState("Balanced mix of difficult topics and revision");
  const [planResult, setPlanResult] = useState<StudyPlanResult | null>(null);

  // Suggestions output
  const [suggestionsResult, setSuggestionsResult] = useState<SuggestionsResult | null>(null);

  // Task Prioritization output
  const [priorityResult, setPriorityResult] = useState<PrioritizeResult | null>(null);
  const [applyingPriorities, setApplyingPriorities] = useState(false);

  // Note Summarizer inputs
  const [selectedNoteId, setSelectedNoteId] = useState("");
  const [customNoteTitle, setCustomNoteTitle] = useState("");
  const [customNoteText, setCustomNoteText] = useState("");
  const [summaryResult, setSummaryResult] = useState<SummarizeResult | null>(null);

  // Exam Prep inputs
  const [selectedExamId, setSelectedExamId] = useState(examinations[0]?.id || "");
  const [examDailyHours, setExamDailyHours] = useState(2.5);
  const [examPrepResult, setExamPrepResult] = useState<ExamPrepResult | null>(null);

  const today = toLocalDateKey();

  const callAiEndpoint = async <T,>(url: string, body: unknown): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "AI request failed");
      }
      return data as T;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reach AI Study Assistant.");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePlan = async () => {
    const data = await callAiEndpoint<StudyPlanResult>("/api/ai/study-planner", {
      today,
      availableHoursPerDay: hoursPerDay,
      focusPreference: focusPref,
      subjects: subjects.map((s) => ({
        name: s.name,
        weeklyTargetMinutes: s.weeklyTargetMinutes,
        completedTopics: s.completedTopics,
        totalTopics: s.totalTopics,
      })),
      exams: examinations.map((e) => ({
        subject: e.subjectName,
        type: e.examType,
        date: e.examDate,
        prepStatus: e.prepStatus,
      })),
      assignments: assignments
        .filter((a) => a.status === "pending")
        .map((a) => ({ subject: a.subjectName, title: a.title, deadline: a.deadline, priority: a.priority })),
      tasks: tasks
        .filter((t) => !t.completed)
        .map((t) => ({ title: t.title, category: t.category, priority: t.priority, dueDate: t.dueDate })),
    });
    if (data) setPlanResult(data);
  };

  const handleGetSuggestions = async () => {
    const data = await callAiEndpoint<SuggestionsResult>("/api/ai/study-suggestions", {
      today,
      subjects: subjects.map((s) => ({
        name: s.name,
        weeklyTargetMinutes: s.weeklyTargetMinutes,
        completedTopics: s.completedTopics,
        totalTopics: s.totalTopics,
      })),
      studySessions: studySessions.slice(0, 20).map((s) => ({
        subject: s.subjectName,
        topic: s.topic,
        date: s.date,
        durationMinutes: s.durationMinutes,
      })),
      assignments: assignments
        .filter((a) => a.status === "pending")
        .map((a) => ({ subject: a.subjectName, title: a.title, deadline: a.deadline })),
      exams: examinations.map((e) => ({
        subject: e.subjectName,
        date: e.examDate,
        prepStatus: e.prepStatus,
      })),
    });
    if (data) setSuggestionsResult(data);
  };

  const handlePrioritizeTasks = async () => {
    const pending = tasks.filter((t) => !t.completed);
    if (pending.length === 0) {
      setError("You have no pending tasks to prioritize.");
      return;
    }
    const data = await callAiEndpoint<PrioritizeResult>("/api/ai/prioritize-tasks", {
      today,
      tasks: pending.map((t) => ({
        id: t.id,
        title: t.title,
        category: t.category,
        currentPriority: t.priority,
        dueDate: t.dueDate,
      })),
      exams: examinations.map((e) => ({ subject: e.subjectName, date: e.examDate })),
      assignments: assignments
        .filter((a) => a.status === "pending")
        .map((a) => ({ title: a.title, deadline: a.deadline })),
    });
    if (data) setPriorityResult(data);
  };

  const handleApplyPriorities = async () => {
    if (!priorityResult?.prioritizedTasks?.length) return;
    setApplyingPriorities(true);
    try {
      const validIds = new Set(tasks.map((t) => t.id));
      for (const item of priorityResult.prioritizedTasks) {
        if (
          validIds.has(item.taskId) &&
          (item.recommendedPriority === "High" ||
            item.recommendedPriority === "Medium" ||
            item.recommendedPriority === "Low")
        ) {
          await updateTaskPriority(item.taskId, item.recommendedPriority);
        }
      }
      showToast("Recommended task priorities applied!", "success");
    } catch {
      showToast("Could not update all task priorities.", "error");
    } finally {
      setApplyingPriorities(false);
    }
  };

  const handleSummarize = async () => {
    const chosenNote = notes.find((n) => n.id === selectedNoteId);
    const titleToSend = chosenNote ? chosenNote.title : customNoteTitle;
    const contentToSend = chosenNote ? stripHtml(chosenNote.content) : customNoteText;
    const subjectToSend = chosenNote ? chosenNote.subjectName : "General";

    const data = await callAiEndpoint<SummarizeResult>("/api/ai/summarize-notes", {
      title: titleToSend,
      subjectName: subjectToSend,
      content: contentToSend,
    });
    if (data) setSummaryResult(data);
  };

  const handleExamPrep = async () => {
    const exam = examinations.find((e) => e.id === selectedExamId) || examinations[0];
    if (!exam) {
      setError("Add at least one examination in Examination Manager first.");
      return;
    }
    const data = await callAiEndpoint<ExamPrepResult>("/api/ai/exam-prep", {
      today,
      dailyHours: examDailyHours,
      exam: {
        subjectName: exam.subjectName,
        examType: exam.examType,
        examDate: exam.examDate,
        examTime: exam.examTime,
        prepStatus: exam.prepStatus,
        syllabus: exam.syllabus,
      },
    });
    if (data) setExamPrepResult(data);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
              AI Study Assistant
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Personalized study plans, recommendations, task prioritization, note summaries, and exam revision grounded in your live academic data.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-1.5 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {(
            [
              { id: "planner", label: "Smart Study Planner", icon: CalendarClock },
              { id: "suggestions", label: "Study Suggestions", icon: Compass },
              { id: "prioritize", label: "Task Prioritization", icon: ListChecks },
              { id: "summarize", label: "Note Summarization", icon: FileText },
              { id: "exam", label: "Exam Prep Plan", icon: Award },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setActiveTab(t.id);
                  setError(null);
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-slate-50"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-300"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* 1. Smart Study Planner */}
      {activeTab === "planner" && (
        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Available Study Hours / Day
              </label>
              <input
                type="number"
                min={1}
                max={12}
                step={0.5}
                value={hoursPerDay}
                onChange={(e) => setHoursPerDay(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Focus Preference
              </label>
              <input
                type="text"
                value={focusPref}
                onChange={(e) => setFocusPref(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Using {subjects.length} subjects, {examinations.length} exams,{" "}
              {assignments.filter((a) => a.status === "pending").length} pending assignments, and{" "}
              {tasks.filter((t) => !t.completed).length} pending tasks.
            </p>
            <button
              type="button"
              onClick={handleGeneratePlan}
              disabled={loading}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "Generating Schedule..." : "Generate 5-Day Study Plan"}
            </button>
          </div>

          {planResult && (
            <div className="space-y-4 border-t border-slate-200 pt-5 dark:border-slate-800">
              {planResult.summary && (
                <p className="text-sm text-slate-700 dark:text-slate-300">{planResult.summary}</p>
              )}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {planResult.days?.map((d, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                  >
                    <h4 className="font-display mb-3 text-sm font-bold text-indigo-600 dark:text-indigo-400">
                      {d.dayLabel}
                    </h4>
                    <div className="space-y-2.5">
                      {d.blocks?.map((b, j) => (
                        <div key={j} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {b.subject}
                            </span>
                            <span className="font-mono text-slate-500 tabular-nums">
                              {b.timeSlot} ({b.durationMinutes}m)
                            </span>
                          </div>
                          <p className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                            {b.topic}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {b.goal}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Study Suggestions */}
      {activeTab === "suggestions" && (
        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-50">
                What Should I Study Next?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Analyzes logged hours vs weekly subject targets, deadlines, and upcoming exams.
              </p>
            </div>
            <button
              type="button"
              onClick={handleGetSuggestions}
              disabled={loading}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "Analyzing Workload..." : "Get Recommendations"}
            </button>
          </div>

          {suggestionsResult && (
            <div className="space-y-3 border-t border-slate-200 pt-5 dark:border-slate-800">
              {suggestionsResult.headline && (
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {suggestionsResult.headline}
                </p>
              )}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {suggestionsResult.suggestions?.map((s, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
                        {s.subject}
                      </span>
                      <span className="font-mono text-xs font-semibold text-indigo-600 tabular-nums dark:text-indigo-400">
                        {s.suggestedMinutes} min · {s.urgency}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-slate-800 dark:text-slate-200">
                      Topic: {s.recommendedTopic}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{s.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Task Prioritization */}
      {activeTab === "prioritize" && (
        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-50">
                Intelligent Task Prioritization
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ranks your {tasks.filter((t) => !t.completed).length} pending tasks by urgency and academic impact.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {priorityResult?.prioritizedTasks?.length ? (
                <button
                  type="button"
                  onClick={handleApplyPriorities}
                  disabled={applyingPriorities}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {applyingPriorities ? "Applying..." : "Apply Priorities"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={handlePrioritizeTasks}
                disabled={loading}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? "Evaluating..." : "Prioritize Pending Tasks"}
              </button>
            </div>
          </div>

          {priorityResult && (
            <div className="space-y-3 border-t border-slate-200 pt-5 dark:border-slate-800">
              {priorityResult.strategyNote && (
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {priorityResult.strategyNote}
                </p>
              )}
              <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {priorityResult.prioritizedTasks?.map((item) => (
                  <div
                    key={item.taskId}
                    className="flex items-start justify-between gap-4 p-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {item.rank}. {item.title}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {item.reason}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                      {item.recommendedPriority}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Study Summarization */}
      {activeTab === "summarize" && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
              Pick Saved Note (or leave blank to paste custom text)
            </label>
            <select
              value={selectedNoteId}
              onChange={(e) => setSelectedNoteId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">Paste custom notes below</option>
              {notes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title} ({n.subjectName || "General"})
                </option>
              ))}
            </select>
          </div>

          {!selectedNoteId && (
            <>
              <input
                type="text"
                value={customNoteTitle}
                onChange={(e) => setCustomNoteTitle(e.target.value)}
                placeholder="Topic / Note Title"
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              <textarea
                rows={6}
                value={customNoteText}
                onChange={(e) => setCustomNoteText(e.target.value)}
                placeholder="Paste your lecture notes or textbook excerpt here..."
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSummarize}
              disabled={loading}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "Summarizing..." : "Summarize Notes"}
            </button>
          </div>

          {summaryResult && (
            <div className="space-y-4 border-t border-slate-200 pt-5 text-sm dark:border-slate-800">
              <div>
                <h4 className="font-display text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  Summary
                </h4>
                <p className="mt-1 text-slate-700 dark:text-slate-300">{summaryResult.tldr}</p>
              </div>
              {summaryResult.keyTakeaways && summaryResult.keyTakeaways.length > 0 && (
                <div>
                  <h4 className="font-display text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    Key Takeaways
                  </h4>
                  <ul className="mt-1.5 list-disc space-y-1 pl-5 text-slate-700 dark:text-slate-300">
                    {summaryResult.keyTakeaways.map((k, i) => (
                      <li key={i}>{k}</li>
                    ))}
                  </ul>
                </div>
              )}
              {summaryResult.keyTerms && summaryResult.keyTerms.length > 0 && (
                <div>
                  <h4 className="font-display text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    Key Concepts
                  </h4>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {summaryResult.keyTerms.map((kt, i) => (
                      <div key={i} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{kt.term}</p>
                        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                          {kt.definition}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {summaryResult.practiceQuestions && summaryResult.practiceQuestions.length > 0 && (
                <div>
                  <h4 className="font-display text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    Active Recall Questions
                  </h4>
                  <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-slate-700 dark:text-slate-300">
                    {summaryResult.practiceQuestions.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 5. Exam Preparation */}
      {activeTab === "exam" && (
        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Select Scheduled Examination
              </label>
              <select
                value={selectedExamId || examinations[0]?.id || ""}
                onChange={(e) => setSelectedExamId(e.target.value)}
                disabled={examinations.length === 0}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {examinations.length === 0 ? (
                  <option value="">No examinations scheduled yet</option>
                ) : (
                  examinations.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.subjectName} ({ex.examType}) — {ex.examDate}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Daily Revision Hours
              </label>
              <input
                type="number"
                min={0.5}
                max={12}
                step={0.5}
                value={examDailyHours}
                onChange={(e) => setExamDailyHours(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleExamPrep}
              disabled={loading || examinations.length === 0}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "Building Revision Plan..." : "Generate Exam Revision Plan"}
            </button>
          </div>

          {examPrepResult && (
            <div className="space-y-4 border-t border-slate-200 pt-5 text-sm dark:border-slate-800">
              {examPrepResult.overview && (
                <p className="text-slate-700 dark:text-slate-300">{examPrepResult.overview}</p>
              )}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {examPrepResult.phases?.map((p, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                  >
                    <p className="font-mono text-xs font-semibold text-cyan-600 dark:text-cyan-400">
                      {p.timeframe}
                    </p>
                    <h4 className="font-display mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-50">
                      {p.phaseTitle}
                    </h4>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-600 dark:text-slate-300">
                      {p.focusTopics?.map((topic, j) => (
                        <li key={j}>{topic}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Method: {p.studyMethod}
                    </p>
                  </div>
                ))}
              </div>
              {examPrepResult.readinessChecklist && examPrepResult.readinessChecklist.length > 0 && (
                <div>
                  <h4 className="font-display text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    Readiness Checklist
                  </h4>
                  <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs text-slate-700 dark:text-slate-300">
                    {examPrepResult.readinessChecklist.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
