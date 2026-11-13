import { useEffect, useState, type FormEvent } from "react";
import { Bell, Lock, LogOut, Monitor, Moon, Sun, Trash2 } from "lucide-react";
import { formatAuthError, useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useToast } from "../../context/ToastContext";
import { requestNotificationPermission } from "../../services/firebase";
import { DEFAULT_NOTIFICATION_PREFS, updateUserPreferences } from "../../services/firestoreService";
import type { NotificationPrefs, ThemePreference } from "../../types";
import { Modal } from "../ui/CommonUI";

export function SettingsPage() {
  const { user, profile, changePassword, logout, deleteAccount } = useAuth();
  const { preference, setThemePreference } = useTheme();
  const { showToast } = useToast();

  const [prefs, setPrefs] = useState<NotificationPrefs>(
    profile?.notificationPrefs || DEFAULT_NOTIFICATION_PREFS
  );

  // Password Change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  // Delete Account Modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  const isPasswordProvider = Boolean(
    user?.providerData?.some((p) => p.providerId === "password")
  );

  useEffect(() => {
    if (profile?.notificationPrefs) {
      setPrefs(profile.notificationPrefs);
    }
  }, [profile]);

  const handleThemeChange = async (nextTheme: ThemePreference) => {
    setThemePreference(nextTheme);
    if (user) {
      try {
        await updateUserPreferences(user.uid, nextTheme, prefs);
      } catch {
        showToast("Theme updated locally.", "info");
      }
    }
  };

  const handlePrefToggle = async (key: keyof NotificationPrefs) => {
    let nextValue = !prefs[key];
    if (key === "browserPushEnabled" && nextValue) {
      const res = await requestNotificationPermission();
      if (!res.granted) {
        nextValue = false;
        showToast("Browser notification permission not granted. Using in-app alerts.", "info");
      }
    }
    const updated = { ...prefs, [key]: nextValue };
    setPrefs(updated);
    if (user) {
      try {
        await updateUserPreferences(user.uid, preference, updated);
        showToast("Notification preference saved.", "success");
      } catch {
        showToast("Could not save preference.", "error");
      }
    }
  };

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showToast("New password must be at least 6 characters.", "error");
      return;
    }
    setPwBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      showToast("Password updated successfully.", "success");
    } catch (err) {
      showToast(formatAuthError(err), "error");
    } finally {
      setPwBusy(false);
    }
  };

  const handleConfirmDeleteAccount = async (e: FormEvent) => {
    e.preventDefault();
    setDeleteBusy(true);
    try {
      await deleteAccount(isPasswordProvider ? deletePassword : undefined);
      showToast("Account and all data permanently deleted.", "info");
    } catch (err) {
      showToast(formatAuthError(err), "error");
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Appearance */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
          Appearance
        </h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Choose how Student Life Manager renders across your workspace.
        </p>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {(
            [
              { id: "light", label: "Light", icon: Sun },
              { id: "dark", label: "Dark", icon: Moon },
              { id: "system", label: "System", icon: Monitor },
            ] as const
          ).map((opt) => {
            const Icon = opt.icon;
            const active = preference === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleThemeChange(opt.id)}
                className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                  active
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                    : "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <Icon className="h-4 w-4" />
                {opt.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Notification Preferences */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
            Notification Preferences
          </h2>
        </div>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Control which reminders appear in your alert center and browser notifications.
        </p>

        <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
          {(
            [
              {
                key: "assignments24h",
                title: "24-Hour Assignment Deadline Alerts",
                desc: "Highlight pending assignments due within 24 hours.",
              },
              {
                key: "examReminders",
                title: "Upcoming Examination Reminders",
                desc: "Alert 7 days ahead of scheduled mid-terms, finals, and quizzes.",
              },
              {
                key: "studyTargetAlerts",
                title: "Study Target Progress",
                desc: "Surface study target reminders on your dashboard.",
              },
              {
                key: "eventReminders",
                title: "Calendar Event Reminders",
                desc: "Show reminders for college events and deadlines marked active.",
              },
              {
                key: "browserPushEnabled",
                title: "Browser Push Notifications",
                desc: "Allow native browser alerts where supported by your device.",
              },
            ] as const
          ).map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-4 py-3.5">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {item.title}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{item.desc}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={prefs[item.key]}
                onClick={() => handlePrefToggle(item.key)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  prefs[item.key] ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-700"
                }`}
              >
                <span
                  className={`block h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${
                    prefs[item.key] ? "translate-x-5.5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Change Password */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
            Security & Password
          </h2>
        </div>

        {isPasswordProvider ? (
          <form onSubmit={handlePasswordChange} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={pwBusy}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {pwBusy ? "Updating..." : "Update Password"}
            </button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
            Your account uses Google Sign-In ({user?.email}). Password management is handled through your Google Account.
          </p>
        )}
      </section>

      {/* Account Actions */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
          Account Session & Deletion
        </h2>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4" />
            Log Out
          </button>

          <button
            type="button"
            onClick={() => setDeleteModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
          >
            <Trash2 className="h-4 w-4" />
            Delete Account
          </button>
        </div>
      </section>

      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Account Permanently"
        subtitle="This will erase your profile, tasks, assignments, notes, timetable, study sessions, and exams."
      >
        <form onSubmit={handleConfirmDeleteAccount} className="space-y-4">
          {isPasswordProvider ? (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Enter your current password to confirm
              </label>
              <input
                type="password"
                required
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              You will be asked to re-confirm via Google Sign-In before permanent account deletion.
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setDeleteModalOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium dark:border-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={deleteBusy}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {deleteBusy ? "Deleting..." : "Permanently Delete"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
