import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

const EMAIL_STATS_FILE = '/Users/solraybob/.openclaw/workspace/data/email_stats.json';
const EMAIL_QUEUE_FILE = '/Users/solraybob/.openclaw/workspace/data/email_queue.json';

export async function GET() {
  try {
    // Try email_stats.json first
    if (existsSync(EMAIL_STATS_FILE)) {
      const raw = await readFile(EMAIL_STATS_FILE, 'utf-8');
      return NextResponse.json(JSON.parse(raw));
    }

    // Fallback: compute from queue
    if (existsSync(EMAIL_QUEUE_FILE)) {
      const raw = await readFile(EMAIL_QUEUE_FILE, 'utf-8');
      const queue = JSON.parse(raw);
      const total = queue.length;
      const pending_day3 = queue.filter((e: Record<string, unknown>) => !e.day3_sent).length;
      const pending_day7 = queue.filter((e: Record<string, unknown>) => !e.day7_sent).length;
      return NextResponse.json({
        total_in_queue: total,
        pending_day3,
        pending_day7,
        last_email_sent: null,
      });
    }

    return NextResponse.json({ total_in_queue: 0, pending_day3: 0, pending_day7: 0, last_email_sent: null });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to read email stats' }, { status: 500 });
  }
}
