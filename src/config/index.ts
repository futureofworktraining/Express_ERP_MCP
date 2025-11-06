/**
 * Konfiguracja aplikacji
 */

import type { AppConfig } from '../types/index.js';

/**
 * Pobiera konfigurację ze zmiennych środowiskowych
 */
export function getConfig(): AppConfig {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseBearerToken = process.env.SUPABASE_BEARER_TOKEN;

  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL environment variable is required');
  }

  if (!supabaseBearerToken) {
    throw new Error('SUPABASE_BEARER_TOKEN environment variable is required');
  }

  return {
    supabaseUrl,
    supabaseBearerToken,
    apiTimeout: parseInt(process.env.API_TIMEOUT || '5000', 10),
    logLevel: process.env.LOG_LEVEL || 'info',
    nodeEnv: process.env.NODE_ENV || 'development',
  };
}

/**
 * Waliduje konfigurację
 */
export function validateConfig(config: AppConfig): void {
  if (!config.supabaseUrl.startsWith('http')) {
    throw new Error('SUPABASE_URL must be a valid HTTP URL');
  }

  if (config.supabaseBearerToken.length < 10) {
    throw new Error('SUPABASE_BEARER_TOKEN appears to be invalid');
  }

  if (config.apiTimeout < 1000 || config.apiTimeout > 30000) {
    throw new Error('API_TIMEOUT must be between 1000 and 30000 milliseconds');
  }
}
