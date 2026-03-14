import { useState, useEffect, useRef, useCallback } from 'react';
import { subscribeToActiveJobs } from '../../services/firestoreJobs';
import { ALL_BAYS } from '../../data/rosters';

// ---------------------------------------------------------------------------
// Helpers — WebOS-safe (no optional chaining, no nullish coalescing)
// ---------------------------------------------------------------------------

var bayLabelMap = {};
ALL_BAYS.forEach(function (b) {
  bayLabelMap[b.id] = b.label;
});

function getBayLabel(bayId) {
  if (!bayId) return null;
  var internal = bayLabelMap[bayId] || bayId;
  var num = internal.match(/\d+/);
  return num ? 'Bay ' + num[0] : internal;
}

function getPlateNumber(job) {
  return (job && job.plateNumber) ? job.plateNumber : '';
}

function getVehicleText(job) {
  var parts = [];
  if (job.year) parts.push(job.year);
  if (job.make) parts.push(job.make);
  if (job.model) parts.push(job.model);
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Inline style constants — TV-readable sizes, no clamp()
// Uses vw for scaling with px minimums via Math.max at render time
// ---------------------------------------------------------------------------

var STYLES = {
  // Header
  headerBar: {
    background: '#111827',
    padding: '12px 24px',
    display: 'flex',
    WebkitBoxAlign: 'center',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  headerTitle: {
    color: '#ffffff',
    fontWeight: 800,
    fontSize: '2.5rem',
    letterSpacing: '0.02em',
    display: 'flex',
    WebkitBoxAlign: 'center',
    alignItems: 'center',
  },
  headerIcon: {
    width: 36,
    height: 36,
    marginRight: 12,
    color: '#ffffff',
  },
  clockWrap: {
    textAlign: 'right',
    color: '#ffffff',
  },
  clockDate: {
    fontSize: '1.25rem',
    fontWeight: 500,
  },
  clockTime: {
    fontSize: '1.15rem',
    fontFamily: 'monospace',
    opacity: 0.8,
  },

  // Footer
  footerBar: {
    background: '#111827',
    padding: '10px 24px',
    display: 'flex',
    WebkitBoxAlign: 'center',
    alignItems: 'center',
    justifyContent: 'space-between',
    color: '#ffffff',
    fontSize: '1.25rem',
    flexShrink: 0,
  },
  footerStats: {
    display: 'flex',
    WebkitBoxAlign: 'center',
    alignItems: 'center',
  },
  footerStatItem: {
    marginRight: 24,
  },
  footerRight: {
    display: 'flex',
    WebkitBoxAlign: 'center',
    alignItems: 'center',
  },
  footerThankYou: {
    opacity: 0.8,
    marginRight: 12,
  },

  // Panel containers
  panelsRow: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  leftPanel: {
    flex: '55 1 0%',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    borderRight: '1px solid #e5e7eb',
  },
  rightPanel: {
    flex: '45 1 0%',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },

  // Section headers
  sectionHeaderLeft: {
    background: '#ecfdf5',
    padding: '12px 24px',
    display: 'flex',
    WebkitBoxAlign: 'center',
    alignItems: 'center',
    borderBottom: '1px solid #a7f3d0',
    flexShrink: 0,
  },
  sectionHeaderRight: {
    background: '#eff6ff',
    padding: '12px 24px',
    display: 'flex',
    WebkitBoxAlign: 'center',
    alignItems: 'center',
    borderBottom: '1px solid #bfdbfe',
    flexShrink: 0,
  },
  sectionHeaderText: {
    fontWeight: 800,
    letterSpacing: '0.04em',
    fontSize: '3rem',
  },
  sectionHeaderTextGreen: {
    color: '#065f46',
  },
  sectionHeaderTextBlue: {
    color: '#1e40af',
  },
  sectionCount: {
    fontWeight: 500,
    opacity: 0.7,
  },
  sectionCountGreen: {
    color: '#059669',
  },
  sectionCountBlue: {
    color: '#2563eb',
  },

  // Now Serving card
  nsCard: {
    background: '#f0fdf4',
    borderRadius: 12,
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    border: '1px solid #a7f3d0',
    borderLeft: '5px solid #10b981',
    padding: '20px 20px',
    display: 'flex',
    WebkitBoxAlign: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  nsQueueBadge: {
    background: '#059669',
    color: '#ffffff',
    fontWeight: 800,
    borderRadius: 10,
    padding: '12px 14px',
    textAlign: 'center',
    flexShrink: 0,
    fontSize: '3.5rem',
    lineHeight: 1.1,
    marginRight: 20,
  },
  nsCardBody: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    flex: 1,
  },
  nsPlate: {
    fontWeight: 800,
    fontSize: '2.5rem',
    color: '#111827',
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  nsVehicle: {
    fontWeight: 600,
    fontSize: '2rem',
    color: '#374151',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginTop: 4,
  },
  nsTagRow: {
    display: 'flex',
    WebkitBoxAlign: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  awaitingBadge: {
    display: 'inline-flex',
    WebkitBoxAlign: 'center',
    alignItems: 'center',
    padding: '2px 12px',
    borderRadius: 20,
    background: '#fef3c7',
    color: '#92400e',
    border: '1px solid #fcd34d',
    fontWeight: 700,
    fontSize: '1.5rem',
    marginRight: 10,
  },
  bayPill: {
    display: 'inline-flex',
    WebkitBoxAlign: 'center',
    alignItems: 'center',
    padding: '2px 12px',
    borderRadius: 20,
    background: '#f3f4f6',
    color: '#6b7280',
    fontWeight: 500,
    fontSize: '1.5rem',
  },

  // In Queue card
  iqCard: {
    background: '#ffffff',
    borderRadius: 10,
    border: '1px solid #e5e7eb',
    padding: '12px 16px',
    display: 'flex',
    WebkitBoxAlign: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  iqQueueBadge: {
    background: '#2563eb',
    color: '#ffffff',
    fontWeight: 800,
    borderRadius: 8,
    padding: '8px 10px',
    textAlign: 'center',
    flexShrink: 0,
    fontSize: '2.5rem',
    lineHeight: 1.1,
    marginRight: 16,
  },
  iqCardBody: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    flex: 1,
  },
  iqPlate: {
    fontWeight: 800,
    fontSize: '2rem',
    color: '#111827',
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  iqVehicle: {
    fontWeight: 600,
    fontSize: '1.5rem',
    color: '#4b5563',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginTop: 2,
  },
  iqPosition: {
    color: '#9ca3af',
    fontWeight: 500,
    fontSize: '1.25rem',
    marginTop: 2,
  },

  // Card list padding
  cardList: {
    padding: 16,
  },

  // Empty states
  emptyCenter: {
    display: 'flex',
    flexDirection: 'column',
    WebkitBoxAlign: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: 32,
    color: '#9ca3af',
  },
  emptyText: {
    fontSize: '2rem',
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: '2rem',
    color: '#9ca3af',
    textAlign: 'center',
  },

  // Full page container
  page: {
    height: '100vh',
    width: '100vw',
    background: '#f9fafb',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    WebkitUserSelect: 'none',
    userSelect: 'none',
  },

  // Pulsing dot (connection indicator)
  dotOuter: {
    position: 'relative',
    width: 10,
    height: 10,
    marginLeft: 12,
    display: 'inline-block',
  },
  dotInner: {
    position: 'relative',
    display: 'inline-block',
    width: 10,
    height: 10,
    borderRadius: '50%',
  },

  // Pulsing dot for NOW SERVING header
  servingDotOuter: {
    position: 'relative',
    width: 14,
    height: 14,
    marginRight: 12,
    display: 'inline-block',
    flexShrink: 0,
  },
  servingDotInner: {
    position: 'relative',
    display: 'inline-block',
    width: 14,
    height: 14,
    borderRadius: '50%',
    background: '#10b981',
  },
};

// ---------------------------------------------------------------------------
// CSS keyframes injected once (with -webkit- prefix for WebOS)
// ---------------------------------------------------------------------------

var stylesInjected = false;
function injectGlobalStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  var css = [
    '@-webkit-keyframes qd-pulse {',
    '  0%, 100% { opacity: 1; -webkit-transform: scale(1); transform: scale(1); }',
    '  50% { opacity: 0.5; -webkit-transform: scale(1.5); transform: scale(1.5); }',
    '}',
    '@keyframes qd-pulse {',
    '  0%, 100% { opacity: 1; transform: scale(1); }',
    '  50% { opacity: 0.5; transform: scale(1.5); }',
    '}',
    '.qd-pulse-green {',
    '  -webkit-animation: qd-pulse 2s ease-in-out infinite;',
    '  animation: qd-pulse 2s ease-in-out infinite;',
    '  background: #22c55e;',
    '  border-radius: 50%;',
    '  position: absolute;',
    '  top: 0; left: 0; right: 0; bottom: 0;',
    '}',
    '.qd-pulse-red {',
    '  -webkit-animation: qd-pulse 2s ease-in-out infinite;',
    '  animation: qd-pulse 2s ease-in-out infinite;',
    '  background: #ef4444;',
    '  border-radius: 50%;',
    '  position: absolute;',
    '  top: 0; left: 0; right: 0; bottom: 0;',
    '}',
    '.qd-pulse-emerald {',
    '  -webkit-animation: qd-pulse 2s ease-in-out infinite;',
    '  animation: qd-pulse 2s ease-in-out infinite;',
    '  background: #34d399;',
    '  border-radius: 50%;',
    '  position: absolute;',
    '  top: 0; left: 0; right: 0; bottom: 0;',
    '}',
    '.qd-cursor-none { cursor: none !important; }',
    '.qd-cursor-none * { cursor: none !important; }',
    // Wrench SVG icon (inline, no lucide-react dependency for this component)
  ].join('\n');

  var style = document.createElement('style');
  style.type = 'text/css';
  style.appendChild(document.createTextNode(css));
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// WrenchIcon — inline SVG so we don't depend on lucide-react loading
// ---------------------------------------------------------------------------

function WrenchIcon(props) {
  var size = (props && props.size) || 24;
  var color = (props && props.color) || 'currentColor';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={props && props.style ? props.style : undefined}
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// LiveClock — updates every second
// ---------------------------------------------------------------------------

function LiveClock() {
  var _useState = useState(new Date());
  var now = _useState[0];
  var setNow = _useState[1];

  useEffect(function () {
    var id = setInterval(function () { setNow(new Date()); }, 1000);
    return function () { clearInterval(id); };
  }, []);

  var day = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Manila' });
  var date = now.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  });
  var time = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila',
  });

  return (
    <div style={STYLES.clockWrap}>
      <div style={STYLES.clockDate}>{day}, {date}</div>
      <div style={STYLES.clockTime}>{time}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AutoScrollPanel — scrolls slowly when content overflows
// ---------------------------------------------------------------------------

function AutoScrollPanel(props) {
  var outerRef = useRef(null);
  var rafRef = useRef(null);
  var pauseUntilRef = useRef(0);
  var directionRef = useRef('down');

  useEffect(function () {
    var el = outerRef.current;
    if (!el) return;

    function tick() {
      var maxScroll = el.scrollHeight - el.clientHeight;

      if (maxScroll <= 0) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      var now = Date.now();

      if (directionRef.current === 'down') {
        el.scrollTop += 0.5;
        if (el.scrollTop >= maxScroll) {
          directionRef.current = 'pausing';
          pauseUntilRef.current = now + 4000;
        }
      } else if (directionRef.current === 'pausing') {
        if (now >= pauseUntilRef.current) {
          directionRef.current = 'up';
          el.scrollTop = 0;
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
    return function () {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  var panelStyle = {
    overflow: 'hidden',
    flex: 1,
    minHeight: 0,
  };

  return (
    <div ref={outerRef} style={panelStyle}>
      {props.children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// NowServingCard
// ---------------------------------------------------------------------------

function NowServingCard(props) {
  var job = props.job;
  var isAwaiting = job.status === 'AWAITING_PARTS';
  var bay = getBayLabel(job.assignedBay);
  var plate = getPlateNumber(job);
  var vehicle = getVehicleText(job);

  return (
    <div style={STYLES.nsCard}>
      <div style={STYLES.nsQueueBadge}>
        {job.queueNumber || '—'}
      </div>
      <div style={STYLES.nsCardBody}>
        {plate && (
          <div style={STYLES.nsPlate}>{plate}</div>
        )}
        <div style={STYLES.nsVehicle}>{vehicle || 'Unknown Vehicle'}</div>
        <div style={STYLES.nsTagRow}>
          {isAwaiting && (
            <span style={STYLES.awaitingBadge}>Awaiting Parts</span>
          )}
          {bay && (
            <span style={STYLES.bayPill}>{bay}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// InQueueCard
// ---------------------------------------------------------------------------

function InQueueCard(props) {
  var job = props.job;
  var position = props.position;
  var total = props.total;
  var plate = getPlateNumber(job);
  var vehicle = getVehicleText(job);

  return (
    <div style={STYLES.iqCard}>
      <div style={STYLES.iqQueueBadge}>
        {job.queueNumber || '—'}
      </div>
      <div style={STYLES.iqCardBody}>
        {plate && (
          <div style={STYLES.iqPlate}>{plate}</div>
        )}
        <div style={STYLES.iqVehicle}>{vehicle || 'Unknown Vehicle'}</div>
        <div style={STYLES.iqPosition}>
          Position {position} of {total}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function Header() {
  return (
    <div style={STYLES.headerBar}>
      <div style={STYLES.headerTitle}>
        <WrenchIcon size={36} color="#ffffff" style={{ marginRight: 12 }} />
        CBROS Auto Service
      </div>
      <LiveClock />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function Footer(props) {
  var servingCount = props.servingCount;
  var waitingCount = props.waitingCount;
  var connected = props.connected;

  var dotBg = connected ? '#22c55e' : '#ef4444';
  var dotPulseClass = connected ? 'qd-pulse-green' : 'qd-pulse-red';

  return (
    <div style={STYLES.footerBar}>
      <div style={STYLES.footerStats}>
        <span style={STYLES.footerStatItem}>
          In service: <strong>{servingCount}</strong>
        </span>
        <span style={STYLES.footerStatItem}>
          Waiting: <strong>{waitingCount}</strong>
        </span>
      </div>
      <div style={STYLES.footerRight}>
        <span style={STYLES.footerThankYou}>Thank you for your patience!</span>
        <WrenchIcon size={18} color="#ffffff" style={{ opacity: 0.6, marginRight: 8 }} />
        <span style={STYLES.dotOuter}>
          <span className={dotPulseClass}></span>
          <span style={Object.assign({}, STYLES.dotInner, { background: dotBg })}></span>
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QueueDisplay (main component)
// ---------------------------------------------------------------------------

export default function QueueDisplay() {
  var _jobsState = useState([]);
  var jobs = _jobsState[0];
  var setJobs = _jobsState[1];

  var _connState = useState(false);
  var connected = _connState[0];
  var setConnected = _connState[1];

  var cursorTimerRef = useRef(null);
  var _cursorState = useState(true);
  var showCursor = _cursorState[0];
  var setShowCursor = _cursorState[1];

  // Inject global CSS once
  useEffect(function () {
    injectGlobalStyles();
  }, []);

  // Firestore subscription
  useEffect(function () {
    var unsub = subscribeToActiveJobs(
      function (data) {
        setJobs(data);
        setConnected(true);
      },
      function () { setConnected(false); }
    );
    return function () { unsub(); };
  }, []);

  // Kiosk: hide cursor after 3s inactivity
  var resetCursorTimer = useCallback(function () {
    setShowCursor(true);
    if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
    cursorTimerRef.current = setTimeout(function () { setShowCursor(false); }, 3000);
  }, []);

  useEffect(function () {
    resetCursorTimer();
    window.addEventListener('mousemove', resetCursorTimer);
    window.addEventListener('mousedown', resetCursorTimer);
    return function () {
      window.removeEventListener('mousemove', resetCursorTimer);
      window.removeEventListener('mousedown', resetCursorTimer);
      if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
    };
  }, [resetCursorTimer]);

  // Kiosk: disable context menu
  useEffect(function () {
    var handler = function (e) { e.preventDefault(); };
    document.addEventListener('contextmenu', handler);
    return function () { document.removeEventListener('contextmenu', handler); };
  }, []);

  // Filter & sort
  var nowServing = jobs.filter(function (j) {
    return !j.isCanceled && (j.status === 'IN_SERVICE' || j.status === 'AWAITING_PARTS');
  }).sort(function (a, b) {
    return (a.queueNumber || '').localeCompare(b.queueNumber || '');
  });

  var inQueue = jobs.filter(function (j) {
    return !j.isCanceled && j.status === 'WAITLIST';
  }).sort(function (a, b) {
    return (a.queueNumber || '').localeCompare(b.queueNumber || '');
  });

  var noJobsAtAll = nowServing.length === 0 && inQueue.length === 0;

  var pageClassName = showCursor ? '' : 'qd-cursor-none';

  // Full-screen empty state
  if (noJobsAtAll) {
    return (
      <div style={STYLES.page} className={pageClassName}>
        <Header />
        <div style={STYLES.emptyCenter}>
          <WrenchIcon size={72} color="#9ca3af" />
          <div style={{ fontSize: '3rem', fontWeight: 800, color: '#6b7280', marginTop: 16 }}>
            No active jobs today
          </div>
          <div style={STYLES.emptySubText}>
            CBROS Auto Service
          </div>
        </div>
        <Footer servingCount={0} waitingCount={0} connected={connected} />
      </div>
    );
  }

  // Main layout
  return (
    <div style={STYLES.page} className={pageClassName}>
      <Header />

      <div style={STYLES.panelsRow}>
        {/* NOW SERVING panel */}
        <div style={STYLES.leftPanel}>
          <div style={STYLES.sectionHeaderLeft}>
            <span style={STYLES.servingDotOuter}>
              <span className="qd-pulse-emerald"></span>
              <span style={STYLES.servingDotInner}></span>
            </span>
            <span style={Object.assign({}, STYLES.sectionHeaderText, STYLES.sectionHeaderTextGreen)}>
              NOW SERVING{' '}
              <span style={Object.assign({}, STYLES.sectionCount, STYLES.sectionCountGreen)}>
                ({nowServing.length})
              </span>
            </span>
          </div>

          <AutoScrollPanel>
            {nowServing.length === 0 ? (
              <div style={STYLES.emptyCenter}>
                <span style={STYLES.emptyText}>No vehicles currently being serviced</span>
              </div>
            ) : (
              <div style={STYLES.cardList}>
                {nowServing.map(function (job) {
                  return <NowServingCard key={job.id} job={job} />;
                })}
              </div>
            )}
          </AutoScrollPanel>
        </div>

        {/* IN QUEUE panel */}
        <div style={STYLES.rightPanel}>
          <div style={STYLES.sectionHeaderRight}>
            <span style={{ fontSize: '2rem', marginRight: 12 }}>&#9203;</span>
            <span style={Object.assign({}, STYLES.sectionHeaderText, STYLES.sectionHeaderTextBlue)}>
              IN QUEUE{' '}
              <span style={Object.assign({}, STYLES.sectionCount, STYLES.sectionCountBlue)}>
                ({inQueue.length})
              </span>
            </span>
          </div>

          <AutoScrollPanel>
            {inQueue.length === 0 ? (
              <div style={STYLES.emptyCenter}>
                <span style={{ fontSize: '2rem' }}>&#10004;</span>
                <span style={STYLES.emptyText}>No vehicles waiting — queue is clear!</span>
              </div>
            ) : (
              <div style={STYLES.cardList}>
                {inQueue.map(function (job, idx) {
                  return (
                    <InQueueCard
                      key={job.id}
                      job={job}
                      position={idx + 1}
                      total={inQueue.length}
                    />
                  );
                })}
              </div>
            )}
          </AutoScrollPanel>
        </div>
      </div>

      <Footer
        servingCount={nowServing.length}
        waitingCount={inQueue.length}
        connected={connected}
      />
    </div>
  );
}
