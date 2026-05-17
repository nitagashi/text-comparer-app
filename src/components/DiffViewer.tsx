import {
  useMemo,
  useState,
  useEffect,
  useRef,
  forwardRef,
  useCallback,
  type MutableRefObject,
} from "react";
import { diffLines, diffWordsWithSpace, Change } from "diff";
import { Button } from "@/components/ui/button";
import { Pencil, Check, X } from "lucide-react";

interface DiffViewerProps {
  left: string;
  right: string;
  mode: "line" | "word";
  scrollContainerRef?: React.Ref<HTMLDivElement>;
}

export interface AlignedRow {
  leftType: "same" | "removed" | "empty";
  rightType: "same" | "added" | "empty";
  leftContent: string;
  rightContent: string;
  leftNum: number | null;
  rightNum: number | null;
  leftInline?: Change[];
  rightInline?: Change[];
}

export interface DiffChunk {
  index: number; // row index of first row in chunk
  type: "added" | "removed" | "modified";
  leftNum: number | null;
  rightNum: number | null;
  preview: string;
  size: number;
}

export function buildAlignedRows(
  left: string,
  right: string,
  mode: "line" | "word",
): AlignedRow[] {
  const changes = diffLines(left, right);
  const rows: AlignedRow[] = [];
  let leftNum = 1;
  let rightNum = 1;

  for (let i = 0; i < changes.length; i++) {
    const part = changes[i];
    const lines = part.value.replace(/\n$/, "").split("\n");

    if (!part.added && !part.removed) {
      for (const line of lines) {
        rows.push({
          leftType: "same",
          rightType: "same",
          leftContent: line,
          rightContent: line,
          leftNum: leftNum++,
          rightNum: rightNum++,
        });
      }
    } else if (part.removed) {
      const next = changes[i + 1];
      if (next && next.added) {
        const removedLines = lines;
        const addedLines = next.value.replace(/\n$/, "").split("\n");
        const max = Math.max(removedLines.length, addedLines.length);
        for (let j = 0; j < max; j++) {
          const r = removedLines[j];
          const a = addedLines[j];
          if (r !== undefined && a !== undefined) {
            const inline =
              mode === "word" ? diffWordsWithSpace(r, a) : undefined;
            rows.push({
              leftType: "removed",
              rightType: "added",
              leftContent: r,
              rightContent: a,
              leftNum: leftNum++,
              rightNum: rightNum++,
              leftInline: inline,
              rightInline: inline,
            });
          } else if (r !== undefined) {
            rows.push({
              leftType: "removed",
              rightType: "empty",
              leftContent: r,
              rightContent: "",
              leftNum: leftNum++,
              rightNum: null,
            });
          } else {
            rows.push({
              leftType: "empty",
              rightType: "added",
              leftContent: "",
              rightContent: a,
              leftNum: null,
              rightNum: rightNum++,
            });
          }
        }
        i++;
      } else {
        for (const line of lines) {
          rows.push({
            leftType: "removed",
            rightType: "empty",
            leftContent: line,
            rightContent: "",
            leftNum: leftNum++,
            rightNum: null,
          });
        }
      }
    } else if (part.added) {
      for (const line of lines) {
        rows.push({
          leftType: "empty",
          rightType: "added",
          leftContent: "",
          rightContent: line,
          leftNum: null,
          rightNum: rightNum++,
        });
      }
    }
  }

  return rows;
}

export function buildChunks(rows: AlignedRow[]): DiffChunk[] {
  const chunks: DiffChunk[] = [];
  let i = 0;
  while (i < rows.length) {
    const row = rows[i];
    const isChanged = row.leftType === "removed" || row.rightType === "added";
    if (!isChanged) {
      i++;
      continue;
    }
    const start = i;
    let hasRemoved = false;
    let hasAdded = false;
    while (i < rows.length) {
      const r = rows[i];
      const changed = r.leftType === "removed" || r.rightType === "added";
      if (!changed) break;
      if (r.leftType === "removed") hasRemoved = true;
      if (r.rightType === "added") hasAdded = true;
      i++;
    }
    const size = i - start;
    const first = rows[start];
    const type: DiffChunk["type"] =
      hasRemoved && hasAdded ? "modified" : hasAdded ? "added" : "removed";
    const preview =
      (first.rightContent || first.leftContent || "").trim().slice(0, 60) ||
      "(empty line)";
    chunks.push({
      index: start,
      type,
      leftNum: first.leftNum,
      rightNum: first.rightNum,
      preview,
      size,
    });
  }
  return chunks;
}

function renderInline(
  content: string,
  parts: Change[] | undefined,
  side: "left" | "right",
  ghost = false,
) {
  if (!parts)
    return (
      <span className={ghost ? "text-transparent" : undefined}>
        {content || "\u00A0"}
      </span>
    );
  return (
    <>
      {parts.map((p, idx) => {
        if (side === "left" && p.added) return null;
        if (side === "right" && p.removed) return null;
        if (p.added || p.removed) {
          return (
            <span
              key={idx}
              className={
                side === "left"
                  ? `bg-[hsl(var(--diff-removed-marker)/0.35)] rounded px-0.5 ${ghost ? "text-transparent" : ""}`
                  : `bg-[hsl(var(--diff-added-marker)/0.35)] rounded px-0.5 ${ghost ? "text-transparent" : ""}`
              }
            >
              {p.value}
            </span>
          );
        }
        return (
          <span key={idx} className={ghost ? "text-transparent" : undefined}>
            {p.value}
          </span>
        );
      })}
    </>
  );
}

export const DiffViewer = forwardRef<HTMLDivElement, DiffViewerProps>(
  ({ left, right, mode, scrollContainerRef, onApplyEdits }, _ref) => {
    const rows = useMemo(
      () => buildAlignedRows(left, right, mode),
      [left, right, mode],
    );
    const [editing, setEditing] = useState<"left" | "right" | null>(null);
    const [editLeft, setEditLeft] = useState(left);
    const [editRight, setEditRight] = useState(right);
    const diffContainerRef = useRef<HTMLDivElement>(null);
    const editAreaRef = useRef<HTMLTextAreaElement>(null);
    const editHighlightRef = useRef<HTMLDivElement>(null);
    const leftPaneRef = useRef<HTMLDivElement>(null);
    const rightPaneRef = useRef<HTMLDivElement>(null);
    const syncingRef = useRef<"editor" | "preview" | null>(null);
    const setScrollRefs = useCallback(
      (node: HTMLDivElement | null) => {
        diffContainerRef.current = node;
        if (typeof scrollContainerRef === "function") scrollContainerRef(node);
        else if (scrollContainerRef)
          (
            scrollContainerRef as MutableRefObject<HTMLDivElement | null>
          ).current = node;
      },
      [scrollContainerRef],
    );

    useEffect(() => {
      if (editing !== "left") setEditLeft(left);
      if (editing !== "right") setEditRight(right);
    }, [left, right, editing]);

    const startEdit = (side: "left" | "right") => {
      if (side === "left") setEditLeft(left);
      else setEditRight(right);
      setEditing(side);
    };

    const cancelEdit = () => {
      setEditLeft(left);
      setEditRight(right);
      setEditing(null);
    };

    const applyEdit = () => {
      const editedPane = diffContainerRef.current;
      const editedLines = editedPane
        ? Array.from(
            editedPane.querySelectorAll<HTMLElement>("[data-edit-line]"),
          ).map((line) => line.innerText.replace(/\n$/, ""))
        : [];
      const editedText =
        editedLines.length > 0
          ? editedLines.join("\n")
          : editing === "left"
            ? editLeft
            : editRight;
      onApplyEdits?.(
        editing === "left" ? editedText : left,
        editing === "right" ? editedText : right,
      );
      setEditing(null);
    };

    const handleEditorScroll = () => {
      if (syncingRef.current === "preview") {
        syncingRef.current = null;
        return;
      }
      const ed = editAreaRef.current;
      const pv =
        editing === "left" ? rightPaneRef.current : leftPaneRef.current;
      if (!ed) return;
      if (editHighlightRef.current)
        editHighlightRef.current.scrollTop = ed.scrollTop;
      if (!pv) return;
      const max = ed.scrollHeight - ed.clientHeight;
      const ratio = max > 0 ? ed.scrollTop / max : 0;
      syncingRef.current = "editor";
      pv.scrollTop = ratio * (pv.scrollHeight - pv.clientHeight);
    };

    const handlePreviewScroll = () => {
      if (syncingRef.current === "editor") {
        syncingRef.current = null;
        return;
      }
      const ed = editAreaRef.current;
      const pv =
        editing === "left" ? rightPaneRef.current : leftPaneRef.current;
      if (!ed || !pv) return;
      const max = pv.scrollHeight - pv.clientHeight;
      const ratio = max > 0 ? pv.scrollTop / max : 0;
      syncingRef.current = "preview";
      ed.scrollTop = ratio * (ed.scrollHeight - ed.clientHeight);
      if (editHighlightRef.current)
        editHighlightRef.current.scrollTop = ed.scrollTop;
    };

    const stats = useMemo(() => {
      let added = 0;
      let removed = 0;
      for (const r of rows) {
        if (r.rightType === "added") added++;
        if (r.leftType === "removed") removed++;
      }
      const unchanged = rows.length - added - removed;
      return { added, removed, unchanged, total: rows.length };
    }, [rows]);

    if (!left && !right) {
      return (
        <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground shadow-[var(--shadow-card)]">
          <p className="text-sm">
            Paste text on both sides and click{" "}
            <span className="font-medium text-foreground">Compare</span> to see
            the differences.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-[hsl(var(--diff-added-marker))]" />
            <span className="font-medium text-foreground">{stats.added}</span>
            <span className="text-muted-foreground">additions</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-[hsl(var(--diff-removed-marker))]" />
            <span className="font-medium text-foreground">{stats.removed}</span>
            <span className="text-muted-foreground">removals</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />
            <span className="font-medium text-foreground">
              {stats.unchanged}
            </span>
            <span className="text-muted-foreground">unchanged</span>
          </div>
          <div className="w-full sm:w-auto sm:ml-auto flex flex-wrap items-center gap-2">
            {editing ? (
              <>
                <span className="text-[11px] text-muted-foreground">
                  Editing{" "}
                  <span className="font-medium text-foreground">
                    {editing === "left" ? "Original" : "Changed"}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-full"
                  onClick={cancelEdit}
                >
                  <X className="mr-1 h-3.5 w-3.5" /> Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-8 rounded-full"
                  onClick={applyEdit}
                >
                  <Check className="mr-1 h-3.5 w-3.5" />
                  <span className="hidden sm:inline">
                    Apply &amp; re-compare
                  </span>
                  <span className="sm:hidden">Apply</span>
                </Button>
              </>
            ) : (
              <div className="inline-flex overflow-hidden rounded-full border border-border bg-card">
                <button
                  onClick={() => startEdit("left")}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title="Edit original text"
                >
                  <Pencil className="h-3.5 w-3.5" /> Original
                </button>
                <span className="w-px bg-border" />
                <button
                  onClick={() => startEdit("right")}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title="Edit changed text"
                >
                  <Pencil className="h-3.5 w-3.5" /> Changed
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
          <div className="grid grid-cols-2 border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <div className="flex items-center justify-between border-r border-border px-4 py-2.5">
              <span>Original</span>
              {editing === "left" && (
                <span className="normal-case tracking-normal text-[10px] text-primary">
                  editing
                </span>
              )}
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span>Changed</span>
              {editing === "right" && (
                <span className="normal-case tracking-normal text-[10px] text-primary">
                  editing
                </span>
              )}
            </div>
          </div>

          {editing ? (
            <div
              ref={setScrollRefs}
              className="max-h-[60vh] overflow-auto font-mono text-[13px] leading-relaxed"
            >
              {rows.map((row, i) => (
                <div key={i} data-diff-row={i} className="grid grid-cols-2">
                  <div
                    ref={editing === "left" ? leftPaneRef : undefined}
                    className={`flex border-r border-border ${
                      row.leftType === "removed"
                        ? "bg-[hsl(var(--diff-removed-bg))]"
                        : row.leftType === "empty"
                          ? "bg-muted/30"
                          : ""
                    }`}
                  >
                    <div className="w-8 sm:w-12 shrink-0 select-none border-r border-border/60 px-1 sm:px-2 py-1 text-right text-[10px] sm:text-xs text-muted-foreground/70">
                      {row.leftNum ?? ""}
                    </div>
                    <pre
                      contentEditable={
                        editing === "left" && row.leftNum !== null
                      }
                      data-edit-line={
                        editing === "left" && row.leftNum !== null
                          ? true
                          : undefined
                      }
                      suppressContentEditableWarning
                      spellCheck={false}
                      className={`flex-1 whitespace-pre-wrap break-words px-2 sm:px-3 py-1 outline-none ${
                        editing === "left" && row.leftNum !== null
                          ? "cursor-text ring-inset focus:bg-background/50 focus:ring-1 focus:ring-primary/50"
                          : ""
                      } ${
                        row.leftType === "removed"
                          ? "text-[hsl(var(--diff-removed-text))]"
                          : "text-[hsl(var(--diff-unchanged))]"
                      }`}
                    >
                      {row.leftType === "removed" && mode === "word"
                        ? renderInline(row.leftContent, row.leftInline, "left")
                        : row.leftContent || "\u00A0"}
                    </pre>
                  </div>

                  <div
                    ref={editing === "right" ? rightPaneRef : undefined}
                    className={`flex ${
                      row.rightType === "added"
                        ? "bg-[hsl(var(--diff-added-bg))]"
                        : row.rightType === "empty"
                          ? "bg-muted/30"
                          : ""
                    }`}
                  >
                    <div className="w-8 sm:w-12 shrink-0 select-none border-r border-border/60 px-1 sm:px-2 py-1 text-right text-[10px] sm:text-xs text-muted-foreground/70">
                      {row.rightNum ?? ""}
                    </div>
                    <pre
                      contentEditable={
                        editing === "right" && row.rightNum !== null
                      }
                      data-edit-line={
                        editing === "right" && row.rightNum !== null
                          ? true
                          : undefined
                      }
                      suppressContentEditableWarning
                      spellCheck={false}
                      className={`flex-1 whitespace-pre-wrap break-words px-2 sm:px-3 py-1 outline-none ${
                        editing === "right" && row.rightNum !== null
                          ? "cursor-text ring-inset focus:bg-background/50 focus:ring-1 focus:ring-primary/50"
                          : ""
                      } ${
                        row.rightType === "added"
                          ? "text-[hsl(var(--diff-added-text))]"
                          : "text-[hsl(var(--diff-unchanged))]"
                      }`}
                    >
                      {row.rightType === "added" && mode === "word"
                        ? renderInline(
                            row.rightContent,
                            row.rightInline,
                            "right",
                          )
                        : row.rightContent || "\u00A0"}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              ref={setScrollRefs}
              className="max-h-[60vh] overflow-auto font-mono text-[13px] leading-relaxed"
            >
              {rows.map((row, i) => (
                <div key={i} data-diff-row={i} className="grid grid-cols-2">
                  <div
                    className={`flex border-r border-border ${
                      row.leftType === "removed"
                        ? "bg-[hsl(var(--diff-removed-bg))]"
                        : row.leftType === "empty"
                          ? "bg-muted/30"
                          : ""
                    }`}
                  >
                    <div className="w-8 sm:w-12 shrink-0 select-none border-r border-border/60 px-1 sm:px-2 py-1 text-right text-[10px] sm:text-xs text-muted-foreground/70">
                      {row.leftNum ?? ""}
                    </div>
                    <pre
                      className={`flex-1 whitespace-pre-wrap break-words px-2 sm:px-3 py-1 ${
                        row.leftType === "removed"
                          ? "text-[hsl(var(--diff-removed-text))]"
                          : "text-[hsl(var(--diff-unchanged))]"
                      }`}
                    >
                      {row.leftType === "removed" && mode === "word"
                        ? renderInline(row.leftContent, row.leftInline, "left")
                        : row.leftContent || "\u00A0"}
                    </pre>
                  </div>

                  <div
                    className={`flex ${
                      row.rightType === "added"
                        ? "bg-[hsl(var(--diff-added-bg))]"
                        : row.rightType === "empty"
                          ? "bg-muted/30"
                          : ""
                    }`}
                  >
                    <div className="w-8 sm:w-12 shrink-0 select-none border-r border-border/60 px-1 sm:px-2 py-1 text-right text-[10px] sm:text-xs text-muted-foreground/70">
                      {row.rightNum ?? ""}
                    </div>
                    <pre
                      className={`flex-1 whitespace-pre-wrap break-words px-2 sm:px-3 py-1 ${
                        row.rightType === "added"
                          ? "text-[hsl(var(--diff-added-text))]"
                          : "text-[hsl(var(--diff-unchanged))]"
                      }`}
                    >
                      {row.rightType === "added" && mode === "word"
                        ? renderInline(
                            row.rightContent,
                            row.rightInline,
                            "right",
                          )
                        : row.rightContent || "\u00A0"}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  },
);

DiffViewer.displayName = "DiffViewer";
