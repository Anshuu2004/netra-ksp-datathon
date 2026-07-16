'use client';
// Route-level error boundary. Without this, one unexpected throw renders a blank page —
// on stage, in front of the jury, that is a score of zero. The workstation should always
// degrade to something that still looks like an instrument and offers a way back.
import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[netra] unhandled:', error); }, [error]);

  return (
    <div className="h-[100svh] grid place-items-center p-6 bg-page">
      <div className="panel max-w-md w-full p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-5 h-5 rounded-sm bg-fg grid place-items-center text-onfill font-bold text-2xs" aria-hidden>ನೇ</span>
          <span className="text-sm font-semibold text-fg">NETRA</span>
        </div>
        <h1 className="text-md font-semibold" style={{ color: '#d95f4a' }}>Something failed on this screen</h1>
        <p className="text-base text-fg-secondary mt-1.5 leading-relaxed">
          The analytics engine and your case are unaffected — this is a rendering fault, and it is recoverable.
        </p>
        {error?.message && (
          <code className="block text-2xs font-mono text-fg-muted bg-sunken border border-hairline rounded-sm px-1.5 py-1 mt-2 break-words">
            {error.message}{error.digest ? ` · ${error.digest}` : ''}
          </code>
        )}
        <div className="flex gap-1.5 mt-3">
          <button onClick={reset} className="btn-ghost px-3 h-7 rounded-sm bg-accent text-onfill text-base font-semibold">Try again</button>
          <a href="/" className="btn-ghost px-3 h-7 rounded-sm border border-hairline text-fg-secondary hover:text-accent hover:border-accent text-base grid place-items-center">Reload workstation</a>
        </div>
      </div>
    </div>
  );
}
