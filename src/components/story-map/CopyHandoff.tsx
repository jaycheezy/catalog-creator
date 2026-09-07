'use client';
import { useState } from 'react';
export function CopyHandoff({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  return <div>
    <button className="rounded-lg bg-[#635bff] px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/25 transition hover:bg-[#4f46e5]" onClick={async () => {
      try { await navigator.clipboard.writeText(text); setState('copied'); }
      catch { setState('failed'); }
    }}>{state === 'copied' ? 'Copied handoff' : 'Copy agent handoff'}</button>
    <span role="status" className="ml-2 text-xs text-slate-500">{state === 'copied' ? 'Ready to paste into an agent task.' : state === 'failed' ? 'Clipboard unavailable. Select the handoff below.' : ''}</span>
    {state === 'failed' && <textarea aria-label="Agent handoff" readOnly value={text} onFocus={event => event.currentTarget.select()} className="mt-2 h-56 w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs text-slate-700" />}
  </div>;
}
