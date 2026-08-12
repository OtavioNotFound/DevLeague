'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { publicConfig } from './config';
import { DevLeagueApi } from './api';

let client: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (publicConfig.demoMode) return null;
  if (!publicConfig.supabaseUrl || !publicConfig.supabasePublishableKey) return null;
  client ??= createClient(publicConfig.supabaseUrl, publicConfig.supabasePublishableKey);
  return client;
}

export async function getAccessToken(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export function createApi(): DevLeagueApi {
  return new DevLeagueApi(getAccessToken);
}
