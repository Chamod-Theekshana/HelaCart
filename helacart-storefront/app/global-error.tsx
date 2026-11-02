"use client";

import "./globals.css";
import "./hardening.css";

// Replaces the root layout, so no providers are available: keep the copy here.
const copy = {
  en: {
    title: "HelaCart is having trouble",
    text: "Something went wrong while loading this page. Please try again.",
    retry: "Try again",
    home: "Go to the home page",
  },
  si: {
    title: "HelaCart හි ගැටලුවක් ඇත",
    text: "මෙම පිටුව පූරණය කිරීමේදී දෝෂයක් ඇති විය. කරුණාකර නැවත උත්සාහ කරන්න.",
    retry: "නැවත උත්සාහ කරන්න",
    home: "මුල් පිටුවට යන්න",
  },
  ta: {
    title: "HelaCart இல் சிக்கல் ஏற்பட்டுள்ளது",
    text: "இந்தப் பக்கத்தை ஏற்றும்போது ஏதோ தவறு நடந்தது. மீண்டும் முயற்சிக்கவும்.",
    retry: "மீண்டும் முயற்சிக்கவும்",
    home: "முகப்புப் பக்கத்திற்குச் செல்லவும்",
  },
} as const;

function currentLocale(): keyof typeof copy {
  if (typeof document === "undefined") return "en";
  const value = /(?:^|;\s*)hc_lang=(en|si|ta)(?:;|$)/.exec(
    document.cookie,
  )?.[1];
  return value === "si" || value === "ta" ? value : "en";
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = currentLocale();
  const text = copy[locale];
  return (
    <html lang={locale}>
      <body>
        <main className="container app-state">
          <div className="empty-panel" role="alert">
            <span className="app-state-code" aria-hidden="true">
              !
            </span>
            <h1>{text.title}</h1>
            <p>{text.text}</p>
            {error.digest && <small>Ref: {error.digest}</small>}
            <div className="inline-actions">
              <button className="primary-btn" type="button" onClick={reset}>
                {text.retry}
              </button>
              {/* A full page load is intended: the app shell has failed. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a className="outline-btn" href="/">
                {text.home}
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
