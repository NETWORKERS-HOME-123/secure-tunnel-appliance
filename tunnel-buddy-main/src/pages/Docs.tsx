import { useEffect, useState, useMemo, useCallback } from "react";
import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, List } from "lucide-react";
import { cn } from "@/lib/utils";
import docsUrl from "/DOCUMENTATION.md?url";

interface TocEntry {
  id: string;
  text: string;
  level: number;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function extractToc(markdown: string): TocEntry[] {
  const entries: TocEntry[] = [];
  for (const line of markdown.split("\n")) {
    const match = line.match(/^(#{1,3})\s+(.+)/);
    if (match) {
      const text = match[2].replace(/[`*_~]/g, "");
      entries.push({ id: slugify(text), text, level: match[1].length });
    }
  }
  return entries;
}

function HeadingRenderer(level: number) {
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  return function Heading({ children }: { children?: React.ReactNode }) {
    const text = String(children ?? "");
    const id = slugify(text);
    return <Tag id={id}>{children}</Tag>;
  };
}

const markdownComponents: Components = {
  h1: HeadingRenderer(1) as Components["h1"],
  h2: HeadingRenderer(2) as Components["h2"],
  h3: HeadingRenderer(3) as Components["h3"],
};

export default function Docs() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [tocOpen, setTocOpen] = useState(true);

  useEffect(() => {
    fetch(docsUrl)
      .then((r) => r.text())
      .then((text) => {
        setContent(text);
        setLoading(false);
      });
  }, []);

  const toc = useMemo(() => extractToc(content), [content]);

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-3rem)]">
        {/* TOC sidebar */}
        {!loading && toc.length > 0 && (
          <aside
            className={cn(
              "hidden lg:flex flex-col border-r border-border bg-card/50 transition-all duration-200 shrink-0",
              tocOpen ? "w-64" : "w-10"
            )}
          >
            <button
              onClick={() => setTocOpen((v) => !v)}
              className="flex items-center gap-2 px-3 py-2.5 text-xs font-mono text-muted-foreground hover:text-foreground border-b border-border"
            >
              <List className="h-3.5 w-3.5 shrink-0" />
              {tocOpen && <span>Contents</span>}
            </button>
            {tocOpen && (
              <ScrollArea className="flex-1">
                <nav className="p-3 space-y-0.5">
                  {toc.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => scrollTo(entry.id)}
                      className={cn(
                        "block w-full text-left truncate rounded-md px-2 py-1 text-xs hover:bg-muted hover:text-foreground transition-colors text-muted-foreground",
                        entry.level === 1 && "font-semibold text-foreground",
                        entry.level === 2 && "pl-4",
                        entry.level === 3 && "pl-7 text-[11px]"
                      )}
                    >
                      {entry.text}
                    </button>
                  ))}
                </nav>
              </ScrollArea>
            )}
          </aside>
        )}

        {/* Main content */}
        <ScrollArea className="flex-1">
          <div className="container max-w-4xl py-8">
            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <article className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-mono prose-headings:scroll-mt-16 prose-code:font-mono prose-code:text-primary prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-table:text-xs prose-th:text-left prose-td:py-1.5 prose-th:py-1.5">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{content}</ReactMarkdown>
              </article>
            )}
          </div>
        </ScrollArea>
      </div>
    </DashboardLayout>
  );
}
