import { useState, useEffect, useRef, useCallback } from 'react';
import { Wrench } from 'lucide-react';
import { subscribeToActiveJobs } from '../../services/firestoreJobs';
import { ALL_BAYS } from '../../data/rosters';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const bayLabelMap = Object.fromEntries(ALL_BAYS.map((b) => [b.id, b.label]));

function getBayLabel(bayId) {
  if (!bayId) return null;
  return bayLabelMap[bayId] || bayId;
}

// ---------------------------------------------------------------------------
// LiveClock — updates every second, shows day/date + time
// ---------------------------------------------------------------------------

function LiveClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const day = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Manila' });
  const date = now.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  });
  const time = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila',
  });

  return (
    <div className="text-right text-white" style={{ fontSize: 'clamp(1rem, 1.5vw, 1.25rem)' }}>
      <div className="font-medium">{day}, {date}</div>
      <div className="font-mono opacity-80">{time}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AutoScrollPanel — scrolls slowly when content overflows
// ---------------------------------------------------------------------------

function AutoScrollPanel({ children, className = '' }) {
  const outerRef = useRef(null);
  const rafRef = useRef(null);
  const pauseUntilRef = useRef(0);
  const directionRef = useRef('down'); // 'down' | 'pausing' | 'up'

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;

    function tick() {
      const maxScroll = el.scrollHeight - el.clientHeight;

      if (maxScroll <= 0) {
        // No overflow — nothing to scroll
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const now = Date.now();

      if (directionRef.current === 'down') {
        el.scrollTop += 0.5;
        if (el.scrollTop >= maxScroll) {
          directionRef.current = 'pausing';
          pauseUntilRef.current = now + 4000;
        }
      } else if (directionRef.current === 'pausing') {
        if (now >= pauseUntilRef.current) {
          directionRef.current = 'up';
          el.scrollTo({ top: 0, behavior: 'smooth' });
          // Wait a moment for smooth scroll to finish then resume
          pauseUntilRef.current = now + 2000;
        }
      } else if (directionRef.current === 'up') {
        if (now >= pauseUntilRef.current) {
          directionRef.current = 'down';
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div ref={outerRef} className={`overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status, bayId }) {
  const isAwaiting = status === 'AWAITING_PARTS';
  const label = isAwaiting ? 'Awaiting Parts' : 'In Service';
  const colors = isAwaiting
    ? 'bg-amber-100 text-amber-800 border-amber-300'
    : 'bg-blue-100 text-blue-800 border-blue-300';
  const bay = getBayLabel(bayId);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span
        className={`inline-flex items-center px-3 py-1 rounded-full border font-semibold ${colors}`}
        style={{ fontSize: 'clamp(1rem, 1.5vw, 1.5rem)' }}
      >
        {label}
      </span>
      {bay && (
        <span
          className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-300 font-medium"
          style={{ fontSize: 'clamp(1rem, 1.5vw, 1.5rem)' }}
        >
          {bay}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Now Serving Card
// ---------------------------------------------------------------------------

function NowServingCard({ job }) {
  return (
    <div className="bg-white rounded-xl shadow-md border border-emerald-200 p-5 flex items-center gap-5">
      <div
        className="bg-emerald-600 text-white font-bold rounded-lg px-4 py-3 text-center min-w-[100px] shrink-0"
        style={{ fontSize: 'clamp(2.5rem, 4vw, 4rem)', lineHeight: 1.1 }}
      >
        {job.queueNumber}
      </div>
      <div className="flex flex-col gap-2 min-w-0">
        <div
          className="font-semibold text-gray-900 truncate"
          style={{ fontSize: 'clamp(1.25rem, 2vw, 2rem)' }}
        >
          {[job.year, job.make, job.model].filter(Boolean).join(' ')}
        </div>
        <StatusBadge status={job.status} bayId={job.assignedBay} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// In Queue Card
// ---------------------------------------------------------------------------

function InQueueCard({ job, position, total }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-4 flex items-center gap-4">
      <div
        className="bg-blue-600 text-white font-bold rounded-lg px-3 py-2 text-center min-w-[90px] shrink-0"
        style={{ fontSize: 'clamp(2rem, 3.5vw, 3.5rem)', lineHeight: 1.1 }}
      >
        {job.queueNumber}
      </div>
      <div className="flex flex-col gap-1 min-w-0">
        <div
          className="font-semibold text-gray-900 truncate"
          style={{ fontSize: 'clamp(1.25rem, 2vw, 2rem)' }}
        >
          {[job.year, job.make, job.model].filter(Boolean).join(' ')}
        </div>
        <div
          className="text-gray-500 font-medium"
          style={{ fontSize: 'clamp(1rem, 1.5vw, 1.5rem)' }}
        >
          Position {position} of {total}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QueueDisplay (main component)
// ---------------------------------------------------------------------------

export default function QueueDisplay() {
  const [jobs, setJobs] = useState([]);
  const [connected, setConnected] = useState(false);
  const cursorTimerRef = useRef(null);
  const [showCursor, setShowCursor] = useState(true);

  // ---- Firestore subscription ----
  useEffect(() => {
    const unsub = subscribeToActiveJobs((data) => {
      setJobs(data);
      setConnected(true);
    });
    return () => unsub();
  }, []);

  // ---- Kiosk: hide cursor after 3s inactivity ----
  const resetCursorTimer = useCallback(() => {
    setShowCursor(true);
    if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
    cursorTimerRef.current = setTimeout(() => setShowCursor(false), 3000);
  }, []);

  useEffect(() => {
    resetCursorTimer();
    window.addEventListener('mousemove', resetCursorTimer);
    window.addEventListener('mousedown', resetCursorTimer);
    return () => {
      window.removeEventListener('mousemove', resetCursorTimer);
      window.removeEventListener('mousedown', resetCursorTimer);
      if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
    };
  }, [resetCursorTimer]);

  // ---- Kiosk: disable context menu ----
  useEffect(() => {
    const handler = (e) => e.preventDefault();
    document.addEventListener('contextmenu', handler);
    return () => document.removeEventListener('contextmenu', handler);
  }, []);

  // ---- Filter & sort ----
  const nowServing = jobs
    .filter(
      (j) =>
        !j.isCanceled &&
        (j.status === 'IN_SERVICE' || j.status === 'AWAITING_PARTS')
    )
    .sort((a, b) => (a.queueNumber || '').localeCompare(b.queueNumber || ''));

  const inQueue = jobs
    .filter((j) => !j.isCanceled && j.status === 'WAITLIST')
    .sort((a, b) => (a.queueNumber || '').localeCompare(b.queueNumber || ''));

  const noJobsAtAll = nowServing.length === 0 && inQueue.length === 0;

  // ---- Full-screen empty state ----
  if (noJobsAtAll) {
    return (
      <div
        className={`h-screen w-screen bg-gray-50 flex flex-col select-none ${showCursor ? '' : 'cursor-none'}`}
      >
        {/* Header */}
        <Header />

        {/* Centered empty */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-gray-400">
          <Wrench size={72} strokeWidth={1.5} />
          <div style={{ fontSize: 'clamp(2rem, 3vw, 3rem)' }} className="font-bold text-gray-500">
            No active jobs today
          </div>
          <div style={{ fontSize: 'clamp(1.25rem, 2vw, 2rem)' }} className="text-gray-400">
            CBROS Auto Service
          </div>
        </div>

        {/* Footer */}
        <Footer
          servingCount={0}
          waitingCount={0}
          connected={connected}
        />
      </div>
    );
  }

  // ---- Main layout ----
  return (
    <div
      className={`h-screen w-screen bg-gray-50 flex flex-col overflow-hidden select-none ${showCursor ? '' : 'cursor-none'}`}
    >
      {/* Header */}
      <Header />

      {/* Panels */}
      <div className="flex-1 flex min-h-0">
        {/* Now Serving panel */}
        <div className="flex-[55] flex flex-col border-r border-gray-200 min-h-0">
          {/* Section header */}
          <div className="bg-emerald-50 px-6 py-3 flex items-center gap-3 border-b border-emerald-200 shrink-0">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
            <span
              className="font-bold text-emerald-800 tracking-wide"
              style={{ fontSize: 'clamp(2rem, 3vw, 3rem)' }}
            >
              NOW SERVING
            </span>
            <span
              className="ml-auto bg-emerald-600 text-white rounded-full px-3 py-0.5 font-bold"
              style={{ fontSize: 'clamp(1rem, 1.5vw, 1.5rem)' }}
            >
              {nowServing.length}
            </span>
          </div>

          {/* Cards */}
          <AutoScrollPanel className="flex-1 min-h-0">
            {nowServing.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400 p-8">
                <span style={{ fontSize: 'clamp(1.25rem, 2vw, 2rem)' }}>
                  No vehicles currently being serviced
                </span>
              </div>
            ) : (
              <div className="p-4 flex flex-col gap-4">
                {nowServing.map((job) => (
                  <NowServingCard key={job.id} job={job} />
                ))}
              </div>
            )}
          </AutoScrollPanel>
        </div>

        {/* In Queue panel */}
        <div className="flex-[45] flex flex-col min-h-0">
          {/* Section header */}
          <div className="bg-blue-50 px-6 py-3 flex items-center gap-3 border-b border-blue-200 shrink-0">
            <span style={{ fontSize: 'clamp(1.5rem, 2vw, 2rem)' }}>&#9203;</span>
            <span
              className="font-bold text-blue-800 tracking-wide"
              style={{ fontSize: 'clamp(2rem, 3vw, 3rem)' }}
            >
              IN QUEUE
            </span>
            <span
              className="ml-auto bg-blue-600 text-white rounded-full px-3 py-0.5 font-bold"
              style={{ fontSize: 'clamp(1rem, 1.5vw, 1.5rem)' }}
            >
              {inQueue.length}
            </span>
          </div>

          {/* Cards */}
          <AutoScrollPanel className="flex-1 min-h-0">
            {inQueue.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8 gap-2">
                <span style={{ fontSize: 'clamp(1.5rem, 2vw, 2rem)' }}>&#10004;</span>
                <span style={{ fontSize: 'clamp(1.25rem, 2vw, 2rem)' }}>
                  No vehicles waiting — queue is clear!
                </span>
              </div>
            ) : (
              <div className="p-4 flex flex-col gap-3">
                {inQueue.map((job, idx) => (
                  <InQueueCard
                    key={job.id}
                    job={job}
                    position={idx + 1}
                    total={inQueue.length}
                  />
                ))}
              </div>
            )}
          </AutoScrollPanel>
        </div>
      </div>

      {/* Footer */}
      <Footer
        servingCount={nowServing.length}
        waitingCount={inQueue.length}
        connected={connected}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function Header() {
  return (
    <div className="bg-gray-900 px-6 py-3 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3 text-white">
        <Wrench size={32} />
        <span className="font-bold" style={{ fontSize: 'clamp(1.5rem, 2.5vw, 2.5rem)' }}>
          CBROS Auto Service
        </span>
      </div>
      <LiveClock />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function Footer({ servingCount, waitingCount, connected }) {
  return (
    <div
      className="bg-gray-900 px-6 py-2 flex items-center justify-between text-white shrink-0"
      style={{ fontSize: 'clamp(1rem, 1.5vw, 1.25rem)' }}
    >
      <div className="flex items-center gap-6">
        <span>
          In service: <strong>{servingCount}</strong>
        </span>
        <span>
          Waiting: <strong>{waitingCount}</strong>
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="opacity-80">Thank you for your patience!</span>
        <Wrench size={18} className="opacity-60" />
        <span className="relative flex h-2.5 w-2.5">
          {connected ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </>
          ) : (
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          )}
        </span>
      </div>
    </div>
  );
}
