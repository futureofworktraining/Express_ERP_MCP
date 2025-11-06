/**
 * Klient API dla Supabase ERP
 */

import type {
  OrderVerificationRequest,
  OrderVerificationResponse,
  AppConfig,
} from '../types/index.js';
import { ApiError } from '../types/index.js';

/**
 * Klasa klienta API
 */
export class ApiClient {
  constructor(private config: AppConfig) {}

  /**
   * Weryfikuje zamówienie w systemie ERP
   */
  async verifyOrder(numerZamowienia: string): Promise<OrderVerificationResponse> {
    // Walidacja wejścia
    if (!numerZamowienia || numerZamowienia.trim().length === 0) {
      throw new ApiError('Numer zamówienia nie może być pusty', 400);
    }

    if (numerZamowienia.length > 50) {
      throw new ApiError('Numer zamówienia jest zbyt długi (max 50 znaków)', 400);
    }

    const requestBody: OrderVerificationRequest = {
      numer_zamowienia: numerZamowienia.trim(),
    };

    // Wykonaj żądanie z retry logic
    return await this.executeWithRetry(async () => {
      return await this.makeRequest(requestBody);
    });
  }

  /**
   * Wykonuje żądanie HTTP do API
   */
  private async makeRequest(
    body: OrderVerificationRequest
  ): Promise<OrderVerificationResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.apiTimeout);

    try {
      const response = await fetch(this.config.supabaseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.supabaseBearerToken}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Obsługa kodów błędów HTTP
      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const data = await response.json();
      return this.validateResponse(data);
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ApiError) {
        throw error;
      }

      // Obsługa timeout
      if ((error as Error).name === 'AbortError') {
        throw new ApiError(
          `Przekroczono limit czasu żądania (${this.config.apiTimeout}ms)`,
          408
        );
      }

      // Obsługa błędów sieciowych
      if (error instanceof TypeError) {
        throw new ApiError('Błąd połączenia z API - sprawdź połączenie sieciowe', 503);
      }

      // Inne błędy
      throw new ApiError('Nieoczekiwany błąd podczas komunikacji z API', 500, error);
    }
  }

  /**
   * Obsługuje odpowiedzi błędów z API
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorDetails: unknown;

    try {
      errorDetails = await response.json();
    } catch {
      errorDetails = await response.text();
    }

    const statusCode = response.status;
    let message: string;

    switch (statusCode) {
      case 400:
        message = 'Nieprawidłowe żądanie - sprawdź format numeru zamówienia';
        break;
      case 401:
        message = 'Błąd autoryzacji - nieprawidłowy token';
        break;
      case 403:
        message = 'Brak dostępu do zasobu';
        break;
      case 404:
        message = 'Endpoint API nie został znaleziony';
        break;
      case 429:
        message = 'Przekroczono limit żądań - spróbuj ponownie później';
        break;
      case 500:
      case 502:
      case 503:
      case 504:
        message = 'Błąd serwera API - spróbuj ponownie później';
        break;
      default:
        message = `Błąd API (kod: ${statusCode})`;
    }

    throw new ApiError(message, statusCode, errorDetails);
  }

  /**
   * Waliduje odpowiedź z API
   */
  private validateResponse(data: unknown): OrderVerificationResponse {
    if (!data || typeof data !== 'object') {
      throw new ApiError('Nieprawidłowy format odpowiedzi z API', 500);
    }

    const response = data as Partial<OrderVerificationResponse>;

    if (typeof response.zamowienieIstnieje !== 'boolean') {
      throw new ApiError('Brak pola zamowienieIstnieje w odpowiedzi', 500);
    }

    // Jeśli zamówienie nie istnieje, daneZamowienia może być null
    if (!response.zamowienieIstnieje) {
      return {
        zamowienieIstnieje: false,
        daneZamowienia: null,
      };
    }

    // Jeśli zamówienie istnieje, waliduj daneZamowienia
    if (!response.daneZamowienia || typeof response.daneZamowienia !== 'object') {
      throw new ApiError('Brak szczegółów zamówienia w odpowiedzi', 500);
    }

    const orderDetails = response.daneZamowienia;

    if (!orderDetails.id_zamowienia || !orderDetails.numer_zamowienia) {
      throw new ApiError('Niepełne dane zamówienia w odpowiedzi', 500);
    }

    return response as OrderVerificationResponse;
  }

  /**
   * Wykonuje operację z automatycznym ponowieniem w przypadku błędów przejściowych
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 2,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Nie próbuj ponownie dla błędów klienta (4xx) poza 408 i 429
        if (error instanceof ApiError) {
          const statusCode = error.statusCode || 500;
          const shouldRetry =
            statusCode === 408 || // Timeout
            statusCode === 429 || // Rate limit
            statusCode >= 500; // Server errors

          if (!shouldRetry || attempt === maxRetries) {
            throw error;
          }
        }

        // Czekaj przed kolejną próbą (exponential backoff)
        if (attempt < maxRetries) {
          const delay = delayMs * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Helper do opóźnień
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
