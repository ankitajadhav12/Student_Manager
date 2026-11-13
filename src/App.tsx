import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AiAssistantPage } from "./components/ai/AiAssistantPage";
import { AnalyticsPage } from "./components/analytics/AnalyticsPage";
import { AssignmentsPage } from "./components/assignments/AssignmentsPage";
import { AuthScreen } from "./components/auth/AuthScreen";
import { DashboardPage } from "./components/dashboard/DashboardPage";
import { EventsPage } from "./components/events/EventsPage";
import { ExamsPage } from "./components/exams/ExamsPage";
import { AppShell } from "./components/layout/AppShell";
import { NotesPage } from "./components/notes/NotesPage";
import { ProfilePage } from "./components/profile/ProfilePage";
import { SettingsPage } from "./components/settings/SettingsPage";
import { StudyPlannerPage } from "./components/study/StudyPlannerPage";
import { TaskFormModal, TasksPage } from "./components/tasks/TasksPage";
import { TimetablePage } from "./components/timetable/TimetablePage";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { DataProvider, useData } from "./context/DataContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import type { AppRoute } from "./types";

function WorkspaceRouter() {
  const { user, profile, authReady, profileLoading, pendingProfileSetup } = useAuth();
  const { dataError } = useData();
  const [route, setRoute] = useState<AppRoute>("dashboard");
  const [quickTaskOpen, setQuickTaskOpen] = useState(false);

  if (!authReady || (user && profileLoading && !pendingProfileSetup)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Loading Student Life Manager...
          </p>
        </div>
      </div>
    );
  }

  if (!user || !user.emailVerified || pendingProfileSetup || !profile) {
    return <AuthScreen />;
  }

  const renderPage = () => {
    switch (route) {
      case "dashboard":
        return (
          <DashboardPage
            onNavigate={setRoute}
            onOpenNewTask={() => setQuickTaskOpen(true)}
          />
        );
      case "tasks":
        return <TasksPage />;
      case "study-planner":
        return <StudyPlannerPage />;
      case "timetable":
        return <TimetablePage />;
      case "assignments":
        return <AssignmentsPage />;
      case "notes":
        return <NotesPage />;
      case "exams":
        return <ExamsPage />;
      case "events":
        return <EventsPage />;
      case "analytics":
        return <AnalyticsPage />;
      case "ai-assistant":
        return <AiAssistantPage />;
      case "profile":
        return <ProfilePage />;
      case "settings":
        return <SettingsPage />;
    }
  };

  return (
    <AppShell
      route={route}
      onNavigate={setRoute}
      onQuickNewTask={() => setQuickTaskOpen(true)}
    >
      {dataError && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
          Sync warning: {dataError}
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={route}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        >
          {renderPage()}
        </motion.div>
      </AnimatePresence>

      <TaskFormModal
        open={quickTaskOpen}
        onClose={() => setQuickTaskOpen(false)}
      />
    </AppShell>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <DataProvider>
            <WorkspaceRouter />
          </DataProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
