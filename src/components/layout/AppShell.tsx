import { useState, type ReactNode } from "react";
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  CalendarClock,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Menu,
  Moon,
  Plus,
  Settings,
  Sparkles,
  Sun,
  User,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { useTheme } from "../../context/ThemeContext";
import { markNotificationRead } from "../../services/firestoreService";
import type { AppRoute } from "../../types";

interface NavItem {
  id: AppRoute;
  label: string;
  icon: typeof LayoutDashboard;
  group: "core" | "academics" | "insights" | "account";
}

export const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "core" },
  { id: "tasks", label: "My Tasks", icon: CheckSquare, group: "core" },
  { id: "study-planner", label: "Study Planner", icon: BookOpen, group: "academics" },
  { id: "timetable", label: "Timetable", icon: CalendarClock, group: "academics" },
  { id: "assignments", label: "Assignments", icon: ClipboardList, group: "academics" },
  { id: "notes", label: "Notes", icon: FileText, group: "academics" },
  { id: "exams", label: "Examinations", icon: Award, group: "academics" },
  { id: "events", label: "Calendar & Events", icon: Calendar, group: "core" },
  { id: "analytics", label: "Analytics", icon: BarChart3, group: "insights" },
  { id: "ai-assistant", label: "AI Study Assistant", icon: Sparkles, group: "insights" },
  { id: "profile", label: "Profile", icon: User, group: "account" },
  { id: "settings", label: "Settings", icon: Settings, group: "account" },
];

export function AppShell({
  route,
  onNavigate,
  onQuickNewTask,
  children,
}: {
  route: AppRoute;
  onNavigate: (r: AppRoute) => void;
  onQuickNewTask: () => void;
  children: ReactNode;
}) {
  const { profile } = useAuth();
  const { derivedAlerts, notifications } = useData();
  const { resolvedTheme, toggleTheme } = useTheme();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const unreadCount =
    derivedAlerts.length + notifications.filter((n) => !n.read).length;

  const currentNav = NAV_ITEMS.find((n) => n.id === route) || NAV_ITEMS[0];

  const handleNavClick = (id: AppRoute) => {
    onNavigate(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Desktop Collapsible Sidebar */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 lg:flex dark:border-slate-800 dark:bg-slate-900 ${
          collapsed ? "w-[72px]" : "w-[256px]"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
          <button
            type="button"
            onClick={() => onNavigate("dashboard")}
            className="flex items-center gap-2.5 overflow-hidden text-left"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <GraduationCap className="h-4 w-4" />
            </div>
            {!collapsed && (
              <span className="font-display truncate text-sm font-bold tracking-tight text-slate-900 whitespace-nowrap dark:text-slate-50">
                Student Life Manager
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = route === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                title={collapsed ? item.label : undefined}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? "text-indigo-600 dark:text-indigo-400" : ""}`} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          <button
            type="button"
            onClick={() => onNavigate("profile")}
            className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {profile?.profileImage ? (
              <img
                src={profile.profileImage}
                alt={profile.fullName}
                referrerPolicy="no-referrer"
                className="h-8 w-8 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                {(profile?.fullName || "S").slice(0, 2).toUpperCase()}
              </div>
            )}
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {profile?.fullName || "Student"}
                </p>
                <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {profile?.semester || "Academic Workspace"}
                </p>
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col pb-16 lg:pb-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-xs sm:h-16 sm:px-6 dark:border-slate-800 dark:bg-slate-900/95">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm">
              <span className="hidden text-slate-400 sm:inline dark:text-slate-500">
                Student Life Manager
              </span>
              <span className="hidden text-slate-300 sm:inline dark:text-slate-700">/</span>
              <h1 className="font-display truncate text-base font-semibold text-slate-900 dark:text-slate-50">
                {currentNav.label}
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
              className="rounded-lg border border-slate-200 p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                aria-label="Notifications"
                className="relative rounded-lg border border-slate-200 p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 font-mono text-[10px] font-semibold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setNotifOpen(false)}
                  />
                  <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-50">
                        Reminders & Alerts
                      </h3>
                      <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                        {unreadCount} active
                      </span>
                    </div>
                    {unreadCount === 0 ? (
                      <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                        All caught up. No urgent deadlines or alerts right now.
                      </p>
                    ) : (
                      <div className="max-h-72 space-y-2.5 overflow-y-auto">
                        {derivedAlerts.map((alert) => (
                          <button
                            key={alert.id}
                            type="button"
                            onClick={() => {
                              setNotifOpen(false);
                              onNavigate(
                                alert.type === "assignment"
                                  ? "assignments"
                                  : alert.type === "exam"
                                    ? "exams"
                                    : "events"
                              );
                            }}
                            className="w-full rounded-lg border border-slate-200 p-2.5 text-left transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
                          >
                            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                              {alert.title}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              {alert.message}
                            </p>
                          </button>
                        ))}
                        {notifications
                          .filter((n) => !n.read)
                          .map((n) => (
                            <div
                              key={n.id}
                              className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 p-2.5 dark:border-slate-800"
                            >
                              <div>
                                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                                  {n.title}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                  {n.message}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => markNotificationRead(n.id)}
                                className="text-[11px] font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                              >
                                Read
                              </button>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={onQuickNewTask}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-700 whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Add Task</span>
              <span className="sm:hidden">Task</span>
            </button>
          </div>
        </header>

        {/* Workspace Viewport */}
        <main className="mx-auto w-full max-w-[1380px] flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>

      {/* Mobile Full Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 flex w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white">
                  <GraduationCap className="h-4 w-4" />
                </div>
                <span className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
                  Student Life Manager
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="rounded-lg p-1 text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = route === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Mobile navigation"
        className="fixed right-0 bottom-0 left-0 z-30 flex h-14 items-center justify-around border-t border-slate-200 bg-white px-2 lg:hidden dark:border-slate-800 dark:bg-slate-900"
      >
        {(
          [
            { id: "dashboard", label: "Home", icon: LayoutDashboard },
            { id: "tasks", label: "Tasks", icon: CheckSquare },
            { id: "study-planner", label: "Study", icon: BookOpen },
            { id: "timetable", label: "Schedule", icon: CalendarClock },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = route === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleNavClick(tab.id)}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 text-[11px] font-medium ${
                active
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 px-3 py-1 text-[11px] font-medium text-slate-500 dark:text-slate-400"
        >
          <Menu className="h-4 w-4" />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}
