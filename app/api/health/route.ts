import { NextResponse } from 'next/server';

const SERVICES = [
  { name: 'Backend API', url: 'https://solray-backend-production.up.railway.app/' },
  { name: 'Landing Page', url: 'https://solray-landing.vercel.app/' },
  { name: 'App', url: 'https://solray-app.vercel.app/' },
];

async function checkService(name: string, url: string) {
  const start = Date.now();
  try {
    const res = await fetch(url, { 
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });
    const ms = Date.now() - start;
    return { name, url, status: res.ok ? 'up' : 'down', statusCode: res.status, ms };
  } catch {
    const ms = Date.now() - start;
    return { name, url, status: 'down', statusCode: 0, ms };
  }
}

export async function GET() {
  const results = await Promise.all(
    SERVICES.map(s => checkService(s.name, s.url))
  );
  return NextResponse.json(results);
}
