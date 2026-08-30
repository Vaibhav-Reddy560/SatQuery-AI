import { Settings as SettingsIcon, Construction } from "lucide-react";

export default function Settings() {
  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-6">
        <SettingsIcon className="h-5 w-5 text-accent" />
        Settings
      </h2>

      <div className="bg-bg-secondary border border-border-subtle rounded-lg p-12 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-warning-muted mb-4">
          <Construction className="h-7 w-7 text-warning" />
        </div>
        <h3 className="text-base font-semibold text-text-primary mb-2">Coming Soon</h3>
        <p className="text-sm text-text-muted max-w-md mx-auto">
          Settings will allow you to configure your account preferences, API keys, notification settings,
          map defaults, and display options. This feature is under development.
        </p>
      </div>
    </div>
  );
}
