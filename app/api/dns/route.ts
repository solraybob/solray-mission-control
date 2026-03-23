import { NextResponse } from 'next/server';
import { promises as dns } from 'dns';

export async function GET() {
  try {
    // Check NS records for solray.ai
    let nameservers: string[] = [];
    let aRecords: string[] = [];
    let propagated = false;

    try {
      nameservers = await dns.resolveNs('solray.ai');
    } catch {
      nameservers = ['Could not resolve'];
    }

    try {
      aRecords = await dns.resolve4('solray.ai');
      // Vercel uses 76.76.21.x range
      propagated = aRecords.some(ip => ip.startsWith('76.76.'));
    } catch {
      aRecords = [];
    }

    return NextResponse.json({
      domain: 'solray.ai',
      nameservers: nameservers.sort(),
      aRecords,
      propagated,
      status: propagated ? 'Propagated' : nameservers.length > 0 ? 'Pending' : 'Not Resolved',
    });
  } catch (err) {
    return NextResponse.json({ error: 'DNS check failed' }, { status: 500 });
  }
}
