import { useMemo, useState, useCallback } from "react";
import { buildAlignedRows, buildChunks, DiffChunk } from "./DiffViewer";
import {
  Plus,
  Minus,
  Pencil,
  ListTree,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

interface DiffNavigatorProps {
  left: string;
  right: string;
  mode: "line" | "word";
  scrollContainerRef: React.RefObject<HTMLDivElement>;
}

const typeStyles: Record<
  DiffChunk["type"],
  { icon: typeof Plus; label: string; dot: string; text: string }
> = {
  added: {
    icon: Plus,
    label: "Added",
    dot: "bg-[hsl(var(--diff-added-marker))]",
    text: "text-[hsl(var(--diff-added-text))]",
  },
  removed: {
    icon: Minus,
    label: "Removed",
    dot: "bg-[hsl(var(--diff-removed-marker))]",
    text: "text-[hsl(var(--diff-removed-text))]",
  },
  modified: {
    icon: Pencil,
    label: "Modified",
    dot: "bg-primary",
    text: "text-foreground",
  },
};

export const DiffNavigator = ({
  left,
  right,
  mode,
  scrollContainerRef,
}: DiffNavigatorProps) => {
  const chunks = useMemo(() => {
    if (!left && !right) return [];
    const rows = buildAlignedRows(left, right, mode);
    return buildChunks(rows);
  }, [left, right, mode]);

  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const jumpTo = useCallback(
    (rowIndex: number, idx?: number) => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const target = container.querySelector<HTMLElement>(
        `[data-diff-row="${rowIndex}"]`,
      );
      if (!target) return;
      const performScroll = () => {
        const cRect = container.getBoundingClientRect();
        const tRect = target.getBoundingClientRect();
        const top = Math.max(
          0,
          tRect.top - cRect.top + container.scrollTop - 12,
        );
        container.scrollTo({ top, behavior: "smooth" });
      };

      const containerRect = container.getBoundingClientRect();
      const viewportH =
        window.innerHeight || document.documentElement.clientHeight;
      if (containerRect.top < 0 || containerRect.top > viewportH * 0.6) {
        window.scrollTo({
          top: window.scrollY + containerRect.top - 80,
          behavior: "smooth",
        });
        setTimeout(performScroll, 350);
      } else {
        performScroll();
      }

      target.classList.add("ring-2", "ring-primary", "ring-inset");
      setTimeout(() => {
        target.classList.remove("ring-2", "ring-primary", "ring-inset");
      }, 1200);
      if (typeof idx === "number") setActiveIndex(idx);
    },
    [scrollContainerRef],
  );

  const goNext = useCallback(() => {
    if (chunks.length === 0) return;
    const next = activeIndex + 1 < chunks.length ? activeIndex + 1 : 0;
    jumpTo(chunks[next].index, next);
  }, [chunks, activeIndex, jumpTo]);

  const goPrev = useCallback(() => {
    if (chunks.length === 0) return;
    const prev = activeIndex - 1 >= 0 ? activeIndex - 1 : chunks.length - 1;
    jumpTo(chunks[prev].index, prev);
  }, [chunks, activeIndex, jumpTo]);

  return (
    <aside className="rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
        <ListTree className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Differences
        </h3>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {chunks.length}
        </span>
      </div>

      {chunks.length > 0 && (
        <div className="flex items-center justify-between border-b border-border bg-muted/20 px-4 py-2">
          <button
            onClick={goPrev}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ChevronUp className="h-3.5 w-3.5" />
            Previous
          </button>
          <span className="text-[11px] font-medium text-muted-foreground">
            {activeIndex >= 0 ? activeIndex + 1 : 0} / {chunks.length}
          </span>
          <button
            onClick={goNext}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            Next
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {chunks.length === 0 ? (
        <div className="p-6 text-center text-xs text-muted-foreground">
          {!left && !right
            ? "Run a comparison to see differences."
            : "No differences found."}
        </div>
      ) : (
        <ul className="max-h-[60vh] overflow-auto divide-y divide-border">
          {chunks.map((chunk, idx) => {
            const meta = typeStyles[chunk.type];
            const Icon = meta.icon;
            const isActive = idx === activeIndex;
            return (
              <li key={chunk.index}>
                <button
                  onClick={() => jumpTo(chunk.index, idx)}
                  className={`group w-full text-left px-4 py-2.5 transition-colors flex items-start gap-3 ${
                    isActive ? "bg-primary/5" : "hover:bg-muted/50"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground group-hover:bg-background"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span
                        className={`inline-flex h-1.5 w-1.5 rounded-full ${meta.dot}`}
                      />
                      <Icon className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium text-foreground">
                        {meta.label}
                      </span>
                      <span className="text-muted-foreground">
                        · L{chunk.leftNum ?? "—"} / R{chunk.rightNum ?? "—"}
                      </span>
                      {chunk.size > 1 && (
                        <span className="ml-auto text-muted-foreground">
                          {chunk.size} lines
                        </span>
                      )}
                    </div>
                    <p
                      className={`mt-1 truncate font-mono text-xs ${meta.text}`}
                    >
                      {chunk.preview}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
};
