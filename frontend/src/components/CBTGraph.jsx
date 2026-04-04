/**
 * CBTGraph.jsx
 * Renders the Core Body Temperature (CBT) circadian curve as an SVG line graph.
 *
 * Props:
 *   cbtReadings: Array<{ timestamp: string|number, value: number }>
 *     - timestamp: ISO 8601 string or epoch ms
 *     - value:     CBT in °C
 *
 * Features:
 *   - X-axis: wall-clock hour ticks snapped to exact 1-hour boundaries,
 *             uniformly spaced across the sleep-onset → wake window.
 *   - Y-axis: 4 equally-spaced temperature gridlines with °C labels.
 *   - Midnight tick highlighted in cyan.
 *   - Automatic tick density scaling for multi-night datasets.
 *   - Subsampled rendering (max 300 SVG points) for performance.
 *   - Glow filter on the trend line; gradient fill below.
 *   - Consistent coordinate mapping: both SVG lines and HTML labels use the
 *     same pixel-domain calculation (no % vs px drift).
 */

import React from 'react';
import GlassCard from './GlassCard';

// ─── Constants ────────────────────────────────────────────────────────────────
const SVG_W  = 900;   // SVG viewBox width  (internal coordinate space)
const SVG_H  = 240;   // SVG viewBox height (internal coordinate space)
const PAD_L  = 52;    // left  padding — room for Y-axis labels
const PAD_R  = 16;    // right padding
const PAD_T  = 12;    // top   padding
const PAD_B  = 0;     // bottom padding (axis labels rendered below SVG)

const PLOT_W = SVG_W - PAD_L - PAD_R;  // usable plot width
const PLOT_H = SVG_H - PAD_T - PAD_B;  // usable plot height

const HR_MS = 60 * 60 * 1000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map a timestamp (ms) to SVG x-coordinate inside the plot area. */
const toX = (t, minTime, timeSpan) =>
  PAD_L + ((t - minTime) / timeSpan) * PLOT_W;

/** Map a temperature value to SVG y-coordinate inside the plot area. */
const toY = (value, minT, maxT) =>
  PAD_T + PLOT_H - ((value - minT) / (maxT - minT)) * PLOT_H;

/** Format epoch ms as a short wall-clock time string (24h). */
const fmtTime = (ms) => {
  const d = new Date(ms);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

/** Returns true if the epoch ms falls exactly on midnight (00:00). */
const isMidnight = (ms) => {
  const d = new Date(ms);
  return d.getHours() === 0 && d.getMinutes() === 0;
};

/**
 * Choose tick interval based on total time span.
 * Target: 6–12 ticks visible.
 */
const choosTickIntervalMs = (timeSpan) => {
  if (timeSpan <= 10 * HR_MS)  return HR_MS;           //  ≤10 h → 1 h ticks
  if (timeSpan <= 20 * HR_MS)  return 2 * HR_MS;       // ≤20 h → 2 h ticks
  if (timeSpan <= 48 * HR_MS)  return 4 * HR_MS;       // ≤48 h → 4 h ticks
  return 8 * HR_MS;                                     //  >48 h → 8 h ticks
};

// ─── Y-Axis Grid: 4 equally-spaced horizontal lines + °C labels ───────────────
const YGrid = ({ minT, maxT }) => {
  const lines = [];
  const step  = (maxT - minT) / 4;
  for (let i = 0; i <= 4; i++) {
    const val = minT + i * step;
    const y   = toY(val, minT, maxT);
    lines.push(
      <g key={i}>
        {/* Grid line */}
        <line
          x1={PAD_L} y1={y} x2={SVG_W - PAD_R} y2={y}
          stroke="rgba(255,255,255,0.06)"
          strokeDasharray={i === 0 ? 'none' : '3 5'}
          strokeWidth={i === 0 ? 1 : 0.8}
        />
        {/* Temperature label */}
        <text
          x={PAD_L - 6} y={y + 4}
          textAnchor="end"
          fontSize="11"
          fill="rgba(255,255,255,0.35)"
          fontFamily="monospace"
        >
          {val.toFixed(1)}
        </text>
      </g>
    );
  }
  return <>{lines}</>;
};

// ─── Main Component ───────────────────────────────────────────────────────────
const CBTGraph = ({ cbtReadings }) => {

  // ── No Data: Placeholder Curve ───────────────────────────────────────────
  if (!cbtReadings || cbtReadings.length === 0) {
    const mockPts = [
      [0.00, 37.2], [0.10, 37.0], [0.25, 36.7], [0.40, 36.3],
      [0.55, 36.1], [0.68, 36.2], [0.78, 36.5], [0.88, 36.8], [1.00, 37.1],
    ];
    const minT = 35.9, maxT = 37.4;
    const pts  = mockPts.map(([rx, v]) => ({
      px: PAD_L + rx * PLOT_W,
      py: toY(v, minT, maxT),
    }));
    const path  = `M ${pts[0].px},${pts[0].py}` + pts.slice(1).map(p => ` L ${p.px},${p.py}`).join('');
    const fill  = `${path} L ${SVG_W - PAD_R},${PAD_T + PLOT_H} L ${PAD_L},${PAD_T + PLOT_H} Z`;

    return (
      <GlassCard style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ marginBottom: '1rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
          <span>Core Body Temperature Curve</span>
          <span style={{ fontSize: '0.8em', color: 'var(--accent-purple)' }}>[ °C ]</span>
        </h3>
        <div style={{ flexGrow: 1, minHeight: '200px' }}>
          <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="cbtGradMock" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="var(--accent-cyan)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0.00" />
              </linearGradient>
            </defs>
            <YGrid minT={minT} maxT={maxT} />
            <path d={fill} fill="url(#cbtGradMock)" />
            <path d={path} fill="none" stroke="var(--accent-cyan)" strokeWidth="2.5" strokeLinejoin="round" strokeOpacity="0.4" strokeDasharray="6 4" />
          </svg>
        </div>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '8px', letterSpacing: '1px' }}>
          Upload a CSV to visualize your CBT circadian curve
        </p>
      </GlassCard>
    );
  }

  // ── Parse & Validate Timestamps ──────────────────────────────────────────
  const parsed = cbtReadings
    .map((r) => ({ t: new Date(r.timestamp).getTime(), v: r.value }))
    .filter((r) => !isNaN(r.t) && !isNaN(r.v))
    .sort((a, b) => a.t - b.t);

  if (parsed.length === 0) {
    return (
      <GlassCard>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
          No valid CBT readings to display.
        </p>
      </GlassCard>
    );
  }

  // ── Y Range with Comfortable Padding ─────────────────────────────────────
  let minT = Math.min(...parsed.map((r) => r.v));
  let maxT = Math.max(...parsed.map((r) => r.v));
  if (minT === maxT) { minT -= 0.5; maxT += 0.5; }
  else {
    const pad = (maxT - minT) * 0.12;
    minT -= pad;
    maxT += pad;
  }

  // ── Subsample to ≤300 SVG Points ─────────────────────────────────────────
  const step   = Math.max(1, Math.floor(parsed.length / 300));
  const sample = parsed.filter((_, i) => i % step === 0);
  // Always include the last point so the line reaches the right edge
  if (sample[sample.length - 1] !== parsed[parsed.length - 1]) {
    sample.push(parsed[parsed.length - 1]);
  }

  // ── Time Domain ──────────────────────────────────────────────────────────
  const minTime  = sample[0].t;
  const maxTime  = sample[sample.length - 1].t;
  const timeSpan = maxTime - minTime;

  // ── Hourly X-Axis Ticks (snapped to wall-clock hour boundaries) ──────────
  const tickMs    = choosTickIntervalMs(timeSpan);
  // Snap the first tick to the next exact wall-clock hour boundary ≥ minTime
  const firstTick = Math.ceil(minTime / tickMs) * tickMs;
  const ticks     = [];
  for (let t = firstTick; t <= maxTime; t += tickMs) {
    ticks.push(t);
  }

  // ── SVG Path Construction ─────────────────────────────────────────────────
  const pts    = sample.map((r) => ({ px: toX(r.t, minTime, timeSpan), py: toY(r.v, minT, maxT) }));
  const path   = `M ${pts[0].px},${pts[0].py}` + pts.slice(1).map((p) => ` L ${p.px},${p.py}`).join('');
  const fill   = `${path} L ${toX(maxTime, minTime, timeSpan)},${PAD_T + PLOT_H} L ${PAD_L},${PAD_T + PLOT_H} Z`;

  // ── Annotate Sleep Onset (leftmost point) and Wake (rightmost) ───────────
  const onsetPt = pts[0];
  const wakePt  = pts[pts.length - 1];

  // Find the nadir (CBT minimum) for annotation
  const nadirParsed = sample.reduce((min, r) => (r.v < min.v ? r : min), sample[0]);
  const nadirPt = { px: toX(nadirParsed.t, minTime, timeSpan), py: toY(nadirParsed.v, minT, maxT) };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <GlassCard style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <h3 style={{ marginBottom: '1rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Continuous CBT Curve <span style={{ fontSize: '0.75em', color: 'rgba(255,255,255,0.25)', fontWeight: 'normal' }}>(Sleep Onset → Wake)</span></span>
        <span style={{ fontSize: '0.78em', color: 'var(--accent-purple)', letterSpacing: '1px' }}>[ °C ]</span>
      </h3>

      {/* Graph */}
      <div style={{ flexGrow: 1, minHeight: '200px', position: 'relative' }}>
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H + 30}`}
          style={{ width: '100%', height: '100%', overflow: 'visible', display: 'block' }}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Gradient fill under curve */}
            <linearGradient id="cbtGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="var(--accent-cyan)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0.00" />
            </linearGradient>
            {/* Glow filter for the trend line */}
            <filter id="cbtGlow" x="-20%" y="-50%" width="140%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Clip region — keeps lines inside the plot area */}
            <clipPath id="plotClip">
              <rect x={PAD_L} y={PAD_T} width={PLOT_W} height={PLOT_H} />
            </clipPath>
          </defs>

          {/* ── Y-Axis Grid + Labels ───────────────────────────────────────── */}
          <YGrid minT={minT} maxT={maxT} />

          {/* ── X-Axis Hour Tick Vertical Lines ───────────────────────────── */}
          {ticks.map((t) => {
            const px = toX(t, minTime, timeSpan);
            const midnight = isMidnight(t);
            return (
              <line
                key={t}
                x1={px} y1={PAD_T}
                x2={px} y2={PAD_T + PLOT_H}
                stroke={midnight ? 'rgba(0,242,254,0.25)' : 'rgba(255,255,255,0.07)'}
                strokeDasharray={midnight ? '4 4' : '2 5'}
                strokeWidth={midnight ? 1.2 : 0.8}
              />
            );
          })}

          {/* ── X-Axis Hour Labels (rendered inside SVG for correct alignment) */}
          {ticks.map((t) => {
            const px      = toX(t, minTime, timeSpan);
            const label   = fmtTime(t);
            const midnight = isMidnight(t);
            return (
              <text
                key={`lbl-${t}`}
                x={px} y={PAD_T + PLOT_H + 20}
                textAnchor="middle"
                fontSize="11"
                fontFamily="monospace"
                fill={midnight ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.38)'}
                fontWeight={midnight ? 'bold' : 'normal'}
              >
                {label}
              </text>
            );
          })}

          {/* ── Plot Area Clip (fill + line stay inside axes) ─────────────── */}
          <g clipPath="url(#plotClip)">
            {/* Gradient fill */}
            <path d={fill} fill="url(#cbtGrad)" />
            {/* CBT trend line with glow */}
            <path
              d={path}
              fill="none"
              stroke="var(--accent-cyan)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              filter="url(#cbtGlow)"
            />
          </g>

          {/* ── Key Annotation: Sleep Onset ───────────────────────────────── */}
          <circle cx={onsetPt.px} cy={onsetPt.py} r="4" fill="var(--accent-cyan)" opacity="0.9" />
          <text
            x={onsetPt.px + 8} y={onsetPt.py - 8}
            fontSize="10" fill="var(--accent-cyan)" fontFamily="monospace" opacity="0.85"
          >
            Onset {fmtTime(minTime)}
          </text>

          {/* ── Key Annotation: CBT Nadir ─────────────────────────────────── */}
          <circle cx={nadirPt.px} cy={nadirPt.py} r="4" fill="#a78bfa" opacity="0.9" />
          <text
            x={nadirPt.px} y={nadirPt.py + 18}
            textAnchor="middle"
            fontSize="10" fill="#a78bfa" fontFamily="monospace" opacity="0.85"
          >
            Nadir {nadirParsed.v.toFixed(2)}°C
          </text>

          {/* ── Key Annotation: Wake / CBT Rise ──────────────────────────── */}
          <circle cx={wakePt.px} cy={wakePt.py} r="4" fill="#f97316" opacity="0.9" />
          <text
            x={wakePt.px - 8} y={wakePt.py - 8}
            textAnchor="end"
            fontSize="10" fill="#f97316" fontFamily="monospace" opacity="0.85"
          >
            Wake {fmtTime(maxTime)}
          </text>

          {/* ── Bottom Axis Line ──────────────────────────────────────────── */}
          <line
            x1={PAD_L} y1={PAD_T + PLOT_H}
            x2={SVG_W - PAD_R} y2={PAD_T + PLOT_H}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1"
          />
          {/* Left axis line */}
          <line
            x1={PAD_L} y1={PAD_T}
            x2={PAD_L} y2={PAD_T + PLOT_H}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1"
          />
        </svg>
      </div>

      {/* Legend row */}
      <div style={{
        display: 'flex', gap: '20px', marginTop: '12px',
        fontSize: '0.75rem', color: 'var(--text-secondary)', justifyContent: 'center',
        flexWrap: 'wrap',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-cyan)', display: 'inline-block' }} />
          Sleep Onset
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#a78bfa', display: 'inline-block' }} />
          CBT Nadir (Deepest Sleep)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f97316', display: 'inline-block' }} />
          Wake / CBT Rise
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: 12, height: 2, background: 'rgba(0,242,254,0.5)', display: 'inline-block' }} />
          Midnight
        </span>
      </div>
    </GlassCard>
  );
};

export default CBTGraph;
