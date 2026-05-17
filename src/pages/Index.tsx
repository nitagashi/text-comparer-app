import { useRef, useState } from "react";
import { TextPanel } from "@/components/TextPanel";
import { DiffViewer } from "@/components/DiffViewer";
import { DiffNavigator } from "@/components/DiffNavigator";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { GitCompare, ArrowLeftRight, RotateCcw } from "lucide-react";

const SAMPLE_LEFT = `The quick brown fox jumps over the lazy dog.
Pack my box with five dozen liquor jugs.
How vexingly quick daft zebras jump!
Sphinx of black quartz, judge my vow.`;

const SAMPLE_RIGHT = `The quick brown fox leaps over the lazy dog.
Pack my box with five dozen liquor jugs.
How vexingly quickly daft zebras jump!
The sphinx of black quartz judges my vow.
Bright vixens jump; dozy fowl quack.`;

const Index = () => {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [compared, setCompared] = useState<{ l: string; r: string } | null>(
    null,
  );
  const [mode, setMode] = useState<"line" | "word">("word");
  const diffScrollRef = useRef<HTMLDivElement>(null);

  const handleCompare = () => setCompared({ l: left, r: right });
  const handleSwap = () => {
    setLeft(right);
    setRight(left);
    if (compared) setCompared({ l: compared.r, r: compared.l });
  };
  const handleClear = () => {
    setLeft("");
    setRight("");
    setCompared(null);
  };
  const loadSample = () => {
    setLeft(SAMPLE_LEFT);
    setRight(SAMPLE_RIGHT);
    setCompared({ l: SAMPLE_LEFT, r: SAMPLE_RIGHT });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:py-5">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[var(--shadow-soft)]">
              <GitCompare className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                Diffly
              </h1>
              <p className="hidden sm:block text-xs text-muted-foreground">
                Compare two texts and spot every difference
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={loadSample}
              className="hidden sm:inline-flex"
            >
              Load sample
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadSample}
              className="sm:hidden h-8 px-2 text-xs"
            >
              Sample
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-8 px-2 sm:px-3"
            >
              <RotateCcw className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Reset</span>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 sm:py-8">
        <div className="grid gap-4 md:grid-cols-2">
          <TextPanel
            label="Original text"
            value={left}
            onChange={setLeft}
            accent="left"
          />
          <TextPanel
            label="Changed text"
            value={right}
            onChange={setRight}
            accent="right"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
            <span className="font-medium text-foreground">
              {left.trim()
                ? left.trim().split(/\s+/).length.toLocaleString()
                : 0}
            </span>
            <span>words</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
            <span className="font-medium text-foreground">
              {right.trim()
                ? right.trim().split(/\s+/).length.toLocaleString()
                : 0}
            </span>
            <span>words</span>
          </div>
        </div>

        <div className="my-6 flex flex-wrap items-center justify-center gap-3">
          <div className="inline-flex rounded-full border border-border bg-card p-1 shadow-[var(--shadow-soft)]">
            <button
              onClick={() => setMode("word")}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                mode === "word"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Word level
            </button>
            <button
              onClick={() => setMode("line")}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                mode === "line"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Line level
            </button>
          </div>
          <Button
            onClick={handleCompare}
            size="lg"
            className="rounded-full px-6 sm:px-8 shadow-[var(--shadow-soft)]"
          >
            <GitCompare className="mr-2 h-4 w-4" />
            Compare
          </Button>
          <Button
            onClick={handleSwap}
            variant="outline"
            size="lg"
            className="rounded-full px-5 sm:px-6"
          >
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            Swap
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <DiffViewer
            left={compared?.l ?? ""}
            right={compared?.r ?? ""}
            mode={mode}
            scrollContainerRef={diffScrollRef}
            onApplyEdits={(l, r) => {
              setLeft(l);
              setRight(r);
              setCompared({ l, r });
            }}
          />
          <DiffNavigator
            left={compared?.l ?? ""}
            right={compared?.r ?? ""}
            mode={mode}
            scrollContainerRef={diffScrollRef}
          />
        </div>
        <footer className="mt-12 border-t border-border pt-6 text-center text-xs text-muted-foreground">
          <p>All comparison happens in your browser. Nothing is uploaded.</p>
        </footer>
      </main>
    </div>
  );
};

export default Index;
