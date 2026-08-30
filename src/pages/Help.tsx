import { HelpCircle, MessageSquare, BookOpen, Bug, Construction } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";

const helpLinks = [
  {
    icon: BookOpen,
    title: "Documentation",
    description: "Explore the SatQuery user guide and API documentation",
    status: "coming-soon",
  },
  {
    icon: MessageSquare,
    title: "Contact Support",
    description: "Reach out to the SatQuery team for assistance",
    status: "coming-soon",
  },
  {
    icon: Bug,
    title: "Report an Issue",
    description: "Found a bug? Let us know so we can fix it",
    status: "coming-soon",
  },
];

export default function Help() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
        <HelpCircle className="h-5 w-5 text-accent" />
        Help & Support
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {helpLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Card key={link.title} className="hover:border-border-default transition-colors cursor-pointer">
              <CardContent>
                <div className="p-2 rounded-lg bg-bg-tertiary inline-flex mb-3">
                  <Icon className="h-5 w-5 text-accent" />
                </div>
                <h3 className="text-sm font-semibold text-text-primary mb-1">{link.title}</h3>
                <p className="text-xs text-text-muted">{link.description}</p>
                <div className="mt-3 flex items-center gap-1 text-[11px] text-warning font-medium">
                  <Construction className="h-3 w-3" />
                  Coming Soon
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent>
          <div className="text-center py-6">
            <p className="text-sm text-text-muted mb-2">
              SatQuery v0.1.0 — Built for SIH 2026
            </p>
            <p className="text-xs text-text-muted">
              An interactive vision-language assistant for remote sensing and satellite image analysis.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
