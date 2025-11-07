/**
 * Narzędzie MCP do weryfikacji zamówień
 */

import type { ApiClient } from '../services/apiClient.js';
import { ApiError } from '../types/index.js';

/**
 * Schemat narzędzia verify_order
 */
export const verifyOrderTool = {
  name: 'verify_order',
  description:
    'Weryfikuje istnienie zamówienia w systemie ERP i pobiera szczegóły zamówienia. ' +
    'Zwraca informacje o statusie zamówienia, wartości oraz danych klienta.',
  inputSchema: {
    type: 'object',
    properties: {
      numer_zamowienia: {
        type: 'string',
        description:
          'Numer zamówienia do weryfikacji (np. OP1001, OP1002). Wymagany parametr.',
        minLength: 1,
        maxLength: 50,
      },
    },
    required: ['numer_zamowienia'],
  },
};

/**
 * Handler dla narzędzia verify_order
 * @param apiClient - Klient API
 * @param args - Argumenty narzędzia
 * @param bearerToken - Token autoryzacyjny (opcjonalny, przekazywany do Supabase)
 */
export async function handleVerifyOrder(
  apiClient: ApiClient,
  args: unknown,
  bearerToken?: string
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    // Walidacja argumentów
    if (!args || typeof args !== 'object') {
      throw new Error('Nieprawidłowe argumenty narzędzia');
    }

    const { numer_zamowienia } = args as { numer_zamowienia?: unknown };

    if (typeof numer_zamowienia !== 'string') {
      throw new Error('Parametr numer_zamowienia musi być ciągiem znaków');
    }

    // Wywołanie API z przekazaniem tokena (jeśli podany)
    const result = await apiClient.verifyOrder(numer_zamowienia, bearerToken);

    // Formatowanie odpowiedzi
    let responseText: string;

    if (result.zamowienieIstnieje && result.daneZamowienia) {
      const order = result.daneZamowienia;
      const klient = order.klient;

      responseText = `✓ Zamówienie zostało znalezione w systemie

📦 SZCZEGÓŁY ZAMÓWIENIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Numer zamówienia: ${order.numer_zamowienia}
• ID zamówienia: ${order.id_zamowienia}
• Status: ${order.status}
• Wartość całkowita: ${order.wartosc_calkowita} PLN

👤 DANE KLIENTA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Imię i nazwisko: ${klient.imie} ${klient.nazwisko}
• Email: ${klient.email}`;
    } else {
      responseText = `✗ Zamówienie "${numer_zamowienia}" nie zostało znalezione w systemie

Możliwe przyczyny:
• Numer zamówienia został wpisany nieprawidłowo
• Zamówienie nie istnieje w systemie
• Zamówienie zostało usunięte

Proszę sprawdzić poprawność numeru zamówienia i spróbować ponownie.`;
    }

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
      errorMessage = `Błąd API (kod ${error.statusCode || 'nieznany'}): ${error.message}`;

      if (error.statusCode === 401) {
        errorMessage += '\n\nProszę sprawdzić konfigurację tokenu autoryzacyjnego.';
      } else if (error.statusCode === 429) {
        errorMessage += '\n\nProszę odczekać chwilę przed kolejną próbą.';
      } else if (error.statusCode && error.statusCode >= 500) {
        errorMessage +=
          '\n\nSerwer API ma problemy. Spróbuj ponownie za kilka minut.';
      }
    } else if (error instanceof Error) {
      errorMessage = `Błąd: ${error.message}`;
    } else {
      errorMessage = 'Wystąpił nieoczekiwany błąd podczas weryfikacji zamówienia';
    }

    return {
      content: [
        {
          type: 'text',
          text: `❌ BŁĄD WERYFIKACJI ZAMÓWIENIA\n\n${errorMessage}`,
        },
      ],
    };
  }
}
