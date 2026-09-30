import { PAYMENT_METHOD_LABELS, formatDate, formatEur } from "@/lib/labels";
import type { PaymentListItem } from "@/lib/data/payments";
import type { PaymentMethod } from "@/types/database";

/** Una fila de la llista de pagaments, ja escrita per al navegador. */
export type PaymentRowView = {
  id: string;
  date: string;
  clientName: string;
  amount: string;
  method: PaymentMethod;
  methodLabel: string;
};

/**
 * La data i l'import es formaten al SERVIDOR i no al navegador: el format curt
 * de mes d'`Intl` no és igual a Node i a Chrome, i la primera pàgina es pinta a
 * tots dos llocs (l'error d'hidratació #418). Les pàgines de «Carregar més»
 * arriben igual d'escrites, i la taula no formata res.
 *
 * Fora del fitxer d'accions a propòsit: allà, cada funció exportada seria una
 * acció que el navegador podria cridar.
 */
export function toPaymentRow(p: PaymentListItem): PaymentRowView {
  return {
    id: p.id,
    date: formatDate(p.paidAt),
    clientName: p.clientName,
    amount: formatEur(p.amount),
    method: p.method,
    methodLabel: PAYMENT_METHOD_LABELS[p.method],
  };
}
