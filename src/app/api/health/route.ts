import { NextResponse } from 'next/server';

/**
 * Health check endpoint for the Syntra server.
 *
 * Used by the Capacitor APK to verify that the server is reachable
 * before attempting API calls. This is especially important when
 * using Cloudflare tunnels or ngrok to expose the dev server.
 *
 * When the APK detects a "server" type connection (tunnel pointing
 * to a Next.js server), it hits this endpoint instead of trying
 * to discover OpenAI-compatible API paths.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'syntra-server',
    timestamp: Date.now(),
    version: '2.0',
  });
}

export async function POST() {
  return NextResponse.json({
    status: 'ok',
    service: 'syntra-server',
    timestamp: Date.now(),
    version: '2.0',
  });
}
