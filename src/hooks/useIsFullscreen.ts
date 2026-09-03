import { useEffect, useState } from "react";

/**
 * True when the browser is using the whole screen — either literal OS/
 * browser fullscreen (F11, the Fullscreen API, the green button on macOS)
 * or simply a maximised window.
 *
 * The first pass here only checked true fullscreen (`innerHeight` matching
 * `screen.height` — the browser's own chrome completely hidden). Direct
 * feedback: the scrollbar this drives was still showing up "while on full
 * screen" — the user meant a maximised window using their whole screen,
 * not literally hidden browser chrome. A maximised window still has tabs
 * and an address bar eating into `innerHeight`, so it would never match
 * `screen.height` and always read as "not fullscreen" under the old check.
 *
 * `outerHeight`/`outerWidth` (the WHOLE browser window, chrome included)
 * against `screen.availHeight`/`availWidth` (the OS-available area, taskbar
 * excluded) catches a maximised window correctly, and literal fullscreen
 * still passes it too (fullscreen is a strict superset — it fills even
 * more than `availHeight`). `document.fullscreenElement` is kept as an
 * explicit first check for the Fullscreen API case, which some browsers
 * report through `outerHeight` inconsistently.
 */
function computeIsFullscreen(): boolean {
  if (typeof window === "undefined") return false;
  if (document.fullscreenElement) return true;
  const tolerance = 4;
  return (
    window.outerHeight >= window.screen.availHeight - tolerance &&
    window.outerWidth >= window.screen.availWidth - tolerance
  );
}

export function useIsFullscreen(): boolean {
  const [isFullscreen, setIsFullscreen] = useState(computeIsFullscreen);

  useEffect(() => {
    const check = () => setIsFullscreen(computeIsFullscreen());

    window.addEventListener("resize", check);
    document.addEventListener("fullscreenchange", check);

    // `resize` alone left this stuck: on some browser/OS combinations it
    // does not fire when macOS's native fullscreen (the green traffic-light
    // button — an OS Space transition, not the Fullscreen API) finishes its
    // animation, so the hook kept reporting whatever was true at mount no
    // matter how many times fullscreen was toggled afterward. A
    // ResizeObserver on the root element is driven by the layout engine's
    // own box-size tracking rather than a dispatched event, so it still
    // catches the viewport change even when `resize` doesn't fire.
    const observer = new ResizeObserver(check);
    observer.observe(document.documentElement);

    return () => {
      window.removeEventListener("resize", check);
      document.removeEventListener("fullscreenchange", check);
      observer.disconnect();
    };
  }, []);

  return isFullscreen;
}
