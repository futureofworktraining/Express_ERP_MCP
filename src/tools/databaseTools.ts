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
    'Pobiera szczegółową strukturę bazy danych Supabase. ' +
    'Zwraca informacje o tabelach, kolumnach (nazwy, typy danych, nullable, default values), ' +
    'relacjach (foreign keys) oraz indeksach. ' +
    'Użyj tego narzędzia aby zrozumieć strukturę bazy przed wykonaniem zapytań SQL.',
  inputSchema: {
    type: 'object',
    properties: {
      include_relations: {
        type: 'boolean',
        description:
          'Czy dołączyć informacje o relacjach między tabelami (foreign keys). Domyślnie: true',
        default: true,
      },
      include_indexes: {
        type: 'boolean',
        description: 'Czy dołączyć informacje o indeksach. Domyślnie: true',
        default: true,
      },
      schema: {
        type: 'string',
        description: 'Nazwa schematu do sprawdzenia. Domyślnie: "public"',
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
    'Wykonuje zapytanie SQL SELECT do bazy danych Supabase z domyślnym ograniczeniem liczby rekordów. ' +
    'WAŻNE: Dozwolone są TYLKO zapytania SELECT. Zapytania modyfikujące dane (INSERT, UPDATE, DELETE) są zabronione. ' +
    'Domyślny limit to 50 rekordów (konfigurowalny w ustawieniach serwera). ' +
    'Użyj tego narzędzia do pobierania danych z tabel ERP.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'Zapytanie SQL SELECT do wykonania. Przykład: "SELECT * FROM zamowienia WHERE status = \'active\'"',
        minLength: 10,
      },
      limit: {
        type: 'number',
        description:
          'Opcjonalny limit rekordów do pobrania. Jeśli nie podano, używany jest domyślny limit z konfiguracji (50). Maksymalny limit to 1000.',
        minimum: 1,
        maximum: 1000,
      },
      offset: {
        type: 'number',
        description: 'Opcjonalny offset dla paginacji wyników. Domyślnie: 0',
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
