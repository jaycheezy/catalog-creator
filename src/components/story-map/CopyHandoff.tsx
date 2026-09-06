'use client';
import { useState } from 'react';
export function CopyHandoff({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  return <div>
    <button className="rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-medium text-violet-800 hover:bg-violet-50" onClick={async () => {
      try { await navigator.clipboard.writeText(text); setState('copied'); }
      catch { setState('failed'); }
    }}>{state === 'copied' ? 'Copied handoff' : 'Copy agent handoff'}</button>
    <span role="status" className="ml-2 text-xs text-zinc-600">{state === 'copied' ? 'Ready to paste into an agent task.' : state === 'failed' ? 'Clipboard unavailable. Select the handoff below.' : ''}</span>
    {state === 'failed' && <textarea aria-label="Agent handoff" readOnly value={text} onFocus={event => event.currentTarget.select()} className="mt-2 h-56 w-full rounded border p-3 text-xs" />}
  </div>;
}
