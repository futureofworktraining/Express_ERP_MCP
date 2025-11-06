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
  supabaseUrl: string;
  supabaseBearerToken: string;
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
