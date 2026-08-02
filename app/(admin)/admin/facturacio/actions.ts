"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { SERVICE_TYPES, formatEur, formatDate } from "@/lib/labels";
import {
  setRate,
  computeSettlement,
  createSettlement,
  setSettlementInvoicePath,
  deleteSettlement,
  getSettlement,
  findSettlementForPeriod,
} from "@/lib/data/settlements";
import {
  uploadSettlementInvoice,
  deleteSettlementInvoice,
  invoiceSignedUrl,
  type InvoiceContent,
} from "@/lib/data/settlement-invoices";
import { notify, getProfileContact } from "@/lib/notifications";
import type { ServiceType } from "@/types/database";

export type RateFormState = { error?: string; ok?: boolean };
export type SettlementFormState = {
  error?: string;
  ok?: boolean;
  savedId?: string;
  /** Missatge de detall quan la factura s'ha desat però l'email no ha sortit. */
  warning?: string;
};

async function requireAdmin(): Promise<{ id: string } | null> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin") return null;
  return { id: viewer.id };
}

/** Desa la tarifa del centre per a un servei (tancant la vigent). */
export async function updateRateAction(
  _prev: RateFormState,
  fd: FormData,
): Promise<RateFormState> {
  if (!(await requireAdmin())) return { error: "No autoritzat." };

  const serviceType = String(fd.get("serviceType") ?? "") as ServiceType;
  const amount = parseFloat(String(fd.get("rateAmount") ?? ""));

  if (!SERVICE_TYPES.includes(serviceType))
    return { error: "Tipus de servei invàlid." };
  if (!Number.isFinite(amount) || amount < 0)
    return { error: "L'import ha de ser un número positiu." };
  if (amount > 100000) return { error: "L'import és massa alt." };

  try {
    await setRate(serviceType, Math.round(amount * 100) / 100);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error en desar la tarifa." };
  }

  revalidatePath("/admin/facturacio/tarifes");
  return { ok: true };
}

/**
 * Genera la factura d'un període: desa la liquidació, emet el PDF, el puja al
 * bucket privat i avisa el professional. És la confirmació del pas de revisió
 * de la UI — fins aquí no s'ha tocat res.
 *
 * Recalcula al servidor a partir del període rebut i no es fia dels imports
 * que arribin del formulari: el total que es desa és el que surt de les dades,
 * no el que hagi pogut manipular el client.
 *
 * Tot o res: si el document falla, la liquidació que s'acabava de desar
 * s'esborra. Val més no deixar-ne una sense factura —que ja no es podria
 * completar des de la UI— que quedar-se a mitges. L'email, en canvi, és
 * best-effort: `notify` no llança mai i la factura ja existeix i és
 * descarregable encara que Resend estigui caigut.
 */
export async function generateInvoiceAction(
  _prev: SettlementFormState,
  fd: FormData,
): Promise<SettlementFormState> {
  const admin = await requireAdmin();
  if (!admin) return { error: "No autoritzat." };

  const trainerId = String(fd.get("trainerId") ?? "");
  const periodStart = String(fd.get("periodStart") ?? "");
  const periodEnd = String(fd.get("periodEnd") ?? "");

  if (!trainerId) return { error: "Tria un professional." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd))
    return { error: "Període invàlid." };
  if (periodEnd < periodStart)
    return { error: "La data final ha de ser posterior a la inicial." };

  let savedId: string | null = null;
  let uploadedPath: string | null = null;
  try {
    const preview = await computeSettlement(trainerId, periodStart, periodEnd);
    if (preview.lines.length === 0)
      return { error: "No hi ha sessions valorables en aquest període." };

    const contact = await getProfileContact(trainerId);
    if (!contact) return { error: "Professional no trobat." };

    const existing = await findSettlementForPeriod(trainerId, periodStart, periodEnd);
    if (existing)
      return {
        error: `Aquest període ja té una factura generada el ${formatDate(existing.generatedAt)}. Per refer-la, esborra abans la liquidació existent.`,
      };

    savedId = await createSettlement(preview, admin.id);

    const content: InvoiceContent = {
      trainerName: contact.name ?? "Professional",
      periodStart,
      periodEnd,
      lines: preview.lines,
      total: preview.total,
      generatedAt: new Date().toISOString(),
    };

    uploadedPath = await uploadSettlementInvoice({
      trainerId,
      settlementId: savedId,
      content,
    });
    await setSettlementInvoicePath(savedId, uploadedPath);

    await notify(
      {
        type: "invoice_generated",
        recipient: contact,
        relatedId: savedId,
        data: {
          name: contact.name ?? "",
          period: `${formatDate(periodStart)} - ${formatDate(periodEnd)}`,
          total: formatEur(preview.total),
        },
      },
      { ignorePreferences: true },
    );

    revalidatePath("/admin/facturacio/liquidacions");
    revalidatePath("/trainer/factures");
    return {
      ok: true,
      savedId,
      warning: contact.email ? undefined : "El professional no té correu: no s'ha pogut enviar l'avís.",
    };
  } catch (e) {
    // Desfés-ho tot perquè es pugui reintentar net: primer el PDF (si ja
    // s'havia pujat quan va petar el pas següent) i després la liquidació.
    if (uploadedPath)
      await deleteSettlementInvoice(uploadedPath).catch(() => undefined);
    if (savedId) await deleteSettlement(savedId).catch(() => undefined);

    // Cursa entre la comprovació i la inserció (dos clics seguits, dues
    // pestanyes): qui hi posa el límit de debò és l'índex UNIQUE.
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("settlements_unique_period"))
      return { error: "Aquest període ja té una factura generada." };
    return { error: msg || "Error en generar la factura." };
  }
}

/** Descàrrega des del panell d'admin: comprova rol i redirigeix a la signed URL. */
export async function downloadInvoiceAdminAction(fd: FormData): Promise<void> {
  if (!(await requireAdmin())) redirect("/admin");

  const settlementId = String(fd.get("settlementId") ?? "");
  const settlement = settlementId ? await getSettlement(settlementId) : null;
  if (!settlement?.invoicePath) redirect("/admin/facturacio/liquidacions");

  const contact = await getProfileContact(settlement.trainerId);
  const url = await invoiceSignedUrl(settlement.invoicePath, {
    trainerName: contact?.name ?? "Professional",
    periodStart: settlement.periodStart,
    periodEnd: settlement.periodEnd,
    lines: settlement.breakdown,
    total: settlement.totalAmount,
    generatedAt: settlement.generatedAt,
  });
  redirect(url);
}
