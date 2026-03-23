import { NextResponse } from 'next/server';
import { readFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const MEMORY_DIR = '/Users/solraybob/.openclaw/workspace/memory';

export async function GET() {
  try {
    // Find the most recent memory file
    if (!existsSync(MEMORY_DIR)) {
      return NextResponse.json({ entries: [], date: null });
    }

    const files = (await readdir(MEMORY_DIR))
      .filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.md$/))
      .sort()
      .reverse();

    if (files.length === 0) {
      return NextResponse.json({ entries: [], date: null });
    }

    const latestFile = files[0];
    const raw = await readFile(path.join(MEMORY_DIR, latestFile), 'utf-8');

    // Extract meaningful lines (non-empty, non-header lines with content)
    const lines = raw.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith('---'))
      .slice(0, 30); // get first 30 to find 5 good entries

    // Extract bullet points or paragraphs
    const entries: string[] = [];
    for (const line of lines) {
      if (line.startsWith('#')) continue; // skip headers
      const text = line.replace(/^[-*]\s+/, '').trim();
      if (text.length > 20) {
        entries.push(text);
      }
      if (entries.length >= 5) break;
    }

    return NextResponse.json({
      entries,
      date: latestFile.replace('.md', ''),
      file: latestFile,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to read memory' }, { status: 500 });
  }
}
