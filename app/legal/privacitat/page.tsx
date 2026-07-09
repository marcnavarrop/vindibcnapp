/**
 * ⚠️ BORRADOR LEGAL — TEXT DE PARTIDA, NO DEFINITIU.
 * Generat automàticament com a punt de partida per a un centre d'entrenament
 * personal i fisioteràpia a Barcelona. PENDENT DE REVISIÓ per un assessor legal
 * abans de publicar. Cal omplir els camps entre [CLAUDÀTORS] i validar les
 * bases legals, terminis de conservació i encarregats del tractament.
 */
export const metadata = { title: "Política de Privacitat · VindiBCN" };

export default function PrivacitatPage() {
  return (
    <>
      <h1 className="text-2xl text-brand-dark">Política de Privacitat</h1>
      <p className="text-xs text-brand-muted">Versió 2026-06 (esborrany)</p>

      <h2 className="mt-4 text-lg font-bold text-brand-dark">
        1. Responsable del tractament
      </h2>
      <p>
        [NOM_RESPONSABLE], amb NIF [NIF] i domicili a [ADREÇA]. Correu de
        contacte: [EMAIL_CONTACTE].
      </p>

      <h2 className="mt-4 text-lg font-bold text-brand-dark">
        2. Quines dades tractem
      </h2>
      <p>
        Dades identificatives i de contacte (nom, correu electrònic, telèfon),
        data de naixement, gènere i dades físiques (alçada, pes) i objectius. En
        el cas de clients que reben fisioteràpia, dades de salut vinculades al
        seguiment terapèutic. També dades de la relació de servei: bons,
        reserves i pagaments.
      </p>

      <h2 className="mt-4 text-lg font-bold text-brand-dark">
        3. Finalitats
      </h2>
      <p>
        Gestió d&apos;altes de client, reserves i bons; seguiment de
        l&apos;entrenament i, si escau, del tractament de fisioteràpia;
        facturació i cobraments; i comunicacions relatives al servei i al
        centre.
      </p>

      <h2 className="mt-4 text-lg font-bold text-brand-dark">
        4. Base legal
      </h2>
      <p>
        Execució del contracte de prestació de serveis; el teu{" "}
        <strong>consentiment</strong> exprés per al tractament de dades de salut
        i per a comunicacions no essencials; i el compliment
        d&apos;obligacions legals (p. ex. facturació). [A validar per
        l&apos;assessor.]
      </p>

      <h2 className="mt-4 text-lg font-bold text-brand-dark">
        5. Destinataris i encarregats del tractament
      </h2>
      <p>
        No cedim les teves dades a tercers, excepte obligació legal. Per prestar
        el servei fem servir proveïdors que actuen com a encarregats del
        tractament:
      </p>
      <ul className="ml-5 list-disc">
        <li>
          <strong>Supabase</strong> — allotjament de base de dades i
          autenticació.
        </li>
        <li>
          <strong>Vercel</strong> — allotjament de l&apos;aplicació web.
        </li>
        <li>
          <strong>Resend</strong> — enviament de correus electrònics
          transaccionals.
        </li>
      </ul>
      <p>
        La ubicació dels servidors i les garanties de transferències
        internacionals s&apos;han de detallar i validar [a revisar per
        l&apos;assessor].
      </p>

      <h2 className="mt-4 text-lg font-bold text-brand-dark">
        6. Conservació
      </h2>
      <p>
        Conservem les dades mentre duri la relació i, després, durant els
        terminis legals aplicables (p. ex. obligacions fiscals i sanitàries).
        [Concretar terminis amb l&apos;assessor.]
      </p>

      <h2 className="mt-4 text-lg font-bold text-brand-dark">
        7. Els teus drets
      </h2>
      <p>
        Pots exercir els drets d&apos;<strong>accés</strong>,{" "}
        <strong>rectificació</strong>, <strong>supressió</strong>,{" "}
        <strong>oposició</strong>, <strong>portabilitat</strong> i{" "}
        <strong>limitació</strong> del tractament, així com{" "}
        <strong>retirar el consentiment</strong> en qualsevol moment. També pots
        presentar una reclamació davant l&apos;Agència Espanyola de Protecció de
        Dades (AEPD).
      </p>

      <h2 className="mt-4 text-lg font-bold text-brand-dark">
        8. Com exercir-los
      </h2>
      <p>
        Escriu a [EMAIL_CONTACTE] indicant el dret que vols exercir i adjuntant
        una còpia d&apos;un document identificatiu.
      </p>
    </>
  );
}
