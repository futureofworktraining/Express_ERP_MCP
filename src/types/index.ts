/**
 * Typy dla Express ERP MCP Server
 */

/**
 * Żądanie weryfikacji zamówienia
 */
export interface OrderVerificationRequest {
  numer_zamowienia: string;
}

/**
 * Dane klienta
 */
export interface Customer {
  imie: string;
  nazwisko: string;
  email: string;
}

/**
 * Szczegóły zamówienia
 */
export interface OrderDetails {
  id_zamowienia: string;
  numer_zamowienia: string;
  status: string;
  wartosc_calkowita: number;
  klient: Customer;
}

/**
 * Odpowiedź z API weryfikacji zamówienia
 */
export interface OrderVerificationResponse {
  zamowienieIstnieje: boolean;
  daneZamowienia: OrderDetails | null;
}

/**
 * Konfiguracja aplikacji
 */
export interface AppConfig {
  supabaseProjectUrl: string;
  supabaseBearerToken: string;
  defaultQueryLimit?: number;
  apiTimeout: number;
  logLevel: string;
  nodeEnv: string;
}

/**
 * Błąd API
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Typ wyniku operacji
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Informacje o kolumnie w tabeli
 */
export interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
}

/**
 * Informacje o foreign key
 */
export interface ForeignKeyInfo {
  constraint_name: string;
  table_name: string;
  column_name: string;
  foreign_table_name: string;
  foreign_column_name: string;
}

/**
 * Informacje o indeksie
 */
export interface IndexInfo {
  index_name: string;
  table_name: string;
  column_name: string;
  is_unique: boolean;
  is_primary: boolean;
}

/**
 * Informacje o tabeli
 */
export interface TableInfo {
  table_name: string;
  table_schema: string;
  columns: ColumnInfo[];
  foreign_keys?: ForeignKeyInfo[];
  indexes?: IndexInfo[];
}

/**
 * Odpowiedź ze strukturą bazy danych
 */
export interface DatabaseSchemaResponse {
  tables: TableInfo[];
  total_tables: number;
}
