export const publicConfig = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1',
  socketUrl: process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:3001/match',
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  termsVersion: process.env.NEXT_PUBLIC_TERMS_VERSION ?? 'v0.1-alpha',
  privacyVersion: process.env.NEXT_PUBLIC_PRIVACY_VERSION ?? 'v0.1-alpha',
  demoMode: process.env.NEXT_PUBLIC_DEMO_MODE !== 'false'
} as const;
