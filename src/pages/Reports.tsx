import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { Plus, Download, Clock, FileStack, X } from "lucide-react";
import { Page } from "@/components/layout/Page";
import { AssistantPanel } from "@/components/ai/AssistantPanel";
import { Button } from "@/components/ui/Button";
import { reportsAssistant } from "@/services/pageAssistants";
import { Input, Textarea } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { reports as initialReports, projects } from "@/data/mockData";
import { aoiImage } from "@/lib/aoiImagery";
import { formatTimestamp } from "@/lib/format";
import { ease, dur } from "@/lib/motion";
import { cn, SCREEN_BEZEL, IMAGE_BEZEL } from "@/lib/utils";
import type { Report } from "@/types";

/**
 * A report card — the exact same chrome-housing / inset-CRT-screen
 * structure as `Projects.tsx`'s `ProjectTicket`, reused deliberately
 * rather than reinvented: this page's old master-detail layout (a plain
 * list on the left, a bespoke preview panel — complete with its own
 * "SatQuery AI" letterhead mockup — on the right) didn't share any
 * material with the rest of the workspace. Now both record-grid pages
 * read as the same product.
 */
function ReportCard({ r }: { r: Report }) {
  return (
    <article className="chrome rounded-lg p-3 flex flex-col gap-3">
      {/* Image panel — bezeled with a thin chrome-high edge and a slight
          inset shadow, same treatment `ProjectTicket` and `EarthConsole`
          both use. No letterhead mockup here either (the old preview drew
          the app's own logo onto the image, as if it were a document
          cover) — just the scene and its status. */}
      <div
        className="relative aspect-[16/10] overflow-hidden rounded-md bg-bg-elevated"
        style={{ border: IMAGE_BEZEL }}
      >
        <img
          src={aoiImage(r.projectName, r.title)}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(6,6,7,0.15) 0%, rgba(6,6,7,0.70) 100%)" }}
        />
        <div className="absolute top-3.5 left-3.5">
          <StatusBadge status={r.status} />
        </div>
        <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5 rounded-full bg-bg-primary/70 backdrop-blur-sm px-2.5 py-1 text-[0.6875rem] font-medium text-white">
          <FileStack className="h-3 w-3" />
          {r.pageCount} pages
        </div>
      </div>

      {/* CRT terminal display — identical treatment to `ProjectTicket`'s:
          phosphor colour + glow on the container, title at full
          brightness, everything else stepped down to `phosphor-dim`. */}
      <div
        className="crt rounded-md px-5 py-4 bg-bg-primary font-mono text-mono text-phosphor phosphor-glow"
        style={{ boxShadow: SCREEN_BEZEL }}
      >
        <h2 className="text-subheading line-clamp-1">{r.title}</h2>
        <p className="mt-1.5 text-body-sm text-phosphor-dim [text-shadow:none]">{r.projectName}</p>
        <p className="mt-3 text-body-sm text-phosphor-dim [text-shadow:none] line-clamp-2">{r.summary}</p>

        <div className="mt-4 flex items-center gap-2 text-body-sm text-phosphor-dim [text-shadow:none]">
          <Clock className="h-3.5 w-3.5 text-phosphor [text-shadow:none]" />
          {formatTimestamp(r.generatedAt ?? r.createdAt)}
        </div>
      </div>

      {/* Actions sit directly on the chrome material, outside the CRT
          screen — the same "furniture vs. display" split as the project
          ticket's footer. Same hand-rolled `bevel` + `bg-bg-hover`
          hardware-button treatment as the nav bar's Search/Notifications/
          Account controls, rather than the blue `primary` fill — these
          are per-record actions living on a chrome surface, the same
          category of control the nav bar's own buttons are. */}
      <div className="flex items-center gap-2 px-1">
        <button className="bevel flex flex-1 items-center justify-center gap-2 h-9 rounded-md bg-bg-hover text-body-sm font-medium text-text-secondary transition-colors duration-150 hover:bg-bg-hover/70 hover:text-text-primary">
          <Download className="h-3.5 w-3.5" /> Export PDF
        </button>
        <button className="bevel flex items-center justify-center gap-2 h-9 px-4 rounded-md bg-bg-hover text-body-sm font-medium text-text-secondary transition-colors duration-150 hover:bg-bg-hover/70 hover:text-text-primary">
          Share
        </button>
      </div>
    </article>
  );
}

/**
 * The "New report" trigger + creation dialog — same Radix Dialog
 * foundation, `glass edge-lit` material, and form layout as `Projects.tsx`'s
 * `NewProjectDialog`, so the two "create a record" flows in this app feel
 * like one pattern rather than two independent implementations.
 */
function NewReportDialog({ onCreate }: { onCreate: (r: Report) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [projectName, setProjectName] = useState(projects[0]?.name ?? "");
  const [summary, setSummary] = useState("");

  const reset = () => {
    setTitle("");
    setProjectName(projects[0]?.name ?? "");
    setSummary("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !projectName) return;
    const now = new Date().toISOString();
    onCreate({
      id: `report-${Date.now()}`,
      title: title.trim(),
      projectName,
      summary: summary.trim() || "No summary yet.",
      pageCount: 0,
      status: "draft",
      createdAt: now,
    });
    reset();
    setOpen(false);
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <Dialog.Trigger asChild>
        <Button variant="primary" size="sm">
          <Plus className="h-3.5 w-3.5" /> New report
        </Button>
      </Dialog.Trigger>

      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: dur.fast }}
                className="fixed inset-0 z-[90] bg-bg-primary/70 backdrop-blur-sm"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild aria-describedby="new-report-description">
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.99 }}
                transition={{ duration: dur.base, ease: ease.apple }}
                className="fixed left-1/2 top-1/2 z-[95] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 glass edge-lit rounded-lg p-5 shadow-overlay"
              >
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title className="text-subheading text-text-primary">New report</Dialog.Title>
                  <Dialog.Close asChild>
                    <button
                      className="flex items-center justify-center h-8 w-8 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors duration-150"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </Dialog.Close>
                </div>
                <p id="new-report-description" className="sr-only">
                  Create a new report by naming it and choosing which project it belongs to.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="new-report-title" className="text-label uppercase text-text-faint mb-1.5 block">
                      Title
                    </label>
                    <Input
                      id="new-report-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Chennai Coastal Watch — Q1 2027"
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <label htmlFor="new-report-project" className="text-label uppercase text-text-faint mb-1.5 block">
                      Project
                    </label>
                    <select
                      id="new-report-project"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      required
                      className="no-native-focus-ring w-full h-10 px-3.5 text-sm bg-bg-tertiary text-text-primary border border-border-default rounded-md transition-[border-color,box-shadow,background-color] duration-150 hover:border-border-glass focus:border-accent focus:border-2 focus:bg-bg-elevated"
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.name}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="new-report-summary" className="text-label uppercase text-text-faint mb-1.5 block">
                      Summary
                    </label>
                    <Textarea
                      id="new-report-summary"
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      placeholder="What does this report cover?"
                      rows={3}
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Dialog.Close asChild>
                      <Button type="button" variant="ghost" size="sm">
                        Cancel
                      </Button>
                    </Dialog.Close>
                    <Button type="submit" variant="primary" size="sm">
                      Create report
                    </Button>
                  </div>
                </form>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

export default function Reports() {
  const [reports, setReports] = useState<Report[]>(initialReports);

  return (
    <Page
      title="Reports"
      subtitle="Generated analysis documents, ready to export or share."
      actions={<NewReportDialog onCreate={(r) => setReports((prev) => [r, ...prev])} />}
    >
      <section className={cn("grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-7 gap-y-10")}>
        {reports.map((r) => (
          <ReportCard key={r.id} r={r} />
        ))}
      </section>

      <AssistantPanel {...reportsAssistant(reports)} />
    </Page>
  );
}
