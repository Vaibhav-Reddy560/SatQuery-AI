import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Root safety net.
 *
 * Without this, ANY uncaught render error anywhere in the tree — a bad prop,
 * a third-party library throwing (MapLibre does this synchronously when it
 * can't acquire a WebGL context) — unmounts the entire app, not just the
 * component that failed. React's default behaviour with no boundary is to
 * clear the whole root to blank.
 */

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("SatQuery: unhandled error", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-dvh items-center justify-center bg-bg-primary px-8">
          <div className="max-w-md text-center">
            <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-danger-muted">
              <AlertTriangle className="h-5 w-5 text-danger" />
            </div>
            <h1 className="text-heading text-text-primary">Something went wrong</h1>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-text-secondary">
              This view hit an error and couldn't render. Reloading usually fixes it.
            </p>
            <Button
              variant="primary"
              className="mt-7"
              onClick={() => {
                this.setState({ error: null });
                window.location.reload();
              }}
            >
              Reload
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
