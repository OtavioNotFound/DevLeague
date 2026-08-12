'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { publicConfig } from './config';
import { DevLeagueApi } from './api';

let client: SupabaseClient | null = null;
const rememberSessionKey = 'devleague:remember-session';

const adaptiveStorage = {
  getItem(key: string): string | null {
    return window.sessionStorage.getItem(key) ?? window.localStorage.getItem(key);
  },
  setItem(key: string, value: string): void {
    const remember = window.localStorage.getItem(rememberSessionKey) !== 'false';
    const selected = remember ? window.localStorage : window.sessionStorage;
    const other = remember ? window.sessionStorage : window.localStorage;
    selected.setItem(key, value);
    other.removeItem(key);
  },
  removeItem(key: string): void {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  }
};

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (publicConfig.demoMode) return null;
  if (!publicConfig.supabaseUrl || !publicConfig.supabasePublishableKey) return null;
  client ??= createClient(publicConfig.supabaseUrl, publicConfig.supabasePublishableKey, {
    auth: { persistSession: true, storage: adaptiveStorage }
  });
  return client;
}

export function setRememberSession(remember: boolean): void {
  window.localStorage.setItem(rememberSessionKey, String(remember));
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
