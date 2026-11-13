import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Bold,
  Code,
  FileText,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Pin,
  PinOff,
  Plus,
  Quote,
  Search,
  Sparkles,
  Trash2,
  Underline,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { useToast } from "../../context/ToastContext";
import {
  createNote,
  deleteNote,
  setNoteArchiveState,
  toggleNotePinned,
  updateNote,
} from "../../services/firestoreService";
import type { Note } from "../../types";
import { stripHtml } from "../../utils/dateUtils";
import { ConfirmModal, EmptyState, Modal } from "../ui/CommonUI";

function sanitizeNoteHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/on\w+='[^']*'/gi, "");
}

export function NotesPage() {
  const { user } = useAuth();
  const { notes, subjects } = useData();
  const { showToast } = useToast();

  const [tab, setTab] = useState<"active" | "archived">("active");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Editor state
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<HTMLDivElement | null>(null);

  // Delete & AI summary
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<{
    tldr?: string;
    keyTakeaways?: string[];
    practiceQuestions?: string[];
  } | null>(null);

  const filteredNotes = useMemo(() => {
    return notes
      .filter((n) => (tab === "archived" ? n.archived : !n.archived))
      .filter((n) => (subjectFilter === "all" ? true : n.subjectId === subjectFilter))
      .filter((n) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          n.title.toLowerCase().includes(q) ||
          stripHtml(n.content).toLowerCase().includes(q) ||
          n.subjectName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => Number(b.pinned) - Number(a.pinned));
  }, [notes, tab, subjectFilter, search]);

  const loadNoteIntoEditor = (note: Note) => {
    setIsCreating(false);
    setSelectedNote(note);
    setTitle(note.title);
    setSubjectId(note.subjectId);
    setSubjectName(note.subjectName);
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = sanitizeNoteHtml(note.content);
      }
    }, 0);
  };

  const startNewNote = () => {
    setSelectedNote(null);
    setIsCreating(true);
    setTitle("");
    setSubjectId(subjects[0]?.id || "");
    setSubjectName(subjects[0]?.name || "General");
    setTimeout(() => {
      if (editorRef.current) editorRef.current.innerHTML = "";
    }, 0);
  };

  useEffect(() => {
    if (!selectedNote && !isCreating && filteredNotes.length > 0) {
      loadNoteIntoEditor(filteredNotes[0]);
    }
  }, [filteredNotes.length]);

  const execFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const handleSave = async () => {
    if (!user) return;
    if (!title.trim()) {
      showToast("Please enter a note title.", "error");
      return;
    }
    const rawHtml = editorRef.current?.innerHTML || "";
    const cleanHtml = sanitizeNoteHtml(rawHtml);
    const chosenSubject = subjects.find((s) => s.id === subjectId);
    const resolvedSubjectName = chosenSubject?.name || subjectName || "General";

    setSaving(true);
    try {
      if (selectedNote && !isCreating) {
        await updateNote(selectedNote.id, {
          subjectId,
          subjectName: resolvedSubjectName,
          title: title.trim(),
          content: cleanHtml,
          pinned: selectedNote.pinned,
          archived: selectedNote.archived,
        });
        showToast("Note saved.", "success");
      } else {
        const newId = await createNote(user.uid, {
          subjectId,
          subjectName: resolvedSubjectName,
          title: title.trim(),
          content: cleanHtml,
          pinned: false,
          archived: false,
        });
        setIsCreating(false);
        setSelectedNote({
          id: newId,
          userId: user.uid,
          subjectId,
          subjectName: resolvedSubjectName,
          title: title.trim(),
          content: cleanHtml,
          pinned: false,
          archived: false,
        });
        showToast("Note created.", "success");
      }
    } catch {
      showToast("Failed to save note.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSummarizeNote = async () => {
    const body = stripHtml(editorRef.current?.innerHTML || "");
    if (body.length < 15) {
      showToast("Write at least a couple of sentences before summarizing.", "info");
      return;
    }
    setAiModalOpen(true);
    setAiLoading(true);
    setAiSummary(null);
    try {
      const res = await fetch("/api/ai/summarize-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          subjectName: subjectName || "General",
          content: body,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Summarization failed");
      setAiSummary(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not summarize note.", "error");
      setAiModalOpen(false);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left Sidebar: Notes List */}
      <div className="space-y-4 lg:col-span-4">
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
              Notes
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {notes.filter((n) => !n.archived).length} active ·{" "}
              {notes.filter((n) => n.archived).length} archived
            </p>
          </div>
          <button
            type="button"
            onClick={startNewNote}
            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-3.5 w-3.5" />
            New Note
          </button>
        </div>

        <div className="space-y-2.5 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setTab("active")}
              className={`flex-1 rounded-md py-1.5 text-xs font-medium ${
                tab === "active"
                  ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-slate-50"
                  : "text-slate-600 dark:text-slate-300"
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setTab("archived")}
              className={`flex-1 rounded-md py-1.5 text-xs font-medium ${
                tab === "archived"
                  ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-slate-50"
                  : "text-slate-600 dark:text-slate-300"
              }`}
            >
              Archived
            </button>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="all">All Subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <div className="max-h-[460px] space-y-2 overflow-y-auto pt-1">
            {filteredNotes.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">
                No {tab} notes found.
              </p>
            ) : (
              filteredNotes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => loadNoteIntoEditor(n)}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${
                    selectedNote?.id === n.id && !isCreating
                      ? "border-indigo-400 bg-indigo-50/50 dark:border-indigo-700 dark:bg-indigo-950/30"
                      : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {n.title}
                    </span>
                    {n.pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-indigo-600" />}
                  </div>
                  <p className="mt-0.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                    {n.subjectName || "General"}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                    {stripHtml(n.content) || "Empty note"}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Right Rich-Text Note Editor */}
      <div className="lg:col-span-8">
        {!selectedNote && !isCreating ? (
          <EmptyState
            icon={<FileText className="h-5 w-5" />}
            title="Select or create a study note"
            description="Write rich-text lecture summaries, pin key exam formulas, and archive past semester notes."
            actionLabel="Create First Note"
            onAction={startNewNote}
          />
        ) : (
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            {/* Note Meta & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Note title..."
                  className="font-display min-w-0 flex-1 bg-transparent text-lg font-bold text-slate-900 focus:outline-none dark:text-slate-50"
                />
                <select
                  value={subjectId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSubjectId(id);
                    const found = subjects.find((s) => s.id === id);
                    setSubjectName(found?.name || "General");
                  }}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="">General</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {selectedNote && !isCreating && (
                  <>
                    <button
                      type="button"
                      onClick={async () => {
                        const next = !selectedNote.pinned;
                        await toggleNotePinned(selectedNote.id, next);
                        setSelectedNote({ ...selectedNote, pinned: next });
                        showToast(next ? "Note pinned." : "Note unpinned.", "info");
                      }}
                      title={selectedNote.pinned ? "Unpin note" : "Pin note"}
                      className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      {selectedNote.pinned ? (
                        <PinOff className="h-4 w-4 text-indigo-600" />
                      ) : (
                        <Pin className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const next = !selectedNote.archived;
                        await setNoteArchiveState(selectedNote.id, next, selectedNote.pinned);
                        setSelectedNote(null);
                        showToast(next ? "Note archived." : "Note restored.", "info");
                      }}
                      title={selectedNote.archived ? "Unarchive" : "Archive note"}
                      className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      {selectedNote.archived ? (
                        <ArchiveRestore className="h-4 w-4" />
                      ) : (
                        <Archive className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(selectedNote)}
                      title="Delete note"
                      className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={handleSummarizeNote}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-300"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Summarize
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Note"}
                </button>
              </div>
            </div>

            {/* Rich-Text Formatting Toolbar */}
            <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50/70 px-4 py-2 dark:border-slate-800 dark:bg-slate-950/50">
              <button
                type="button"
                onClick={() => execFormat("bold")}
                title="Bold"
                className="rounded p-1.5 text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Bold className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => execFormat("italic")}
                title="Italic"
                className="rounded p-1.5 text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Italic className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => execFormat("underline")}
                title="Underline"
                className="rounded p-1.5 text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Underline className="h-4 w-4" />
              </button>
              <div className="mx-1 h-4 w-px bg-slate-300 dark:bg-slate-700" />
              <button
                type="button"
                onClick={() => execFormat("formatBlock", "H3")}
                title="Heading"
                className="rounded p-1.5 text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Heading3 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => execFormat("insertUnorderedList")}
                title="Bullet List"
                className="rounded p-1.5 text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => execFormat("insertOrderedList")}
                title="Numbered List"
                className="rounded p-1.5 text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ListOrdered className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => execFormat("formatBlock", "BLOCKQUOTE")}
                title="Quote"
                className="rounded p-1.5 text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Quote className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => execFormat("formatBlock", "PRE")}
                title="Code Block"
                className="rounded p-1.5 text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Code className="h-4 w-4" />
              </button>
            </div>

            {/* Editable Surface */}
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              data-placeholder="Start writing your lecture notes, derivations, or key concepts..."
              className="rich-editor min-h-[420px] p-6 text-sm leading-relaxed text-slate-800 focus:outline-none dark:text-slate-200"
            />
          </div>
        )}
      </div>

      {/* AI Summary Modal */}
      <Modal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        title="AI Note Summary"
        subtitle={title || "Study Notes"}
        maxWidth="max-w-xl"
      >
        {aiLoading ? (
          <div className="space-y-3 py-6">
            <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-full animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          </div>
        ) : aiSummary ? (
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-display text-xs font-bold text-indigo-600 dark:text-indigo-400">
                Core Overview
              </h4>
              <p className="mt-1 text-slate-700 dark:text-slate-300">{aiSummary.tldr}</p>
            </div>
            {aiSummary.keyTakeaways && aiSummary.keyTakeaways.length > 0 && (
              <div>
                <h4 className="font-display text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  Key Takeaways
                </h4>
                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-slate-700 dark:text-slate-300">
                  {aiSummary.keyTakeaways.map((k, i) => (
                    <li key={i}>{k}</li>
                  ))}
                </ul>
              </div>
            )}
            {aiSummary.practiceQuestions && aiSummary.practiceQuestions.length > 0 && (
              <div>
                <h4 className="font-display text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  Self-Test Questions
                </h4>
                <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-slate-700 dark:text-slate-300">
                  {aiSummary.practiceQuestions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteNote(deleteTarget.id);
          setSelectedNote(null);
          setIsCreating(false);
          setDeleteTarget(null);
          showToast("Note deleted.", "success");
        }}
        title="Delete Note"
        message={`Delete "${deleteTarget?.title}" permanently?`}
      />
    </div>
  );
}
