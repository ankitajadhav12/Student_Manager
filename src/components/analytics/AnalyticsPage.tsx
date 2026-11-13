import { useMemo } from "react";
import { BarChart3, CheckCircle2, ClipboardCheck, Clock, ListTodo } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useData } from "../../context/DataContext";
import { formatMinutesToHours, getLastNDays, toLocalDateKey } from "../../utils/dateUtils";
import { EmptyState } from "../ui/CommonUI";

const CHART_COLORS = ["#4F46E5", "#7C3AED", "#0891B2", "#059669", "#D97706", "#E11D48"];

export function AnalyticsPage() {
  const { studySessions, tasks, assignments, subjects } = useData();
  const now = new Date();

  const totalStudyMinutes = useMemo(
    () => studySessions.reduce((sum, s) => sum + s.durationMinutes, 0),
    [studySessions]
  );

  const completedTasks = tasks.filter((t) => t.completed).length;
  const pendingTasks = tasks.filter((t) => !t.completed).length;
  const submittedAssignments = assignments.filter((a) => a.status === "submitted").length;
  const assignmentPct =
    assignments.length > 0 ? Math.round((submittedAssignments / assignments.length) * 100) : 0;

  const weeklyData = useMemo(() => {
    return getLastNDays(7, now).map((d) => {
      const mins = studySessions
        .filter((s) => s.date === d.dateKey)
        .reduce((sum, s) => sum + s.durationMinutes, 0);
      return {
        day: d.label,
        hours: Number((mins / 60).toFixed(2)),
      };
    });
  }, [studySessions]);

  const monthlyTrendData = useMemo(() => {
    return getLastNDays(30, now).map((d) => {
      const mins = studySessions
        .filter((s) => s.date === d.dateKey)
        .reduce((sum, s) => sum + s.durationMinutes, 0);
      return {
        date: d.dateKey.slice(5),
        hours: Number((mins / 60).toFixed(2)),
      };
    });
  }, [studySessions]);

  const subjectDistribution = useMemo(() => {
    const map = new Map<string, { name: string; minutes: number; color: string }>();
    const colorMap = new Map(subjects.map((s) => [s.name, s.color]));
    studySessions.forEach((s) => {
      const existing = map.get(s.subjectName) || {
        name: s.subjectName,
        minutes: 0,
        color: colorMap.get(s.subjectName) || CHART_COLORS[map.size % CHART_COLORS.length],
      };
      existing.minutes += s.durationMinutes;
      map.set(s.subjectName, existing);
    });
    return Array.from(map.values()).map((item) => ({
      ...item,
      hours: Number((item.minutes / 60).toFixed(1)),
    }));
  }, [studySessions, subjects]);

  const activity28Days = useMemo(() => {
    const days = getLastNDays(28, now);
    return days.map((d) => {
      const mins = studySessions
        .filter((s) => s.date === d.dateKey)
        .reduce((sum, s) => sum + s.durationMinutes, 0);
      return { ...d, mins };
    });
  }, [studySessions]);

  const hasAnyData =
    studySessions.length > 0 || tasks.length > 0 || assignments.length > 0;

  return (
    <div className="space-y-6">
      {/* KPI Overview */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Total Study Time</span>
            <Clock className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="font-mono mt-2 text-2xl font-bold text-slate-900 tabular-nums dark:text-slate-50">
            {formatMinutesToHours(totalStudyMinutes)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Across {studySessions.length} logged sessions
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Tasks Completed</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="font-mono mt-2 text-2xl font-bold text-slate-900 tabular-nums dark:text-slate-50">
            {completedTasks}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {tasks.length > 0
              ? `${Math.round((completedTasks / tasks.length) * 100)}% completion rate`
              : "No tasks created yet"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Pending Tasks</span>
            <ListTodo className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="font-mono mt-2 text-2xl font-bold text-slate-900 tabular-nums dark:text-slate-50">
            {pendingTasks}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {tasks.filter((t) => !t.completed && t.priority === "High").length} high priority
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Assignment Completion</span>
            <ClipboardCheck className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
          </div>
          <p className="font-mono mt-2 text-2xl font-bold text-slate-900 tabular-nums dark:text-slate-50">
            {assignmentPct}%
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {submittedAssignments} of {assignments.length} submitted
          </p>
        </div>
      </section>

      {!hasAnyData ? (
        <EmptyState
          icon={<BarChart3 className="h-5 w-5" />}
          title="No analytics data yet"
          description="Log study sessions, complete tasks, and submit assignments to visualize your real productivity trends."
        />
      ) : (
        <>
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Weekly Productivity */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-50">
                Weekly Productivity (Hours Studied)
              </h3>
              <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
                Daily breakdown over the last 7 days
              </p>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" unit="h" />
                    <Tooltip formatter={(val) => [`${val} hrs`, "Studied"]} />
                    <Bar dataKey="hours" fill="#4F46E5" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Monthly Trend */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-50">
                30-Day Study Trend
              </h3>
              <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
                Consistency curve over the past month
              </p>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" minTickGap={20} />
                    <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" unit="h" />
                    <Tooltip formatter={(val) => [`${val} hrs`, "Studied"]} />
                    <Area
                      type="monotone"
                      dataKey="hours"
                      stroke="#0891B2"
                      fill="#0891B2"
                      fillOpacity={0.18}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Subject-Wise Study Distribution */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-6 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-50">
                Subject-Wise Study Distribution
              </h3>
              <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
                Share of total study time per subject
              </p>

              {subjectDistribution.length === 0 ? (
                <p className="py-16 text-center text-sm text-slate-500">
                  Log study sessions to view subject distribution.
                </p>
              ) : (
                <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={subjectDistribution}
                          dataKey="minutes"
                          nameKey="name"
                          innerRadius={45}
                          outerRadius={78}
                          paddingAngle={3}
                        >
                          {subjectDistribution.map((entry, idx) => (
                            <Cell key={idx} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(val) => [formatMinutesToHours(Number(val)), "Logged"]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-2.5">
                    {subjectDistribution.map((s) => (
                      <div key={s.name} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 truncate text-slate-700 dark:text-slate-300">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: s.color }}
                          />
                          <span className="truncate">{s.name}</span>
                        </span>
                        <span className="font-mono font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                          {formatMinutesToHours(s.minutes)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 28-Day Daily Study Activity */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-6 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-50">
                Daily Study Activity (28 Days)
              </h3>
              <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
                Each cell represents total study minutes logged on that day
              </p>

              <div className="grid grid-cols-7 gap-2">
                {activity28Days.map((day) => {
                  const intensity =
                    day.mins === 0
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-400"
                      : day.mins < 45
                        ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                        : day.mins < 120
                          ? "bg-indigo-300 text-indigo-950 dark:bg-indigo-800 dark:text-indigo-100"
                          : "bg-indigo-600 text-white";
                  const isToday = day.dateKey === toLocalDateKey(now);

                  return (
                    <div
                      key={day.dateKey}
                      title={`${day.dateKey}: ${formatMinutesToHours(day.mins)}`}
                      className={`flex h-12 flex-col items-center justify-center rounded-lg font-mono text-[11px] tabular-nums ${intensity} ${
                        isToday ? "ring-2 ring-cyan-500" : ""
                      }`}
                    >
                      <span className="text-[10px] opacity-80">{day.dateKey.slice(8)}</span>
                      <span className="font-semibold">
                        {day.mins > 0 ? `${day.mins}m` : "–"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
