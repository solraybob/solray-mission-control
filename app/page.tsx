'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ServiceStatus {
  name: string;
  url: string;
  status: 'up' | 'down';
  statusCode: number;
  ms: number;
}

interface DashboardData {
  users: { total: number; new_7d: number };
  waitlist: { total: number; new_7d: number };
  backend_version: string;
  timestamp: string;
}

interface Tweet {
  id: string;
  text: string;
  timestamp: string;
}

interface EmailStats {
  total_in_queue: number;
  pending_day3: number;
  pending_day7: number;
  last_email_sent: string | null;
  updated_at?: string;
}

interface DnsStatus {
  domain: string;
  nameservers: string[];
  aRecords: string[];
  propagated: boolean;
  status: string;
}

interface MemoryData {
  entries: string[];
  date: string | null;
  file?: string;
}

interface CronJob {
  name: string;
  schedule: string;
  label: string;
  tz: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nextCronFire(cronExpr: string, tz: string): string {
  const parts = cronExpr.split(' ');
  if (parts.length < 5) return 'Unknown';
  const minute = parseInt(parts[0]);
  const hour = parseInt(parts[1]);

  const now = new Date();
  const madridNow = new Date(now.toLocaleString('en-US', { timeZone: tz }));

  const target = new Date(madridNow);
  target.setHours(hour, minute, 0, 0);

  if (target <= madridNow) {
    target.setDate(target.getDate() + 1);
  }

  const diffMs = target.getTime() - madridNow.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  const diffM = Math.floor((diffMs % 3600000) / 60000);

  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');

  if (diffH < 24) {
    return `in ${diffH}h ${diffM}m (${hh}:${mm})`;
  } else {
    return `Tomorrow ${hh}:${mm}`;
  }
}

function formatTs(ts: string): string {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Card({ title, children, icon }: { title: string; children: React.ReactNode; icon?: string }) {
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e8d5b8',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 2px 12px rgba(232, 130, 26, 0.08), 0 1px 4px rgba(26, 16, 8, 0.06)',
    }}>
      <h2 style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: '1.4rem',
        color: '#e8821a',
        margin: '0 0 16px',
        fontWeight: 600,
      }}>
        {icon && <span style={{ marginRight: 8 }}>{icon}</span>}
        {title}
      </h2>
      {children}
    </div>
  );
}

function StatusDot({ status }: { status: 'up' | 'down' | 'loading' }) {
  const color = status === 'up' ? '#22c55e' : status === 'down' ? '#ef4444' : '#c8b89a';
  return (
    <span style={{
      display: 'inline-block',
      width: 10,
      height: 10,
      borderRadius: '50%',
      background: color,
      boxShadow: status === 'up' ? '0 0 6px rgba(34, 197, 94, 0.5)' : undefined,
      marginRight: 8,
      flexShrink: 0,
    }} />
  );
}

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: '0.75rem', color: '#7a6a5a', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: '1.6rem', fontFamily: "'Cormorant Garamond', serif", color: '#1a1008', fontWeight: 600 }}>
        {value}
        {sub && <span style={{ fontSize: '0.8rem', color: '#7a6a5a', marginLeft: 6 }}>{sub}</span>}
      </div>
    </div>
  );
}

// ─── PM Office ───────────────────────────────────────────────────────────────

type PMStatus = 'active' | 'ready' | 'partial' | 'not-started';

interface PM {
  id: string;
  name: string;
  project: string;
  avatar: string;
  timeOfDay: string;
  status: PMStatus;
  task: string;
}

const PM_ROSTER: PM[] = [
  { id: 'solray',   name: 'PM Solray',   project: 'Solray AI',    avatar: '🌙', timeOfDay: 'Midnight',    status: 'active',      task: 'Awaiting Lemon Squeezy approval. Backend + frontend live.' },
  { id: 'bobby',    name: 'PM Bobby',    project: 'Agent Bobby',  avatar: '☀️', timeOfDay: 'High Noon',   status: 'not-started', task: 'Awaiting Solray AI launch before building.' },
  { id: 'canon',    name: 'PM Canon',    project: 'Solar Canon',  avatar: '📚', timeOfDay: 'Dawn',        status: 'ready',       task: '14 books written. Need sales infrastructure.' },
  { id: 'dog',      name: 'PM Dog',      project: 'Sol-Ray Dog',  avatar: '🐕', timeOfDay: 'Golden Hour', status: 'not-started', task: 'Needs audience first. Build after content grows.' },
  { id: 'commerce', name: 'PM Commerce', project: 'Commerce',     avatar: '🛍', timeOfDay: 'Full Sun',    status: 'not-started', task: 'Physical products last. Needs volume.' },
  { id: 'content',  name: 'PM Content',  project: 'Content',      avatar: '🌅', timeOfDay: 'Sunrise',     status: 'partial',     task: 'X automated 3x/day. Other channels pending.' },
];

function pmStatusColor(status: PMStatus): string {
  return status === 'active' ? '#e8821a'
    : status === 'partial' ? '#c9681a'
    : status === 'ready' ? '#60a5fa'
    : '#c8b89a';
}

function pmBorderColor(status: PMStatus): string {
  return status === 'active' ? '#e8821a'
    : status === 'partial' ? '#c9681a88'
    : status === 'ready' ? '#60a5fa55'
    : '#e8d5b8';
}

function pmShadow(status: PMStatus): string {
  return status === 'active'
    ? '0 4px 20px rgba(232, 130, 26, 0.2), 0 2px 8px rgba(232, 130, 26, 0.12)'
    : status === 'partial'
    ? '0 4px 16px rgba(201, 104, 26, 0.12)'
    : '0 2px 8px rgba(26, 16, 8, 0.06)';
}

function pmStatusLabel(status: PMStatus): string {
  return status === 'active' ? 'Active'
    : status === 'partial' ? 'Partial'
    : status === 'ready' ? 'Ready'
    : 'Not Started';
}

function PMOfficeSection() {
  return (
    <div style={{ padding: '0 32px 8px' }}>
      <style>{`
        @keyframes pmPulse {
          0%, 100% { box-shadow: 0 4px 20px rgba(232, 130, 26, 0.2), 0 2px 8px rgba(232, 130, 26, 0.12); }
          50% { box-shadow: 0 6px 28px rgba(232, 130, 26, 0.35), 0 3px 12px rgba(232, 130, 26, 0.2); }
        }
        @keyframes pmPulsePartial {
          0%, 100% { box-shadow: 0 4px 16px rgba(201, 104, 26, 0.12); }
          50% { box-shadow: 0 6px 22px rgba(201, 104, 26, 0.22); }
        }
        .pm-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .pm-card:hover { transform: translateY(-4px) !important; }
        .pm-card-active { animation: pmPulse 3s ease-in-out infinite; }
        .pm-card-partial { animation: pmPulsePartial 3s ease-in-out infinite; }
      `}</style>

      <h2 style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: '1.8rem',
        color: '#1a1008',
        margin: '0 0 16px',
        fontWeight: 600,
      }}>
        🏢 PM Office
      </h2>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 16,
      }}>
        {PM_ROSTER.map(pm => {
          const animClass = pm.status === 'active' ? 'pm-card pm-card-active'
            : pm.status === 'partial' ? 'pm-card pm-card-partial'
            : 'pm-card';
          return (
            <div
              key={pm.id}
              className={animClass}
              style={{
                background: pm.status === 'active' ? '#fffbf5' : '#ffffff',
                border: `1px solid ${pmBorderColor(pm.status)}`,
                borderLeft: pm.status === 'active' ? `3px solid #e8821a` : `1px solid ${pmBorderColor(pm.status)}`,
                borderRadius: 12,
                padding: '18px 20px',
                boxShadow: pmShadow(pm.status),
                cursor: 'default',
              }}
            >
              {/* Avatar row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: '2rem', lineHeight: 1 }}>{pm.avatar}</span>
                <span style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: '0.72rem',
                  padding: '3px 9px',
                  borderRadius: 20,
                  background: pm.status === 'active' ? 'rgba(232, 130, 26, 0.12)'
                    : pm.status === 'partial' ? 'rgba(201, 104, 26, 0.1)'
                    : pm.status === 'ready' ? 'rgba(96, 165, 250, 0.1)'
                    : 'rgba(200, 184, 154, 0.2)',
                  border: `1px solid ${pmStatusColor(pm.status)}44`,
                  color: pmStatusColor(pm.status),
                }}>
                  <span style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: pmStatusColor(pm.status),
                    display: 'inline-block',
                    flexShrink: 0,
                  }} />
                  {pmStatusLabel(pm.status)}
                </span>
              </div>

              {/* Names */}
              <div style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: '1.15rem',
                fontWeight: 700,
                color: '#1a1008',
                marginBottom: 2,
              }}>
                {pm.name}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#e8821a', marginBottom: 6, fontWeight: 500 }}>
                {pm.project}
              </div>

              {/* Time of day */}
              <div style={{ fontSize: '0.72rem', color: '#7a6a5a', marginBottom: 10 }}>
                🕐 {pm.timeOfDay}
              </div>

              {/* Task */}
              <div style={{
                fontSize: '0.8rem',
                color: '#7a6a5a',
                lineHeight: 1.4,
                borderTop: '1px solid #e8d5b8',
                paddingTop: 10,
              }}>
                {pm.task}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Task Board (Kanban) ──────────────────────────────────────────────────────

interface KanbanTask {
  title: string;
  pm: string;
}

interface KanbanColumn {
  id: string;
  label: string;
  icon: string;
  tasks: KanbanTask[];
}

const KANBAN_COLUMNS: KanbanColumn[] = [
  {
    id: 'backlog',
    label: 'Backlog',
    icon: '📋',
    tasks: [
      { title: 'Connect Lemon Squeezy payments to Solray AI', pm: 'Solray AI' },
      { title: 'Set up solray@solray.ai email when DNS resolves', pm: 'Content' },
      { title: 'Build Instagram Meta API connection', pm: 'Content' },
      { title: 'Chiron ephemeris file on Railway', pm: 'Solray AI' },
      { title: 'Resolve Marta Moon Gate precision', pm: 'Solray AI' },
      { title: 'Build solraybob.com product pages', pm: 'Commerce' },
    ],
  },
  {
    id: 'in-progress',
    label: 'In Progress',
    icon: '⚡',
    tasks: [
      { title: 'solray.ai DNS propagation', pm: 'System' },
      { title: 'X posting 3x daily automated', pm: 'Content' },
      { title: 'Nightly memory consolidation cron', pm: 'System' },
    ],
  },
  {
    id: 'done',
    label: 'Done',
    icon: '✓',
    tasks: [
      { title: 'Backend deployed to Railway', pm: 'Solray AI' },
      { title: 'Supabase database connected', pm: 'Solray AI' },
      { title: 'Email nurture sequence 3 emails', pm: 'Content' },
      { title: 'Phase 1-4 frontend + backend built', pm: 'Solray AI' },
      { title: 'Energy score calculator (deterministic)', pm: 'Solray AI' },
      { title: 'Timezone bug fix for all users', pm: 'Solray AI' },
    ],
  },
];

function TaskBoardSection() {
  return (
    <div style={{ padding: '32px 32px 8px', background: '#fffbf5' }}>
      <style>{`
        @keyframes taskCardHover {
          0% { transform: translateY(0); }
          100% { transform: translateY(-3px); }
        }
        .task-card { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .task-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 6px 20px rgba(232, 130, 26, 0.14) !important;
        }
      `}</style>

      <h2 style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: '1.8rem',
        color: '#1a1008',
        margin: '0 0 4px',
        fontWeight: 600,
      }}>
        📌 Task Board
      </h2>
      <p style={{ fontSize: '0.8rem', color: '#7a6a5a', margin: '0 0 20px' }}>
        Current sprint · hardcoded · will connect to DB
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 20,
      }}>
        {KANBAN_COLUMNS.map(col => (
          <div key={col.id} style={{
            background: col.id === 'done' ? '#f0fdf4' : col.id === 'in-progress' ? '#fffbf0' : '#faf6f0',
            border: '1px solid #e8d5b8',
            borderRadius: 12,
            overflow: 'hidden',
          }}>
            {/* Column header */}
            <div style={{
              padding: '12px 16px',
              borderBottom: '2px solid #e8d5b8',
              background: col.id === 'done'
                ? 'linear-gradient(135deg, #f0fdf4, #dcfce7)'
                : col.id === 'in-progress'
                ? 'linear-gradient(135deg, #fffbf0, #fef3c7)'
                : 'linear-gradient(135deg, #faf6f0, #f5ede0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: '1.1rem',
                fontWeight: 700,
                color: '#1a1008',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <span>{col.icon}</span>
                {col.label}
              </div>
              <span style={{
                background: col.id === 'done' ? 'rgba(34,197,94,0.15)' : 'rgba(232,130,26,0.15)',
                color: col.id === 'done' ? '#15803d' : '#92400e',
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 20,
                border: col.id === 'done' ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(232,130,26,0.3)',
              }}>
                {col.tasks.length}
              </span>
            </div>

            {/* Cards */}
            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {col.tasks.map((task, i) => (
                <div
                  key={i}
                  className="task-card"
                  style={{
                    background: col.id === 'done' ? 'rgba(255,255,255,0.7)' : '#ffffff',
                    border: '1px solid #e8d5b8',
                    borderLeft: `3px solid ${col.id === 'done' ? '#86efac' : '#e8821a'}`,
                    borderRadius: 8,
                    padding: '12px 14px',
                    boxShadow: '0 1px 6px rgba(232, 130, 26, 0.07)',
                    cursor: 'default',
                    opacity: col.id === 'done' ? 0.85 : 1,
                  }}
                >
                  <div style={{
                    fontSize: '0.85rem',
                    color: '#1a1008',
                    lineHeight: 1.45,
                    marginBottom: 8,
                    fontWeight: 500,
                    textDecoration: col.id === 'done' ? 'line-through' : 'none',
                    textDecorationColor: '#c8b89a',
                  }}>
                    {task.title}
                  </div>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'rgba(232, 130, 26, 0.10)',
                    border: '1px solid rgba(232, 130, 26, 0.25)',
                    borderRadius: 20,
                    padding: '2px 8px',
                    fontSize: '0.68rem',
                    color: '#92400e',
                    fontWeight: 600,
                    letterSpacing: '0.02em',
                  }}>
                    <span style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: '#e8821a',
                      display: 'inline-block',
                      flexShrink: 0,
                    }} />
                    PM {task.pm}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Playful Office Scene ─────────────────────────────────────────────────────

function PlayfulOfficeSection() {
  return (
    <div style={{ padding: '32px 32px 48px', background: '#fff8f0' }}>
      <style>{`
        @keyframes rotateSun {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulseScreen {
          0%, 100% { opacity: 0.7; filter: brightness(1); }
          50% { opacity: 1; filter: brightness(1.3); }
        }
        @keyframes rockChair {
          0%, 100% { transform: rotate(-5deg) translateY(0); }
          50% { transform: rotate(5deg) translateY(2px); }
        }
        @keyframes floatBook {
          0%, 100% { transform: translateY(0px) rotate(-3deg); }
          33% { transform: translateY(-6px) rotate(2deg); }
          66% { transform: translateY(-3px) rotate(-5deg); }
        }
        @keyframes floatBook2 {
          0%, 100% { transform: translateY(0px) rotate(4deg); }
          50% { transform: translateY(-8px) rotate(-2deg); }
        }
        @keyframes floatBook3 {
          0%, 100% { transform: translateY(-2px) rotate(-6deg); }
          60% { transform: translateY(-9px) rotate(3deg); }
        }
        @keyframes ambientGlow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.5; }
        }
        @keyframes cameraLens {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        .sun-ring { animation: rotateSun 8s linear infinite; }
        .screen-glow { animation: pulseScreen 2s ease-in-out infinite; }
        .chair-rock { animation: rockChair 3s ease-in-out infinite; }
        .book-float-1 { animation: floatBook 4s ease-in-out infinite; }
        .book-float-2 { animation: floatBook2 5s ease-in-out infinite 0.5s; }
        .book-float-3 { animation: floatBook3 3.5s ease-in-out infinite 1s; }
        .ambient-glow { animation: ambientGlow 4s ease-in-out infinite; }
        .camera-lens { animation: cameraLens 2s ease-in-out infinite; }
        .office-char { transition: filter 0.2s; }
        .office-char:hover { filter: drop-shadow(0 6px 16px rgba(232,130,26,0.3)); }
      `}</style>

      <h2 style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: '1.8rem',
        color: '#1a1008',
        margin: '0 0 4px',
        fontWeight: 600,
      }}>
        🏯 The Office
      </h2>
      <p style={{ fontSize: '0.8rem', color: '#7a6a5a', margin: '0 0 28px' }}>
        Where the empire is built · illustrated · live
      </p>

      {/* Office container */}
      <div style={{
        position: 'relative',
        background: 'linear-gradient(160deg, #fef9f0 0%, #fdf3e0 50%, #faf0d8 100%)',
        border: '2px solid #e8d5b8',
        borderRadius: 20,
        padding: '40px 24px 32px',
        overflow: 'hidden',
        minHeight: 520,
      }}>

        {/* Ambient glow circles */}
        <div className="ambient-glow" style={{
          position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)',
          width: 300, height: 300,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(232,130,26,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -80, left: -80,
          width: 260, height: 260,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(251,191,36,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -60, right: -60,
          width: 200, height: 200,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(232,130,26,0.07) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Floor lines (subtle tatami feel) */}
        {[1,2,3,4].map(i => (
          <div key={i} style={{
            position: 'absolute',
            left: 0, right: 0,
            top: `${20 + i * 18}%`,
            height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(232,130,26,0.08), transparent)',
            pointerEvents: 'none',
          }} />
        ))}

        {/* Characters grid — semicircle layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 12,
          alignItems: 'end',
          position: 'relative',
          zIndex: 1,
        }}>

          {/* PM Canon */}
          <div className="office-char" style={{ textAlign: 'center' }}>
            {/* Floating books */}
            <div style={{ position: 'relative', height: 60, marginBottom: 4 }}>
              <div className="book-float-1" style={{
                position: 'absolute', left: '10%', top: 5,
              }}>
                <svg width="22" height="28" viewBox="0 0 22 28">
                  <rect x="2" y="2" width="18" height="24" rx="2" fill="#d4a96a" stroke="#a07040" strokeWidth="1"/>
                  <rect x="2" y="2" width="4" height="24" rx="1" fill="#b8864e"/>
                  <line x1="8" y1="8" x2="18" y2="8" stroke="#8a5c30" strokeWidth="1" opacity="0.5"/>
                  <line x1="8" y1="12" x2="18" y2="12" stroke="#8a5c30" strokeWidth="1" opacity="0.4"/>
                  <line x1="8" y1="16" x2="14" y2="16" stroke="#8a5c30" strokeWidth="1" opacity="0.4"/>
                </svg>
              </div>
              <div className="book-float-2" style={{
                position: 'absolute', right: '5%', top: 0,
              }}>
                <svg width="20" height="26" viewBox="0 0 20 26">
                  <rect x="1" y="1" width="18" height="24" rx="2" fill="#e8c090" stroke="#b08050" strokeWidth="1"/>
                  <rect x="1" y="1" width="4" height="24" rx="1" fill="#c09060"/>
                  <line x1="7" y1="7" x2="17" y2="7" stroke="#906040" strokeWidth="1" opacity="0.5"/>
                  <line x1="7" y1="11" x2="17" y2="11" stroke="#906040" strokeWidth="1" opacity="0.4"/>
                </svg>
              </div>
              <div className="book-float-3" style={{
                position: 'absolute', left: '35%', top: 20,
              }}>
                <svg width="18" height="22" viewBox="0 0 18 22">
                  <rect x="1" y="1" width="16" height="20" rx="2" fill="#c8a060" stroke="#8a6030" strokeWidth="1"/>
                  <rect x="1" y="1" width="3" height="20" rx="1" fill="#a07840"/>
                </svg>
              </div>
            </div>
            {/* Character body */}
            <svg width="64" height="90" viewBox="0 0 64 90" style={{ display: 'block', margin: '0 auto' }}>
              {/* Desk */}
              <rect x="4" y="68" width="56" height="6" rx="3" fill="#d4a96a" stroke="#b08040" strokeWidth="1"/>
              <rect x="12" y="74" width="5" height="14" rx="2" fill="#c09050"/>
              <rect x="47" y="74" width="5" height="14" rx="2" fill="#c09050"/>
              {/* Body */}
              <rect x="22" y="38" width="20" height="30" rx="4" fill="#f5e6d0" stroke="#d4a96a" strokeWidth="1"/>
              {/* Robe detail */}
              <path d="M22 50 Q32 54 42 50" stroke="#d4a96a" strokeWidth="1.5" fill="none"/>
              {/* Head */}
              <ellipse cx="32" cy="28" rx="11" ry="12" fill="#f5d5b0" stroke="#d4a96a" strokeWidth="1"/>
              {/* Hair */}
              <ellipse cx="32" cy="18" rx="11" ry="6" fill="#3d2c1a"/>
              {/* Eyes */}
              <ellipse cx="27" cy="28" rx="2" ry="2.5" fill="#1a1008"/>
              <ellipse cx="37" cy="28" rx="2" ry="2.5" fill="#1a1008"/>
              <circle cx="27.5" cy="27.2" r="0.7" fill="white"/>
              <circle cx="37.5" cy="27.2" r="0.7" fill="white"/>
              {/* Glasses */}
              <circle cx="27" cy="28" r="4" fill="none" stroke="#8a6030" strokeWidth="1.2"/>
              <circle cx="37" cy="28" r="4" fill="none" stroke="#8a6030" strokeWidth="1.2"/>
              <line x1="31" y1="28" x2="33" y2="28" stroke="#8a6030" strokeWidth="1"/>
              {/* Arms reading */}
              <rect x="10" y="45" width="12" height="5" rx="2" fill="#f5d5b0" transform="rotate(-15 16 47)"/>
              <rect x="42" y="45" width="12" height="5" rx="2" fill="#f5d5b0" transform="rotate(15 48 47)"/>
            </svg>
            <div style={{ fontSize: '0.7rem', color: '#1a1008', fontWeight: 600, marginTop: 6, lineHeight: 1.3 }}>PM Canon</div>
            <div style={{ fontSize: '0.62rem', color: '#7a6a5a', lineHeight: 1.3 }}>Solar Canon</div>
          </div>

          {/* PM Solray */}
          <div className="office-char" style={{ textAlign: 'center' }}>
            {/* Screen glow above */}
            <div style={{ height: 60, position: 'relative' }}>
              <div className="screen-glow" style={{
                position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
                width: 44, height: 36,
                background: 'linear-gradient(135deg, #1a237e22, #7c3aed22)',
                border: '1.5px solid rgba(124,58,237,0.4)',
                borderRadius: 4,
                boxShadow: '0 0 12px rgba(124,58,237,0.3)',
              }}>
                {/* Moon/star icons on screen */}
                <svg width="44" height="36" viewBox="0 0 44 36">
                  <text x="4" y="14" fontSize="8" fill="#a78bfa">🌙</text>
                  <text x="18" y="14" fontSize="7" fill="#c4b5fd">★</text>
                  <text x="28" y="14" fontSize="6" fill="#a78bfa">✦</text>
                  <rect x="4" y="20" width="20" height="2" rx="1" fill="rgba(167,139,250,0.5)"/>
                  <rect x="4" y="25" width="30" height="2" rx="1" fill="rgba(167,139,250,0.3)"/>
                  <rect x="4" y="30" width="14" height="2" rx="1" fill="rgba(167,139,250,0.2)"/>
                </svg>
              </div>
            </div>
            <svg width="64" height="90" viewBox="0 0 64 90" style={{ display: 'block', margin: '0 auto' }}>
              {/* Desk */}
              <rect x="4" y="65" width="56" height="6" rx="3" fill="#d4a96a" stroke="#b08040" strokeWidth="1"/>
              <rect x="12" y="71" width="5" height="17" rx="2" fill="#c09050"/>
              <rect x="47" y="71" width="5" height="17" rx="2" fill="#c09050"/>
              {/* Keyboard fingers */}
              <rect x="20" y="62" width="24" height="3" rx="1.5" fill="#d4c0a0"/>
              {/* Body */}
              <rect x="22" y="36" width="20" height="30" rx="4" fill="#ede0f8" stroke="#c4b5fd" strokeWidth="1"/>
              {/* Moon emblem */}
              <text x="26" y="55" fontSize="10" fill="#7c3aed">🌙</text>
              {/* Head */}
              <ellipse cx="32" cy="26" rx="11" ry="12" fill="#f5d5b0" stroke="#d4a96a" strokeWidth="1"/>
              {/* Hair (long dark) */}
              <ellipse cx="32" cy="16" rx="11" ry="6" fill="#2d1f0e"/>
              <rect x="21" y="16" width="4" height="18" rx="2" fill="#2d1f0e"/>
              <rect x="39" y="16" width="4" height="18" rx="2" fill="#2d1f0e"/>
              {/* Eyes (focused/squinting at screen) */}
              <ellipse cx="27" cy="27" rx="2.5" ry="1.8" fill="#1a1008"/>
              <ellipse cx="37" cy="27" rx="2.5" ry="1.8" fill="#1a1008"/>
              <circle cx="27.8" cy="26.5" r="0.6" fill="white"/>
              <circle cx="37.8" cy="26.5" r="0.6" fill="white"/>
              {/* Arms typing */}
              <rect x="8" y="56" width="14" height="5" rx="2.5" fill="#f5d5b0" transform="rotate(10 15 59)"/>
              <rect x="42" y="56" width="14" height="5" rx="2.5" fill="#f5d5b0" transform="rotate(-10 49 59)"/>
            </svg>
            <div style={{ fontSize: '0.7rem', color: '#1a1008', fontWeight: 600, marginTop: 6, lineHeight: 1.3 }}>PM Solray</div>
            <div style={{ fontSize: '0.62rem', color: '#7a6a5a', lineHeight: 1.3 }}>Solray AI</div>
          </div>

          {/* PM Content */}
          <div className="office-char" style={{ textAlign: 'center' }}>
            <div style={{ height: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              {/* Camera above */}
              <svg width="32" height="24" viewBox="0 0 32 24" className="camera-lens">
                <rect x="2" y="6" width="22" height="16" rx="3" fill="#3d2c1a" stroke="#6b4c28" strokeWidth="1"/>
                <circle cx="13" cy="14" r="5" fill="#1a1a2e" stroke="#4a3828" strokeWidth="1.5"/>
                <circle cx="13" cy="14" r="3" fill="#0d0d1a"/>
                <circle cx="11.5" cy="12.5" r="1" fill="rgba(255,255,255,0.3)"/>
                <rect x="24" y="10" width="6" height="8" rx="2" fill="#2d2010" stroke="#5a4020" strokeWidth="1"/>
                <rect x="8" y="2" width="10" height="5" rx="2" fill="#3d2c1a"/>
                <circle cx="13" cy="14" r="1.5" fill="#c4b5fd" opacity="0.6"/>
              </svg>
            </div>
            <svg width="64" height="90" viewBox="0 0 64 90" style={{ display: 'block', margin: '0 auto' }}>
              {/* Body standing */}
              <rect x="22" y="36" width="20" height="30" rx="4" fill="#fde8d0" stroke="#e8d0a0" strokeWidth="1"/>
              {/* Mic detail */}
              <circle cx="32" cy="50" r="4" fill="#d4a96a" stroke="#b08040" strokeWidth="1"/>
              {/* Head */}
              <ellipse cx="32" cy="26" rx="11" ry="12" fill="#f5d5b0" stroke="#d4a96a" strokeWidth="1"/>
              {/* Hair */}
              <ellipse cx="32" cy="17" rx="11" ry="5" fill="#5c3d1e"/>
              {/* Eyes (bright, camera-ready) */}
              <ellipse cx="27" cy="26" rx="2.5" ry="3" fill="#1a1008"/>
              <ellipse cx="37" cy="26" rx="2.5" ry="3" fill="#1a1008"/>
              <circle cx="27.8" cy="25" r="0.8" fill="white"/>
              <circle cx="37.8" cy="25" r="0.8" fill="white"/>
              {/* Smile */}
              <path d="M27 32 Q32 36 37 32" stroke="#8a5030" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
              {/* Arm holding camera */}
              <rect x="42" y="40" width="14" height="5" rx="2.5" fill="#f5d5b0" transform="rotate(-30 49 42)"/>
              {/* Other arm gesturing */}
              <rect x="8" y="45" width="14" height="5" rx="2.5" fill="#f5d5b0" transform="rotate(20 15 47)"/>
              {/* Legs */}
              <rect x="26" y="66" width="5" height="20" rx="2.5" fill="#3d2c1a"/>
              <rect x="33" y="66" width="5" height="20" rx="2.5" fill="#3d2c1a"/>
            </svg>
            <div style={{ fontSize: '0.7rem', color: '#1a1008', fontWeight: 600, marginTop: 6, lineHeight: 1.3 }}>PM Content</div>
            <div style={{ fontSize: '0.62rem', color: '#7a6a5a', lineHeight: 1.3 }}>Content</div>
          </div>

          {/* Sol-Ray Bot — Center, tallest */}
          <div className="office-char" style={{ textAlign: 'center', position: 'relative' }}>
            {/* Spinning sun halo */}
            <div style={{ position: 'relative', height: 70, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              <div className="sun-ring" style={{
                position: 'absolute',
                top: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 56,
                height: 56,
              }}>
                <svg width="56" height="56" viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r="18" fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 3"/>
                  {[0,45,90,135,180,225,270,315].map((angle, i) => (
                    <line
                      key={i}
                      x1={28 + 20 * Math.cos(angle * Math.PI / 180)}
                      y1={28 + 20 * Math.sin(angle * Math.PI / 180)}
                      x2={28 + 26 * Math.cos(angle * Math.PI / 180)}
                      y2={28 + 26 * Math.sin(angle * Math.PI / 180)}
                      stroke="#f59e0b"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  ))}
                  <circle cx="28" cy="28" r="10" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.5"/>
                  <text x="28" y="33" textAnchor="middle" fontSize="10" fill="#e8821a">☀</text>
                </svg>
              </div>
            </div>
            <svg width="72" height="100" viewBox="0 0 72 100" style={{ display: 'block', margin: '0 auto' }}>
              {/* Central desk — larger */}
              <ellipse cx="36" cy="82" rx="30" ry="8" fill="#d4a96a" stroke="#b08040" strokeWidth="1.5"/>
              <ellipse cx="36" cy="80" rx="30" ry="8" fill="#e8c080" stroke="#c09050" strokeWidth="1.5"/>
              {/* Desk glow */}
              <ellipse cx="36" cy="80" rx="24" ry="4" fill="rgba(232,130,26,0.15)"/>
              {/* Robe */}
              <path d="M16 44 Q36 38 56 44 L60 80 Q36 84 12 80 Z" fill="#fef3c7" stroke="#e8d5a0" strokeWidth="1.5"/>
              {/* Robe layering details */}
              <path d="M24 50 Q36 54 48 50" stroke="#e8d5a0" strokeWidth="1.5" fill="none"/>
              <path d="M20 60 Q36 65 52 60" stroke="#e8d5a0" strokeWidth="1" fill="none" opacity="0.7"/>
              {/* Sun emblem on robe */}
              <circle cx="36" cy="66" r="8" fill="rgba(232,130,26,0.15)" stroke="#e8821a" strokeWidth="1"/>
              <text x="36" y="70" textAnchor="middle" fontSize="9" fill="#e8821a">☀</text>
              {/* Body */}
              <rect x="26" y="44" width="20" height="28" rx="6" fill="transparent"/>
              {/* Head */}
              <ellipse cx="36" cy="30" rx="13" ry="14" fill="#f5d5b0" stroke="#d4a96a" strokeWidth="1.5"/>
              {/* Hair */}
              <ellipse cx="36" cy="18" rx="13" ry="6" fill="#1a1008"/>
              {/* Eyes (wise, serene) */}
              <ellipse cx="30" cy="30" rx="3" ry="2.5" fill="#1a1008"/>
              <ellipse cx="42" cy="30" rx="3" ry="2.5" fill="#1a1008"/>
              <circle cx="31" cy="29" r="1" fill="white"/>
              <circle cx="43" cy="29" r="1" fill="white"/>
              {/* Slight smile */}
              <path d="M30 37 Q36 41 42 37" stroke="#8a5030" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              {/* Mark on forehead */}
              <circle cx="36" cy="22" r="2.5" fill="rgba(232,130,26,0.5)" stroke="#e8821a" strokeWidth="0.5"/>
              {/* Arms open/welcoming */}
              <rect x="4" y="50" width="22" height="6" rx="3" fill="#f5d5b0" transform="rotate(20 15 53)"/>
              <rect x="46" y="50" width="22" height="6" rx="3" fill="#f5d5b0" transform="rotate(-20 57 53)"/>
            </svg>
            <div style={{
              color: '#1a1008',
              fontWeight: 700,
              marginTop: 6,
              lineHeight: 1.3,
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '0.9rem',
            }}>Sol-Ray Bot</div>
            <div style={{
              fontSize: '0.65rem',
              color: '#e8821a',
              lineHeight: 1.3,
              fontWeight: 600,
              background: 'rgba(232,130,26,0.1)',
              borderRadius: 20,
              padding: '2px 8px',
              display: 'inline-block',
              marginTop: 2,
              border: '1px solid rgba(232,130,26,0.25)',
            }}>CEO</div>
          </div>

          {/* PM Commerce */}
          <div className="office-char" style={{ textAlign: 'center' }}>
            <div style={{ height: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 4 }}>
              {/* Whiteboard */}
              <svg width="48" height="36" viewBox="0 0 48 36">
                <rect x="2" y="2" width="44" height="28" rx="3" fill="#fafafa" stroke="#d4a96a" strokeWidth="1.5"/>
                <rect x="2" y="2" width="44" height="5" rx="2" fill="#e8d5b8"/>
                <line x1="8" y1="12" x2="24" y2="12" stroke="#e8821a" strokeWidth="1.5" strokeLinecap="round"/>
                <rect x="10" y="16" width="8" height="10" rx="1" fill="rgba(232,130,26,0.15)" stroke="#e8821a" strokeWidth="1"/>
                <rect x="22" y="18" width="8" height="8" rx="1" fill="rgba(232,130,26,0.1)" stroke="#d4a96a" strokeWidth="1"/>
                <rect x="34" y="14" width="8" height="12" rx="1" fill="rgba(232,130,26,0.08)" stroke="#d4a96a" strokeWidth="1"/>
                <line x1="14" y1="30" x2="14" y2="34" stroke="#d4a96a" strokeWidth="2"/>
                <line x1="34" y1="30" x2="34" y2="34" stroke="#d4a96a" strokeWidth="2"/>
              </svg>
            </div>
            <svg width="64" height="90" viewBox="0 0 64 90" style={{ display: 'block', margin: '0 auto' }}>
              {/* Body standing */}
              <rect x="22" y="36" width="20" height="30" rx="4" fill="#fde8d0" stroke="#e8c090" strokeWidth="1"/>
              {/* Tie/vest detail */}
              <path d="M32 38 L29 50 L32 52 L35 50 Z" fill="#e8821a" opacity="0.7"/>
              {/* Head */}
              <ellipse cx="32" cy="26" rx="11" ry="12" fill="#f5d5b0" stroke="#d4a96a" strokeWidth="1"/>
              {/* Hair (short, neat) */}
              <ellipse cx="32" cy="17" rx="10" ry="5" fill="#4a3020"/>
              <rect x="22" y="17" width="4" height="6" rx="2" fill="#4a3020"/>
              {/* Eyes (focused) */}
              <ellipse cx="27" cy="27" rx="2.5" ry="2.5" fill="#1a1008"/>
              <ellipse cx="37" cy="27" rx="2.5" ry="2.5" fill="#1a1008"/>
              <circle cx="27.8" cy="26.2" r="0.7" fill="white"/>
              <circle cx="37.8" cy="26.2" r="0.7" fill="white"/>
              {/* Arm pointing at board */}
              <rect x="42" y="38" width="14" height="5" rx="2.5" fill="#f5d5b0" transform="rotate(-40 49 40)"/>
              {/* Marker in hand */}
              <rect x="53" y="25" width="2" height="8" rx="1" fill="#e8821a" transform="rotate(-40 54 29)"/>
              {/* Other arm back */}
              <rect x="8" y="48" width="14" height="5" rx="2.5" fill="#f5d5b0" transform="rotate(10 15 50)"/>
              {/* Legs */}
              <rect x="26" y="66" width="5" height="20" rx="2.5" fill="#2d1f0e"/>
              <rect x="33" y="66" width="5" height="20" rx="2.5" fill="#2d1f0e"/>
            </svg>
            <div style={{ fontSize: '0.7rem', color: '#1a1008', fontWeight: 600, marginTop: 6, lineHeight: 1.3 }}>PM Commerce</div>
            <div style={{ fontSize: '0.62rem', color: '#7a6a5a', lineHeight: 1.3 }}>Commerce</div>
          </div>

          {/* PM Bobby */}
          <div className="office-char" style={{ textAlign: 'center' }}>
            <div style={{ height: 60 }} />
            <div className="chair-rock" style={{ display: 'inline-block' }}>
              <svg width="64" height="100" viewBox="0 0 64 100" style={{ display: 'block', margin: '0 auto' }}>
                {/* Tilted chair back */}
                <rect x="18" y="56" width="28" height="28" rx="4" fill="#d4a96a" stroke="#b08040" strokeWidth="1" transform="rotate(12 32 70)"/>
                {/* Chair seat */}
                <rect x="16" y="72" width="32" height="10" rx="4" fill="#c09050" stroke="#a07030" strokeWidth="1" transform="rotate(12 32 77)"/>
                {/* Chair legs */}
                <line x1="18" y1="82" x2="12" y2="96" stroke="#a07030" strokeWidth="3" strokeLinecap="round"/>
                <line x1="46" y1="82" x2="52" y2="96" stroke="#a07030" strokeWidth="3" strokeLinecap="round"/>
                {/* Body leaning back */}
                <rect x="22" y="44" width="20" height="30" rx="4" fill="#e8f0fe" stroke="#c0ccea" strokeWidth="1" transform="rotate(12 32 59)"/>
                {/* Folded arms */}
                <rect x="16" y="55" width="14" height="5" rx="2.5" fill="#f5d5b0" transform="rotate(8 23 57)"/>
                <rect x="34" y="52" width="14" height="5" rx="2.5" fill="#f5d5b0" transform="rotate(-8 41 54)"/>
                {/* Head tilted back */}
                <ellipse cx="34" cy="30" rx="11" ry="12" fill="#f5d5b0" stroke="#d4a96a" strokeWidth="1" transform="rotate(12 34 30)"/>
                {/* Hair */}
                <ellipse cx="34" cy="20" rx="11" ry="6" fill="#5c3d1e" transform="rotate(12 34 20)"/>
                {/* Eyes (confident, half-lidded) */}
                <path d="M28 31 Q31 29 34 31" stroke="#1a1008" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                <path d="M36 31 Q39 29 42 31" stroke="#1a1008" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                {/* Smug smile */}
                <path d="M29 37 Q34 39 38 36" stroke="#8a5030" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#1a1008', fontWeight: 600, marginTop: 2, lineHeight: 1.3 }}>PM Bobby</div>
            <div style={{ fontSize: '0.62rem', color: '#c8b89a', lineHeight: 1.3, fontStyle: 'italic' }}>Not yet active</div>
          </div>

          {/* PM Dog */}
          <div className="office-char" style={{ textAlign: 'center' }}>
            <div style={{ height: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 4 }}>
              {/* Zen circle above */}
              <svg width="36" height="36" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(232,130,26,0.4)" strokeWidth="1.5" strokeDasharray="3 5"/>
                <circle cx="18" cy="18" r="8" fill="none" stroke="rgba(232,130,26,0.25)" strokeWidth="1"/>
                <text x="18" y="23" textAnchor="middle" fontSize="12" fill="#e8821a" opacity="0.6">☯</text>
              </svg>
            </div>
            <svg width="64" height="90" viewBox="0 0 64 90" style={{ display: 'block', margin: '0 auto' }}>
              {/* Cushion */}
              <ellipse cx="32" cy="80" rx="22" ry="8" fill="#e8c090" stroke="#c09050" strokeWidth="1.5"/>
              <ellipse cx="32" cy="78" rx="22" ry="8" fill="#f0d5a0" stroke="#d4a96a" strokeWidth="1.5"/>
              {/* Body (sitting cross-legged) */}
              <ellipse cx="32" cy="62" rx="16" ry="14" fill="#fef3d0" stroke="#e8d5a0" strokeWidth="1"/>
              {/* Crossed legs */}
              <ellipse cx="22" cy="72" rx="8" ry="5" fill="#fef3d0" stroke="#e8d5a0" strokeWidth="1"/>
              <ellipse cx="42" cy="72" rx="8" ry="5" fill="#fef3d0" stroke="#e8d5a0" strokeWidth="1"/>
              {/* Paws in lap (zen mudra) */}
              <circle cx="28" cy="68" r="5" fill="#f5d5b0" stroke="#d4a96a" strokeWidth="1"/>
              <circle cx="36" cy="68" r="5" fill="#f5d5b0" stroke="#d4a96a" strokeWidth="1"/>
              {/* Dog head */}
              <ellipse cx="32" cy="42" rx="13" ry="12" fill="#d4a96a" stroke="#b08040" strokeWidth="1.5"/>
              {/* Ears */}
              <ellipse cx="20" cy="38" rx="6" ry="9" fill="#c09050" stroke="#a07030" strokeWidth="1" transform="rotate(-15 20 38)"/>
              <ellipse cx="44" cy="38" rx="6" ry="9" fill="#c09050" stroke="#a07030" strokeWidth="1" transform="rotate(15 44 38)"/>
              <ellipse cx="20" cy="38" rx="3.5" ry="6" fill="#b08040" transform="rotate(-15 20 38)"/>
              <ellipse cx="44" cy="38" rx="3.5" ry="6" fill="#b08040" transform="rotate(15 44 38)"/>
              {/* Snout */}
              <ellipse cx="32" cy="47" rx="7" ry="5" fill="#c09050" stroke="#a07030" strokeWidth="1"/>
              {/* Nose */}
              <ellipse cx="32" cy="45" rx="3" ry="2" fill="#3d2c1a"/>
              {/* Closed/zen eyes */}
              <path d="M25 40 Q28 38 31 40" stroke="#3d2c1a" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              <path d="M33 40 Q36 38 39 40" stroke="#3d2c1a" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              {/* Gentle smile */}
              <path d="M27 50 Q32 54 37 50" stroke="#3d2c1a" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
            </svg>
            <div style={{ fontSize: '0.7rem', color: '#1a1008', fontWeight: 600, marginTop: 6, lineHeight: 1.3 }}>PM Dog</div>
            <div style={{ fontSize: '0.62rem', color: '#7a6a5a', lineHeight: 1.3 }}>Sol-Ray Dog</div>
          </div>

        </div>

        {/* Floor label */}
        <div style={{
          textAlign: 'center',
          marginTop: 24,
          fontSize: '0.72rem',
          color: 'rgba(122, 106, 90, 0.6)',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          fontWeight: 500,
        }}>
          Sol-Ray Bob Empire HQ · Floor One
        </div>
      </div>
    </div>
  );
}

// ─── Cron Jobs ────────────────────────────────────────────────────────────────

const CRON_JOBS: CronJob[] = [
  { name: 'X Morning Post', schedule: '0 8 * * *', label: '☀️', tz: 'Europe/Madrid' },
  { name: 'X Afternoon Post', schedule: '0 13 * * *', label: '🌤', tz: 'Europe/Madrid' },
  { name: 'X Evening Post', schedule: '0 19 * * *', label: '🌙', tz: 'Europe/Madrid' },
  { name: 'Nightly Memory Consolidation', schedule: '0 2 * * *', label: '🧠', tz: 'Europe/Madrid' },
  { name: 'Email Follow-up', schedule: '0 9 * * *', label: '📧', tz: 'Europe/Madrid' },
];

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function MissionControl() {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [health, setHealth] = useState<ServiceStatus[] | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [tweets, setTweets] = useState<Tweet[] | null>(null);
  const [emailStats, setEmailStats] = useState<EmailStats | null>(null);
  const [dns, setDns] = useState<DnsStatus | null>(null);
  const [memory, setMemory] = useState<MemoryData | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [h, d, t, e, dnsData, m] = await Promise.allSettled([
        fetch('/api/health').then(r => r.json()),
        fetch('/api/dashboard').then(r => r.json()),
        fetch('/api/tweets').then(r => r.json()),
        fetch('/api/email-stats').then(r => r.json()),
        fetch('/api/dns').then(r => r.json()),
        fetch('/api/memory').then(r => r.json()),
      ]);

      if (h.status === 'fulfilled') setHealth(h.value);
      if (d.status === 'fulfilled') setDashboard(d.value);
      if (t.status === 'fulfilled') setTweets(Array.isArray(t.value) ? t.value : []);
      if (e.status === 'fulfilled') setEmailStats(e.value);
      if (dnsData.status === 'fulfilled') setDns(dnsData.value);
      if (m.status === 'fulfilled') setMemory(m.value);

      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#faf6f0',
      color: '#1a1008',
      fontFamily: "'Inter', sans-serif",
      padding: '0 0 60px',
    }}>

      {/* Header — newspaper masthead style */}
      <div style={{
        background: 'linear-gradient(135deg, #e8821a 0%, #c9681a 50%, #b5561a 100%)',
        padding: '28px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        boxShadow: '0 4px 20px rgba(232, 130, 26, 0.3)',
      }}>
        <div>
          <h1 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 700,
            color: '#1a1008',
            margin: 0,
            lineHeight: 1,
            letterSpacing: '-0.5px',
          }}>
            ☀ Mission Control
          </h1>
          <div style={{
            fontSize: '0.85rem',
            color: 'rgba(26, 16, 8, 0.7)',
            marginTop: 6,
            fontFamily: "'Inter', sans-serif",
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontWeight: 500,
          }}>
            Sol-Ray Bob Empire · Operations Command
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {lastUpdated && (
            <div style={{ fontSize: '0.8rem', color: 'rgba(26, 16, 8, 0.65)' }}>
              Last updated: {lastUpdated.toLocaleTimeString()}
            </div>
          )}
          <button
            onClick={refresh}
            disabled={loading}
            style={{
              marginTop: 6,
              padding: '6px 16px',
              background: 'rgba(26, 16, 8, 0.15)',
              border: '1px solid rgba(26, 16, 8, 0.3)',
              borderRadius: 6,
              color: '#1a1008',
              cursor: loading ? 'wait' : 'pointer',
              fontSize: '0.8rem',
              fontFamily: "'Inter', sans-serif",
              fontWeight: 500,
            }}
          >
            {loading ? 'Refreshing...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Thin gold rule below header */}
      <div style={{
        height: 3,
        background: 'linear-gradient(90deg, #c9681a, #e8821a, #c9681a)',
      }} />

      {/* PM Office */}
      <div style={{ padding: '28px 0 8px', background: '#fff8f0' }}>
        <PMOfficeSection />
      </div>

      {/* Task Board — after PM Office */}
      <TaskBoardSection />

      {/* Grid */}
      <div style={{
        padding: '24px 32px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
        gap: 20,
        background: '#fffdf8',
      }}>

        {/* 1. System Health */}
        <Card title="System Health" icon="🔴">
          {!health ? (
            <div style={{ color: '#7a6a5a', fontSize: '0.85rem' }}>Checking services...</div>
          ) : (
            <div>
              {health.map(svc => (
                <div key={svc.name} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderBottom: '1px solid #e8d5b8',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <StatusDot status={svc.status as 'up' | 'down'} />
                    <span style={{ fontSize: '0.9rem', color: '#1a1008' }}>{svc.name}</span>
                  </div>
                  <span style={{
                    fontSize: '0.75rem',
                    color: svc.status === 'up' ? '#22c55e' : '#ef4444',
                  }}>
                    {svc.status === 'up' ? `${svc.ms}ms` : `HTTP ${svc.statusCode || 'err'}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 2. Users & Growth */}
        <Card title="Users & Growth" icon="📈">
          {!dashboard ? (
            <div style={{ color: '#7a6a5a', fontSize: '0.85rem' }}>Loading...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              <Stat label="Total Users" value={dashboard.users?.total ?? 0} />
              <Stat label="New (7d)" value={dashboard.users?.new_7d ?? 0} />
              <Stat label="Waitlist" value={dashboard.waitlist?.total ?? 0} />
              <Stat label="New Waitlist (7d)" value={dashboard.waitlist?.new_7d ?? 0} />
            </div>
          )}
        </Card>

        {/* 3. X / Twitter Posts */}
        <Card title="Recent X Posts" icon="✖">
          {!tweets ? (
            <div style={{ color: '#7a6a5a', fontSize: '0.85rem' }}>Loading...</div>
          ) : tweets.length === 0 ? (
            <div style={{ color: '#7a6a5a', fontSize: '0.85rem' }}>No recent posts found.</div>
          ) : (
            <div>
              {tweets.slice(0, 5).map((tweet, i) => (
                <div key={tweet.id || i} style={{
                  padding: '8px 0',
                  borderBottom: i < tweets.length - 1 ? '1px solid #e8d5b8' : 'none',
                }}>
                  <div style={{ fontSize: '0.75rem', color: '#7a6a5a', marginBottom: 3 }}>
                    {formatTs(tweet.timestamp)}
                    {tweet.id && (
                      <a
                        href={`https://twitter.com/solraybob/status/${tweet.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#e8821a', marginLeft: 8, textDecoration: 'none' }}
                      >
                        ↗
                      </a>
                    )}
                  </div>
                  <div style={{ fontSize: '0.85rem', lineHeight: 1.4, color: '#1a1008' }}>
                    {tweet.text.length > 140 ? tweet.text.slice(0, 140) + '…' : tweet.text}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 4. Email Queue */}
        <Card title="Email Queue" icon="📧">
          {!emailStats ? (
            <div style={{ color: '#7a6a5a', fontSize: '0.85rem' }}>Loading...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              <Stat label="Total in Queue" value={emailStats.total_in_queue} />
              <Stat label="Pending Day-3" value={emailStats.pending_day3} />
              <Stat label="Pending Day-7" value={emailStats.pending_day7} />
              <div>
                <div style={{ fontSize: '0.75rem', color: '#7a6a5a', marginBottom: 2 }}>Last Sent</div>
                <div style={{ fontSize: '0.85rem', color: '#1a1008' }}>
                  {emailStats.last_email_sent ? formatTs(emailStats.last_email_sent) : 'None yet'}
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* 5. DNS Status */}
        <Card title="DNS Status" icon="🌐">
          {!dns ? (
            <div style={{ color: '#7a6a5a', fontSize: '0.85rem' }}>Checking DNS...</div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                <StatusDot status={dns.propagated ? 'up' : 'down'} />
                <span style={{ fontWeight: 600, marginRight: 8, color: '#1a1008' }}>solray.ai</span>
                <span style={{
                  padding: '2px 10px',
                  borderRadius: 20,
                  fontSize: '0.75rem',
                  background: dns.propagated ? '#22c55e18' : '#ef444418',
                  color: dns.propagated ? '#22c55e' : '#ef4444',
                  border: `1px solid ${dns.propagated ? '#22c55e44' : '#ef444444'}`,
                }}>
                  {dns.status}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#7a6a5a', marginBottom: 4 }}>Nameservers</div>
              {dns.nameservers.slice(0, 4).map(ns => (
                <div key={ns} style={{ fontSize: '0.8rem', color: '#1a1008', marginBottom: 2 }}>
                  → {ns}
                </div>
              ))}
              {dns.aRecords.length > 0 && (
                <>
                  <div style={{ fontSize: '0.8rem', color: '#7a6a5a', marginTop: 8, marginBottom: 4 }}>A Records</div>
                  {dns.aRecords.map(ip => (
                    <div key={ip} style={{ fontSize: '0.8rem', color: '#1a1008', marginBottom: 2 }}>
                      → {ip}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </Card>

        {/* 6. Cron Jobs */}
        <Card title="Cron Jobs" icon="⏱">
          <div>
            {CRON_JOBS.map(job => (
              <div key={job.name} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: '1px solid #e8d5b8',
              }}>
                <div style={{ fontSize: '0.85rem', color: '#1a1008' }}>
                  <span style={{ marginRight: 6 }}>{job.label}</span>
                  {job.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#7a6a5a', textAlign: 'right' }}>
                  {nextCronFire(job.schedule, job.tz)}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* 7. Recent Memory */}
        <Card title="Recent Memory" icon="🧠">
          {!memory ? (
            <div style={{ color: '#7a6a5a', fontSize: '0.85rem' }}>Loading...</div>
          ) : (
            <div>
              {memory.date && (
                <div style={{ fontSize: '0.75rem', color: '#7a6a5a', marginBottom: 10 }}>
                  From {memory.date}
                </div>
              )}
              {memory.entries.length === 0 ? (
                <div style={{ color: '#7a6a5a', fontSize: '0.85rem' }}>No memory entries found.</div>
              ) : (
                <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
                  {memory.entries.map((entry, i) => (
                    <li key={i} style={{
                      fontSize: '0.85rem',
                      lineHeight: 1.5,
                      marginBottom: 8,
                      color: '#1a1008',
                    }}>
                      {entry}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Card>

      </div>

      {/* Playful Office Scene — at the bottom */}
      <PlayfulOfficeSection />

      {/* Footer */}
      <div style={{
        textAlign: 'center',
        padding: '0 32px',
        color: '#7a6a5a',
        fontSize: '0.75rem',
        background: '#fffdf8',
      }}>
        Auto-refreshes every 60s · Sol-Ray Bob Empire · Mission Control
      </div>
    </div>
  );
}
