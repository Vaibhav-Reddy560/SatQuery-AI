import { useNavigate } from "react-router-dom";
import { ArrowRight, BookOpen, MessageSquare, Bug } from "lucide-react";
import { Page, Section } from "@/components/layout/Page";
import { useAppStore } from "@/store/useAppStore";

const EXAMPLES: { q: string; note: string }[] = [
  { q: "Find all water bodies near Mumbai", note: "Segments water and reports surface area per body." },
  { q: "What changed here since 2024?", note: "Compares two acquisitions and quantifies the difference." },
  { q: "Classify land cover in Punjab", note: "Returns per-class percentages and ground area." },
  { q: "Detect solar farms in Rajasthan", note: "Grounded object detection with confidence per instance." },
  { q: "Estimate deforestation in the Sundarbans", note: "Vegetation loss against a chosen baseline." },
  { q: "Measure the area of this lake", note: "Draw an area first, then ask." },
];

const RESOURCES = [
  { icon: BookOpen, title: "Documentation", body: "Query syntax, supported inputs and how the agent selects a tool." },
  { icon: MessageSquare, title: "Contact support", body: "Reach the team working on the SIH 2026 submission." },
  { icon: Bug, title: "Report an issue", body: "Something wrong with a result? Send the query and the trace." },
];

export default function Help() {
  const navigate = useNavigate();
  const setQueryInput = useAppStore((s) => s.setQueryInput);

  const ask = (q: string) => {
    setQueryInput(q);
    navigate("/query");
  };

  return (
    <Page
      title="Help"
      subtitle="What SatQuery can answer, and how to phrase it."
    >
      <Section title="What can I ask?" description="Click any example to run it.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
          {EXAMPLES.map((e) => (
            <button
              key={e.q}
              onClick={() => ask(e.q)}
              className="group flex items-start justify-between gap-4 text-left py-5 border-b border-border-subtle"
            >
              <div className="min-w-0">
                <div className="text-body text-text-primary">{e.q}</div>
                <p className="mt-1.5 text-body-sm text-text-muted">{e.note}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 mt-1 text-text-faint group-hover:text-atmos group-hover:translate-x-0.5 transition-all duration-200" />
            </button>
          ))}
        </div>
      </Section>

      <Section title="How it works">
        <ol className="space-y-6">
          {[
            ["Parse", "Your question is parsed into an intent, a location and a time range."],
            ["Select", "The agent picks the analysis tool that supports that intent."],
            ["Run", "The tool executes against the imagery for your area of interest."],
            ["Explain", "You get the answer, the confidence, and the trace showing how it was produced."],
          ].map(([step, body], i) => (
            <li key={step} className="flex gap-5">
              <span className="bevel flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-tertiary font-mono text-[0.8125rem] font-semibold text-phosphor">
                {i + 1}
              </span>
              <div>
                <div className="text-[0.9375rem] font-semibold text-text-primary">{step}</div>
                <p className="mt-1 text-body text-text-secondary">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Resources">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {RESOURCES.map((r) => {
            const Icon = r.icon;
            return (
              <div key={r.title}>
                <Icon className="h-5 w-5 text-atmos mb-4" />
                <h3 className="text-[0.9375rem] font-semibold text-text-primary">{r.title}</h3>
                <p className="mt-2 text-body-sm text-text-muted">{r.body}</p>
              </div>
            );
          })}
        </div>
      </Section>
    </Page>
  );
}
