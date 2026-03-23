import { NextResponse } from 'next/server';

const BACKEND = 'https://solray-backend-production.up.railway.app';

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/dashboard`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'Backend error' }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 503 });
  }
}
