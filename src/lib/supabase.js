import { createClient } from '@supabase/supabase-js';

// Retrieve credentials from environment or client localStorage
function getActiveCredentials() {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  let customUrl = '';
  let customKey = '';
  if (typeof window !== 'undefined' && window.localStorage) {
    customUrl = localStorage.getItem('techpulse_supabase_url') || '';
    customKey = localStorage.getItem('techpulse_supabase_key') || '';
  }

  const url = (customUrl || envUrl).trim();
  const key = (customKey || envKey).trim();
  const source = customUrl ? 'custom' : envUrl ? 'env' : 'none';

  const isConfigured = Boolean(
    url &&
    key &&
    url !== '' &&
    key !== '' &&
    !url.includes('your-project') &&
    !key.includes('your-anon-public-key')
  );

  return { url, key, source, isConfigured };
}

let activeCreds = getActiveCredentials();

export let isSupabaseConfigured = activeCreds.isConfigured;

export let supabase = isSupabaseConfigured
  ? createClient(activeCreds.url, activeCreds.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

/**
 * Reinitialize Supabase client dynamically if keys are updated in the UI
 */
export function reinitializeSupabase() {
  activeCreds = getActiveCredentials();
  isSupabaseConfigured = activeCreds.isConfigured;
  supabase = isSupabaseConfigured
    ? createClient(activeCreds.url, activeCreds.key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null;
  return getSupabaseConfigStatus();
}

/**
 * Save custom Supabase credentials from the Admin UI
 */
export function setCustomSupabaseCredentials(url, key) {
  if (typeof window !== 'undefined' && window.localStorage) {
    if (url && key) {
      localStorage.setItem('techpulse_supabase_url', url.trim());
      localStorage.setItem('techpulse_supabase_key', key.trim());
    }
  }
  return reinitializeSupabase();
}

/**
 * Remove custom Supabase credentials
 */
export function clearCustomSupabaseCredentials() {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.removeItem('techpulse_supabase_url');
    localStorage.removeItem('techpulse_supabase_key');
  }
  return reinitializeSupabase();
}

/**
 * Get current configuration details
 */
export const getSupabaseConfigStatus = () => {
  const creds = getActiveCredentials();
  return {
    configured: creds.isConfigured,
    url: creds.url || null,
    source: creds.source,
    hasKey: Boolean(creds.key),
  };
};

/**
 * Test connectivity to a Supabase project by querying the location_sessions table
 */
export async function testSupabaseConnection(testUrl, testKey) {
  const url = testUrl || activeCreds.url;
  const key = testKey || activeCreds.key;

  if (!url || !key) {
    return {
      success: false,
      error: 'Missing Supabase Project URL or Anon Key. Please enter both fields.',
    };
  }

  try {
    const testClient = createClient(url, key);
    const { data, error } = await testClient
      .from('location_sessions')
      .select('id')
      .limit(1);

    if (error) {
      // Check if table missing
      if (error.code === '42P01' || error.message?.includes('relation "public.location_sessions" does not exist')) {
        return {
          success: false,
          error:
            'Connected to Supabase, but the "location_sessions" table is not found. Please run the SQL schema migration in your Supabase SQL Editor.',
          missingTable: true,
        };
      }
      return {
        success: false,
        error: `Supabase returned an error: ${error.message} (Code: ${error.code})`,
      };
    }

    return {
      success: true,
      message: 'Successfully connected to Supabase PostgreSQL! Database is live and ready.',
      dataCount: data?.length || 0,
    };
  } catch (err) {
    return {
      success: false,
      error: `Network connection failed: ${err.message}`,
    };
  }
}
