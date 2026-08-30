import { useState } from "react";
import {
  FileText,
  Plus,
  Download,
  Eye,
  Clock,
  CheckCircle,
  FileEdit,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { reports } from "@/data/mockData";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";

const statusIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  draft: FileEdit,
  generated: CheckCircle,
  exported: ExternalLink,
};

export default function Reports() {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <FileText className="h-5 w-5 text-accent" />
            Reports
          </h2>
          <p className="text-sm text-text-muted mt-1">
            Generate and manage satellite analysis reports
          </p>
        </div>
        <button className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-accent rounded-lg hover:bg-accent-hover transition-colors">
          <Plus className="h-4 w-4" />
          Generate Report
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Reports List */}
        <div className="lg:col-span-2 space-y-3">
          {reports.map((report) => {
            const StatusIcon = statusIcons[report.status] ?? FileText;
            return (
              <button
                key={report.id}
                onClick={() => setSelectedReport(report.id)}
                className={cn(
                  "w-full text-left p-4 rounded-lg border transition-all",
                  selectedReport === report.id
                    ? "border-accent bg-accent-muted/30"
                    : "border-border-subtle bg-bg-secondary hover:border-border-default hover:bg-bg-hover"
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <StatusIcon className="h-4 w-4 text-text-muted" />
                    <StatusBadge status={report.status} />
                  </div>
                  <Badge>{report.pageCount} pages</Badge>
                </div>
                <h3 className="text-sm font-semibold text-text-primary mb-1">{report.title}</h3>
                <p className="text-xs text-text-muted mb-2">{report.projectName}</p>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-text-muted" />
                  <span className="text-[11px] text-text-muted">
                    {report.generatedAt
                      ? `Generated ${formatDate(report.generatedAt)}`
                      : `Created ${formatDate(report.createdAt)}`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Report Preview */}
        <div className="lg:col-span-3">
          <Card className="sticky top-6">
            {selectedReport ? (
              (() => {
                const report = reports.find((r) => r.id === selectedReport);
                if (!report) return null;
                return (
                  <>
                    <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-text-primary">{report.title}</h3>
                        <p className="text-xs text-text-muted mt-0.5">{report.projectName}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="p-2 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button className="p-2 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors">
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="p-5">
                      {/* Simulated report preview */}
                      <div className="bg-bg-primary border border-border-subtle rounded-lg p-8 min-h-[500px]">
                        <div className="text-center mb-8">
                          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-accent-muted mb-3">
                            <Satellite className="h-5 w-5 text-accent" />
                          </div>
                          <h2 className="text-lg font-bold text-text-primary">{report.title}</h2>
                          <p className="text-sm text-text-muted mt-1">Generated by SatQuery AI</p>
                          <p className="text-xs text-text-muted">{report.generatedAt ? formatDate(report.generatedAt) : formatDate(report.createdAt)}</p>
                        </div>

                        <div className="space-y-6">
                          <div>
                            <h3 className="text-sm font-semibold text-text-primary mb-2 uppercase tracking-wider">Summary</h3>
                            <p className="text-sm text-text-secondary leading-relaxed">{report.summary}</p>
                          </div>

                          <div>
                            <h3 className="text-sm font-semibold text-text-primary mb-2 uppercase tracking-wider">Key Findings</h3>
                            <ul className="space-y-1.5">
                              <li className="flex items-start gap-2 text-sm text-text-secondary">
                                <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                                Analysis covered {report.pageCount} pages of detailed satellite imagery assessment
                              </li>
                              <li className="flex items-start gap-2 text-sm text-text-secondary">
                                <span className="w-1.5 h-1.5 rounded-full bg-success mt-1.5 shrink-0" />
                                All detection algorithms achieved &gt;85% confidence threshold
                              </li>
                              <li className="flex items-start gap-2 text-sm text-text-secondary">
                                <span className="w-1.5 h-1.5 rounded-full bg-warning mt-1.5 shrink-0" />
                                Results cross-validated with ground-truth data where available
                              </li>
                            </ul>
                          </div>

                          <div>
                            <h3 className="text-sm font-semibold text-text-primary mb-2 uppercase tracking-wider">Methodology</h3>
                            <p className="text-sm text-text-secondary leading-relaxed">
                              Multi-spectral satellite imagery was processed using supervised classification
                              algorithms with random forest and deep learning models. Change detection employed
                              post-classification comparison with pixel-level accuracy assessment.
                            </p>
                          </div>

                          <div className="pt-4 border-t border-border-subtle text-center">
                            <p className="text-xs text-text-muted">
                              Page 1 of {report.pageCount} &middot; Confidential — For authorized use only
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()
            ) : (
              <div className="p-12 flex flex-col items-center justify-center text-center min-h-[500px]">
                <FileText className="h-10 w-10 text-text-muted mb-3" />
                <p className="text-sm text-text-muted">Select a report to preview</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

// Small helper component
function Satellite({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 7L9 3 5 7l4 4" />
      <path d="M17 11l4 4-4 4-4-4" />
      <path d="M8 12l4 4 6-6-4-4-4 4" />
      <path d="M16 3l4 4" />
      <circle cx="12" cy="12" r="1" />
    </svg>
  );
}
