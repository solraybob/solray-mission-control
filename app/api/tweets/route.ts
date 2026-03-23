import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

const TWEETS_FILE = '/Users/solraybob/.openclaw/workspace/data/recent_tweets.json';

export async function GET() {
  try {
    if (!existsSync(TWEETS_FILE)) {
      return NextResponse.json([]);
    }
    const raw = await readFile(TWEETS_FILE, 'utf-8');
    const tweets = JSON.parse(raw);
    // Return last 10, most recent first
    return NextResponse.json(tweets.slice(-10).reverse());
  } catch (err) {
    return NextResponse.json({ error: 'Failed to read tweets' }, { status: 500 });
  }
}
