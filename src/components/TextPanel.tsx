import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Copy, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useRef } from "react";

interface TextPanelProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  accent: "left" | "right";
}

export const TextPanel = ({ label, value, onChange, accent }: TextPanelProps) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const charCount = value.length;
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const lineCount = value ? value.split("\n").length : 0;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      toast.error("File too large (max 1MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onChange(String(reader.result ?? ""));
      toast.success(`Loaded ${file.name}`);
    };
    reader.readAsText(file);
  };

  const handleCopy = async () => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              accent === "left" ? "bg-[hsl(var(--diff-removed-marker))]" : "bg-[hsl(var(--diff-added-marker))]"
            }`}
          />
          <h2 className="text-sm font-semibold text-foreground">{label}</h2>
        </div>
        <div className="flex items-center gap-1">
          <input ref={fileRef} type="file" accept=".txt,.md,.json,.csv,.log,.xml,.html,.css,.js,.ts" className="hidden" onChange={handleFile} />
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => fileRef.current?.click()} title="Upload file">
            <Upload className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleCopy} title="Copy">
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onChange("")} title="Clear">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste your text here…"
        spellCheck={false}
        className="min-h-[280px] flex-1 resize-none rounded-none border-0 bg-transparent font-mono text-[13px] leading-relaxed focus-visible:ring-0 focus-visible:ring-offset-0"
      />
      <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
        <span>{lineCount.toLocaleString()} lines</span>
        <span>{wordCount.toLocaleString()} words</span>
        <span>{charCount.toLocaleString()} chars</span>
      </div>
    </div>
  );
};
