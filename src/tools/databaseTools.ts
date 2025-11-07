/**
 * Narzędzia MCP do zarządzania bazą danych
 */

import type { DatabaseClient } from '../services/databaseClient.js';
import { ApiError } from '../types/index.js';

/**
 * Schemat narzędzia get_database_schema
 */
export const getDatabaseSchemaTool = {
  name: 'get_database_schema',
  description:
    'Retrieves detailed database schema information from Supabase PostgreSQL. ' +
    'Returns comprehensive metadata about tables, columns, relationships, and indexes. ' +
    '\n\n' +
    '📋 USE CASES:\n' +
    '• Discover database structure before writing SQL queries\n' +
    '• Understand table relationships and foreign keys\n' +
    '• Check column data types and constraints\n' +
    '• Identify primary keys and indexes for query optimization\n' +
    '• Generate documentation or ERD diagrams\n' +
    '\n' +
    '💡 USAGE TIPS:\n' +
    '• ALWAYS call this tool first before executing SQL queries\n' +
    '• Use it to verify table and column names (case-sensitive!)\n' +
    '• Check foreign key relationships for JOIN queries\n' +
    '• Review indexes to understand query performance\n' +
    '\n' +
    '📊 RETURNED DATA:\n' +
    '• Tables: names and schema\n' +
    '• Columns: name, data type, nullable, defaults, max length\n' +
    '• Foreign Keys: source/target tables and columns\n' +
    '• Indexes: names, uniqueness, primary key status\n' +
    '\n' +
    '⚠️ IMPORTANT:\n' +
    '• Table names are case-sensitive in PostgreSQL\n' +
    '• Use double quotes for mixed-case names: "TableName"\n' +
    '• Only shows tables visible with current RLS permissions\n' +
    '• Default schema is "public" (most common)',
  inputSchema: {
    type: 'object',
    properties: {
      include_relations: {
        type: 'boolean',
        description:
          'Include foreign key relationships between tables. Recommended: true. Default: true',
        default: true,
      },
      include_indexes: {
        type: 'boolean',
        description: 'Include index information for performance analysis. Default: true',
        default: true,
      },
      schema: {
        type: 'string',
        description: 'Database schema name to query. Use "public" for main tables. Default: "public"',
        default: 'public',
        minLength: 1,
        maxLength: 63,
      },
    },
    required: [],
  },
};

/**
 * Schemat narzędzia execute_sql_limited
 */
export const executeSQLLimitedTool = {
  name: 'execute_sql_limited',
  description:
    'Executes SELECT queries against Supabase PostgreSQL database with automatic record limiting. ' +
    'Provides safe, read-only access to ERP data with built-in security constraints. ' +
    '\n\n' +
    '📋 USE CASES:\n' +
    '• Query customer, order, product, and complaint data\n' +
    '• Generate reports and analytics\n' +
    '• Search and filter records\n' +
    '• Join related tables for comprehensive data views\n' +
    '• Perform aggregations (COUNT, SUM, AVG, etc.)\n' +
    '\n' +
    '💡 USAGE TIPS:\n' +
    '• Call get_database_schema FIRST to see available tables\n' +
    '• Table names with capitals MUST use double quotes: "Zamowienia" not zamowienia\n' +
    '• Default limit is 50 records (override with limit parameter)\n' +
    '• Use offset for pagination through large result sets\n' +
    '• Respects Row Level Security (RLS) - only authorized data returned\n' +
    '\n' +
    '📝 QUERY EXAMPLES:\n' +
    '• Simple: SELECT * FROM "Klienci" WHERE email LIKE \'%@example.com\'\n' +
    '• JOIN: SELECT k.imie, z.numer_zamowienia FROM "Klienci" k JOIN "Zamowienia" z ON k.id = z.id_klienta\n' +
    '• Aggregate: SELECT COUNT(*), AVG(wartosc_calkowita) FROM "Zamowienia" WHERE status = \'completed\'\n' +
    '• With limit: Add LIMIT 100 to your query (max 1000)\n' +
    '\n' +
    '🔒 SECURITY:\n' +
    '• ONLY SELECT queries allowed - no data modification\n' +
    '• Automatically blocks: INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE\n' +
    '• RLS policies enforced - user sees only permitted data\n' +
    '• Default 50 record limit prevents accidental large queries\n' +
    '\n' +
    '⚠️ CRITICAL: TABLE NAME SYNTAX\n' +
    '• Tables created with capitals REQUIRE double quotes\n' +
    '• WRONG: SELECT * FROM Zamowienia (will fail!)\n' +
    '• CORRECT: SELECT * FROM "Zamowienia"\n' +
    '• Check get_database_schema output for exact table names',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'SQL SELECT query to execute. IMPORTANT: Use double quotes for mixed-case table names like "Zamowienia". Example: SELECT * FROM "Klienci" WHERE email = \'test@example.com\'',
        minLength: 10,
      },
      limit: {
        type: 'number',
        description:
          'Maximum number of records to return. Default: 50 (from config). Max: 1000. Use for pagination or limiting large result sets.',
        minimum: 1,
        maximum: 1000,
      },
      offset: {
        type: 'number',
        description: 'Number of records to skip (for pagination). Example: offset=50 with limit=50 returns records 51-100. Default: 0',
        minimum: 0,
        default: 0,
      },
    },
    required: ['query'],
  },
};

/**
 * Handler dla narzędzia get_database_schema
 * @param databaseClient - Klient bazy danych
 * @param args - Argumenty narzędzia
 */
export async function handleGetDatabaseSchema(
  databaseClient: DatabaseClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    // Walidacja argumentów
    const params = (args || {}) as {
      include_relations?: boolean;
      include_indexes?: boolean;
      schema?: string;
    };

    const includeRelations =
      params.include_relations !== undefined ? params.include_relations : true;
    const includeIndexes = params.include_indexes !== undefined ? params.include_indexes : true;
    const schema = params.schema || 'public';

    // Walidacja schematu
    if (typeof schema !== 'string' || schema.length === 0 || schema.length > 63) {
      throw new Error('Parametr schema musi być niepustym stringiem (max 63 znaki)');
    }

    // Wywołanie metody klienta bazy danych
    const result = await databaseClient.getDatabaseSchema(
      includeRelations,
      includeIndexes,
      schema
    );

    // Formatowanie odpowiedzi
    let responseText = `📊 STRUKTURA BAZY DANYCH - SCHEMA: ${schema}\n`;
    responseText += `${'='.repeat(60)}\n\n`;
    responseText += `Liczba tabel: ${result.total_tables}\n\n`;

    if (result.tables.length === 0) {
      responseText += `⚠️ Nie znaleziono tabel w schemacie "${schema}".\n`;
    } else {
      for (const table of result.tables) {
        responseText += `\n📋 TABELA: ${table.table_name}\n`;
        responseText += `${'-'.repeat(60)}\n`;

        // Kolumny
        responseText += `\n🔹 KOLUMNY (${table.columns.length}):\n`;
        for (const col of table.columns) {
          const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
          const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
          const maxLength = col.character_maximum_length
            ? `(${col.character_maximum_length})`
            : '';

          responseText += `  • ${col.column_name}: ${col.data_type}${maxLength} ${nullable}${defaultVal}\n`;
        }

        // Foreign Keys
        if (includeRelations && table.foreign_keys && table.foreign_keys.length > 0) {
          responseText += `\n🔗 FOREIGN KEYS (${table.foreign_keys.length}):\n`;
          for (const fk of table.foreign_keys) {
            responseText += `  • ${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}\n`;
            responseText += `    (${fk.constraint_name})\n`;
          }
        }

        // Indeksy
        if (includeIndexes && table.indexes && table.indexes.length > 0) {
          responseText += `\n🔍 INDEKSY (${table.indexes.length}):\n`;
          for (const idx of table.indexes) {
            const type = idx.is_primary
              ? 'PRIMARY KEY'
              : idx.is_unique
              ? 'UNIQUE'
              : 'INDEX';
            responseText += `  • ${idx.index_name} (${type})\n`;
            responseText += `    Kolumna: ${idx.column_name}\n`;
          }
        }

        responseText += '\n';
      }
    }

    responseText += `\n${'='.repeat(60)}\n`;
    responseText += `💡 TIP: Użyj narzędzia execute_sql_limited aby zapytać o dane z tabel.\n`;

    return {
      content: [
        {
          type: 'text',
          text: responseText,
        },
      ],
    };
  } catch (error) {
    // Obsługa błędów
    let errorMessage: string;

    if (error instanceof ApiError) {
      errorMessage = `Błąd dostępu do bazy danych: ${error.message}`;

      if (error.message.includes('not configured')) {
        errorMessage +=
          '\n\nAby użyć narzędzi bazodanowych, skonfiguruj zmienne środowiskowe:\n' +
          '• SUPABASE_PROJECT_URL\n' +
          '• SUPABASE_SERVICE_ROLE_KEY';
      } else if (error.message.includes('exec_sql RPC')) {
        errorMessage +=
          '\n\nWymagana jest funkcja exec_sql w bazie danych Supabase.\n' +
          'Zobacz dokumentację MCP serwera aby ją utworzyć.';
      }
    } else if (error instanceof Error) {
      errorMessage = `Błąd: ${error.message}`;
    } else {
      errorMessage = 'Wystąpił nieoczekiwany błąd podczas pobierania struktury bazy danych';
    }

    return {
      content: [
        {
          type: 'text',
          text: `❌ BŁĄD POBIERANIA STRUKTURY BAZY\n\n${errorMessage}`,
        },
      ],
    };
  }
}

/**
 * Handler dla narzędzia execute_sql_limited
 * @param databaseClient - Klient bazy danych
 * @param args - Argumenty narzędzia
 */
export async function handleExecuteSQLLimited(
  databaseClient: DatabaseClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    // Walidacja argumentów
    if (!args || typeof args !== 'object') {
      throw new Error('Nieprawidłowe argumenty narzędzia');
    }

    const params = args as { query?: unknown; limit?: unknown; offset?: unknown };

    if (typeof params.query !== 'string') {
      throw new Error('Parametr query musi być ciągiem znaków');
    }

    const query = params.query.trim();

    if (query.length < 10) {
      throw new Error('Zapytanie SQL jest zbyt krótkie (minimum 10 znaków)');
    }

    // Walidacja limit
    let limit: number | undefined;
    if (params.limit !== undefined) {
      if (typeof params.limit !== 'number') {
        throw new Error('Parametr limit musi być liczbą');
      }
      if (params.limit < 1 || params.limit > 1000) {
        throw new Error('Parametr limit musi być w zakresie 1-1000');
      }
      limit = params.limit;
    }

    // Walidacja offset
    let offset = 0;
    if (params.offset !== undefined) {
      if (typeof params.offset !== 'number') {
        throw new Error('Parametr offset musi być liczbą');
      }
      if (params.offset < 0) {
        throw new Error('Parametr offset musi być >= 0');
      }
      offset = params.offset;
    }

    // Wykonaj zapytanie
    const result = await databaseClient.executeSQLWithLimit(query, limit, offset);

    // Formatowanie odpowiedzi
    let responseText = `✅ WYNIKI ZAPYTANIA SQL\n`;
    responseText += `${'='.repeat(60)}\n\n`;

    if (result.limited) {
      responseText += `⚠️ UWAGA: Wyniki zostały ograniczone limitem\n\n`;
    }

    responseText += `📊 Liczba zwróconych rekordów: ${result.count}\n`;

    if (offset > 0) {
      responseText += `📄 Offset: ${offset}\n`;
    }

    responseText += `\n${'-'.repeat(60)}\n\n`;

    if (result.count === 0) {
      responseText += `Brak wyników dla tego zapytania.\n`;
    } else {
      // Wyświetl wyniki w formacie tabeli
      responseText += `WYNIKI:\n\n`;
      responseText += JSON.stringify(result.data, null, 2);
      responseText += `\n\n`;

      // Dodaj informacje o paginacji jeśli wyniki były limitowane
      if (result.limited && result.count === (limit || 50)) {
        responseText += `\n💡 TIP: Możliwe że jest więcej wyników.\n`;
        responseText += `Użyj parametru 'offset' aby pobrać kolejne strony:\n`;
        responseText += `offset: ${offset + result.count}\n`;
      }
    }

    responseText += `\n${'='.repeat(60)}\n`;

    return {
      content: [
        {
          type: 'text',
          text: responseText,
        },
      ],
    };
  } catch (error) {
    // Obsługa błędów
    let errorMessage: string;

    if (error instanceof ApiError) {
      errorMessage = `Błąd wykonania zapytania SQL: ${error.message}`;

      if (error.statusCode === 400) {
        errorMessage += '\n\nSprawdź poprawność zapytania SQL.';
      } else if (error.message.includes('not configured')) {
        errorMessage +=
          '\n\nAby użyć narzędzi bazodanowych, skonfiguruj zmienne środowiskowe:\n' +
          '• SUPABASE_PROJECT_URL\n' +
          '• SUPABASE_SERVICE_ROLE_KEY';
      }
    } else if (error instanceof Error) {
      errorMessage = `Błąd: ${error.message}`;
    } else {
      errorMessage = 'Wystąpił nieoczekiwany błąd podczas wykonywania zapytania SQL';
    }

    return {
      content: [
        {
          type: 'text',
          text: `❌ BŁĄD WYKONANIA ZAPYTANIA SQL\n\n${errorMessage}`,
        },
      ],
    };
  }
}
