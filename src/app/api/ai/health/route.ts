import { NextResponse } from 'next/server';
import { getAIHealth } from '@/lib/ai/ai-service';

export async function GET() {
  const health = getAIHealth();

  return NextResponse.json(
    health,
    { status: health.success ? 200 : 503 }
  );
}
