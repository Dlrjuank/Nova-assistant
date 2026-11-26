import { NextResponse } from 'next/server';
import { TEXTO_REGISTRO_CERRADO } from '@/lib/auth/registro';

export async function POST() {
  return NextResponse.json({ success: false, error: TEXTO_REGISTRO_CERRADO }, { status: 403 });
}
