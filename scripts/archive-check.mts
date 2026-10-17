/**
 * L'arxiu clínic (0119), en simulació:
 *
 *   npm run archive:check
 *
 *   1. Fins quan es conservaria: amb historial (sessió de fisio passada → +15
 *      anys) i sense.
 *   2. La baixa d'un client amb historial l'arxiva ABANS d'esborrar: primera
 *      visita, seguiment, nota de sessió, document i consentiments (també el
 *      retirat); el compte desapareix; queda anotat.
 *   3. Si l'arxivat falla (MOCK_FAIL=clinical_archive), NO s'esborra res.
 *   4. Sense historial, la baixa no arxiva res.
 *   5. Un client que ja té arxiu no se n'arxiva dos cops.
 *   6. Qui llegeix què: admin i fisio, demo amb demo; l'entrenador, res. Obrir
 *      la fitxa queda registrat; el document només amb permís.
 *   7. La purga: el vençut s'esborra, el pacient buit desapareix i s'anota sense
 *      el nom.
 *
 * La base ho torna a mirar amb la RLS: el bloc del SQL Editor de la 0119.
 * Treballa sobre el fitxer de la simulació i el deixa tal com era.
 */
process.env.NEXT_PUBLIC_USE_MOCK = "true";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const STORE = path.join(os.tmpdir(), "vindibcn-mock.json");
const abans = fs.existsSync(STORE) ? fs.readFileSync(STORE, "utf8") : null;
const restaura = () => {
  if (abans === null) fs.rmSync(STORE, { force: true });
  else fs.writeFileSync(STORE, abans);
};

const { PRE_FISIO_ID } = await import("../lib/pre-accounts");
const DEMO_TRAINER_IDS = ["", PRE_FISIO_ID];
const { getStore, saveStore } = await import("../lib/mock/store");
const archive = await import("../lib/data/clinical-archive");
const { deleteClient } = await import("../lib/data/gdpr-delete");
const { redeemGiftVoucher } = await import("../lib/data/gift-vouchers");

let bad = 0;
const check = (nom: string, ok: boolean, detall = "") => {
  if (!ok) bad++;
  console.log(`${ok ? "✓" : "✗"} ${nom}${detall ? ` — ${detall}` : ""}`);
};
const plus15 = (d: string) => `${Number(d.slice(0, 4)) + 15}${d.slice(4)}`;

const admin = { id: "u-admin", role: "admin" as const, specialty: null };
const jordi = { id: "u-trainer-jordi", role: "trainer" as const, specialty: "fisioterapeuta" as const };
const laia = { id: "u-trainer-laia", role: "trainer" as const, specialty: "entrenador" as const };
const fisioDemo = { id: DEMO_TRAINER_IDS[1], role: "trainer" as const, specialty: "fisioterapeuta" as const };

try {
  // Partim de la llavor, perquè el que hi hagi al fitxer no canviï el resultat.
  fs.rmSync(STORE, { force: true });

  // ─── Preparació: la Marta, amb historial de fisio complet ────────────────
  {
    const s = getStore();
    const t = "2026-03-02T09:00:00.000Z";
    s.reservations.push({
      ...s.reservations.find((r) => r.id === "r-3")!,
      id: "r-arx-1",
      service_type: "fisioterapia",
      status: "completed",
      scheduled_at: t,
      ends_at: "2026-03-02T10:00:00.000Z",
    });
    s.session_notes.push({ reservation_id: "r-arx-1", author_id: "u-trainer-jordi", body: "Nota de la sessió", created_at: t, updated_at: t });
    s.clinical_followups.push({ id: "cf-arx-1", client_id: "c-marta", author_id: "u-trainer-jordi", body: "Seguiment de prova", created_at: t, updated_at: t } as never);
    s.client_documents.push({ id: "doc-arx-1", client_id: "c-marta", uploaded_by: "u-client-marta", storage_path: "c-marta/abc.pdf", file_name: "informe.pdf", file_size: 2048, mime_type: "application/pdf", description: "Ressonància", uploaded_at: t });
    s.consents.push(
      { id: "k-arx-1", user_id: "u-client-marta", type: "health_data", version: "2026-06", granted_at: "2026-06-15T10:00:00.000Z", ip: null, created_at: "2026-06-15T10:00:00.000Z", revoked_at: "2026-09-01T10:00:00.000Z" },
      { id: "k-arx-2", user_id: "u-client-marta", type: "health_data", version: "2026-10", granted_at: "2026-10-17T10:00:00.000Z", ip: null, created_at: "2026-10-17T10:00:00.000Z", revoked_at: null },
    );
    saveStore(s);
  }

  console.log("\n1. Fins quan es conservaria\n");
  const ret = await archive.getClinicalRetention("c-marta");
  check("la Marta té historial i no és demo", ret?.hasHistory === true && ret.isDemo === false);
  check("des de l'última sessió de fisio, +15 anys", ret?.lastCareOn === "2026-03-02" && ret.purgeAfter === "2041-03-02", `${ret?.lastCareOn} → ${ret?.purgeAfter}`);
  const pau = await archive.getClinicalRetention("c-pau");
  check("en Pau no en té", pau?.hasHistory === false && pau.purgeAfter === null);
  check("un client que no existeix: null", (await archive.getClinicalRetention("c-no")) === null);

  console.log("\n2. La baixa arxiva abans d'esborrar\n");
  const del = await deleteClient("c-marta", "u-admin");
  const s2 = getStore();
  const pat = s2.clinical_archive_patients.find((p) => p.former_client_id === "c-marta");
  check("arxivat fins al 02/03/2041", del?.archive.archived === true && del.archive.purgeAfter === "2041-03-02");
  check("el pacient, amb nom, correu i telèfon", pat?.full_name === "Marta Gil" && pat.email === "marta@example.com" && pat.phone === "+34 600 100 003" && pat.archived_by_name === "Marc Navarro");
  const kinds = s2.clinical_archive_entries
    .filter((e) => e.patient_id === pat?.id)
    .reduce<Record<string, number>>((a, e) => ((a[e.kind] = (a[e.kind] ?? 0) + 1), a), {});
  check("què s'ha arxivat", JSON.stringify(kinds) === JSON.stringify({ followup: 1, session_note: 1, document: 1, consent: 2 }), JSON.stringify(kinds));
  const doc = s2.clinical_archive_entries.find((e) => e.patient_id === pat?.id && e.kind === "document");
  check("el document, copiat a la carpeta de l'arxiu", doc?.storage_path === `${pat?.id}/abc.pdf` && doc.file_name === "informe.pdf");
  check("el consentiment retirat, amb la data", s2.clinical_archive_entries.some((e) => e.patient_id === pat?.id && e.kind === "consent" && e.consent_revoked_at));
  check("l'autor, com a text", s2.clinical_archive_entries.find((e) => e.patient_id === pat?.id && e.kind === "followup")?.author_name === "Jordi Soler");
  check("el compte ja no hi és", !s2.clients.some((c) => c.id === "c-marta") && !s2.profiles.some((p) => p.id === "u-client-marta"));
  check("ni el seu historial viu", !s2.clinical_followups.some((f) => f.client_id === "c-marta") && !s2.client_documents.some((d) => d.client_id === "c-marta"));
  check("anotat (clinical_archive)", s2.data_access_log.some((l) => l.action === "clinical_archive" && l.subject_profile_id === "u-client-marta"));
  // Els referits (0122): la Marta va venir de l'Ana.
  check("la recompensa de la Marta se'n va amb ella", !s2.referral_rewards.some((r) => r.id === "rr-marta-reward"));
  check("la de l'Ana es queda, sense el nom de la Marta", s2.referral_rewards.find((r) => r.id === "rr-ana-reward")?.referee_client_id === null);

  console.log("\n3. Si l'arxivat falla, no s'esborra res\n");
  process.env.MOCK_FAIL = "clinical_archive";
  let error = "";
  try {
    await deleteClient("c-ana", "u-admin");
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  delete process.env.MOCK_FAIL;
  const s3 = getStore();
  check("la baixa diu que no", /No s'ha esborrat res/.test(error), error);
  check("l'Ana continua hi és, amb la primera visita", s3.clients.some((c) => c.id === "c-ana") && s3.clinical_first_visits.some((v) => v.client_id === "c-ana"));
  check("i no hi ha cap arxiu seu", !s3.clinical_archive_patients.some((p) => p.former_client_id === "c-ana"));

  console.log("\n4. Sense historial, no s'arxiva\n");
  const dp = await deleteClient("c-pau", "u-admin");
  check("en Pau s'esborra sense arxiu", dp?.archive.archived === false && !getStore().clinical_archive_patients.some((p) => p.former_client_id === "c-pau"));

  console.log("\n5. Un sol arxiu per client\n");
  const a1 = await archive.archiveClinicalHistory("c-ana", "u-admin");
  const a2 = await archive.archiveClinicalHistory("c-ana", "u-admin");
  check("el segon cop torna l'arxiu que ja hi és", a1.archived && a2.archived && a2.already === true && a2.patientId === a1.patientId);
  check("i només n'hi ha un", getStore().clinical_archive_patients.filter((p) => p.former_client_id === "c-ana").length === 1);
  // Fora, per no barrejar-lo amb la resta de proves.
  {
    const s = getStore();
    s.clinical_archive_entries = s.clinical_archive_entries.filter((e) => e.patient_id !== (a1.archived ? a1.patientId : ""));
    s.clinical_archive_patients = s.clinical_archive_patients.filter((p) => p.former_client_id !== "c-ana");
    saveStore(s);
  }

  console.log("\n6. Qui llegeix què\n");
  {
    const s = getStore();
    // El Fisio Demo és demo perquè ho diu `demo_profiles` (0121).
    s.demo_profiles.push({ profile_id: PRE_FISIO_ID, label: "Fisio Demo" });
    s.clinical_archive_patients.push({ id: "arx-demo", former_client_id: "c-demo-vell", full_name: "Pacient Demo", birth_date: null, email: null, phone: null, last_care_on: "2026-01-01", archived_at: new Date().toISOString(), archived_by: null, archived_by_name: null, is_demo: true });
    s.clinical_archive_entries.push({ id: "arx-demo-1", patient_id: "arx-demo", kind: "followup", body: "demo", author_name: "Fisio Demo", written_at: new Date().toISOString(), updated_at: null, session_on: null, source_id: null, storage_path: null, file_name: null, file_size: null, mime_type: null, description: null, consent_version: null, consent_revoked_at: null, purge_after: "2041-01-01" });
    saveStore(s);
  }
  const ids = async (v: typeof admin | typeof jordi | typeof laia | typeof fisioDemo) =>
    (await archive.listArchivedPatients(v)).map((p) => p.fullName).sort().join(", ") || "—";
  check("admin: tot", (await ids(admin)) === "Marta Gil, Pacient Demo", await ids(admin));
  check("fisio real: només el real", (await ids(jordi)) === "Marta Gil", await ids(jordi));
  check("fisio demo: només el demo", (await ids(fisioDemo)) === "Pacient Demo", await ids(fisioDemo));
  check("entrenadora: res", (await ids(laia)) === "—");
  const logs0 = getStore().data_access_log.length;
  const fitxa = await archive.getArchivedPatient(pat!.id, jordi);
  check("el fisio obre la fitxa sencera", fitxa?.entryList.length === 5);
  const l = getStore().data_access_log.at(-1);
  check("…i queda registrat (clinical_archive_view)", getStore().data_access_log.length === logs0 + 1 && l?.action === "clinical_archive_view" && l.actor_id === "u-trainer-jordi");
  check("el fisio demo no l'obre", (await archive.getArchivedPatient(pat!.id, fisioDemo)) === null);
  check("l'entrenadora no l'obre", (await archive.getArchivedPatient(pat!.id, laia)) === null);
  await archive.getArchivedPatient(pat!.id, admin, "export");
  check("exportar queda com a clinical_archive_export", getStore().data_access_log.at(-1)?.action === "clinical_archive_export");
  check("el document, amb permís sí", !!(await archive.getArchivedDocumentUrl(doc!.id, jordi)));
  check("el document, sense permís no", (await archive.getArchivedDocumentUrl(doc!.id, laia)) === null && (await archive.getArchivedDocumentUrl(doc!.id, fisioDemo)) === null);

  console.log("\n6b. La baixa d'un padrí (0122)\n");
  {
    const s = getStore();
    s.clients.find((c) => c.id === "c-oriol")!.referred_by_client_id = "c-ana";
    s.referral_rewards.push({ id: "rr-oriol", referrer_client_id: "c-ana", referee_client_id: "c-oriol", beneficiary_client_id: "c-oriol", discount_percent: 10, status: "pending", used_in_bono_id: null, created_at: new Date().toISOString() });
    saveStore(s);
  }
  // I els vals de regal (0123): un que l'Ana va comprar (actiu) i un que va bescanviar.
  {
    const s = getStore();
    const svc = s.services[0];
    const base = { service_id: svc.id, recipient_email: null, message: null, price: 50, service_type: svc.service_type, total_sessions: 4, package_name: svc.name, purchased_at: new Date().toISOString(), expires_at: "2099-01-01", redeemed_bono_id: null, created_at: new Date().toISOString(), stripe_checkout_session_id: null };
    s.gift_vouchers.push(
      { ...base, id: "gv-ana-comprat", code: "VINDI-ARXA-COMP", buyer_client_id: "c-ana", recipient_name: "L'Oriol", status: "active", redeemed_at: null, redeemed_by_client_id: null, pdf_path: "c-ana/gv-ana-comprat.pdf" } as never,
      { ...base, id: "gv-ana-bescanviat", code: "VINDI-ARXA-BESC", buyer_client_id: "c-oriol", recipient_name: "L'Ana", status: "redeemed", redeemed_at: new Date().toISOString(), redeemed_by_client_id: "c-ana", pdf_path: null } as never,
    );
    saveStore(s);
  }
  let padriError = "";
  try {
    await deleteClient("c-ana", "u-admin");
  } catch (e) {
    padriError = e instanceof Error ? e.message : String(e);
  }
  const s6 = getStore();
  check("l'Ana (padrina) es pot donar de baixa", !padriError && !s6.clients.some((c) => c.id === "c-ana"), padriError);
  check("l'Oriol continua, sense padrí", s6.clients.find((c) => c.id === "c-oriol")?.referred_by_client_id === null);
  check("la recompensa de l'Oriol es queda, sense padrí", s6.referral_rewards.find((r) => r.id === "rr-oriol")?.referrer_client_id === null);
  check("la de l'Ana (beneficiària) se'n va amb ella", !s6.referral_rewards.some((r) => r.id === "rr-ana-reward"));
  const comprat = s6.gift_vouchers.find((v) => v.id === "gv-ana-comprat");
  check("el val que va comprar segueix viu, actiu i sense comprador", comprat?.status === "active" && comprat.buyer_client_id === null && comprat.pdf_path === "c-ana/gv-ana-comprat.pdf");
  const besc = s6.gift_vouchers.find((v) => v.id === "gv-ana-bescanviat");
  check("el que va bescanviar segueix bescanviat, sense ella", besc?.status === "redeemed" && besc.redeemed_by_client_id === null);
  const red = await redeemGiftVoucher({ code: "VINDI-ARXA-COMP", profileId: "u-client-oriol" });
  check("l'Oriol bescanvia el val de l'Ana", red.ok === true && getStore().gift_vouchers.find((v) => v.id === "gv-ana-comprat")?.redeemed_by_client_id === "c-oriol", JSON.stringify(red));

  console.log("\n7. La purga\n");
  {
    const s = getStore();
    s.clinical_archive_entries.find((e) => e.patient_id === pat!.id && e.kind === "followup")!.purge_after = "2026-01-01";
    saveStore(s);
  }
  let pg = await archive.purgeExpiredClinicalArchive("2026-10-17");
  check("una vençuda, una esborrada", pg.expired === 1 && pg.purged === 1, JSON.stringify(pg));
  check("el pacient encara hi és, amb 4", getStore().clinical_archive_entries.filter((e) => e.patient_id === pat!.id).length === 4 && getStore().clinical_archive_patients.some((p) => p.id === pat!.id));
  {
    const s = getStore();
    for (const e of s.clinical_archive_entries.filter((x) => x.patient_id === pat!.id)) e.purge_after = "2026-01-01";
    saveStore(s);
  }
  pg = await archive.purgeExpiredClinicalArchive("2026-10-17");
  check("la resta, amb el fitxer", pg.purged === 4 && pg.filesRemoved === 1, JSON.stringify(pg));
  check("el pacient ja no hi és", !getStore().clinical_archive_patients.some((p) => p.id === pat!.id));
  const pl = getStore().data_access_log.at(-1);
  check("anotat sense el nom", pl?.action === "clinical_purge" && pl.subject_label === `Arxiu clínic ${pat!.id}` && !/Marta/.test(pl.details ?? ""));
  check("el demo, que no venç, s'hi queda", getStore().clinical_archive_patients.some((p) => p.id === "arx-demo"));
  check("el venciment és el dia següent al «fins al»", plus15("2026-03-02") === "2041-03-02");
} catch (e) {
  bad++;
  console.error(e);
} finally {
  restaura();
}

console.log(bad ? `\n${bad} casos no fan el que han de fer.\n` : "\nTot correcte.\n");
process.exit(bad ? 1 : 0);
