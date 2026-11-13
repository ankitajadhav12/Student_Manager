import { useMemo } from "react";
import {
  ArrowRight,
  Award,
  BookOpen,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Circle,
  ClipboardList,
  Clock,
  Plus,
  Sparkles,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { useToast } from "../../context/ToastContext";
import { toggleTaskComplete } from "../../services/firestoreService";
import type { AppRoute } from "../../types";
import {
  formatDisplayDate,
  formatMinutesToHours,
  formatShortDate,
  formatTime12h,
  getDaysRemaining,
  getGreeting,
  getHoursUntilDeadline,
  getLastNDays,
  getLectureStatus,
  getTodayDayName,
  toLocalDateKey,
} from "../../utils/dateUtils";
import { EmptyState, PriorityLabel, SkeletonRows } from "../ui/CommonUI";

export function DashboardPage({
  onNavigate,
  onOpenNewTask,
}: {
  onNavigate: (r: AppRoute) => void;
  onOpenNewTask: () => void;
}) {
  const { profile } = useAuth();
  const {
    subjects,
    tasks,
    assignments,
    timetable,
    studySessions,
    examinations,
    events,
    loading,
  } = useData();
  const { showToast } = useToast();

  const now = new Date();
  const todayKey = toLocalDateKey(now);
  const todayDay = getTodayDayName(now);
  const firstName = profile?.fullName?.split(" ")[0] || "Student";

  const todaysTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.dueDate === todayKey || (!t.completed && !t.dueDate))
        .sort((a, b) => Number(a.completed) - Number(b.completed)),
    [tasks, todayKey]
  );

  const completedTasksToday = tasks.filter((t) => t.dueDate === todayKey && t.completed).length;
  const totalTasksToday = tasks.filter((t) => t.dueDate === todayKey).length;
  const totalCompletedTasks = tasks.filter((t) => t.completed).length;
  const remainingTasks = tasks.filter((t) => !t.completed).length;

  const pendingAssignments = useMemo(
    () =>
      assignments
        .filter((a) => a.status === "pending")
        .sort((a, b) => a.deadline.localeCompare(b.deadline)),
    [assignments]
  );

  const upcomingExams = useMemo(
    () =>
      examinations
        .filter((e) => getDaysRemaining(e.examDate, now) >= 0)
        .sort((a, b) => a.examDate.localeCompare(b.examDate)),
    [examinations]
  );

  const todaysSchedule = useMemo(
    () =>
      timetable
        .filter((item) => item.day === todayDay)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [timetable, todayDay]
  );

  const last7Days = useMemo(() => getLastNDays(7, now), []);
  const weeklyChartData = useMemo(() => {
    return last7Days.map((day) => {
      const mins = studySessions
        .filter((s) => s.date === day.dateKey)
        .reduce((sum, s) => sum + s.durationMinutes, 0);
      return {
        day: day.label,
        hours: Number((mins / 60).toFixed(2)),
        minutes: mins,
      };
    });
  }, [last7Days, studySessions]);

  const weeklyMinutes = weeklyChartData.reduce((sum, d) => sum + d.minutes, 0);
  const todayStudyMinutes = studySessions
    .filter((s) => s.date === todayKey)
    .reduce((sum, s) => sum + s.durationMinutes, 0);

  const upcomingDeadlines = useMemo(() => {
    const items: { id: string; title: string; subtitle: string; date: string; route: AppRoute; urgent: boolean }[] = [];
    pendingAssignments.slice(0, 4).forEach((a) => {
      const hrs = getHoursUntilDeadline(a.deadline, now);
      items.push({
        id: `a_${a.id}`,
        title: a.title,
        subtitle: `${a.subjectName} · Assignment`,
        date: formatDisplayDate(a.deadline),
        route: "assignments",
        urgent: hrs <= 24,
      });
    });
    events
      .filter((ev) => getDaysRemaining(ev.date, now) >= 0)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 3)
      .forEach((ev) => {
        items.push({
          id: `e_${ev.id}`,
          title: ev.title,
          subtitle: ev.category,
          date: formatDisplayDate(ev.date),
          route: "events",
          urgent: getDaysRemaining(ev.date, now) === 0,
        });
      });
    return items.slice(0, 5);
  }, [pendingAssignments, events]);

  const handleToggleTask = async (id: string, current: boolean) => {
    try {
      await toggleTaskComplete(id, !current);
    } catch {
      showToast("Failed to update task status.", "error");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
        <SkeletonRows rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Greeting & Student Overview Header */}
      <section className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 md:flex-row md:items-center dark:border-slate-800 dark:bg-slate-900">
        <div>
          <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
            {formatShortDate(now)}
          </p>
          <h2 className="font-display mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            {getGreeting(now)}, {firstName}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {[profile?.college, profile?.degree, profile?.branch, profile?.semester]
              .filter(Boolean)
              .join(" · ") || "Complete your academic profile in Settings"}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenNewTask}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-700 whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            New Task
          </button>
          <button
            type="button"
            onClick={() => onNavigate("study-planner")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <BookOpen className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
            Log Study
          </button>
          <button
            type="button"
            onClick={() => onNavigate("assignments")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <ClipboardList className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
            Assignments
          </button>
          <button
            type="button"
            onClick={() => onNavigate("ai-assistant")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            AI Study Plan
          </button>
        </div>
      </section>

      {/* 4-Column KPI Summary Strip */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Daily Task Overview</span>
            <CheckCircle2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="font-mono mt-2 text-2xl font-bold text-slate-900 tabular-nums dark:text-slate-50">
            {totalCompletedTasks} <span className="text-sm font-normal text-slate-400">done</span> ·{" "}
            {remainingTasks} <span className="text-sm font-normal text-slate-400">left</span>
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Today: {completedTasksToday}/{totalTasksToday} completed
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Pending Assignments</span>
            <ClipboardList className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="font-mono mt-2 text-2xl font-bold text-slate-900 tabular-nums dark:text-slate-50">
            {pendingAssignments.length}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {pendingAssignments.filter((a) => getHoursUntilDeadline(a.deadline, now) <= 24).length} due within 24 hours
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Study Hours (7 Days)</span>
            <Clock className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <p className="font-mono mt-2 text-2xl font-bold text-slate-900 tabular-nums dark:text-slate-50">
            {formatMinutesToHours(weeklyMinutes)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Today: {formatMinutesToHours(todayStudyMinutes)} logged
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Next Examination</span>
            <Award className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
          </div>
          {upcomingExams[0] ? (
            <>
              <p className="font-mono mt-2 text-2xl font-bold text-slate-900 tabular-nums dark:text-slate-50">
                {getDaysRemaining(upcomingExams[0].examDate, now) === 0
                  ? "Today"
                  : `${getDaysRemaining(upcomingExams[0].examDate, now)}d left`}
              </p>
              <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                {upcomingExams[0].subjectName} · {upcomingExams[0].examType}
              </p>
            </>
          ) : (
            <>
              <p className="font-mono mt-2 text-2xl font-bold text-slate-900 dark:text-slate-50">
                None
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                No upcoming exams scheduled
              </p>
            </>
          )}
        </div>
      </section>

      {/* Primary Workspace Grid: Today's Tasks & Timetable + Weekly Productivity Chart */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Today's Tasks */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-50">
                Today&apos;s Tasks
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tasks scheduled for today or without a fixed date
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("tasks")}
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {todaysTasks.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-5 w-5" />}
              title="No tasks due today"
              description="Create a task to track coursework, projects, or personal reminders."
              actionLabel="Add Task"
              onAction={onOpenNewTask}
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {todaysTasks.slice(0, 6).map((task) => (
                <div key={task.id} className="flex items-center justify-between gap-3 py-3">
                  <button
                    type="button"
                    onClick={() => handleToggleTask(task.id, task.completed)}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  >
                    {task.completed ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    )}
                    <div className="min-w-0">
                      <p
                        className={`truncate text-sm font-medium ${
                          task.completed
                            ? "text-slate-400 line-through dark:text-slate-500"
                            : "text-slate-900 dark:text-slate-100"
                        }`}
                      >
                        {task.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {task.category}
                        {task.dueDate ? ` · ${formatDisplayDate(task.dueDate)}` : ""}
                      </p>
                    </div>
                  </button>
                  <PriorityLabel priority={task.priority} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Today's Timetable */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-50">
                Today&apos;s Timetable ({todayDay})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Current and upcoming lectures highlighted automatically
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("timetable")}
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Full week <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {todaysSchedule.length === 0 ? (
            <EmptyState
              icon={<CalendarClock className="h-5 w-5" />}
              title={todayDay === "Sunday" ? "Sunday — No classes scheduled" : "No timetable entries for today"}
              description="Add your college lectures and break slots in Timetable Management."
              actionLabel="Manage Timetable"
              onAction={() => onNavigate("timetable")}
            />
          ) : (
            <div className="space-y-2.5">
              {todaysSchedule.map((entry) => {
                const status = getLectureStatus(entry, now);
                return (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                      status === "current"
                        ? "border-indigo-300 bg-indigo-50/70 dark:border-indigo-700 dark:bg-indigo-950/40"
                        : status === "upcoming"
                          ? "border-cyan-200 bg-cyan-50/40 dark:border-cyan-900/50 dark:bg-cyan-950/20"
                          : "border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/30"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {entry.entryType === "break" ? `Break · ${entry.subjectName}` : entry.subjectName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {entry.entryType === "lecture"
                          ? [entry.facultyName, entry.classroom].filter(Boolean).join(" · ") || "Lecture"
                          : "Break period"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-xs font-medium text-slate-800 tabular-nums dark:text-slate-200">
                        {formatTime12h(entry.startTime)} – {formatTime12h(entry.endTime)}
                      </p>
                      <p className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                        {status === "current"
                          ? "In progress"
                          : status === "upcoming"
                            ? "Upcoming"
                            : "Completed"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Weekly Productivity Chart & Subject Progress */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-50">
                Weekly Study Hours
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Logged study duration across the past 7 days
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("analytics")}
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Analytics <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" unit="h" />
                <Tooltip
                  formatter={(value) => [`${value} hrs`, "Studied"]}
                  contentStyle={{
                    borderRadius: "10px",
                    border: "1px solid rgba(148,163,184,0.25)",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="hours" fill="#4F46E5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Subject-Wise Progress */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-50">
                Subject Progress
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Syllabus topics completed per subject
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("study-planner")}
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Planner <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {subjects.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="h-5 w-5" />}
              title="No subjects added yet"
              description="Add your semester subjects to track weekly study hours and topic mastery."
              actionLabel="Add Subject"
              onAction={() => onNavigate("study-planner")}
            />
          ) : (
            <div className="space-y-4">
              {subjects.slice(0, 5).map((sub) => {
                const pct =
                  sub.totalTopics > 0
                    ? Math.min(100, Math.round((sub.completedTopics / sub.totalTopics) * 100))
                    : 0;
                return (
                  <div key={sub.id}>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {sub.name}
                        {sub.code ? ` (${sub.code})` : ""}
                      </span>
                      <span className="font-mono text-slate-500 tabular-nums dark:text-slate-400">
                        {sub.completedTopics}/{sub.totalTopics} topics · {pct}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: sub.color || "#4F46E5" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Upcoming Deadlines & Upcoming Examinations */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-50">
              Upcoming Deadlines
            </h3>
            <button
              type="button"
              onClick={() => onNavigate("assignments")}
              className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Manage
            </button>
          </div>
          {upcomingDeadlines.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              No pending assignments or upcoming event deadlines.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {upcomingDeadlines.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.route)}
                  className="flex w-full items-center justify-between gap-3 py-3 text-left transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      {item.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{item.subtitle}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span
                      className={`font-mono text-xs font-medium tabular-nums ${
                        item.urgent
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {item.date}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-50">
              Upcoming Examinations
            </h3>
            <button
              type="button"
              onClick={() => onNavigate("exams")}
              className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Exam Planner
            </button>
          </div>
          {upcomingExams.length === 0 ? (
            <EmptyState
              icon={<Calendar className="h-5 w-5" />}
              title="No exams scheduled"
              description="Add mid-terms, finals, or quizzes to track countdowns and revision readiness."
              actionLabel="Add Exam"
              onAction={() => onNavigate("exams")}
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {upcomingExams.slice(0, 5).map((exam) => {
                const daysLeft = getDaysRemaining(exam.examDate, now);
                return (
                  <div key={exam.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {exam.subjectName} · {exam.examType}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDisplayDate(exam.examDate)} at {formatTime12h(exam.examTime)} · {exam.prepStatus}
                      </p>
                    </div>
                    <span
                      className={`font-mono shrink-0 text-xs font-semibold tabular-nums ${
                        daysLeft <= 3
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-indigo-600 dark:text-indigo-400"
                      }`}
                    >
                      {daysLeft === 0 ? "Today" : `${daysLeft}d`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
