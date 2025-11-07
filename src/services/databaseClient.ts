/**
 * Klient bazy danych Supabase
 * Umożliwia bezpośredni dostęp do bazy danych poprzez Supabase Client
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  AppConfig,
  DatabaseSchemaResponse,
  TableInfo,
  ColumnInfo,
  ForeignKeyInfo,
  IndexInfo,
} from '../types/index.js';
import { ApiError } from '../types/index.js';

/**
 * Klasa klienta bazy danych
 */
export class DatabaseClient {
  private supabase: SupabaseClient | null = null;
  private defaultQueryLimit: number;

  constructor(config: AppConfig) {
    this.defaultQueryLimit = config.defaultQueryLimit || 50;

    // Inicjalizuj klienta Supabase z bearer token (anon key)
    // Wszystkie zapytania respektują Row Level Security (RLS)
    if (config.supabaseProjectUrl && config.supabaseBearerToken) {
      this.supabase = createClient(
        config.supabaseProjectUrl,
        config.supabaseBearerToken,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );
    }
  }

  /**
   * Sprawdza czy klient bazy danych jest dostępny
   */
  private ensureClient(): void {
    if (!this.supabase) {
      throw new ApiError(
        'Database client not configured. Please provide SUPABASE_PROJECT_URL and SUPABASE_BEARER_TOKEN',
        500
      );
    }
  }

  /**
   * Pobiera strukturę bazy danych
   * @param includeRelations - Czy dołączyć informacje o relacjach (foreign keys)
   * @param includeIndexes - Czy dołączyć informacje o indeksach
   * @param schema - Nazwa schematu (domyślnie 'public')
   */
  async getDatabaseSchema(
    includeRelations: boolean = true,
    includeIndexes: boolean = true,
    schema: string = 'public'
  ): Promise<DatabaseSchemaResponse> {
    this.ensureClient();

    try {
      // 1. Pobierz listę tabel
      const tablesQuery = `
        SELECT table_name, table_schema
        FROM information_schema.tables
        WHERE table_schema = '${schema}'
          AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `;

      const { data: tablesData, error: tablesError } = await this.supabase!.rpc(
        'exec_sql',
        { query: tablesQuery }
      );

      if (tablesError) {
        // Jeśli RPC nie jest dostępne, spróbuj przez Postgres REST API
        const tablesResult = await this.executeRawSQL(tablesQuery);
        return await this.buildSchemaResponse(
          tablesResult,
          schema,
          includeRelations,
          includeIndexes
        );
      }

      return await this.buildSchemaResponse(
        tablesData,
        schema,
        includeRelations,
        includeIndexes
      );
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        `Failed to retrieve database schema: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        error
      );
    }
  }

  /**
   * Buduje odpowiedź ze strukturą bazy danych
   */
  private async buildSchemaResponse(
    tablesData: any[],
    schema: string,
    includeRelations: boolean,
    includeIndexes: boolean
  ): Promise<DatabaseSchemaResponse> {
    const tables: TableInfo[] = [];

    for (const table of tablesData) {
      const tableName = table.table_name;

      // Pobierz kolumny
      const columns = await this.getTableColumns(tableName, schema);

      const tableInfo: TableInfo = {
        table_name: tableName,
        table_schema: schema,
        columns,
      };

      // Pobierz relacje jeśli wymagane
      if (includeRelations) {
        tableInfo.foreign_keys = await this.getTableForeignKeys(tableName, schema);
      }

      // Pobierz indeksy jeśli wymagane
      if (includeIndexes) {
        tableInfo.indexes = await this.getTableIndexes(tableName, schema);
      }

      tables.push(tableInfo);
    }

    return {
      tables,
      total_tables: tables.length,
    };
  }

  /**
   * Pobiera informacje o kolumnach tabeli
   */
  private async getTableColumns(
    tableName: string,
    schema: string
  ): Promise<ColumnInfo[]> {
    const query = `
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = '${schema}'
        AND table_name = '${tableName}'
      ORDER BY ordinal_position;
    `;

    const result = await this.executeRawSQL(query);
    return result;
  }

  /**
   * Pobiera informacje o foreign keys tabeli
   */
  private async getTableForeignKeys(
    tableName: string,
    schema: string
  ): Promise<ForeignKeyInfo[]> {
    const query = `
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = '${schema}'
        AND tc.table_name = '${tableName}';
    `;

    const result = await this.executeRawSQL(query);
    return result;
  }

  /**
   * Pobiera informacje o indeksach tabeli
   */
  private async getTableIndexes(
    tableName: string,
    schema: string
  ): Promise<IndexInfo[]> {
    const query = `
      SELECT
        i.relname AS index_name,
        t.relname AS table_name,
        a.attname AS column_name,
        ix.indisunique AS is_unique,
        ix.indisprimary AS is_primary
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE t.relkind = 'r'
        AND n.nspname = '${schema}'
        AND t.relname = '${tableName}'
      ORDER BY i.relname;
    `;

    const result = await this.executeRawSQL(query);
    return result;
  }

  /**
   * Wykonuje zapytanie SQL z domyślnym limitem
   * @param query - Zapytanie SQL
   * @param limit - Limit rekordów (domyślnie z konfiguracji)
   * @param offset - Offset dla paginacji
   */
  async executeSQLWithLimit(
    query: string,
    limit?: number,
    offset: number = 0
  ): Promise<{ data: any[]; count: number; limited: boolean }> {
    this.ensureClient();

    try {
      // Walidacja zapytania
      const trimmedQuery = query.trim().toUpperCase();

      // Sprawdź czy to zapytanie SELECT
      if (!trimmedQuery.startsWith('SELECT')) {
        throw new ApiError(
          'Only SELECT queries are allowed. For data modification, use appropriate MCP tools.',
          400
        );
      }

      // Sprawdź czy zapytanie zawiera niebezpieczne operacje
      const dangerousKeywords = ['DROP', 'DELETE', 'TRUNCATE', 'INSERT', 'UPDATE', 'ALTER'];
      for (const keyword of dangerousKeywords) {
        if (trimmedQuery.includes(keyword)) {
          throw new ApiError(
            `Query contains dangerous keyword: ${keyword}. Only SELECT queries are allowed.`,
            400
          );
        }
      }

      // Ustal limit
      const effectiveLimit = limit !== undefined ? limit : this.defaultQueryLimit;
      let limited = false;

      // Sprawdź czy zapytanie już ma LIMIT
      let finalQuery = query.trim();
      if (!trimmedQuery.includes('LIMIT')) {
        // Dodaj LIMIT jeśli nie ma
        finalQuery += ` LIMIT ${effectiveLimit}`;
        limited = true;
      } else {
        // Sprawdź czy istniejący LIMIT jest większy niż dozwolony
        const limitMatch = trimmedQuery.match(/LIMIT\s+(\d+)/);
        if (limitMatch) {
          const requestedLimit = parseInt(limitMatch[1], 10);
          if (requestedLimit > effectiveLimit) {
            // Zamień na mniejszy limit
            finalQuery = finalQuery.replace(/LIMIT\s+\d+/i, `LIMIT ${effectiveLimit}`);
            limited = true;
          }
        }
      }

      // Dodaj OFFSET jeśli podany
      if (offset > 0) {
        if (!trimmedQuery.includes('OFFSET')) {
          finalQuery += ` OFFSET ${offset}`;
        }
      }

      // Wykonaj zapytanie
      const result = await this.executeRawSQL(finalQuery);

      return {
        data: result,
        count: result.length,
        limited,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        `Failed to execute SQL query: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        error
      );
    }
  }

  /**
   * Wykonuje surowe zapytanie SQL
   * @private
   */
  private async executeRawSQL(query: string): Promise<any[]> {
    this.ensureClient();

    try {
      // Próbuj użyć Postgres REST API
      const { data, error } = await this.supabase!.rpc('exec_sql', { query });

      if (error) {
        throw new ApiError(
          `Database query failed: ${error.message}`,
          500,
          error
        );
      }

      return data || [];
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      // Jeśli RPC nie działa, spróbuj alternatywnej metody
      // (wymaga utworzenia funkcji exec_sql w bazie danych)
      throw new ApiError(
        'Database client requires exec_sql RPC function. Please create it in your Supabase database.',
        500,
        error
      );
    }
  }

  /**
   * Zamyka połączenie z bazą danych
   */
  async close(): Promise<void> {
    // Supabase client nie wymaga jawnego zamykania
    this.supabase = null;
  }
}
