import type { DayOfWeek, TimetableEntry } from "../types";

export function getGreeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function toLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "No date";
  const parsed = dateStr.includes("T") ? new Date(dateStr) : new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatShortDate(date: Date = new Date()): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function getTodayDayName(now: Date = new Date()): DayOfWeek | "Sunday" {
  const idx = now.getDay();
  const map: Record<number, DayOfWeek | "Sunday"> = {
    0: "Sunday",
    1: "Monday",
    2: "Tuesday",
    3: "Wednesday",
    4: "Thursday",
    5: "Friday",
    6: "Saturday",
  };
  return map[idx];
}

export function timeToMinutes(hhmm: string): number {
  const [h, m] = (hhmm || "00:00").split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

export function formatMinutesToHours(minutes: number): string {
  if (!minutes || minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function getLectureStatus(
  entry: TimetableEntry,
  now: Date = new Date()
): "current" | "upcoming" | "completed" | "other" {
  const todayName = getTodayDayName(now);
  if (entry.day !== todayName) return "other";

  const currentMin = now.getHours() * 60 + now.getMinutes();
  const start = timeToMinutes(entry.startTime);
  const end = timeToMinutes(entry.endTime);

  if (currentMin >= start && currentMin < end) return "current";
  if (currentMin < start) return "upcoming";
  return "completed";
}

export function getDaysRemaining(targetDateStr: string, now: Date = new Date()): number {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = targetDateStr.includes("T")
    ? new Date(targetDateStr)
    : new Date(`${targetDateStr}T00:00:00`);
  const targetStart = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  return Math.round((targetStart - todayStart) / (1000 * 60 * 60 * 24));
}

export function getHoursUntilDeadline(deadlineStr: string, now: Date = new Date()): number {
  const target = new Date(deadlineStr);
  if (Number.isNaN(target.getTime())) return 9999;
  return (target.getTime() - now.getTime()) / (1000 * 60 * 60);
}

export function getLastNDays(n: number, now: Date = new Date()): { dateKey: string; label: string }[] {
  const result: { dateKey: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    result.push({
      dateKey: toLocalDateKey(d),
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
    });
  }
  return result;
}

export function getWeekStartDateKey(now: Date = new Date()): string {
  const d = new Date(now);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return toLocalDateKey(d);
}

export function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatTime12h(hhmm: string): string {
  if (!hhmm || !hhmm.includes(":")) return hhmm;
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr} ${suffix}`;
}
