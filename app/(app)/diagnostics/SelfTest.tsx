// File: app/(app)/diagnostics/SelfTest.tsx
'use client';

import { useState } from 'react';
import { runSelfTest } from './actions';

type Result = {
  id: string;
  name: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  detail: string;
  recommendation?: string;
};

type TestRun = {
  runId: string;
  startedAt: string;
  finishedAt: string;
  results: Result[];
};

const manualChecks = [
  'Browser navigation across authenticated routes',
  'Responsive layout at phone, tablet, and desktop widths',
  'Keyboard navigation through links, forms, and controls',
  'Visible focus indication on interactive controls',
  'Confirmation dialogs and destructive-action wording',
  'Full export and report-download behavior',
  'Cross-account direct-URL isolation testing',
  'Visual empty and unavailable states',
  'Browser back and forward behavior'
];

export default function SelfTest() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [meta, setMeta] = useState<TestRun | null>(null);

  async function run() {
    setRunning(true);
    setDone(0);
    setTotal(0);
    setResults([]);

    try {
      const testRun = await runSelfTest();
      setMeta(testRun);
      setTotal(testRun.results.length);

      for (let index = 0; index < testRun.results.length; index += 1) {
        setResults(testRun.results.slice(0, index + 1));
        setDone(index + 1);
        await new Promise((resolve) => setTimeout(resolve, 60));
      }
    } finally {
      setRunning(false);
    }
  }

  const passed = results.filter((result) => result.status === 'PASS').length;
  const warned = results.filter((result) => result.status === 'WARN').length;
  const failed = results.filter((result) => result.status === 'FAIL').length;
  const overall = failed
    ? 'FAILED'
    : warned
      ? 'WARNING'
      : results.length
        ? 'HEALTHY'
        : 'NOT RUN';
  const percentage = total > 0
    ? Math.min(100, Math.round((done / total) * 100))
    : 0;
  const manualReport =
    '\n\nManual Verification Checklist (not included in automated totals)\n' +
    manualChecks.map((check) => `[ ] ${check}`).join('\n');
  const report =
    `Personal OS Self-Test\nStatus: ${overall}\n` +
    `Run: ${meta?.runId ?? ''}\nStarted: ${meta?.startedAt ?? ''}\n` +
    `Finished: ${meta?.finishedAt ?? ''}\n` +
    `PASS ${passed} WARN ${warned} FAIL ${failed}\n\n` +
    results
      .map(
        (result) =>
          `${result.status} ${result.id} ${result.name}: ${result.detail}` +
          (result.recommendation
            ? ` | Suggested: ${result.recommendation}`
            : '')
      )
      .join('\n') + manualReport;

  function download() {
    const blob = new Blob([report], { type: 'text/plain' });
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = 'personal-os-self-test.txt';
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }

  return (
    <section>
      <h2>Self-Test</h2>
      <p>
        Runs the current read-only diagnostic catalog. No user records are
        created, changed, archived, restored, or deleted.
      </p>
      <button onClick={run} disabled={running}>
        {running ? 'Running Self-Test...' : 'Run Self-Test'}
      </button>

      <h3>Progress</h3>
      <progress value={done} max={total || 1} style={{ width: '100%' }} />
      <p>
        {done} of {total} tests completed · {percentage}%
      </p>

      {results.map((result) => (
        <p key={result.id}>
          <strong>
            {result.status} · {result.id} · {result.name}
          </strong>
          <br />
          {result.detail}
          {result.recommendation ? (
            <>
              <br />
              <strong>Suggested action:</strong> {result.recommendation}
            </>
          ) : null}
        </p>
      ))}

      <section>
        <h3>Manual Verification Checklist</h3>
        <p>
          Manual checks are not included in automated PASS, WARN, or FAIL
          totals and are never marked complete automatically.
        </p>
        <ul>
          {manualChecks.map((check) => (
            <li key={check}>☐ {check}</li>
          ))}
        </ul>
      </section>

      {results.length && !running ? (
        <>
          <h3>Overall status: {overall}</h3>
          <p>
            PASS {passed} · WARN {warned} · FAIL {failed}
          </p>
          <button onClick={() => navigator.clipboard.writeText(report)}>
            Copy Report
          </button>{' '}
          <button onClick={download}>Download Report</button>
        </>
      ) : null}
    </section>
  );
}
