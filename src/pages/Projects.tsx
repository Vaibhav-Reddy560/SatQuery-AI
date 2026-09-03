import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { Plus, Search, MapPin, BarChart3, Images, X } from "lucide-react";
import { Page } from "@/components/layout/Page";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Segmented";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Num } from "@/components/ui/Num";
import { projects as initialProjects } from "@/data/mockData";
import { aoiImage } from "@/lib/aoiImagery";
import { formatDate } from "@/lib/format";
import { ease, dur } from "@/lib/motion";
import { cn, SCREEN_BEZEL, IMAGE_BEZEL } from "@/lib/utils";
import type { Project } from "@/types";

type Filter = "all" | "active" | "archived" | "draft";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "draft", label: "Draft" },
];

/** Deterministic "barcode" from the project id — decorative, ticket-stub styling. */
function Barcode({ seed }: { seed: string }) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const bars = Array.from({ length: 14 }, () => {
    h = (h * 1103515245 + 12345) >>> 0;
    return 1 + (h % 3);
  });
  return (
    <div aria-hidden="true" className="flex items-end gap-[2px]">
      {bars.map((w, i) => (
        <span key={i} className="bg-white" style={{ width: w, height: 14 }} />
      ))}
    </div>
  );
}

/**
 * A die-cut ticket, not a plain card — two half-circle notches punched at
 * the seam between the scene and the stub, matching whatever sits behind
 * the grid (the page background), so it reads as a real perforation rather
 * than a decoration painted on top. Directly from the reference mood
 * board's boarding-pass shape.
 */
function ProjectTicket({ p }: { p: Project }) {
  return (
    /* Chrome housing — same "console body around an embedded screen"
       structure as the landing Earth's `EarthConsole`: a `chrome` shell
       with its own padding, so the blue-steel material actually shows as
       a visible frame, not just a 1px seam behind flush children. Image
       and CRT display sit inside that frame as separate rounded panels,
       each edged with its own `silver` bezel — a true neutral chrome/
       steel line, not the blue-tinted `chrome-*` ramp, per explicit
       feedback that the bezel should read as actual metal — framing every
       screen individually, so the gap between the two panels reads as a
       lit seam instead of a dark gap. The updated-date/barcode footer
       sits directly on the chrome material itself, outside both. */
    <article className="group cursor-pointer chrome rounded-lg p-3 flex flex-col gap-3">
      {/* Image panel — blue-chrome bezel hugging the scene's own edge. */}
      <div
        className="relative aspect-[16/10] overflow-hidden rounded-md bg-bg-elevated"
        style={{ border: IMAGE_BEZEL }}
      >
        <img
          src={aoiImage(p.location, p.name)}
          alt={p.location}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(6,6,7,0.15) 0%, rgba(6,6,7,0.70) 100%)" }}
        />
        <div className="absolute top-3.5 left-3.5">
          <StatusBadge status={p.status} />
        </div>
      </div>

      {/* CRT terminal display — recessed screen, second panel inset in the
          same chrome frame. Same treatment as `Terminal.tsx` (crt
          scanlines, mono, phosphor colour + glow on the container so every
          child inherits it). Title reads at full phosphor-glow brightness;
          everything else steps down to `phosphor-dim` with the glow
          switched off, the same de-emphasis `TerminalLine` already uses
          for its `>` prompt. */}
      <div
        className="crt rounded-md px-5 py-4 bg-bg-primary font-mono text-mono text-phosphor phosphor-glow"
        style={{ boxShadow: SCREEN_BEZEL }}
      >
        <h2 className="text-subheading">{p.name}</h2>
        <p className="mt-1.5 flex items-center gap-1.5 text-body-sm text-phosphor-dim [text-shadow:none]">
          <MapPin className="h-3.5 w-3.5" />
          {p.location}
        </p>
        <p className="mt-3 text-body-sm text-phosphor-dim [text-shadow:none] line-clamp-2">{p.description}</p>

        {/* Stats stay inside the screen — they're readouts, not chrome furniture. */}
        <div className="mt-4 flex items-center gap-6 text-body-sm text-phosphor-dim [text-shadow:none]">
          <span className="flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5 text-phosphor [text-shadow:none]" />
            <Num value={p.analysisCount} /> analyses
          </span>
          <span className="flex items-center gap-2">
            <Images className="h-3.5 w-3.5 text-phosphor [text-shadow:none]" />
            <Num value={p.imageCount} /> images
          </span>
        </div>
      </div>

      {/* Footer — updated date + barcode sit directly on the chrome
          material, outside the CRT screen entirely, like a label plate
          printed on the console body below its display. `text-faint`
          (#47474b) was chosen for a quiet caption on a light-neutral card;
          against dark chrome it was nearly invisible — white reads here. */}
      <div className="flex items-end justify-between px-1 text-xs text-white/80">
        <p>Updated {formatDate(p.updatedAt)}</p>
        <Barcode seed={p.id} />
      </div>
    </article>
  );
}

/**
 * The "New project" trigger + creation dialog. Built on Radix Dialog for
 * the same focus trap / Escape / scroll lock reasoning as `MobileNav`'s
 * drawer — this is the only other place in the app a new record gets
 * created, so it gets the same accessible foundation rather than a
 * hand-rolled modal.
 */
function NewProjectDialog({ onCreate }: { onCreate: (p: Project) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  const reset = () => {
    setName("");
    setLocation("");
    setDescription("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !location.trim()) return;
    const now = new Date().toISOString();
    onCreate({
      id: `proj-${Date.now()}`,
      name: name.trim(),
      location: location.trim(),
      description: description.trim() || "No description yet.",
      analysisCount: 0,
      imageCount: 0,
      status: "draft",
      createdAt: now,
      updatedAt: now,
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
        {/* Same `primary` treatment as Reports' "New report" — the
            page-level create action reads the same way in both places
            instead of each page inventing its own button language. */}
        <Button variant="primary" size="sm">
          <Plus className="h-3.5 w-3.5" />
          New project
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

            <Dialog.Content asChild aria-describedby="new-project-description">
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.99 }}
                transition={{ duration: dur.base, ease: ease.apple }}
                className="fixed left-1/2 top-1/2 z-[95] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 glass edge-lit rounded-lg p-5 shadow-overlay"
              >
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title className="text-subheading text-text-primary">New project</Dialog.Title>
                  <Dialog.Close asChild>
                    <button
                      className="flex items-center justify-center h-8 w-8 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors duration-150"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </Dialog.Close>
                </div>
                <p id="new-project-description" className="sr-only">
                  Create a new area-of-interest project by naming it and giving it a location.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="new-project-name" className="text-label uppercase text-text-faint mb-1.5 block">
                      Name
                    </label>
                    <Input
                      id="new-project-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Chennai Coastal Watch"
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <label htmlFor="new-project-location" className="text-label uppercase text-text-faint mb-1.5 block">
                      Location
                    </label>
                    <Input
                      id="new-project-location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Chennai, Tamil Nadu"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="new-project-description" className="text-label uppercase text-text-faint mb-1.5 block">
                      Description
                    </label>
                    <Textarea
                      id="new-project-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="What is this project tracking?"
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
                      Create project
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

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const shown = useMemo(
    () =>
      projects.filter(
        (p) =>
          (filter === "all" || p.status === filter) &&
          (q === "" ||
            p.name.toLowerCase().includes(q.toLowerCase()) ||
            p.location.toLowerCase().includes(q.toLowerCase()))
      ),
    [projects, filter, q]
  );

  return (
    <Page
      title="Projects"
      subtitle="Every area of interest you are tracking, and what has been run against it."
      actions={<NewProjectDialog onCreate={(p) => setProjects((prev) => [p, ...prev])} />}
    >
      <div className="flex items-center justify-between gap-6 flex-wrap -mt-4">
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted pointer-events-none" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search projects"
            className="pl-9"
            aria-label="Search projects"
          />
        </div>
        <Segmented options={FILTERS} value={filter} onChange={setFilter} />
      </div>

      <section className={cn("grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-7 gap-y-10")}>
        {shown.map((p) => (
          <ProjectTicket key={p.id} p={p} />
        ))}
      </section>

      {shown.length === 0 && (
        <p className="text-center text-body text-text-muted py-20">
          No projects match &ldquo;{q}&rdquo;.
        </p>
      )}
    </Page>
  );
}
