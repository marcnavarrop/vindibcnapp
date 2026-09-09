/**
 * El manual del client, com a DADES.
 *
 * El text viu en cadenes i no directament al JSX per dos motius. El primer és
 * pràctic: el català va ple d'apòstrofs i `react/no-unescaped-entities` obligaria
 * a escriure mig manual amb `&apos;`, que no es podria ni llegir ni corregir. El
 * segon és que un manual és un document, no una pantalla: separar-lo del
 * component vol dir que qui hi vingui a canviar una frase no ha de tocar cap
 * marcatge, i que el dia que se'n vulgui una altra sortida —traduir-lo, imprimir-lo
 * d'una altra manera— el contingut ja no hi està enganxat.
 *
 * TOT EL QUE ÉS UN NÚMERO O UN INTERRUPTOR ARRIBA DE FORA
 *
 * `buildClientManual` rep els ajustos REALS del centre i escriu el manual amb
 * ells: les hores de cancel·lació, l'aforament dels grups, el descompte de
 * referits, els mesos de caducitat. I els capítols dels mòduls apagats no es
 * generen. Un manual que parla de vals de regal a un centre que els té tancats
 * menteix més que un manual incomplet, i menteix cada dia sense que ningú
 * se n'assabenti.
 */

import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

/**
 * Com contactar amb el centre.
 *
 * PLACEHOLDER A SUBSTITUIR. Mateix patró que les pàgines legals
 * ([NOM_RESPONSABLE], [NIF]…), però en una sola constant i no repartit pel text:
 * el dia que hi hagi el correu i el telèfon de debò, es canvia AQUÍ i prou.
 *
 * L'app no té cap canal de contacte propi per al client —el botó de suport és
 * només per a l'equip—, així que aquesta és l'única sortida que el manual li pot
 * donar quan alguna cosa no es pot resoldre sol.
 */
export const CONTACTE_CENTRE = "[CONTACTE_CENTRE]";

/** Un tros de manual. Prou tipus per dir el que un manual necessita dir. */
export type Block =
  /** Paràgraf. */
  | { t: "p"; text: string }
  /** Subtítol dins d'un capítol. */
  | { t: "h"; text: string }
  /** Llista de punts. */
  | { t: "ul"; items: string[] }
  /** Passos numerats. */
  | { t: "ol"; items: string[] }
  /** Terme i explicació: els estats, el glossari. */
  | { t: "dl"; items: [string, string][] }
  /** Avís tranquil: una cosa que va bé saber. */
  | { t: "note"; text: string }
  /** Avís que evita un disgust: diners, terminis, coses irreversibles. */
  | { t: "warn"; text: string }
  /** Taula. */
  | { t: "table"; head: string[]; rows: string[][] };

export type Chapter = {
  /** Àncora de l'índex. Estable: pot acabar en un enllaç compartit. */
  id: string;
  title: string;
  blocks: Block[];
};

/** Els ajustos del centre que el manual necessita per no dir cap número fals. */
export type ManualSettings = {
  minCancellationHours: number;
  minBookingHours: number;
  openingHour: number;
  closingHour: number;
  groupCapacity: number;
  bonoLowThreshold: number;
  bonoExpiryMonths: number | null;
  pendingPaymentCancelEnabled: boolean;
  pendingPaymentCancelHours: number | null;
  reminderHourLocal: number;
  /** Dies d'antelació de l'avís de bo a punt de caducar. */
  bonoExpiryWarningDays: number;
  /** Mínim de caràcters d'una contrasenya. */
  minPasswordLength: number;
  giftVouchersEnabled: boolean;
  giftVoucherExpiryMonths: number;
  waitlistEnabled: boolean;
  subscriptionsEnabled: boolean;
  subscriptionExtraSessionsMax: number;
  referralProgramActive: boolean;
  referralDiscountPercent: number;
  referralRewardReferee: boolean;
  modules: { comunitat: boolean; documents: boolean; sessionsProva: boolean };
  /** Es pot pagar amb targeta ara mateix (Stripe configurat i fora de simulació). */
  cardPayments: boolean;
  documentsMaxMb: number;
  trialMinAdvanceHours: number;
  trialMaxAdvanceDays: number;
};

/**
 * Una frase, en els tres idiomes.
 *
 * Els tres camps són OBLIGATORIS, i és tota la garantia que hi ha: aquí no hi
 * ha claus ni diccionari, de manera que no pot existir una frase traduïda a
 * mitges —el compilador no deixaria desar-la—. És el que fa innecessari un
 * comprovador com `i18n:check`, que existeix precisament per als diccionaris
 * amb claus.
 *
 * La forma és aquesta i no la de claus contra `messages/*.json` perquè el
 * criteri era que qui vingui d'aquí a un any a canviar una frase en trobi les
 * tres versions de cop. Aquí les té a la línia del costat.
 */
export type Tr = { ca: string; es: string; en: string };

/** "07:00" a partir d'una hora sencera. */
const hhmm = (h: number) => `${String(h).padStart(2, "0")}:00`;

/**
 * El manual, en l'idioma de qui el llegeix.
 *
 * L'idioma NOMÉS tria quina cara de cada `Tr` es fa servir. Tota la resta
 * —els números que surten de la configuració, els blocs condicionals, els
 * capítols dels mòduls apagats i la numeració que es recalcula— és la mateixa
 * per als tres, i viu escrita una sola vegada. Per això els tres idiomes no
 * poden divergir en estructura, i per això hi ha una comprovació que ho
 * verifica (`scripts/manual-check.mjs`).
 *
 * Per defecte, català: és el que queda si algú crida el builder sense idioma.
 */
export function buildClientManual(
  s: ManualSettings,
  locale: Locale = DEFAULT_LOCALE,
): Chapter[] {
  const T = (t: Tr) => t[locale];

  const chapters: (Chapter & { when?: boolean })[] = [
    // ─────────────────────────── 1 ───────────────────────────
    {
      id: "primers-passos",
      title: T({
        ca: "Primers passos",
        es: "Primers passos",
        en: "Primers passos",
      }),
      blocks: [
        {
          t: "p",
          text: T({
            ca: "Aquesta app és el teu espai al centre: hi tens els bons que has comprat, hi reserves les sessions, hi consultes els exercicis que t'ha posat el teu professional i hi trobes els avisos del centre. Tot el que hi facis queda desat al moment; no hi ha res que s'hagi de confirmar després per un altre canal.",
            es: "Aquesta app és el teu espai al centre: hi tens els bons que has comprat, hi reserves les sessions, hi consultes els exercicis que t'ha posat el teu professional i hi trobes els avisos del centre. Tot el que hi facis queda desat al moment; no hi ha res que s'hagi de confirmar després per un altre canal.",
            en: "Aquesta app és el teu espai al centre: hi tens els bons que has comprat, hi reserves les sessions, hi consultes els exercicis que t'ha posat el teu professional i hi trobes els avisos del centre. Tot el que hi facis queda desat al moment; no hi ha res que s'hagi de confirmar després per un altre canal.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Crear el compte",
            es: "Crear el compte",
            en: "Crear el compte",
          }),
        },
        {
          t: "p",
          text: T({
            ca: `Des de la pantalla d'entrada, «Crear compte». Et demanem el nom i cognoms, el correu electrònic, un telèfon, la data de naixement i una contrasenya de ${s.minPasswordLength} caràcters com a mínim. El telèfon i la data de naixement són obligatoris: el centre ha de poder trucar-te si una sessió es mou o hi ha una urgència.`,
            es: `Des de la pantalla d'entrada, «Crear compte». Et demanem el nom i cognoms, el correu electrònic, un telèfon, la data de naixement i una contrasenya de ${s.minPasswordLength} caràcters com a mínim. El telèfon i la data de naixement són obligatoris: el centre ha de poder trucar-te si una sessió es mou o hi ha una urgència.`,
            en: `Des de la pantalla d'entrada, «Crear compte». Et demanem el nom i cognoms, el correu electrònic, un telèfon, la data de naixement i una contrasenya de ${s.minPasswordLength} caràcters com a mínim. El telèfon i la data de naixement són obligatoris: el centre ha de poder trucar-te si una sessió es mou o hi ha una urgència.`,
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Hi ha també un parell de camps opcionals —el teu objectiu i, si algú te'n va donar un, un codi de referit— i una casella per acceptar la Política de Privacitat i l'Avís Legal, que sí que cal marcar per continuar. Pots triar l'idioma de l'app ja aquí; després el podràs canviar quan vulguis.",
            es: "Hi ha també un parell de camps opcionals —el teu objectiu i, si algú te'n va donar un, un codi de referit— i una casella per acceptar la Política de Privacitat i l'Avís Legal, que sí que cal marcar per continuar. Pots triar l'idioma de l'app ja aquí; després el podràs canviar quan vulguis.",
            en: "Hi ha també un parell de camps opcionals —el teu objectiu i, si algú te'n va donar un, un codi de referit— i una casella per acceptar la Política de Privacitat i l'Avís Legal, que sí que cal marcar per continuar. Pots triar l'idioma de l'app ja aquí; després el podràs canviar quan vulguis.",
          }),
        },
        {
          t: "note",
          text: T({
            ca: "El correu que hi posis serà el teu usuari d'accés i la bústia on rebràs els avisos. Si el centre té activada la confirmació per correu, revisa la safata abans d'intentar entrar.",
            es: "El correu que hi posis serà el teu usuari d'accés i la bústia on rebràs els avisos. Si el centre té activada la confirmació per correu, revisa la safata abans d'intentar entrar.",
            en: "El correu que hi posis serà el teu usuari d'accés i la bústia on rebràs els avisos. Si el centre té activada la confirmació per correu, revisa la safata abans d'intentar entrar.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Entrar i recuperar la contrasenya",
            es: "Entrar i recuperar la contrasenya",
            en: "Entrar i recuperar la contrasenya",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "S'entra amb el correu i la contrasenya. Si no la recordes, «Has oblidat la contrasenya?» t'envia un enllaç a la teva bústia per posar-ne una de nova. L'enllaç arriba al correu amb què vas crear el compte.",
            es: "S'entra amb el correu i la contrasenya. Si no la recordes, «Has oblidat la contrasenya?» t'envia un enllaç a la teva bústia per posar-ne una de nova. L'enllaç arriba al correu amb què vas crear el compte.",
            en: "S'entra amb el correu i la contrasenya. Si no la recordes, «Has oblidat la contrasenya?» t'envia un enllaç a la teva bústia per posar-ne una de nova. L'enllaç arriba al correu amb què vas crear el compte.",
          }),
        },
        ...(s.modules.sessionsProva
          ? ([
              {
                t: "h",
                text: T({
                  ca: "Provar-ho abans, sense compte",
                  es: "Provar-ho abans, sense compte",
                  en: "Provar-ho abans, sense compte",
                }),
              },
              {
                t: "p",
                text: T({
                  ca: `Si encara no ets client, el centre ofereix una sessió de prova gratuïta que es demana sense crear cap compte: tries una franja lliure del calendari públic, hi deixes el nom, el correu i el telèfon, i un professional te la confirma. Cal demanar-la amb un mínim de ${s.trialMinAdvanceHours} h d'antelació i com a molt ${s.trialMaxAdvanceDays} dies vista.`,
                  es: `Si encara no ets client, el centre ofereix una sessió de prova gratuïta que es demana sense crear cap compte: tries una franja lliure del calendari públic, hi deixes el nom, el correu i el telèfon, i un professional te la confirma. Cal demanar-la amb un mínim de ${s.trialMinAdvanceHours} h d'antelació i com a molt ${s.trialMaxAdvanceDays} dies vista.`,
                  en: `Si encara no ets client, el centre ofereix una sessió de prova gratuïta que es demana sense crear cap compte: tries una franja lliure del calendari públic, hi deixes el nom, el correu i el telèfon, i un professional te la confirma. Cal demanar-la amb un mínim de ${s.trialMinAdvanceHours} h d'antelació i com a molt ${s.trialMaxAdvanceDays} dies vista.`,
                }),
              },
              {
                t: "p",
                text: T({
                  ca: "La sol·licitud queda pendent fins que el professional la respon, i la resposta t'arriba per correu tant si s'accepta com si no.",
                  es: "La sol·licitud queda pendent fins que el professional la respon, i la resposta t'arriba per correu tant si s'accepta com si no.",
                  en: "La sol·licitud queda pendent fins que el professional la respon, i la resposta t'arriba per correu tant si s'accepta com si no.",
                }),
              },
            ] as Block[])
          : []),
        {
          t: "h",
          text: T({
            ca: "Moure't per l'app",
            es: "Moure't per l'app",
            en: "Moure't per l'app",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "A l'ordinador tens el menú sempre a l'esquerra. Al mòbil hi ha una barra a dalt amb el botó de menú, que obre el mateix llistat. Les seccions són les mateixes en tots dos casos: Inici, Bons, Reserves, Exercicis, Documents, Comunitat, Configuració i aquesta Ajuda.",
            es: "A l'ordinador tens el menú sempre a l'esquerra. Al mòbil hi ha una barra a dalt amb el botó de menú, que obre el mateix llistat. Les seccions són les mateixes en tots dos casos: Inici, Bons, Reserves, Exercicis, Documents, Comunitat, Configuració i aquesta Ajuda.",
            en: "A l'ordinador tens el menú sempre a l'esquerra. Al mòbil hi ha una barra a dalt amb el botó de menú, que obre el mateix llistat. Les seccions són les mateixes en tots dos casos: Inici, Bons, Reserves, Exercicis, Documents, Comunitat, Configuració i aquesta Ajuda.",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Al peu del menú hi ha el teu nom i la teva foto: aquell bloc porta a Configuració. Just a sota hi ha el botó de tancar sessió i els enllaços a la Política de Privacitat, l'Avís Legal i la política de Cookies.",
            es: "Al peu del menú hi ha el teu nom i la teva foto: aquell bloc porta a Configuració. Just a sota hi ha el botó de tancar sessió i els enllaços a la Política de Privacitat, l'Avís Legal i la política de Cookies.",
            en: "Al peu del menú hi ha el teu nom i la teva foto: aquell bloc porta a Configuració. Just a sota hi ha el botó de tancar sessió i els enllaços a la Política de Privacitat, l'Avís Legal i la política de Cookies.",
          }),
        },
        {
          t: "note",
          text: T({
            ca: "Si al teu menú hi falta alguna de les seccions que surten en aquest manual, no és cap error: el centre pot tenir-la desactivada. Aquest manual s'escriu amb la configuració real del teu centre, així que el que hi llegeixes és el que hi tens.",
            es: "Si al teu menú hi falta alguna de les seccions que surten en aquest manual, no és cap error: el centre pot tenir-la desactivada. Aquest manual s'escriu amb la configuració real del teu centre, així que el que hi llegeixes és el que hi tens.",
            en: "Si al teu menú hi falta alguna de les seccions que surten en aquest manual, no és cap error: el centre pot tenir-la desactivada. Aquest manual s'escriu amb la configuració real del teu centre, així que el que hi llegeixes és el que hi tens.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Canviar d'idioma",
            es: "Canviar d'idioma",
            en: "Canviar d'idioma",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "L'app està en català, castellà i anglès. El canvi és a Configuració → Dades personals → Preferències, i té efecte de seguida: no cal desar res. L'idioma que triïs és també el dels correus que t'enviem.",
            es: "L'app està en català, castellà i anglès. El canvi és a Configuració → Dades personals → Preferències, i té efecte de seguida: no cal desar res. L'idioma que triïs és també el dels correus que t'enviem.",
            en: "L'app està en català, castellà i anglès. El canvi és a Configuració → Dades personals → Preferències, i té efecte de seguida: no cal desar res. L'idioma que triïs és també el dels correus que t'enviem.",
          }),
        },
      ],
    },

    // ─────────────────────────── 2 ───────────────────────────
    {
      id: "inici",
      title: T({ ca: "Inici", es: "Inici", en: "Inici" }),
      blocks: [
        {
          t: "p",
          text: T({
            ca: "La pantalla d'entrada és un resum: què tens, què ve ara i què has de fer si vols alguna cosa. No cal entrar-hi a fer res, però és des d'on es fa tot més de pressa.",
            es: "La pantalla d'entrada és un resum: què tens, què ve ara i què has de fer si vols alguna cosa. No cal entrar-hi a fer res, però és des d'on es fa tot més de pressa.",
            en: "La pantalla d'entrada és un resum: què tens, què ve ara i què has de fer si vols alguna cosa. No cal entrar-hi a fer res, però és des d'on es fa tot més de pressa.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Els quatre indicadors",
            es: "Els quatre indicadors",
            en: "Els quatre indicadors",
          }),
        },
        {
          t: "dl",
          items: [
            [
              T({
                ca: "Sessions restants",
                es: "Sessions restants",
                en: "Sessions restants",
              }),
              T({
                ca: "Les sessions que et queden sumant tots els bons que pots fer servir, i entre parèntesis quantes en portaves en total.",
                es: "Les sessions que et queden sumant tots els bons que pots fer servir, i entre parèntesis quantes en portaves en total.",
                en: "Les sessions que et queden sumant tots els bons que pots fer servir, i entre parèntesis quantes en portaves en total.",
              }),
            ],
            [
              T({ ca: "Bons actius", es: "Bons actius", en: "Bons actius" }),
              T({
                ca: "Quants bons tens en marxa ara mateix.",
                es: "Quants bons tens en marxa ara mateix.",
                en: "Quants bons tens en marxa ara mateix.",
              }),
            ],
            [
              T({
                ca: "Properes reserves",
                es: "Properes reserves",
                en: "Properes reserves",
              }),
              T({
                ca: "Les sessions que tens reservades per als pròxims set dies.",
                es: "Les sessions que tens reservades per als pròxims set dies.",
                en: "Les sessions que tens reservades per als pròxims set dies.",
              }),
            ],
            [
              T({ ca: "Assistència", es: "Assistència", en: "Assistència" }),
              T({
                ca: "El percentatge de sessions d'aquest mes que s'han donat per fetes. Surt un guionet mentre no n'hi hagi cap de tancada: sense sessions, un percentatge no voldria dir res.",
                es: "El percentatge de sessions d'aquest mes que s'han donat per fetes. Surt un guionet mentre no n'hi hagi cap de tancada: sense sessions, un percentatge no voldria dir res.",
                en: "El percentatge de sessions d'aquest mes que s'han donat per fetes. Surt un guionet mentre no n'hi hagi cap de tancada: sense sessions, un percentatge no voldria dir res.",
              }),
            ],
          ],
        },
        {
          t: "h",
          text: T({
            ca: "Accions ràpides",
            es: "Accions ràpides",
            en: "Accions ràpides",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Tres botons grans amb les tres coses que es fan més sovint: reservar una sessió, comprar un bo i anar als teus entrenaments. Res que no es pugui fer també des del menú; simplement són a un clic.",
            es: "Tres botons grans amb les tres coses que es fan més sovint: reservar una sessió, comprar un bo i anar als teus entrenaments. Res que no es pugui fer també des del menú; simplement són a un clic.",
            en: "Tres botons grans amb les tres coses que es fan més sovint: reservar una sessió, comprar un bo i anar als teus entrenaments. Res que no es pugui fer també des del menú; simplement són a un clic.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "La pròxima sessió",
            es: "La pròxima sessió",
            en: "La pròxima sessió",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Al mòbil és el primer que veus en obrir l'app, i a l'ordinador queda a la dreta: el dia, l'hora en gran i amb qui la fas. Porta el botó «Afegir al calendari», que la posa al teu Google Calendar o et descarrega un fitxer que qualsevol altra agenda entén (Apple, Outlook…).",
            es: "Al mòbil és el primer que veus en obrir l'app, i a l'ordinador queda a la dreta: el dia, l'hora en gran i amb qui la fas. Porta el botó «Afegir al calendari», que la posa al teu Google Calendar o et descarrega un fitxer que qualsevol altra agenda entén (Apple, Outlook…).",
            en: "Al mòbil és el primer que veus en obrir l'app, i a l'ordinador queda a la dreta: el dia, l'hora en gran i amb qui la fas. Porta el botó «Afegir al calendari», que la posa al teu Google Calendar o et descarrega un fitxer que qualsevol altra agenda entén (Apple, Outlook…).",
          }),
        },
        {
          t: "note",
          text: T({
            ca: "Afegir-la al teu calendari no és el mateix que reservar-la: la reserva ja està feta i és a l'app. Això només és una còpia perquè et surti a l'agenda del mòbil.",
            es: "Afegir-la al teu calendari no és el mateix que reservar-la: la reserva ja està feta i és a l'app. Això només és una còpia perquè et surti a l'agenda del mòbil.",
            en: "Afegir-la al teu calendari no és el mateix que reservar-la: la reserva ja està feta i és a l'app. Això només és una còpia perquè et surti a l'agenda del mòbil.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Properes reserves",
            es: "Properes reserves",
            en: "Properes reserves",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Les tres següents, amb el dia gran a l'esquerra i el professional a la dreta. Des d'aquí mateix pots afegir-les al calendari o cancel·lar-les, sense passar pel calendari de Reserves. «Veure totes» porta a Reserves.",
            es: "Les tres següents, amb el dia gran a l'esquerra i el professional a la dreta. Des d'aquí mateix pots afegir-les al calendari o cancel·lar-les, sense passar pel calendari de Reserves. «Veure totes» porta a Reserves.",
            en: "Les tres següents, amb el dia gran a l'esquerra i el professional a la dreta. Des d'aquí mateix pots afegir-les al calendari o cancel·lar-les, sense passar pel calendari de Reserves. «Veure totes» porta a Reserves.",
          }),
        },
        {
          t: "h",
          text: T({ ca: "Bons actius", es: "Bons actius", en: "Bons actius" }),
        },
        {
          t: "p",
          text: T({
            ca: "Una targeta per bo, amb el servei, les sessions que et queden de les que tenia, l'estat i la data de caducitat si en té. La barra de sota creix a mesura que el vas gastant: mostra el que has consumit, no el que et queda.",
            es: "Una targeta per bo, amb el servei, les sessions que et queden de les que tenia, l'estat i la data de caducitat si en té. La barra de sota creix a mesura que el vas gastant: mostra el que has consumit, no el que et queda.",
            en: "Una targeta per bo, amb el servei, les sessions que et queden de les que tenia, l'estat i la data de caducitat si en té. La barra de sota creix a mesura que el vas gastant: mostra el que has consumit, no el que et queda.",
          }),
        },
        ...(s.modules.comunitat
          ? ([
              {
                t: "h",
                text: T({ ca: "Comunitat", es: "Comunitat", en: "Comunitat" }),
              },
              {
                t: "p",
                text: T({
                  ca: "Si el centre ha publicat anuncis o ha obert alguna enquesta, els primers els veus aquí mateix, sense haver d'entrar a Comunitat.",
                  es: "Si el centre ha publicat anuncis o ha obert alguna enquesta, els primers els veus aquí mateix, sense haver d'entrar a Comunitat.",
                  en: "Si el centre ha publicat anuncis o ha obert alguna enquesta, els primers els veus aquí mateix, sense haver d'entrar a Comunitat.",
                }),
              },
            ] as Block[])
          : []),
        ...(s.giftVouchersEnabled || s.referralProgramActive
          ? ([
              {
                t: "h",
                text: T({
                  ca: "Regalar i recomanar",
                  es: "Regalar i recomanar",
                  en: "Regalar i recomanar",
                }),
              },
              {
                t: "p",
                text: [
                  s.giftVouchersEnabled
                    ? "«Regala Vindi» porta a comprar un paquet de sessions per a una altra persona."
                    : "",
                  s.referralProgramActive
                    ? "«Porta un amic» obre el teu codi de referit aquí mateix, en una finestra, per copiar-lo i enviar-lo."
                    : "",
                ]
                  .filter(Boolean)
                  .join(" "),
              },
            ] as Block[])
          : []),
      ],
    },

    // ─────────────────────────── 3 ───────────────────────────
    {
      id: "bons",
      title: T({ ca: "Bons", es: "Bons", en: "Bons" }),
      blocks: [
        {
          t: "p",
          text: T({
            ca: "Un bo és un paquet de sessions ja pagades (o pendents de pagar) d'un servei concret. Sense un bo amb sessions disponibles no es pot reservar: el calendari no t'ensenyarà cap franja lliure. Aquesta secció té dues pestanyes, «Comprar bo nou» i «Els meus bons».",
            es: "Un bo és un paquet de sessions ja pagades (o pendents de pagar) d'un servei concret. Sense un bo amb sessions disponibles no es pot reservar: el calendari no t'ensenyarà cap franja lliure. Aquesta secció té dues pestanyes, «Comprar bo nou» i «Els meus bons».",
            en: "Un bo és un paquet de sessions ja pagades (o pendents de pagar) d'un servei concret. Sense un bo amb sessions disponibles no es pot reservar: el calendari no t'ensenyarà cap franja lliure. Aquesta secció té dues pestanyes, «Comprar bo nou» i «Els meus bons».",
          }),
        },
        {
          t: "h",
          text: T({ ca: "Els serveis", es: "Els serveis", en: "Els serveis" }),
        },
        {
          t: "dl",
          items: [
            [
              T({
                ca: "EP Individual",
                es: "EP Individual",
                en: "EP Individual",
              }),
              T({
                ca: "Entrenament personal, tu sol amb el professional.",
                es: "Entrenament personal, tu sol amb el professional.",
                en: "Entrenament personal, tu sol amb el professional.",
              }),
            ],
            [
              T({ ca: "EP Parelles", es: "EP Parelles", en: "EP Parelles" }),
              T({
                ca: "Entrenament personal de dos.",
                es: "Entrenament personal de dos.",
                en: "Entrenament personal de dos.",
              }),
            ],
            [
              T({ ca: "Grup reduït", es: "Grup reduït", en: "Grup reduït" }),
              T({
                ca: `Sessions en grup, amb un màxim de ${s.groupCapacity} persones.`,
                es: `Sessions en grup, amb un màxim de ${s.groupCapacity} persones.`,
                en: `Sessions en grup, amb un màxim de ${s.groupCapacity} persones.`,
              }),
            ],
            [
              T({ ca: "Fisioteràpia", es: "Fisioteràpia", en: "Fisioteràpia" }),
              T({
                ca: "Sessions de fisioteràpia.",
                es: "Sessions de fisioteràpia.",
                en: "Sessions de fisioteràpia.",
              }),
            ],
          ],
        },
        {
          t: "p",
          text: T({
            ca: "El catàleg de paquets i els preus els posa el centre, i no tots els serveis tenen per què estar disponibles en tot moment.",
            es: "El catàleg de paquets i els preus els posa el centre, i no tots els serveis tenen per què estar disponibles en tot moment.",
            en: "El catàleg de paquets i els preus els posa el centre, i no tots els serveis tenen per què estar disponibles en tot moment.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Comprar un bo, pas a pas",
            es: "Comprar un bo, pas a pas",
            en: "Comprar un bo, pas a pas",
          }),
        },
        {
          t: "ol",
          items: [
            T({
              ca: "Tries el tipus de servei.",
              es: "Tries el tipus de servei.",
              en: "Tries el tipus de servei.",
            }),
            T({
              ca: "Tries el paquet: cada un diu quantes sessions porta i què val.",
              es: "Tries el paquet: cada un diu quantes sessions porta i què val.",
              en: "Tries el paquet: cada un diu quantes sessions porta i què val.",
            }),
            T({
              ca: "Tries com el pagues.",
              es: "Tries com el pagues.",
              en: "Tries com el pagues.",
            }),
          ],
        },
        {
          t: "p",
          text: T({
            ca: "Abans de crear res et sortirà una finestra amb el resum del que has triat i una casella per acceptar les condicions de compra. Fins que no la marquis, el botó de confirmar no s'activa.",
            es: "Abans de crear res et sortirà una finestra amb el resum del que has triat i una casella per acceptar les condicions de compra. Fins que no la marquis, el botó de confirmar no s'activa.",
            en: "Abans de crear res et sortirà una finestra amb el resum del que has triat i una casella per acceptar les condicions de compra. Fins que no la marquis, el botó de confirmar no s'activa.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Ofertes i descomptes",
            es: "Ofertes i descomptes",
            en: "Ofertes i descomptes",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Si el centre té una oferta activa sobre un paquet, el preu ratllat i el preu final surten a la mateixa targeta. Els descomptes no se sumen: si tens un descompte de referit pendent i alhora hi ha una oferta, s'aplica el que et surti millor i l'altre es guarda per a la propera compra. L'app t'ho diu explícitament abans de pagar.",
            es: "Si el centre té una oferta activa sobre un paquet, el preu ratllat i el preu final surten a la mateixa targeta. Els descomptes no se sumen: si tens un descompte de referit pendent i alhora hi ha una oferta, s'aplica el que et surti millor i l'altre es guarda per a la propera compra. L'app t'ho diu explícitament abans de pagar.",
            en: "Si el centre té una oferta activa sobre un paquet, el preu ratllat i el preu final surten a la mateixa targeta. Els descomptes no se sumen: si tens un descompte de referit pendent i alhora hi ha una oferta, s'aplica el que et surti millor i l'altre es guarda per a la propera compra. L'app t'ho diu explícitament abans de pagar.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Pagar al centre",
            es: "Pagar al centre",
            en: "Pagar al centre",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "El bo es crea a l'instant amb l'estat «Pendent de pagament» i el pagues en efectiu quan vagis. No és una reserva a mitges: les sessions ja les pots fer servir per reservar des del primer moment. L'estat passa a «Actiu» quan el centre registra el cobrament.",
            es: "El bo es crea a l'instant amb l'estat «Pendent de pagament» i el pagues en efectiu quan vagis. No és una reserva a mitges: les sessions ja les pots fer servir per reservar des del primer moment. L'estat passa a «Actiu» quan el centre registra el cobrament.",
            en: "El bo es crea a l'instant amb l'estat «Pendent de pagament» i el pagues en efectiu quan vagis. No és una reserva a mitges: les sessions ja les pots fer servir per reservar des del primer moment. L'estat passa a «Actiu» quan el centre registra el cobrament.",
          }),
        },
        ...(s.pendingPaymentCancelEnabled && s.pendingPaymentCancelHours
          ? ([
              {
                t: "warn",
                text: T({
                  ca: `Un bo pendent de pagament no ho pot estar per sempre: si passen ${s.pendingPaymentCancelHours} h des de la primera reserva que hi facis sense que s'hagi cobrat, el bo s'anul·la i les sessions que hi tinguessis reservades es cancel·len. Rebràs un correu si això passa.`,
                  es: `Un bo pendent de pagament no ho pot estar per sempre: si passen ${s.pendingPaymentCancelHours} h des de la primera reserva que hi facis sense que s'hagi cobrat, el bo s'anul·la i les sessions que hi tinguessis reservades es cancel·len. Rebràs un correu si això passa.`,
                  en: `Un bo pendent de pagament no ho pot estar per sempre: si passen ${s.pendingPaymentCancelHours} h des de la primera reserva que hi facis sense que s'hagi cobrat, el bo s'anul·la i les sessions que hi tinguessis reservades es cancel·len. Rebràs un correu si això passa.`,
                }),
              },
            ] as Block[])
          : []),
        ...(s.cardPayments
          ? ([
              {
                t: "h",
                text: T({
                  ca: "Pagar amb targeta",
                  es: "Pagar amb targeta",
                  en: "Pagar amb targeta",
                }),
              },
              {
                t: "p",
                text: T({
                  ca: "Et portem a la pàgina de pagament de Stripe. Les dades de la targeta no passen mai pel nostre domini: les recull Stripe directament.",
                  es: "Et portem a la pàgina de pagament de Stripe. Les dades de la targeta no passen mai pel nostre domini: les recull Stripe directament.",
                  en: "Et portem a la pàgina de pagament de Stripe. Les dades de la targeta no passen mai pel nostre domini: les recull Stripe directament.",
                }),
              },
              {
                t: "p",
                text: T({
                  ca: "Prémer «Pagar amb targeta» no crea res encara. El bo neix quan el banc confirma el cobrament. Per això, en tornar, pots trobar-te una pantalla que diu «Estem confirmant el pagament»: vol dir que la confirmació encara no ha arribat. No cal que facis res ni que tornis a pagar; en poca estona el bo apareix sol.",
                  es: "Prémer «Pagar amb targeta» no crea res encara. El bo neix quan el banc confirma el cobrament. Per això, en tornar, pots trobar-te una pantalla que diu «Estem confirmant el pagament»: vol dir que la confirmació encara no ha arribat. No cal que facis res ni que tornis a pagar; en poca estona el bo apareix sol.",
                  en: "Prémer «Pagar amb targeta» no crea res encara. El bo neix quan el banc confirma el cobrament. Per això, en tornar, pots trobar-te una pantalla que diu «Estem confirmant el pagament»: vol dir que la confirmació encara no ha arribat. No cal que facis res ni que tornis a pagar; en poca estona el bo apareix sol.",
                }),
              },
              {
                t: "warn",
                text: T({
                  ca: `Si passa una hora i el bo segueix sense sortir tot i que el banc t'ha cobrat, avisa el centre (${CONTACTE_CENTRE}). El que no s'ha de fer és tornar a pagar.`,
                  es: `Si passa una hora i el bo segueix sense sortir tot i que el banc t'ha cobrat, avisa el centre (${CONTACTE_CENTRE}). El que no s'ha de fer és tornar a pagar.`,
                  en: `Si passa una hora i el bo segueix sense sortir tot i que el banc t'ha cobrat, avisa el centre (${CONTACTE_CENTRE}). El que no s'ha de fer és tornar a pagar.`,
                }),
              },
              {
                t: "note",
                text: T({
                  ca: "Si tanques la pestanya de Stripe a mitges, no es crea ni es cobra res. Pots tornar-hi quan vulguis.",
                  es: "Si tanques la pestanya de Stripe a mitges, no es crea ni es cobra res. Pots tornar-hi quan vulguis.",
                  en: "Si tanques la pestanya de Stripe a mitges, no es crea ni es cobra res. Pots tornar-hi quan vulguis.",
                }),
              },
            ] as Block[])
          : ([
              {
                t: "note",
                text: T({
                  ca: "Ara mateix el centre no accepta pagament amb targeta des de l'app: els bons es paguen al centre.",
                  es: "Ara mateix el centre no accepta pagament amb targeta des de l'app: els bons es paguen al centre.",
                  en: "Ara mateix el centre no accepta pagament amb targeta des de l'app: els bons es paguen al centre.",
                }),
              },
            ] as Block[])),
        ...(s.subscriptionsEnabled
          ? ([
              {
                t: "h",
                text: T({
                  ca: "La subscripció mensual",
                  es: "La subscripció mensual",
                  en: "La subscripció mensual",
                }),
              },
              {
                t: "p",
                text: T({
                  ca: `Als bons de Grup reduït, a més de comprar-ne un de solt, pots subscriure-t'hi: reps aquestes mateixes sessions cada mes sense haver de tornar a comprar res. El dia de renovació és el dia del mes en què t'hi dones d'alta, i te'l diem abans de confirmar.`,
                  es: `Als bons de Grup reduït, a més de comprar-ne un de solt, pots subscriure-t'hi: reps aquestes mateixes sessions cada mes sense haver de tornar a comprar res. El dia de renovació és el dia del mes en què t'hi dones d'alta, i te'l diem abans de confirmar.`,
                  en: `Als bons de Grup reduït, a més de comprar-ne un de solt, pots subscriure-t'hi: reps aquestes mateixes sessions cada mes sense haver de tornar a comprar res. El dia de renovació és el dia del mes en què t'hi dones d'alta, i te'l diem abans de confirmar.`,
                }),
              },
              {
                t: "p",
                text: T({
                  ca: "El preu et queda congelat: encara que la tarifa del centre pugi, tu segueixes pagant el que pagaves. Només se'n pot tenir una de viva alhora.",
                  es: "El preu et queda congelat: encara que la tarifa del centre pugi, tu segueixes pagant el que pagaves. Només se'n pot tenir una de viva alhora.",
                  en: "El preu et queda congelat: encara que la tarifa del centre pugi, tu segueixes pagant el que pagaves. Només se'n pot tenir una de viva alhora.",
                }),
              },
              {
                t: "warn",
                text: T({
                  ca: "Les sessions que no facis servir NO s'acumulen per al mes següent. Ara bé, reservar ja compta: si al calendari hi ha franges del mes que ve, pots reservar-les amb les sessions d'aquest mes i no perdre-les.",
                  es: "Les sessions que no facis servir NO s'acumulen per al mes següent. Ara bé, reservar ja compta: si al calendari hi ha franges del mes que ve, pots reservar-les amb les sessions d'aquest mes i no perdre-les.",
                  en: "Les sessions que no facis servir NO s'acumulen per al mes següent. Ara bé, reservar ja compta: si al calendari hi ha franges del mes que ve, pots reservar-les amb les sessions d'aquest mes i no perdre-les.",
                }),
              },
              {
                t: "p",
                text: s.cardPayments
                  ? T({
                      ca: "La pots pagar de dues maneres: al centre, en efectiu, com un bo qualsevol; o amb targeta, i llavors es cobra sola cada mes.",
                      es: "La pots pagar de dues maneres: al centre, en efectiu, com un bo qualsevol; o amb targeta, i llavors es cobra sola cada mes.",
                      en: "La pots pagar de dues maneres: al centre, en efectiu, com un bo qualsevol; o amb targeta, i llavors es cobra sola cada mes.",
                    })
                  : T({
                      ca: "Es paga al centre, en efectiu, com un bo qualsevol.",
                      es: "Es paga al centre, en efectiu, com un bo qualsevol.",
                      en: "Es paga al centre, en efectiu, com un bo qualsevol.",
                    }),
              },
              {
                t: "h",
                text: T({
                  ca: "Què veus a «Els meus bons»",
                  es: "Què veus a «Els meus bons»",
                  en: "Què veus a «Els meus bons»",
                }),
              },
              {
                t: "p",
                text: T({
                  ca: "La subscripció té el seu propi bloc a dalt de tot, separat dels bons: el que hi surt no és una compra que has fet sinó el que passarà cada mes. Hi trobes el preu, el dia de renovació, com es paga, l'estat i quantes sessions et queden del mes en curs.",
                  es: "La subscripció té el seu propi bloc a dalt de tot, separat dels bons: el que hi surt no és una compra que has fet sinó el que passarà cada mes. Hi trobes el preu, el dia de renovació, com es paga, l'estat i quantes sessions et queden del mes en curs.",
                  en: "La subscripció té el seu propi bloc a dalt de tot, separat dels bons: el que hi surt no és una compra que has fet sinó el que passarà cada mes. Hi trobes el preu, el dia de renovació, com es paga, l'estat i quantes sessions et queden del mes en curs.",
                }),
              },
              ...(s.subscriptionExtraSessionsMax > 0
                ? ([
                    {
                      t: "h",
                      text: T({
                        ca: "Demanar una sessió extra",
                        es: "Demanar una sessió extra",
                        en: "Demanar una sessió extra",
                      }),
                    },
                    {
                      t: "p",
                      text: T({
                        ca: `Si t'has quedat sense sessions abans que acabi el mes, pots demanar-ne fins a ${s.subscriptionExtraSessionsMax} de més sense esperar la renovació. Es cobra al preu per sessió del teu bo, no al d'una sessió solta, i caduca amb el mes en curs com la resta.`,
                        es: `Si t'has quedat sense sessions abans que acabi el mes, pots demanar-ne fins a ${s.subscriptionExtraSessionsMax} de més sense esperar la renovació. Es cobra al preu per sessió del teu bo, no al d'una sessió solta, i caduca amb el mes en curs com la resta.`,
                        en: `Si t'has quedat sense sessions abans que acabi el mes, pots demanar-ne fins a ${s.subscriptionExtraSessionsMax} de més sense esperar la renovació. Es cobra al preu per sessió del teu bo, no al d'una sessió solta, i caduca amb el mes en curs com la resta.`,
                      }),
                    },
                    {
                      t: "p",
                      text: T({
                        ca: "El botó només apareix quan de debò se'n pot demanar una: si encara et queden sessions del mes, primer has de fer servir aquelles.",
                        es: "El botó només apareix quan de debò se'n pot demanar una: si encara et queden sessions del mes, primer has de fer servir aquelles.",
                        en: "El botó només apareix quan de debò se'n pot demanar una: si encara et queden sessions del mes, primer has de fer servir aquelles.",
                      }),
                    },
                  ] as Block[])
                : []),
              ...(s.cardPayments
                ? ([
                    {
                      t: "h",
                      text: T({
                        ca: "Canviar la targeta o veure els rebuts",
                        es: "Canviar la targeta o veure els rebuts",
                        en: "Canviar la targeta o veure els rebuts",
                      }),
                    },
                    {
                      t: "p",
                      text: T({
                        ca: "Si la pagues amb targeta, el botó «Canviar la targeta o veure els rebuts» obre la pàgina de gestió de Stripe, on pots posar-hi una targeta nova i descarregar els comprovants de cada mes.",
                        es: "Si la pagues amb targeta, el botó «Canviar la targeta o veure els rebuts» obre la pàgina de gestió de Stripe, on pots posar-hi una targeta nova i descarregar els comprovants de cada mes.",
                        en: "Si la pagues amb targeta, el botó «Canviar la targeta o veure els rebuts» obre la pàgina de gestió de Stripe, on pots posar-hi una targeta nova i descarregar els comprovants de cada mes.",
                      }),
                    },
                  ] as Block[])
                : []),
              {
                t: "h",
                text: T({
                  ca: "Donar-te de baixa",
                  es: "Donar-te de baixa",
                  en: "Donar-te de baixa",
                }),
              },
              {
                t: "p",
                text: T({
                  ca: "Amb «Donar-me de baixa». No perds el mes que ja tens pagat: el conserves sencer i simplement no se'n cobra cap més. Un cop demanada, l'app t'ho recorda al mateix bloc.",
                  es: "Amb «Donar-me de baixa». No perds el mes que ja tens pagat: el conserves sencer i simplement no se'n cobra cap més. Un cop demanada, l'app t'ho recorda al mateix bloc.",
                  en: "Amb «Donar-me de baixa». No perds el mes que ja tens pagat: el conserves sencer i simplement no se'n cobra cap més. Un cop demanada, l'app t'ho recorda al mateix bloc.",
                }),
              },
              {
                t: "h",
                text: T({
                  ca: "Si la subscripció s'atura",
                  es: "Si la subscripció s'atura",
                  en: "Si la subscripció s'atura",
                }),
              },
              {
                t: "dl",
                items: [
                  [
                    T({
                      ca: "Aturada per impagament",
                      es: "Aturada per impagament",
                      en: "Aturada per impagament",
                    }),
                    T({
                      ca: "Vol dir que hi ha un mes sense cobrar. Es reprèn sola quan el pagues al centre. Mentre estigui així no es renova.",
                      es: "Vol dir que hi ha un mes sense cobrar. Es reprèn sola quan el pagues al centre. Mentre estigui així no es renova.",
                      en: "Vol dir que hi ha un mes sense cobrar. Es reprèn sola quan el pagues al centre. Mentre estigui així no es renova.",
                    }),
                  ],
                  [
                    T({ ca: "Congelada", es: "Congelada", en: "Congelada" }),
                    T({
                      ca: "L'ha aturada el centre, no tu. No has de pagar res mentre duri i el temps aturat no el perds: en reprendre-la, la renovació es retarda els mateixos dies. Mentre estigui congelada no hi ha cap botó, perquè no hi ha res que puguis fer-hi tu.",
                      es: "L'ha aturada el centre, no tu. No has de pagar res mentre duri i el temps aturat no el perds: en reprendre-la, la renovació es retarda els mateixos dies. Mentre estigui congelada no hi ha cap botó, perquè no hi ha res que puguis fer-hi tu.",
                      en: "L'ha aturada el centre, no tu. No has de pagar res mentre duri i el temps aturat no el perds: en reprendre-la, la renovació es retarda els mateixos dies. Mentre estigui congelada no hi ha cap botó, perquè no hi ha res que puguis fer-hi tu.",
                    }),
                  ],
                ],
              },
            ] as Block[])
          : []),
        {
          t: "h",
          text: T({
            ca: "Els meus bons",
            es: "Els meus bons",
            en: "Els meus bons",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "La llista de tot el que has comprat, amb les sessions que et queden de cada bo, el preu i l'estat. Aquests són els estats possibles:",
            es: "La llista de tot el que has comprat, amb les sessions que et queden de cada bo, el preu i l'estat. Aquests són els estats possibles:",
            en: "La llista de tot el que has comprat, amb les sessions que et queden de cada bo, el preu i l'estat. Aquests són els estats possibles:",
          }),
        },
        {
          t: "dl",
          items: [
            [
              T({ ca: "Actiu", es: "Actiu", en: "Actiu" }),
              T({
                ca: "Pagat i amb sessions disponibles.",
                es: "Pagat i amb sessions disponibles.",
                en: "Pagat i amb sessions disponibles.",
              }),
            ],
            [
              T({
                ca: "Pendent de pagament",
                es: "Pendent de pagament",
                en: "Pendent de pagament",
              }),
              T({
                ca: "Creat però encara no cobrat. Ja el pots fer servir per reservar.",
                es: "Creat però encara no cobrat. Ja el pots fer servir per reservar.",
                en: "Creat però encara no cobrat. Ja el pots fer servir per reservar.",
              }),
            ],
            [
              T({ ca: "Completat", es: "Completat", en: "Completat" }),
              T({
                ca: "Has gastat totes les sessions.",
                es: "Has gastat totes les sessions.",
                en: "Has gastat totes les sessions.",
              }),
            ],
            [
              T({ ca: "Caducat", es: "Caducat", en: "Caducat" }),
              T({
                ca: "Ha passat la data de validesa amb sessions sense fer.",
                es: "Ha passat la data de validesa amb sessions sense fer.",
                en: "Ha passat la data de validesa amb sessions sense fer.",
              }),
            ],
            [
              T({
                ca: "Anul·lat per impagament",
                es: "Anul·lat per impagament",
                en: "Anul·lat per impagament",
              }),
              T({
                ca: "Era pendent de pagament, no es va cobrar a temps i s'ha donat de baixa.",
                es: "Era pendent de pagament, no es va cobrar a temps i s'ha donat de baixa.",
                en: "Era pendent de pagament, no es va cobrar a temps i s'ha donat de baixa.",
              }),
            ],
            [
              T({ ca: "Cancel·lat", es: "Cancel·lat", en: "Cancel·lat" }),
              T({
                ca: "L'ha anul·lat el centre.",
                es: "L'ha anul·lat el centre.",
                en: "L'ha anul·lat el centre.",
              }),
            ],
          ],
        },
        ...(s.bonoExpiryMonths
          ? ([
              {
                t: "note",
                text: T({
                  ca: `Els bons caduquen ${s.bonoExpiryMonths} mesos després de la compra. Cada bo porta la seva pròpia data: si el centre canvia aquest termini, els que ja tinguessis comprats no es toquen.`,
                  es: `Els bons caduquen ${s.bonoExpiryMonths} mesos després de la compra. Cada bo porta la seva pròpia data: si el centre canvia aquest termini, els que ja tinguessis comprats no es toquen.`,
                  en: `Els bons caduquen ${s.bonoExpiryMonths} mesos després de la compra. Cada bo porta la seva pròpia data: si el centre canvia aquest termini, els que ja tinguessis comprats no es toquen.`,
                }),
              },
            ] as Block[])
          : ([
              {
                t: "note",
                text: T({
                  ca: "Ara mateix el centre no posa data de caducitat als bons nous. Si algun dels teus en porta una, és la que tenia el dia que el vas comprar i es respecta.",
                  es: "Ara mateix el centre no posa data de caducitat als bons nous. Si algun dels teus en porta una, és la que tenia el dia que el vas comprar i es respecta.",
                  en: "Ara mateix el centre no posa data de caducitat als bons nous. Si algun dels teus en porta una, és la que tenia el dia que el vas comprar i es respecta.",
                }),
              },
            ] as Block[])),
        {
          t: "h",
          text: T({
            ca: "Historial de pagaments",
            es: "Historial de pagaments",
            en: "Historial de pagaments",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Sota els bons hi ha la llista dels cobraments registrats a nom teu, amb la data, l'import i si van ser en efectiu o amb targeta.",
            es: "Sota els bons hi ha la llista dels cobraments registrats a nom teu, amb la data, l'import i si van ser en efectiu o amb targeta.",
            en: "Sota els bons hi ha la llista dels cobraments registrats a nom teu, amb la data, l'import i si van ser en efectiu o amb targeta.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Tinc un codi de regal",
            es: "Tinc un codi de regal",
            en: "Tinc un codi de regal",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "A la pestanya «Comprar bo nou», a dalt, hi ha el camp «Tens un codi de regal?». Escriu-hi el codi (té la forma VINDI-XXXX-XXXX) i les sessions s'afegeixen al teu compte com un bo més.",
            es: "A la pestanya «Comprar bo nou», a dalt, hi ha el camp «Tens un codi de regal?». Escriu-hi el codi (té la forma VINDI-XXXX-XXXX) i les sessions s'afegeixen al teu compte com un bo més.",
            en: "A la pestanya «Comprar bo nou», a dalt, hi ha el camp «Tens un codi de regal?». Escriu-hi el codi (té la forma VINDI-XXXX-XXXX) i les sessions s'afegeixen al teu compte com un bo més.",
          }),
        },
        {
          t: "p",
          text: T({
            ca: `Si el codi no s'accepta, el missatge et diu per què: que no existeix, que ja s'ha bescanviat, que ha caducat, que s'ha anul·lat o que el centre encara no n'ha confirmat el cobrament. En els tres últims casos no has fet res malament i qui ho pot resoldre és el centre (${CONTACTE_CENTRE}).`,
            es: `Si el codi no s'accepta, el missatge et diu per què: que no existeix, que ja s'ha bescanviat, que ha caducat, que s'ha anul·lat o que el centre encara no n'ha confirmat el cobrament. En els tres últims casos no has fet res malament i qui ho pot resoldre és el centre (${CONTACTE_CENTRE}).`,
            en: `Si el codi no s'accepta, el missatge et diu per què: que no existeix, que ja s'ha bescanviat, que ha caducat, que s'ha anul·lat o que el centre encara no n'ha confirmat el cobrament. En els tres últims casos no has fet res malament i qui ho pot resoldre és el centre (${CONTACTE_CENTRE}).`,
          }),
        },
      ],
    },

    // ─────────────────────────── 4 ───────────────────────────
    {
      id: "reserves",
      title: T({ ca: "Reserves", es: "Reserves", en: "Reserves" }),
      blocks: [
        {
          t: "p",
          text: T({
            ca: "Aquí es reserva. El calendari ensenya les franges lliures de TOTS els professionals del centre, filtrades pel que tu pots fer: només hi surt el que pots reservar amb els bons que tens.",
            es: "Aquí es reserva. El calendari ensenya les franges lliures de TOTS els professionals del centre, filtrades pel que tu pots fer: només hi surt el que pots reservar amb els bons que tens.",
            en: "Aquí es reserva. El calendari ensenya les franges lliures de TOTS els professionals del centre, filtrades pel que tu pots fer: només hi surt el que pots reservar amb els bons que tens.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Llegir el calendari",
            es: "Llegir el calendari",
            en: "Llegir el calendari",
          }),
        },
        {
          t: "p",
          text: T({
            ca: `Es pot mirar per dia o per setmana —al mòbil s'obre per dia— i moure't endavant i endarrere amb les fletxes. L'horari que es mostra va de les ${hhmm(s.openingHour)} a les ${hhmm(s.closingHour)}, que és l'horari del centre.`,
            es: `Es pot mirar per dia o per setmana —al mòbil s'obre per dia— i moure't endavant i endarrere amb les fletxes. L'horari que es mostra va de les ${hhmm(s.openingHour)} a les ${hhmm(s.closingHour)}, que és l'horari del centre.`,
            en: `Es pot mirar per dia o per setmana —al mòbil s'obre per dia— i moure't endavant i endarrere amb les fletxes. L'horari que es mostra va de les ${hhmm(s.openingHour)} a les ${hhmm(s.closingHour)}, que és l'horari del centre.`,
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Cada professional té el seu color, i la llegenda de sota el calendari diu quin és de qui. A dalt hi ha dos filtres, per servei i per professional, per si vols mirar només una cosa. Si tens un professional assignat, el filtre ja hi ve posat.",
            es: "Cada professional té el seu color, i la llegenda de sota el calendari diu quin és de qui. A dalt hi ha dos filtres, per servei i per professional, per si vols mirar només una cosa. Si tens un professional assignat, el filtre ja hi ve posat.",
            en: "Cada professional té el seu color, i la llegenda de sota el calendari diu quin és de qui. A dalt hi ha dos filtres, per servei i per professional, per si vols mirar només una cosa. Si tens un professional assignat, el filtre ja hi ve posat.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Què vol dir cada casella",
            es: "Què vol dir cada casella",
            en: "Què vol dir cada casella",
          }),
        },
        {
          t: "dl",
          items: [
            [
              T({
                ca: "Una franja de color amb el nom d'un servei",
                es: "Una franja de color amb el nom d'un servei",
                en: "Una franja de color amb el nom d'un servei",
              }),
              T({
                ca: "És lliure i la pots reservar. Si un professional ofereix dues coses a la mateixa hora, en surt una per cada servei que tu puguis reservar.",
                es: "És lliure i la pots reservar. Si un professional ofereix dues coses a la mateixa hora, en surt una per cada servei que tu puguis reservar.",
                en: "És lliure i la pots reservar. Si un professional ofereix dues coses a la mateixa hora, en surt una per cada servei que tu puguis reservar.",
              }),
            ],
            [
              T({ ca: "Ocupat", es: "Ocupat", en: "Ocupat" }),
              T({
                ca: "Aquella hora ja la té ocupada una altra persona. No hi veus mai qui és.",
                es: "Aquella hora ja la té ocupada una altra persona. No hi veus mai qui és.",
                en: "Aquella hora ja la té ocupada una altra persona. No hi veus mai qui és.",
              }),
            ],
            [
              T({
                ca: `Un comptador tipus «2/${s.groupCapacity}»`,
                es: `Un comptador tipus «2/${s.groupCapacity}»`,
                en: `Un comptador tipus «2/${s.groupCapacity}»`,
              }),
              T({
                ca: "És una sessió de Grup reduït que ja està en marxa i encara té places. El color et diu com va: verd si hi ha lloc de sobres, ambre si en queda una de sola, vermell si està plena.",
                es: "És una sessió de Grup reduït que ja està en marxa i encara té places. El color et diu com va: verd si hi ha lloc de sobres, ambre si en queda una de sola, vermell si està plena.",
                en: "És una sessió de Grup reduït que ja està en marxa i encara té places. El color et diu com va: verd si hi ha lloc de sobres, ambre si en queda una de sola, vermell si està plena.",
              }),
            ],
            [
              T({
                ca: "La teva sessió",
                es: "La teva sessió",
                en: "La teva sessió",
              }),
              T({
                ca: "Les que ja tens reservades surten sempre, encara que hi hagi filtres posats.",
                es: "Les que ja tens reservades surten sempre, encara que hi hagi filtres posats.",
                en: "Les que ja tens reservades surten sempre, encara que hi hagi filtres posats.",
              }),
            ],
          ],
        },
        {
          t: "h",
          text: T({
            ca: "Per què hi ha franges que no et surten",
            es: "Per què hi ha franges que no et surten",
            en: "Per què hi ha franges que no et surten",
          }),
        },
        {
          t: "ul",
          items: [
            T({
              ca: "No tens cap bo actiu amb sessions disponibles: sense bo no hi ha res reservable, i l'app t'ho diu a dalt de tot.",
              es: "No tens cap bo actiu amb sessions disponibles: sense bo no hi ha res reservable, i l'app t'ho diu a dalt de tot.",
              en: "No tens cap bo actiu amb sessions disponibles: sense bo no hi ha res reservable, i l'app t'ho diu a dalt de tot.",
            }),
            T({
              ca: "Aquell professional no ofereix cap dels serveis dels teus bons. Si has filtrat per ell, l'app t'ho avisa i t'ofereix tornar a veure'ls tots.",
              es: "Aquell professional no ofereix cap dels serveis dels teus bons. Si has filtrat per ell, l'app t'ho avisa i t'ofereix tornar a veure'ls tots.",
              en: "Aquell professional no ofereix cap dels serveis dels teus bons. Si has filtrat per ell, l'app t'ho avisa i t'ofereix tornar a veure'ls tots.",
            }),
            T({
              ca: "Ja tens una reserva confirmada a aquella hora: no se te'n proposa una altra al mateix moment.",
              es: "Ja tens una reserva confirmada a aquella hora: no se te'n proposa una altra al mateix moment.",
              en: "Ja tens una reserva confirmada a aquella hora: no se te'n proposa una altra al mateix moment.",
            }),
            T({
              ca: "És una hora que ja ha passat, o cau fora de l'horari del centre.",
              es: "És una hora que ja ha passat, o cau fora de l'horari del centre.",
              en: "És una hora que ja ha passat, o cau fora de l'horari del centre.",
            }),
            ...(s.minBookingHours > 0
              ? [
                  T({
                    ca: `És massa a prop: el centre demana un mínim de ${s.minBookingHours} h d'antelació per reservar.`,
                    es: `És massa a prop: el centre demana un mínim de ${s.minBookingHours} h d'antelació per reservar.`,
                    en: `És massa a prop: el centre demana un mínim de ${s.minBookingHours} h d'antelació per reservar.`,
                  }),
                ]
              : []),
          ],
        },
        {
          t: "h",
          text: T({
            ca: "Reservar una sessió",
            es: "Reservar una sessió",
            en: "Reservar una sessió",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Cliques la franja i s'obre una finestra amb el dia, l'hora, el servei i el professional. Prems «Reservar» i ja està: la sessió es descompta del bo i la confirmació surt al moment, amb el botó per afegir-la al teu calendari.",
            es: "Cliques la franja i s'obre una finestra amb el dia, l'hora, el servei i el professional. Prems «Reservar» i ja està: la sessió es descompta del bo i la confirmació surt al moment, amb el botó per afegir-la al teu calendari.",
            en: "Cliques la franja i s'obre una finestra amb el dia, l'hora, el servei i el professional. Prems «Reservar» i ja està: la sessió es descompta del bo i la confirmació surt al moment, amb el botó per afegir-la al teu calendari.",
          }),
        },
        {
          t: "note",
          text: T({
            ca: "Mentre la reserva viatja, el botó es bloqueja i diu «Reservant…». És a posta: evita que un doble clic acabi en dues reserves.",
            es: "Mentre la reserva viatja, el botó es bloqueja i diu «Reservant…». És a posta: evita que un doble clic acabi en dues reserves.",
            en: "Mentre la reserva viatja, el botó es bloqueja i diu «Reservant…». És a posta: evita que un doble clic acabi en dues reserves.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Les sessions de grup",
            es: "Les sessions de grup",
            en: "Les sessions de grup",
          }),
        },
        {
          t: "p",
          text: T({
            ca: `Un Grup reduït admet ${s.groupCapacity} persones. En obrir la finestra d'una sessió de grup veus qui ja s'hi ha apuntat; a la graella del calendari no hi surt cap nom, només el comptador, perquè el calendari es veu de lluny i sense voler.`,
            es: `Un Grup reduït admet ${s.groupCapacity} persones. En obrir la finestra d'una sessió de grup veus qui ja s'hi ha apuntat; a la graella del calendari no hi surt cap nom, només el comptador, perquè el calendari es veu de lluny i sense voler.`,
            en: `Un Grup reduït admet ${s.groupCapacity} persones. En obrir la finestra d'una sessió de grup veus qui ja s'hi ha apuntat; a la graella del calendari no hi surt cap nom, només el comptador, perquè el calendari es veu de lluny i sense voler.`,
          }),
        },
        {
          t: "h",
          text: T({
            ca: "La teva sessió: consultar-la i cancel·lar-la",
            es: "La teva sessió: consultar-la i cancel·lar-la",
            en: "La teva sessió: consultar-la i cancel·lar-la",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Cliques la teva sessió al calendari i s'obre amb el detall, el botó d'afegir-la al calendari i el de cancel·lar. Cancel·lar demana una confirmació; la sessió torna al teu bo.",
            es: "Cliques la teva sessió al calendari i s'obre amb el detall, el botó d'afegir-la al calendari i el de cancel·lar. Cancel·lar demana una confirmació; la sessió torna al teu bo.",
            en: "Cliques la teva sessió al calendari i s'obre amb el detall, el botó d'afegir-la al calendari i el de cancel·lar. Cancel·lar demana una confirmació; la sessió torna al teu bo.",
          }),
        },
        {
          t: "warn",
          text: T({
            ca: `Les reserves es poden cancel·lar fins a ${s.minCancellationHours} h abans. Passat aquest punt el botó desapareix i l'app t'explica per què. Si tens una urgència, parla amb el centre (${CONTACTE_CENTRE}): la política de cancel·lació la porta el centre, no l'app.`,
            es: `Les reserves es poden cancel·lar fins a ${s.minCancellationHours} h abans. Passat aquest punt el botó desapareix i l'app t'explica per què. Si tens una urgència, parla amb el centre (${CONTACTE_CENTRE}): la política de cancel·lació la porta el centre, no l'app.`,
            en: `Les reserves es poden cancel·lar fins a ${s.minCancellationHours} h abans. Passat aquest punt el botó desapareix i l'app t'explica per què. Si tens una urgència, parla amb el centre (${CONTACTE_CENTRE}): la política de cancel·lació la porta el centre, no l'app.`,
          }),
        },
        ...(s.waitlistEnabled
          ? ([
              {
                t: "h",
                text: T({
                  ca: "La llista d'espera",
                  es: "La llista d'espera",
                  en: "La llista d'espera",
                }),
              },
              {
                t: "p",
                text: T({
                  ca: "Quan una sessió de grup està plena no és un carreró sense sortida: pots apuntar-te a la llista d'espera. Si algú cancel·la, la plaça passa a ser teva automàticament, es fa la reserva sola, es descompta la sessió del bo i t'avisem per correu.",
                  es: "Quan una sessió de grup està plena no és un carreró sense sortida: pots apuntar-te a la llista d'espera. Si algú cancel·la, la plaça passa a ser teva automàticament, es fa la reserva sola, es descompta la sessió del bo i t'avisem per correu.",
                  en: "Quan una sessió de grup està plena no és un carreró sense sortida: pots apuntar-te a la llista d'espera. Si algú cancel·la, la plaça passa a ser teva automàticament, es fa la reserva sola, es descompta la sessió del bo i t'avisem per correu.",
                }),
              },
              {
                t: "warn",
                text: T({
                  ca: "Aquest avís no es pot desactivar, i és important que el llegeixis: la reserva es fa sense que tu hi tornis a prémer res, i si no ho saps no hi vas i la sessió es crema igualment.",
                  es: "Aquest avís no es pot desactivar, i és important que el llegeixis: la reserva es fa sense que tu hi tornis a prémer res, i si no ho saps no hi vas i la sessió es crema igualment.",
                  en: "Aquest avís no es pot desactivar, i és important que el llegeixis: la reserva es fa sense que tu hi tornis a prémer res, i si no ho saps no hi vas i la sessió es crema igualment.",
                }),
              },
              {
                t: "p",
                text: T({
                  ca: "Mentre hi siguis, la franja et surt marcada com que ets a la llista, i des d'allà mateix te'n pots donar de baixa.",
                  es: "Mentre hi siguis, la franja et surt marcada com que ets a la llista, i des d'allà mateix te'n pots donar de baixa.",
                  en: "Mentre hi siguis, la franja et surt marcada com que ets a la llista, i des d'allà mateix te'n pots donar de baixa.",
                }),
              },
            ] as Block[])
          : ([
              {
                t: "note",
                text: T({
                  ca: "Ara mateix el centre no accepta inscripcions noves a la llista d'espera. Si ja n'esperaves alguna d'abans, aquella segueix el seu curs i t'avisarem igual si s'allibera la plaça.",
                  es: "Ara mateix el centre no accepta inscripcions noves a la llista d'espera. Si ja n'esperaves alguna d'abans, aquella segueix el seu curs i t'avisarem igual si s'allibera la plaça.",
                  en: "Ara mateix el centre no accepta inscripcions noves a la llista d'espera. Si ja n'esperaves alguna d'abans, aquella segueix el seu curs i t'avisarem igual si s'allibera la plaça.",
                }),
              },
            ] as Block[])),
        {
          t: "h",
          text: T({
            ca: "Repetir una sessió en bucle (les sèries)",
            es: "Repetir una sessió en bucle (les sèries)",
            en: "Repetir una sessió en bucle (les sèries)",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Si vols la mateixa franja cada setmana, no cal reservar-la una per una. Hi ha dues portes: la casella «Fer-ho recurrent» a la finestra de reservar, i el botó «Repetir en bucle a partir d'aquesta» a una sessió que ja tinguis reservada.",
            es: "Si vols la mateixa franja cada setmana, no cal reservar-la una per una. Hi ha dues portes: la casella «Fer-ho recurrent» a la finestra de reservar, i el botó «Repetir en bucle a partir d'aquesta» a una sessió que ja tinguis reservada.",
            en: "Si vols la mateixa franja cada setmana, no cal reservar-la una per una. Hi ha dues portes: la casella «Fer-ho recurrent» a la finestra de reservar, i el botó «Repetir en bucle a partir d'aquesta» a una sessió que ja tinguis reservada.",
          }),
        },
        {
          t: "ol",
          items: [
            T({
              ca: "Tries cada quant es repeteix: cada setmana, cada dues setmanes o cada mes.",
              es: "Tries cada quant es repeteix: cada setmana, cada dues setmanes o cada mes.",
              en: "Tries cada quant es repeteix: cada setmana, cada dues setmanes o cada mes.",
            }),
            T({
              ca: "Dius fins quan (una data) o quantes sessions en vols. Pots omplir-ne un o tots dos; amb tots dos, la sèrie s'atura amb el primer límit que arribi.",
              es: "Dius fins quan (una data) o quantes sessions en vols. Pots omplir-ne un o tots dos; amb tots dos, la sèrie s'atura amb el primer límit que arribi.",
              en: "Dius fins quan (una data) o quantes sessions en vols. Pots omplir-ne un o tots dos; amb tots dos, la sèrie s'atura amb el primer límit que arribi.",
            }),
            T({
              ca: "Si vols, obres «Si no hi ha plaça…» i ajustes què s'ha de fer amb les dates que estiguin ocupades.",
              es: "Si vols, obres «Si no hi ha plaça…» i ajustes què s'ha de fer amb les dates que estiguin ocupades.",
              en: "Si vols, obres «Si no hi ha plaça…» i ajustes què s'ha de fer amb les dates que estiguin ocupades.",
            }),
            T({
              ca: "Prems «Veure les sessions»: es calcula la sèrie i te l'ensenyem sencera. Encara no s'ha reservat res.",
              es: "Prems «Veure les sessions»: es calcula la sèrie i te l'ensenyem sencera. Encara no s'ha reservat res.",
              en: "Prems «Veure les sessions»: es calcula la sèrie i te l'ensenyem sencera. Encara no s'ha reservat res.",
            }),
            T({
              ca: "Revises la llista, acceptes les alternatives que t'agradin i prems «Confirmar sèrie».",
              es: "Revises la llista, acceptes les alternatives que t'agradin i prems «Confirmar sèrie».",
              en: "Revises la llista, acceptes les alternatives que t'agradin i prems «Confirmar sèrie».",
            }),
          ],
        },
        {
          t: "note",
          text: T({
            ca: "Fins que no prems «Confirmar sèrie» no es reserva absolutament res. El pas de revisió és exactament perquè puguis veure on cauen les sessions abans de comprometre-les.",
            es: "Fins que no prems «Confirmar sèrie» no es reserva absolutament res. El pas de revisió és exactament perquè puguis veure on cauen les sessions abans de comprometre-les.",
            en: "Fins que no prems «Confirmar sèrie» no es reserva absolutament res. El pas de revisió és exactament perquè puguis veure on cauen les sessions abans de comprometre-les.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Les opcions de «Si no hi ha plaça…»",
            es: "Les opcions de «Si no hi ha plaça…»",
            en: "Les opcions de «Si no hi ha plaça…»",
          }),
        },
        {
          t: "dl",
          items: [
            [
              T({
                ca: "Reservar només les disponibles",
                es: "Reservar només les disponibles",
                en: "Reservar només les disponibles",
              }),
              T({
                ca: "Ve marcada per defecte. Només es confirmen les dates amb plaça i la resta es descarten. Té prioritat sobre les altres dues.",
                es: "Ve marcada per defecte. Només es confirmen les dates amb plaça i la resta es descarten. Té prioritat sobre les altres dues.",
                en: "Ve marcada per defecte. Només es confirmen les dates amb plaça i la resta es descarten. Té prioritat sobre les altres dues.",
              }),
            ],
            [
              T({
                ca: "Proposar alternatives automàtiques",
                es: "Proposar alternatives automàtiques",
                en: "Proposar alternatives automàtiques",
              }),
              T({
                ca: "Per a les dates ocupades et suggerim la millor alternativa possible (una altra hora o un altre professional) i decideixes tu si l'acceptes, una per una.",
                es: "Per a les dates ocupades et suggerim la millor alternativa possible (una altra hora o un altre professional) i decideixes tu si l'acceptes, una per una.",
                en: "Per a les dates ocupades et suggerim la millor alternativa possible (una altra hora o un altre professional) i decideixes tu si l'acceptes, una per una.",
              }),
            ],
            ...(s.waitlistEnabled
              ? ([
                  [
                    T({
                      ca: "Afegir a la llista d'espera si no hi ha plaça",
                      es: "Afegir a la llista d'espera si no hi ha plaça",
                      en: "Afegir a la llista d'espera si no hi ha plaça",
                    }),
                    T({
                      ca: "Les dates plenes no es descarten: t'apuntem a la cua i, si algú cancel·la, la plaça és teva.",
                      es: "Les dates plenes no es descarten: t'apuntem a la cua i, si algú cancel·la, la plaça és teva.",
                      en: "Les dates plenes no es descarten: t'apuntem a la cua i, si algú cancel·la, la plaça és teva.",
                    }),
                  ],
                ] as [string, string][])
              : []),
            ...(s.subscriptionsEnabled
              ? ([
                  [
                    T({
                      ca: "Allargar-la sola cada mes",
                      es: "Allargar-la sola cada mes",
                      en: "Allargar-la sola cada mes",
                    }),
                    T({
                      ca: "Només surt si tens subscripció. Quan es renovi, es reserven soles les sessions que faltaven seguint el mateix patró. Si aquell mes la franja està ocupada, aquella sessió no es fa: mai se't canvia l'hora sense dir-t'ho.",
                      es: "Només surt si tens subscripció. Quan es renovi, es reserven soles les sessions que faltaven seguint el mateix patró. Si aquell mes la franja està ocupada, aquella sessió no es fa: mai se't canvia l'hora sense dir-t'ho.",
                      en: "Només surt si tens subscripció. Quan es renovi, es reserven soles les sessions que faltaven seguint el mateix patró. Si aquell mes la franja està ocupada, aquella sessió no es fa: mai se't canvia l'hora sense dir-t'ho.",
                    }),
                  ],
                ] as [string, string][])
              : []),
          ],
        },
        {
          t: "h",
          text: T({
            ca: "Llegir la revisió de la sèrie",
            es: "Llegir la revisió de la sèrie",
            en: "Llegir la revisió de la sèrie",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Cada data de la llista porta una etiqueta:",
            es: "Cada data de la llista porta una etiqueta:",
            en: "Cada data de la llista porta una etiqueta:",
          }),
        },
        {
          t: "dl",
          items: [
            [
              T({ ca: "Confirmada", es: "Confirmada", en: "Confirmada" }),
              T({
                ca: "Hi ha plaça i es reservarà.",
                es: "Hi ha plaça i es reservarà.",
                en: "Hi ha plaça i es reservarà.",
              }),
            ],
            [
              T({ ca: "Ja reservada", es: "Ja reservada", en: "Ja reservada" }),
              T({
                ca: "Aquella sessió ja la tenies. No es duplica: s'adopta a la sèrie, i si un dia cancel·les la sèrie sencera, se n'anirà amb ella.",
                es: "Aquella sessió ja la tenies. No es duplica: s'adopta a la sèrie, i si un dia cancel·les la sèrie sencera, se n'anirà amb ella.",
                en: "Aquella sessió ja la tenies. No es duplica: s'adopta a la sèrie, i si un dia cancel·les la sèrie sencera, se n'anirà amb ella.",
              }),
            ],
            [
              T({
                ca: "Alternativa proposada",
                es: "Alternativa proposada",
                en: "Alternativa proposada",
              }),
              T({
                ca: "L'original està ocupada i te'n proposem una altra. No compta fins que prems «Accepta».",
                es: "L'original està ocupada i te'n proposem una altra. No compta fins que prems «Accepta».",
                en: "L'original està ocupada i te'n proposem una altra. No compta fins que prems «Accepta».",
              }),
            ],
            [
              T({
                ca: "Llista d'espera",
                es: "Llista d'espera",
                en: "Llista d'espera",
              }),
              T({
                ca: "T'apuntarem a la cua d'aquella sessió.",
                es: "T'apuntarem a la cua d'aquella sessió.",
                en: "T'apuntarem a la cua d'aquella sessió.",
              }),
            ],
            [
              T({ ca: "Sense places", es: "Sense places", en: "Sense places" }),
              T({
                ca: "No es reservarà.",
                es: "No es reservarà.",
                en: "No es reservarà.",
              }),
            ],
          ],
        },
        {
          t: "p",
          text: T({
            ca: "A sota hi ha el recompte i, si el bo no arriba per a totes, t'ho diem abans de confirmar: quantes es reserven ara i quantes queden fora. Si tens subscripció, les que no hi caben no es perden, es reservaran quan es renovi.",
            es: "A sota hi ha el recompte i, si el bo no arriba per a totes, t'ho diem abans de confirmar: quantes es reserven ara i quantes queden fora. Si tens subscripció, les que no hi caben no es perden, es reservaran quan es renovi.",
            en: "A sota hi ha el recompte i, si el bo no arriba per a totes, t'ho diem abans de confirmar: quantes es reserven ara i quantes queden fora. Si tens subscripció, les que no hi caben no es perden, es reservaran quan es renovi.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Les meves sèries",
            es: "Les meves sèries",
            en: "Les meves sèries",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Les sèries vives surten en un bloc a dalt de la pantalla de Reserves, amb la freqüència, quantes sessions queden pendents i quina és la pròxima. Des d'allà pots cancel·lar-ne una de sencera.",
            es: "Les sèries vives surten en un bloc a dalt de la pantalla de Reserves, amb la freqüència, quantes sessions queden pendents i quina és la pròxima. Des d'allà pots cancel·lar-ne una de sencera.",
            en: "Les sèries vives surten en un bloc a dalt de la pantalla de Reserves, amb la freqüència, quantes sessions queden pendents i quina és la pròxima. Des d'allà pots cancel·lar-ne una de sencera.",
          }),
        },
        {
          t: "warn",
          text: T({
            ca: `Cancel·lar la sèrie anul·la totes les sessions futures d'aquella sèrie i les torna al teu bo. Les que ja siguin a menys de ${s.minCancellationHours} h es queden com estaven, i l'app et diu quantes n'han quedat.`,
            es: `Cancel·lar la sèrie anul·la totes les sessions futures d'aquella sèrie i les torna al teu bo. Les que ja siguin a menys de ${s.minCancellationHours} h es queden com estaven, i l'app et diu quantes n'han quedat.`,
            en: `Cancel·lar la sèrie anul·la totes les sessions futures d'aquella sèrie i les torna al teu bo. Les que ja siguin a menys de ${s.minCancellationHours} h es queden com estaven, i l'app et diu quantes n'han quedat.`,
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Sessions passades",
            es: "Sessions passades",
            en: "Sessions passades",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Al final d'aquesta mateixa pantalla, sota el calendari, hi ha les sessions que ja has fet. És on pots mirar enrere: la data, el servei i amb qui la vas fer.",
            es: "Al final d'aquesta mateixa pantalla, sota el calendari, hi ha les sessions que ja has fet. És on pots mirar enrere: la data, el servei i amb qui la vas fer.",
            en: "Al final d'aquesta mateixa pantalla, sota el calendari, hi ha les sessions que ja has fet. És on pots mirar enrere: la data, el servei i amb qui la vas fer.",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Si el teu professional hi ha deixat una nota de la sessió, la veuràs allà mateix, signada amb el seu nom i la data. No totes en tenen: la nota és opcional i l'escriu qui vol.",
            es: "Si el teu professional hi ha deixat una nota de la sessió, la veuràs allà mateix, signada amb el seu nom i la data. No totes en tenen: la nota és opcional i l'escriu qui vol.",
            en: "Si el teu professional hi ha deixat una nota de la sessió, la veuràs allà mateix, signada amb el seu nom i la data. No totes en tenen: la nota és opcional i l'escriu qui vol.",
          }),
        },
      ],
    },

    // ─────────────────────────── 5 ───────────────────────────
    {
      id: "exercicis",
      title: T({ ca: "Exercicis", es: "Exercicis", en: "Exercicis" }),
      blocks: [
        {
          t: "p",
          text: T({
            ca: "Dues coses a la mateixa pantalla: el que el teu professional t'ha posat a tu, i tot el que hi ha a la biblioteca del centre. Les de dalt van amb un accent lila justament perquè es distingeixin d'un cop d'ull.",
            es: "Dues coses a la mateixa pantalla: el que el teu professional t'ha posat a tu, i tot el que hi ha a la biblioteca del centre. Les de dalt van amb un accent lila justament perquè es distingeixin d'un cop d'ull.",
            en: "Dues coses a la mateixa pantalla: el que el teu professional t'ha posat a tu, i tot el que hi ha a la biblioteca del centre. Les de dalt van amb un accent lila justament perquè es distingeixin d'un cop d'ull.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Els teus exercicis",
            es: "Els teus exercicis",
            en: "Els teus exercicis",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Cada targeta porta el nom de l'exercici, la seva categoria i, si n'hi ha, la nota que t'hi ha escrit el professional. Aquella nota és una instrucció per a tu, no una descripció del catàleg: hi surt sencera i destacada.",
            es: "Cada targeta porta el nom de l'exercici, la seva categoria i, si n'hi ha, la nota que t'hi ha escrit el professional. Aquella nota és una instrucció per a tu, no una descripció del catàleg: hi surt sencera i destacada.",
            en: "Cada targeta porta el nom de l'exercici, la seva categoria i, si n'hi ha, la nota que t'hi ha escrit el professional. Aquella nota és una instrucció per a tu, no una descripció del catàleg: hi surt sencera i destacada.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "El teu progrés",
            es: "El teu progrés",
            en: "El teu progrés",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Sota cada exercici assignat hi ha l'històric que s'ha anat registrant: la data, el pes en quilos, les repeticions i qualsevol comentari. Els registres els posa el professional; tu els consultes.",
            es: "Sota cada exercici assignat hi ha l'històric que s'ha anat registrant: la data, el pes en quilos, les repeticions i qualsevol comentari. Els registres els posa el professional; tu els consultes.",
            en: "Sota cada exercici assignat hi ha l'històric que s'ha anat registrant: la data, el pes en quilos, les repeticions i qualsevol comentari. Els registres els posa el professional; tu els consultes.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "La biblioteca del centre",
            es: "La biblioteca del centre",
            en: "La biblioteca del centre",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Tots els altres exercicis del centre, per consultar. Hi ha un cercador per nom o descripció i un filtre per categoria. Els que tenen vídeo el porten a la mateixa targeta: s'obre en una finestra sense sortir de la pàgina.",
            es: "Tots els altres exercicis del centre, per consultar. Hi ha un cercador per nom o descripció i un filtre per categoria. Els que tenen vídeo el porten a la mateixa targeta: s'obre en una finestra sense sortir de la pàgina.",
            en: "Tots els altres exercicis del centre, per consultar. Hi ha un cercador per nom o descripció i un filtre per categoria. Els que tenen vídeo el porten a la mateixa targeta: s'obre en una finestra sense sortir de la pàgina.",
          }),
        },
        {
          t: "note",
          text: T({
            ca: "La biblioteca és de només lectura. Els exercicis els crea i els assigna el centre; des d'aquí no se'n pot afegir ni modificar cap.",
            es: "La biblioteca és de només lectura. Els exercicis els crea i els assigna el centre; des d'aquí no se'n pot afegir ni modificar cap.",
            en: "La biblioteca és de només lectura. Els exercicis els crea i els assigna el centre; des d'aquí no se'n pot afegir ni modificar cap.",
          }),
        },
      ],
    },

    // ─────────────────────────── 6 ───────────────────────────
    {
      id: "documents",
      title: T({ ca: "Documents", es: "Documents", en: "Documents" }),
      when: s.modules.documents,
      blocks: [
        {
          t: "p",
          text: T({
            ca: "Un lloc per guardar el que té a veure amb el teu seguiment: informes mèdics, radiografies, resultats de proves, el que sigui. Ho pots consultar tu i el teu professional, ningú més.",
            es: "Un lloc per guardar el que té a veure amb el teu seguiment: informes mèdics, radiografies, resultats de proves, el que sigui. Ho pots consultar tu i el teu professional, ningú més.",
            en: "Un lloc per guardar el que té a veure amb el teu seguiment: informes mèdics, radiografies, resultats de proves, el que sigui. Ho pots consultar tu i el teu professional, ningú més.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Pujar un document",
            es: "Pujar un document",
            en: "Pujar un document",
          }),
        },
        {
          t: "p",
          text: T({
            ca: `Amb «+ Pujar document». S'accepten PDF, imatges (JPG, PNG, HEIC) i Word, fins a ${s.documentsMaxMb} MB per fitxer. Pots afegir-hi una descripció curta —per exemple «Informe de la ressonància del genoll»— que és el que després et permetrà distingir-los d'un cop d'ull.`,
            es: `Amb «+ Pujar document». S'accepten PDF, imatges (JPG, PNG, HEIC) i Word, fins a ${s.documentsMaxMb} MB per fitxer. Pots afegir-hi una descripció curta —per exemple «Informe de la ressonància del genoll»— que és el que després et permetrà distingir-los d'un cop d'ull.`,
            en: `Amb «+ Pujar document». S'accepten PDF, imatges (JPG, PNG, HEIC) i Word, fins a ${s.documentsMaxMb} MB per fitxer. Pots afegir-hi una descripció curta —per exemple «Informe de la ressonància del genoll»— que és el que després et permetrà distingir-los d'un cop d'ull.`,
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Consultar-los i esborrar-los",
            es: "Consultar-los i esborrar-los",
            en: "Consultar-los i esborrar-los",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Cada document de la llista es pot descarregar i esborrar. L'esborrat demana confirmació i no té marxa enrere: el fitxer se'n va de debò.",
            es: "Cada document de la llista es pot descarregar i esborrar. L'esborrat demana confirmació i no té marxa enrere: el fitxer se'n va de debò.",
            en: "Cada document de la llista es pot descarregar i esborrar. L'esborrat demana confirmació i no té marxa enrere: el fitxer se'n va de debò.",
          }),
        },
        {
          t: "note",
          text: T({
            ca: "Si el fitxer és massa gros o té un format que no acceptem, l'app t'ho diu abans d'intentar pujar-lo, no després.",
            es: "Si el fitxer és massa gros o té un format que no acceptem, l'app t'ho diu abans d'intentar pujar-lo, no després.",
            en: "Si el fitxer és massa gros o té un format que no acceptem, l'app t'ho diu abans d'intentar pujar-lo, no després.",
          }),
        },
      ],
    },

    // ─────────────────────────── 7 ───────────────────────────
    {
      id: "comunitat",
      title: T({ ca: "Comunitat", es: "Comunitat", en: "Comunitat" }),
      when: s.modules.comunitat,
      blocks: [
        {
          t: "p",
          text: T({
            ca: "El tauler del centre: anuncis, novetats i enquestes. Els més recents també et surten a l'Inici, així que no cal entrar-hi cada dia.",
            es: "El tauler del centre: anuncis, novetats i enquestes. Els més recents també et surten a l'Inici, així que no cal entrar-hi cada dia.",
            en: "El tauler del centre: anuncis, novetats i enquestes. Els més recents també et surten a l'Inici, així que no cal entrar-hi cada dia.",
          }),
        },
        { t: "h", text: T({ ca: "Anuncis", es: "Anuncis", en: "Anuncis" }) },
        {
          t: "p",
          text: T({
            ca: "Publicacions del centre, de la més nova a la més antiga, amb la data i qui les signa. La més recent va marcada com a novetat. No s'hi respon: són avisos d'una banda cap a l'altra.",
            es: "Publicacions del centre, de la més nova a la més antiga, amb la data i qui les signa. La més recent va marcada com a novetat. No s'hi respon: són avisos d'una banda cap a l'altra.",
            en: "Publicacions del centre, de la més nova a la més antiga, amb la data i qui les signa. La més recent va marcada com a novetat. No s'hi respon: són avisos d'una banda cap a l'altra.",
          }),
        },
        {
          t: "h",
          text: T({ ca: "Enquestes", es: "Enquestes", en: "Enquestes" }),
        },
        {
          t: "p",
          text: T({
            ca: "De tant en tant el centre obre una enquesta. Algunes deixen triar una sola opció i altres diverses; l'enunciat t'ho diu. Un cop enviada la resposta veus el repartiment de vots, si n'hi ha.",
            es: "De tant en tant el centre obre una enquesta. Algunes deixen triar una sola opció i altres diverses; l'enunciat t'ho diu. Un cop enviada la resposta veus el repartiment de vots, si n'hi ha.",
            en: "De tant en tant el centre obre una enquesta. Algunes deixen triar una sola opció i altres diverses; l'enunciat t'ho diu. Un cop enviada la resposta veus el repartiment de vots, si n'hi ha.",
          }),
        },
        {
          t: "warn",
          text: T({
            ca: "El vot no es pot canviar un cop enviat. Si l'enquesta té data de tancament, hi surt; passada, ja no accepta respostes.",
            es: "El vot no es pot canviar un cop enviat. Si l'enquesta té data de tancament, hi surt; passada, ja no accepta respostes.",
            en: "El vot no es pot canviar un cop enviat. Si l'enquesta té data de tancament, hi surt; passada, ja no accepta respostes.",
          }),
        },
      ],
    },

    // ─────────────────────────── 8 ───────────────────────────
    {
      id: "regala-vindi",
      title: T({ ca: "Regala Vindi", es: "Regala Vindi", en: "Regala Vindi" }),
      when: s.giftVouchersEnabled,
      blocks: [
        {
          t: "p",
          text: T({
            ca: "Un val de regal és el mateix paquet de sessions que compraries per a tu, però amb un codi perquè el faci servir una altra persona. S'hi arriba des de la targeta de l'Inici o des del final de la pantalla de Bons.",
            es: "Un val de regal és el mateix paquet de sessions que compraries per a tu, però amb un codi perquè el faci servir una altra persona. S'hi arriba des de la targeta de l'Inici o des del final de la pantalla de Bons.",
            en: "Un val de regal és el mateix paquet de sessions que compraries per a tu, però amb un codi perquè el faci servir una altra persona. S'hi arriba des de la targeta de l'Inici o des del final de la pantalla de Bons.",
          }),
        },
        {
          t: "h",
          text: T({ ca: "Comprar-lo", es: "Comprar-lo", en: "Comprar-lo" }),
        },
        {
          t: "ol",
          items: [
            T({
              ca: "Tries el servei.",
              es: "Tries el servei.",
              en: "Tries el servei.",
            }),
            T({
              ca: "Tries el paquet.",
              es: "Tries el paquet.",
              en: "Tries el paquet.",
            }),
            T({
              ca: "Si vols, hi poses el nom de qui el rep, el seu correu i una dedicatòria. Tot això és opcional.",
              es: "Si vols, hi poses el nom de qui el rep, el seu correu i una dedicatòria. Tot això és opcional.",
              en: "Si vols, hi poses el nom de qui el rep, el seu correu i una dedicatòria. Tot això és opcional.",
            }),
            s.cardPayments
              ? T({
                  ca: "Tries si el pagues al centre o amb targeta, i confirmes.",
                  es: "Tries si el pagues al centre o amb targeta, i confirmes.",
                  en: "Tries si el pagues al centre o amb targeta, i confirmes.",
                })
              : T({
                  ca: "Confirmes; el pagaràs al centre.",
                  es: "Confirmes; el pagaràs al centre.",
                  en: "Confirmes; el pagaràs al centre.",
                }),
          ],
        },
        {
          t: "note",
          text: T({
            ca: "El nom que hi posis surt imprès al val, però no limita qui el pot bescanviar: qui tingui el codi el podrà fer servir. Un val és al portador.",
            es: "El nom que hi posis surt imprès al val, però no limita qui el pot bescanviar: qui tingui el codi el podrà fer servir. Un val és al portador.",
            en: "El nom que hi posis surt imprès al val, però no limita qui el pot bescanviar: qui tingui el codi el podrà fer servir. Un val és al portador.",
          }),
        },
        {
          t: "note",
          text: T({
            ca: "Els vals es paguen sempre a preu de catàleg. Si tu tens un descompte personal, no s'aplica aquí: el descompte és teu, i el val canvia de mans.",
            es: "Els vals es paguen sempre a preu de catàleg. Si tu tens un descompte personal, no s'aplica aquí: el descompte és teu, i el val canvia de mans.",
            en: "Els vals es paguen sempre a preu de catàleg. Si tu tens un descompte personal, no s'aplica aquí: el descompte és teu, i el val canvia de mans.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "El codi i com fer-l'hi arribar",
            es: "El codi i com fer-l'hi arribar",
            en: "El codi i com fer-l'hi arribar",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Un cop creat, l'app t'ensenya el codi i te'l deixa copiar. Tens tres maneres de donar-l'hi: copiar el codi i enviar-l'hi tu, descarregar el val en PDF per imprimir-lo o donar-l'hi en persona, o enviar-l'hi per correu des de la mateixa pantalla —li arriba el codi i les instruccions per fer-lo servir.",
            es: "Un cop creat, l'app t'ensenya el codi i te'l deixa copiar. Tens tres maneres de donar-l'hi: copiar el codi i enviar-l'hi tu, descarregar el val en PDF per imprimir-lo o donar-l'hi en persona, o enviar-l'hi per correu des de la mateixa pantalla —li arriba el codi i les instruccions per fer-lo servir.",
            en: "Un cop creat, l'app t'ensenya el codi i te'l deixa copiar. Tens tres maneres de donar-l'hi: copiar el codi i enviar-l'hi tu, descarregar el val en PDF per imprimir-lo o donar-l'hi en persona, o enviar-l'hi per correu des de la mateixa pantalla —li arriba el codi i les instruccions per fer-lo servir.",
          }),
        },
        ...(s.cardPayments
          ? ([
              {
                t: "warn",
                text: T({
                  ca: "Si el pagues al centre, el val es genera i el pots descarregar de seguida, però no serà bescanviable fins que el centre confirmi el cobrament. Si el pagues amb targeta, neix ja bescanviable.",
                  es: "Si el pagues al centre, el val es genera i el pots descarregar de seguida, però no serà bescanviable fins que el centre confirmi el cobrament. Si el pagues amb targeta, neix ja bescanviable.",
                  en: "Si el pagues al centre, el val es genera i el pots descarregar de seguida, però no serà bescanviable fins que el centre confirmi el cobrament. Si el pagues amb targeta, neix ja bescanviable.",
                }),
              },
            ] as Block[])
          : ([
              {
                t: "warn",
                text: T({
                  ca: "El val es genera i el pots descarregar de seguida, però no serà bescanviable fins que el paguis al centre i s'hi confirmi el cobrament.",
                  es: "El val es genera i el pots descarregar de seguida, però no serà bescanviable fins que el paguis al centre i s'hi confirmi el cobrament.",
                  en: "El val es genera i el pots descarregar de seguida, però no serà bescanviable fins que el paguis al centre i s'hi confirmi el cobrament.",
                }),
              },
            ] as Block[])),
        {
          t: "h",
          text: T({
            ca: "Els vals que has regalat",
            es: "Els vals que has regalat",
            en: "Els vals que has regalat",
          }),
        },
        {
          t: "p",
          text: T({
            ca: `Al final de la pantalla hi ha la llista dels que has comprat, amb el codi, el paquet, l'import, l'estat i la data. Des d'allà els pots tornar a descarregar sempre que vulguis. Els vals valen ${s.giftVoucherExpiryMonths} mesos des de la compra.`,
            es: `Al final de la pantalla hi ha la llista dels que has comprat, amb el codi, el paquet, l'import, l'estat i la data. Des d'allà els pots tornar a descarregar sempre que vulguis. Els vals valen ${s.giftVoucherExpiryMonths} mesos des de la compra.`,
            en: `Al final de la pantalla hi ha la llista dels que has comprat, amb el codi, el paquet, l'import, l'estat i la data. Des d'allà els pots tornar a descarregar sempre que vulguis. Els vals valen ${s.giftVoucherExpiryMonths} mesos des de la compra.`,
          }),
        },
        {
          t: "dl",
          items: [
            [
              T({
                ca: "Pendent de pagament",
                es: "Pendent de pagament",
                en: "Pendent de pagament",
              }),
              T({
                ca: "Encara no s'ha cobrat: no es pot bescanviar.",
                es: "Encara no s'ha cobrat: no es pot bescanviar.",
                en: "Encara no s'ha cobrat: no es pot bescanviar.",
              }),
            ],
            [
              T({ ca: "Actiu", es: "Actiu", en: "Actiu" }),
              T({
                ca: "Pagat i esperant que algú l'utilitzi.",
                es: "Pagat i esperant que algú l'utilitzi.",
                en: "Pagat i esperant que algú l'utilitzi.",
              }),
            ],
            [
              T({ ca: "Bescanviat", es: "Bescanviat", en: "Bescanviat" }),
              T({
                ca: "Ja s'ha fet servir. Et vam avisar per correu quan va passar.",
                es: "Ja s'ha fet servir. Et vam avisar per correu quan va passar.",
                en: "Ja s'ha fet servir. Et vam avisar per correu quan va passar.",
              }),
            ],
            [
              T({ ca: "Caducat", es: "Caducat", en: "Caducat" }),
              T({
                ca: "Ha passat la data de validesa sense fer-se servir.",
                es: "Ha passat la data de validesa sense fer-se servir.",
                en: "Ha passat la data de validesa sense fer-se servir.",
              }),
            ],
            [
              T({ ca: "Anul·lat", es: "Anul·lat", en: "Anul·lat" }),
              T({
                ca: "L'ha anul·lat el centre.",
                es: "L'ha anul·lat el centre.",
                en: "L'ha anul·lat el centre.",
              }),
            ],
          ],
        },
      ],
    },

    // ─────────────────────────── 9 ───────────────────────────
    {
      id: "porta-un-amic",
      title: T({
        ca: "Porta un amic",
        es: "Porta un amic",
        en: "Porta un amic",
      }),
      when: s.referralProgramActive,
      blocks: [
        {
          t: "p",
          text: T({
            ca: `Tens un codi de referit personal. Quan algú es registri amb ell i pagui el seu primer bo, ${s.referralRewardReferee ? "tots dos rebeu" : "reps"} un ${s.referralDiscountPercent}% de descompte a la propera compra.`,
            es: `Tens un codi de referit personal. Quan algú es registri amb ell i pagui el seu primer bo, ${s.referralRewardReferee ? "tots dos rebeu" : "reps"} un ${s.referralDiscountPercent}% de descompte a la propera compra.`,
            en: `Tens un codi de referit personal. Quan algú es registri amb ell i pagui el seu primer bo, ${s.referralRewardReferee ? "tots dos rebeu" : "reps"} un ${s.referralDiscountPercent}% de descompte a la propera compra.`,
          }),
        },
        {
          t: "h",
          text: T({
            ca: "On és el teu codi",
            es: "On és el teu codi",
            en: "On és el teu codi",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "A dos llocs, i és el mateix: la targeta «Porta un amic» de l'Inici, que l'obre en una finestra amb el botó de copiar, i Configuració → Dades personals, on hi ha també el compte d'amics que ja has portat.",
            es: "A dos llocs, i és el mateix: la targeta «Porta un amic» de l'Inici, que l'obre en una finestra amb el botó de copiar, i Configuració → Dades personals, on hi ha també el compte d'amics que ja has portat.",
            en: "A dos llocs, i és el mateix: la targeta «Porta un amic» de l'Inici, que l'obre en una finestra amb el botó de copiar, i Configuració → Dades personals, on hi ha també el compte d'amics que ja has portat.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Com s'aplica el descompte",
            es: "Com s'aplica el descompte",
            en: "Com s'aplica el descompte",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Sol, quan compris. A la pantalla de compra t'apareix un avís dient que el tens i si s'aplica o no. Si el paquet ja té una oferta millor, s'aplica l'oferta i el teu descompte de referit es guarda per a la següent compra: no es perd ni se sumen l'un amb l'altre.",
            es: "Sol, quan compris. A la pantalla de compra t'apareix un avís dient que el tens i si s'aplica o no. Si el paquet ja té una oferta millor, s'aplica l'oferta i el teu descompte de referit es guarda per a la següent compra: no es perd ni se sumen l'un amb l'altre.",
            en: "Sol, quan compris. A la pantalla de compra t'apareix un avís dient que el tens i si s'aplica o no. Si el paquet ja té una oferta millor, s'aplica l'oferta i el teu descompte de referit es guarda per a la següent compra: no es perd ni se sumen l'un amb l'altre.",
          }),
        },
      ],
    },

    // ─────────────────────────── 10 ───────────────────────────
    {
      id: "configuracio",
      title: T({ ca: "Configuració", es: "Configuració", en: "Configuració" }),
      blocks: [
        {
          t: "p",
          text: T({
            ca: "Quatre pestanyes: Dades personals, Privacitat, Notificacions i Compte.",
            es: "Quatre pestanyes: Dades personals, Privacitat, Notificacions i Compte.",
            en: "Quatre pestanyes: Dades personals, Privacitat, Notificacions i Compte.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Dades personals",
            es: "Dades personals",
            en: "Dades personals",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "El nom complet i el telèfon són obligatoris; la resta —data de naixement, alçada, pes, gènere, contacte d'emergència i el teu objectiu— els omples si vols. Els camps obligatoris porten un asterisc i el formulari no es desa sense ells.",
            es: "El nom complet i el telèfon són obligatoris; la resta —data de naixement, alçada, pes, gènere, contacte d'emergència i el teu objectiu— els omples si vols. Els camps obligatoris porten un asterisc i el formulari no es desa sense ells.",
            en: "El nom complet i el telèfon són obligatoris; la resta —data de naixement, alçada, pes, gènere, contacte d'emergència i el teu objectiu— els omples si vols. Els camps obligatoris porten un asterisc i el formulari no es desa sense ells.",
          }),
        },
        {
          t: "note",
          text: T({
            ca: "Si el teu compte és d'abans que el telèfon fos obligatori, el tindràs buit i el formulari te'l demanarà el primer cop que hi desis res. No és un error.",
            es: "Si el teu compte és d'abans que el telèfon fos obligatori, el tindràs buit i el formulari te'l demanarà el primer cop que hi desis res. No és un error.",
            en: "Si el teu compte és d'abans que el telèfon fos obligatori, el tindràs buit i el formulari te'l demanarà el primer cop que hi desis res. No és un error.",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "El correu electrònic hi surt, però no s'hi pot tocar: és la teva credencial d'accés i es canvia a la pestanya «Compte».",
            es: "El correu electrònic hi surt, però no s'hi pot tocar: és la teva credencial d'accés i es canvia a la pestanya «Compte».",
            en: "El correu electrònic hi surt, però no s'hi pot tocar: és la teva credencial d'accés i es canvia a la pestanya «Compte».",
          }),
        },
        { t: "h", text: T({ ca: "Idioma", es: "Idioma", en: "Idioma" }) },
        {
          t: "p",
          text: T({
            ca: "A la mateixa pestanya, a dalt, sota «Preferències». Es desa sol en triar-lo, sense passar pel botó de desar, i el canvi és immediat.",
            es: "A la mateixa pestanya, a dalt, sota «Preferències». Es desa sol en triar-lo, sense passar pel botó de desar, i el canvi és immediat.",
            en: "A la mateixa pestanya, a dalt, sota «Preferències». Es desa sol en triar-lo, sense passar pel botó de desar, i el canvi és immediat.",
          }),
        },
        {
          t: "h",
          text: T({ ca: "Privacitat", es: "Privacitat", en: "Privacitat" }),
        },
        {
          t: "p",
          text: T({
            ca: "Aquí veus què has acceptat i quan: la data i la versió de la Política de Privacitat i l'Avís Legal que vas acceptar en registrar-te.",
            es: "Aquí veus què has acceptat i quan: la data i la versió de la Política de Privacitat i l'Avís Legal que vas acceptar en registrar-te.",
            en: "Aquí veus què has acceptat i quan: la data i la versió de la Política de Privacitat i l'Avís Legal que vas acceptar en registrar-te.",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "A sota hi ha el consentiment per al tractament de dades de salut, que fa falta si reps fisioteràpia. Si encara no l'has donat, hi ha la casella per fer-ho. Un cop donat, hi consta la data; per revocar-lo cal escriure al centre.",
            es: "A sota hi ha el consentiment per al tractament de dades de salut, que fa falta si reps fisioteràpia. Si encara no l'has donat, hi ha la casella per fer-ho. Un cop donat, hi consta la data; per revocar-lo cal escriure al centre.",
            en: "A sota hi ha el consentiment per al tractament de dades de salut, que fa falta si reps fisioteràpia. Si encara no l'has donat, hi ha la casella per fer-ho. Un cop donat, hi consta la data; per revocar-lo cal escriure al centre.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Notificacions",
            es: "Notificacions",
            en: "Notificacions",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Una llista d'avisos amb una casella «Email» a cada un. Marca els que vols rebre i prem «Desar preferències».",
            es: "Una llista d'avisos amb una casella «Email» a cada un. Marca els que vols rebre i prem «Desar preferències».",
            en: "Una llista d'avisos amb una casella «Email» a cada un. Marca els que vols rebre i prem «Desar preferències».",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "No hi surten tots els correus que et podem enviar, i és a posta. Alguns avisos s'envien sempre, sense casella. El criteri és aquest: és obligatori l'avís que et diu una cosa JA FETA, que no has provocat tu en aquell moment, i que no podries descobrir mirant l'app.",
            es: "No hi surten tots els correus que et podem enviar, i és a posta. Alguns avisos s'envien sempre, sense casella. El criteri és aquest: és obligatori l'avís que et diu una cosa JA FETA, que no has provocat tu en aquell moment, i que no podries descobrir mirant l'app.",
            en: "No hi surten tots els correus que et podem enviar, i és a posta. Alguns avisos s'envien sempre, sense casella. El criteri és aquest: és obligatori l'avís que et diu una cosa JA FETA, que no has provocat tu en aquell moment, i que no podries descobrir mirant l'app.",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Per això la reserva cancel·lada s'envia sempre i la confirmada no: una reserva que existeix la pots veure quan vulguis; una que ja no existeix, no. Al capítol següent tens la llista sencera amb quins es poden apagar i quins no.",
            es: "Per això la reserva cancel·lada s'envia sempre i la confirmada no: una reserva que existeix la pots veure quan vulguis; una que ja no existeix, no. Al capítol següent tens la llista sencera amb quins es poden apagar i quins no.",
            en: "Per això la reserva cancel·lada s'envia sempre i la confirmada no: una reserva que existeix la pots veure quan vulguis; una que ja no existeix, no. Al capítol següent tens la llista sencera amb quins es poden apagar i quins no.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Compte: canviar el correu d'accés",
            es: "Compte: canviar el correu d'accés",
            en: "Compte: canviar el correu d'accés",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "El correu és amb què entres i on reps els avisos, així que canviar-lo va per un camí propi i en dos passos:",
            es: "El correu és amb què entres i on reps els avisos, així que canviar-lo va per un camí propi i en dos passos:",
            en: "El correu és amb què entres i on reps els avisos, així que canviar-lo va per un camí propi i en dos passos:",
          }),
        },
        {
          t: "ol",
          items: [
            T({
              ca: "Escrius el correu nou i la teva contrasenya actual —te la demanem per assegurar-nos que ets tu.",
              es: "Escrius el correu nou i la teva contrasenya actual —te la demanem per assegurar-nos que ets tu.",
              en: "Escrius el correu nou i la teva contrasenya actual —te la demanem per assegurar-nos que ets tu.",
            }),
            T({
              ca: "T'enviem un enllaç a la bústia NOVA. Fins que no l'obris des d'allà, el canvi no es fa i segueixes entrant amb el correu de sempre.",
              es: "T'enviem un enllaç a la bústia NOVA. Fins que no l'obris des d'allà, el canvi no es fa i segueixes entrant amb el correu de sempre.",
              en: "T'enviem un enllaç a la bústia NOVA. Fins que no l'obris des d'allà, el canvi no es fa i segueixes entrant amb el correu de sempre.",
            }),
          ],
        },
        {
          t: "p",
          text: T({
            ca: "Mentre la petició està pendent, l'app t'ho recorda i te la deixa anul·lar. El correu antic també rep un avís que algú ha demanat el canvi: si no has estat tu, és com te n'assabentes.",
            es: "Mentre la petició està pendent, l'app t'ho recorda i te la deixa anul·lar. El correu antic també rep un avís que algú ha demanat el canvi: si no has estat tu, és com te n'assabentes.",
            en: "Mentre la petició està pendent, l'app t'ho recorda i te la deixa anul·lar. El correu antic també rep un avís que algú ha demanat el canvi: si no has estat tu, és com te n'assabentes.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Compte: canviar la contrasenya",
            es: "Compte: canviar la contrasenya",
            en: "Compte: canviar la contrasenya",
          }),
        },
        {
          t: "p",
          text: T({
            ca: `Cal la contrasenya actual i la nova dues vegades. La nova ha de tenir ${s.minPasswordLength} caràcters com a mínim i ser diferent de l'actual. Canviar-la no et tanca la sessió: segueixes dins.`,
            es: `Cal la contrasenya actual i la nova dues vegades. La nova ha de tenir ${s.minPasswordLength} caràcters com a mínim i ser diferent de l'actual. Canviar-la no et tanca la sessió: segueixes dins.`,
            en: `Cal la contrasenya actual i la nova dues vegades. La nova ha de tenir ${s.minPasswordLength} caràcters com a mínim i ser diferent de l'actual. Canviar-la no et tanca la sessió: segueixes dins.`,
          }),
        },
        ...(s.referralProgramActive
          ? ([
              {
                t: "h",
                text: T({
                  ca: "El teu codi de referit",
                  es: "El teu codi de referit",
                  en: "El teu codi de referit",
                }),
              },
              {
                t: "p",
                text: T({
                  ca: "A la pestanya de Dades personals, al final, amb el botó de copiar i el compte d'amics que has portat.",
                  es: "A la pestanya de Dades personals, al final, amb el botó de copiar i el compte d'amics que has portat.",
                  en: "A la pestanya de Dades personals, al final, amb el botó de copiar i el compte d'amics que has portat.",
                }),
              },
            ] as Block[])
          : []),
      ],
    },

    // ─────────────────────────── 11 ───────────────────────────
    {
      id: "correus",
      title: T({
        ca: "Els correus que rebràs",
        es: "Els correus que rebràs",
        en: "Els correus que rebràs",
      }),
      blocks: [
        {
          t: "p",
          text: T({
            ca: "Tots arriben a la teva adreça d'accés i en l'idioma que tinguis triat. Els que es poden apagar es marquen a Configuració → Notificacions.",
            es: "Tots arriben a la teva adreça d'accés i en l'idioma que tinguis triat. Els que es poden apagar es marquen a Configuració → Notificacions.",
            en: "Tots arriben a la teva adreça d'accés i en l'idioma que tinguis triat. Els que es poden apagar es marquen a Configuració → Notificacions.",
          }),
        },
        {
          t: "table",
          head: [
            T({ ca: "Avís", es: "Avís", en: "Avís" }),
            T({ ca: "Quan arriba", es: "Quan arriba", en: "Quan arriba" }),
            T({
              ca: "El pots apagar?",
              es: "El pots apagar?",
              en: "El pots apagar?",
            }),
          ],
          rows: [
            [
              T({
                ca: "Reserva confirmada",
                es: "Reserva confirmada",
                en: "Reserva confirmada",
              }),
              T({
                ca: "Quan es crea una reserva a nom teu.",
                es: "Quan es crea una reserva a nom teu.",
                en: "Quan es crea una reserva a nom teu.",
              }),
              T({ ca: "Sí", es: "Sí", en: "Sí" }),
            ],
            [
              T({
                ca: "Reserva cancel·lada",
                es: "Reserva cancel·lada",
                en: "Reserva cancel·lada",
              }),
              T({
                ca: "Quan s'anul·la una reserva teva, la cancel·lis tu o el centre.",
                es: "Quan s'anul·la una reserva teva, la cancel·lis tu o el centre.",
                en: "Quan s'anul·la una reserva teva, la cancel·lis tu o el centre.",
              }),
              T({ ca: "No", es: "No", en: "No" }),
            ],
            [
              T({
                ca: "Recordatori de sessió",
                es: "Recordatori de sessió",
                en: "Recordatori de sessió",
              }),
              T({
                ca: `El dia abans de cada sessió, a partir de les ${hhmm(s.reminderHourLocal)}.`,
                es: `El dia abans de cada sessió, a partir de les ${hhmm(s.reminderHourLocal)}.`,
                en: `El dia abans de cada sessió, a partir de les ${hhmm(s.reminderHourLocal)}.`,
              }),
              T({ ca: "Sí", es: "Sí", en: "Sí" }),
            ],
            ...(s.modules.sessionsProva
              ? [
                  [
                    T({
                      ca: "Estat de la teva prova",
                      es: "Estat de la teva prova",
                      en: "Estat de la teva prova",
                    }),
                    T({
                      ca: "Quan la teva sessió de prova s'accepta o es rebutja.",
                      es: "Quan la teva sessió de prova s'accepta o es rebutja.",
                      en: "Quan la teva sessió de prova s'accepta o es rebutja.",
                    }),
                    T({ ca: "No", es: "No", en: "No" }),
                  ],
                ]
              : []),
            [
              T({
                ca: "Bo a punt d'esgotar-se",
                es: "Bo a punt d'esgotar-se",
                en: "Bo a punt d'esgotar-se",
              }),
              T({
                ca: `Quan et queda${s.bonoLowThreshold === 1 ? " 1 sessió" : `n ${s.bonoLowThreshold} sessions`} al bo.`,
                es: `Quan et queda${s.bonoLowThreshold === 1 ? " 1 sessió" : `n ${s.bonoLowThreshold} sessions`} al bo.`,
                en: `Quan et queda${s.bonoLowThreshold === 1 ? " 1 sessió" : `n ${s.bonoLowThreshold} sessions`} al bo.`,
              }),
              T({ ca: "Sí", es: "Sí", en: "Sí" }),
            ],
            [
              T({
                ca: "Bo a punt de caducar",
                es: "Bo a punt de caducar",
                en: "Bo a punt de caducar",
              }),
              T({
                ca: `${s.bonoExpiryWarningDays} dies abans que caduqui un bo amb sessions sense fer.`,
                es: `${s.bonoExpiryWarningDays} dies abans que caduqui un bo amb sessions sense fer.`,
                en: `${s.bonoExpiryWarningDays} dies abans que caduqui un bo amb sessions sense fer.`,
              }),
              T({ ca: "Sí", es: "Sí", en: "Sí" }),
            ],
            [
              T({
                ca: "Bo anul·lat per impagament",
                es: "Bo anul·lat per impagament",
                en: "Bo anul·lat per impagament",
              }),
              T({
                ca: "Si un bo pendent de pagament decau i es cancel·len les sessions que hi tenies reservades.",
                es: "Si un bo pendent de pagament decau i es cancel·len les sessions que hi tenies reservades.",
                en: "Si un bo pendent de pagament decau i es cancel·len les sessions que hi tenies reservades.",
              }),
              T({ ca: "No", es: "No", en: "No" }),
            ],
            ...(s.modules.comunitat
              ? [
                  [
                    T({
                      ca: "Novetats de la comunitat",
                      es: "Novetats de la comunitat",
                      en: "Novetats de la comunitat",
                    }),
                    T({
                      ca: "Nous anuncis del centre.",
                      es: "Nous anuncis del centre.",
                      en: "Nous anuncis del centre.",
                    }),
                    T({ ca: "Sí", es: "Sí", en: "Sí" }),
                  ],
                ]
              : []),
            ...(s.waitlistEnabled
              ? [
                  [
                    T({
                      ca: "Plaça de la llista d'espera",
                      es: "Plaça de la llista d'espera",
                      en: "Plaça de la llista d'espera",
                    }),
                    T({
                      ca: "Quan s'allibera una plaça que esperaves i te la reservem.",
                      es: "Quan s'allibera una plaça que esperaves i te la reservem.",
                      en: "Quan s'allibera una plaça que esperaves i te la reservem.",
                    }),
                    T({ ca: "No", es: "No", en: "No" }),
                  ],
                ]
              : []),
            ...(s.giftVouchersEnabled
              ? [
                  [
                    T({
                      ca: "T'han bescanviat un regal",
                      es: "T'han bescanviat un regal",
                      en: "T'han bescanviat un regal",
                    }),
                    T({
                      ca: "Quan algú fa servir un val de regal que has comprat.",
                      es: "Quan algú fa servir un val de regal que has comprat.",
                      en: "Quan algú fa servir un val de regal que has comprat.",
                    }),
                    T({ ca: "No", es: "No", en: "No" }),
                  ],
                ]
              : []),
            ...(s.subscriptionsEnabled
              ? [
                  [
                    T({
                      ca: "Renovació de la subscripció",
                      es: "Renovació de la subscripció",
                      en: "Renovació de la subscripció",
                    }),
                    T({
                      ca: "Cada mes, quan reps les sessions noves.",
                      es: "Cada mes, quan reps les sessions noves.",
                      en: "Cada mes, quan reps les sessions noves.",
                    }),
                    T({ ca: "No", es: "No", en: "No" }),
                  ],
                  [
                    T({
                      ca: "Subscripció aturada per impagament",
                      es: "Subscripció aturada per impagament",
                      en: "Subscripció aturada per impagament",
                    }),
                    T({
                      ca: "Quan un mes no s'ha pogut cobrar.",
                      es: "Quan un mes no s'ha pogut cobrar.",
                      en: "Quan un mes no s'ha pogut cobrar.",
                    }),
                    T({ ca: "No", es: "No", en: "No" }),
                  ],
                  [
                    T({
                      ca: "Baixa de la subscripció",
                      es: "Baixa de la subscripció",
                      en: "Baixa de la subscripció",
                    }),
                    T({
                      ca: "Quan es dona de baixa, la demanis tu o el centre.",
                      es: "Quan es dona de baixa, la demanis tu o el centre.",
                      en: "Quan es dona de baixa, la demanis tu o el centre.",
                    }),
                    T({ ca: "No", es: "No", en: "No" }),
                  ],
                  [
                    T({
                      ca: "Subscripció congelada",
                      es: "Subscripció congelada",
                      en: "Subscripció congelada",
                    }),
                    T({
                      ca: "Quan el centre l'atura temporalment.",
                      es: "Quan el centre l'atura temporalment.",
                      en: "Quan el centre l'atura temporalment.",
                    }),
                    T({ ca: "No", es: "No", en: "No" }),
                  ],
                  [
                    T({
                      ca: "Subscripció represa",
                      es: "Subscripció represa",
                      en: "Subscripció represa",
                    }),
                    T({
                      ca: "Quan el centre la torna a posar en marxa.",
                      es: "Quan el centre la torna a posar en marxa.",
                      en: "Quan el centre la torna a posar en marxa.",
                    }),
                    T({ ca: "No", es: "No", en: "No" }),
                  ],
                ]
              : []),
          ],
        },
        {
          t: "p",
          text: T({
            ca: "A banda d'aquests, hi ha els correus del compte, que no tenen casella perquè no són avisos sinó part del funcionament: la benvinguda en registrar-te, l'enllaç per canviar el correu d'accés i l'avís a la bústia antiga que algú ho ha demanat.",
            es: "A banda d'aquests, hi ha els correus del compte, que no tenen casella perquè no són avisos sinó part del funcionament: la benvinguda en registrar-te, l'enllaç per canviar el correu d'accés i l'avís a la bústia antiga que algú ho ha demanat.",
            en: "A banda d'aquests, hi ha els correus del compte, que no tenen casella perquè no són avisos sinó part del funcionament: la benvinguda en registrar-te, l'enllaç per canviar el correu d'accés i l'avís a la bústia antiga que algú ho ha demanat.",
          }),
        },
        {
          t: "note",
          text: T({
            ca: "El teu professional també et pot enviar un correu quan t'assigni exercicis nous. Aquell no és automàtic: el dispara ell quan vol, no cada vegada.",
            es: "El teu professional també et pot enviar un correu quan t'assigni exercicis nous. Aquell no és automàtic: el dispara ell quan vol, no cada vegada.",
            en: "El teu professional també et pot enviar un correu quan t'assigni exercicis nous. Aquell no és automàtic: el dispara ell quan vol, no cada vegada.",
          }),
        },
      ],
    },

    // ─────────────────────────── 12 ───────────────────────────
    {
      id: "si-alguna-cosa-no-va",
      title: T({
        ca: "Si alguna cosa no va",
        es: "Si alguna cosa no va",
        en: "Si alguna cosa no va",
      }),
      blocks: [
        {
          t: "h",
          text: T({
            ca: "El calendari no em deixa reservar res",
            es: "El calendari no em deixa reservar res",
            en: "El calendari no em deixa reservar res",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Gairebé sempre és una d'aquestes tres: no tens cap bo actiu amb sessions disponibles, el bo que tens és d'un altre servei del que estàs mirant, o tens un filtre de professional posat que amaga la resta. Comprova-ho per aquest ordre; l'app t'avisa a dalt de la pantalla en els dos primers casos.",
            es: "Gairebé sempre és una d'aquestes tres: no tens cap bo actiu amb sessions disponibles, el bo que tens és d'un altre servei del que estàs mirant, o tens un filtre de professional posat que amaga la resta. Comprova-ho per aquest ordre; l'app t'avisa a dalt de la pantalla en els dos primers casos.",
            en: "Gairebé sempre és una d'aquestes tres: no tens cap bo actiu amb sessions disponibles, el bo que tens és d'un altre servei del que estàs mirant, o tens un filtre de professional posat que amaga la resta. Comprova-ho per aquest ordre; l'app t'avisa a dalt de la pantalla en els dos primers casos.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "He pagat i el bo no em surt",
            es: "He pagat i el bo no em surt",
            en: "He pagat i el bo no em surt",
          }),
        },
        {
          t: "p",
          text: s.cardPayments
            ? T({
                ca: "Si has pagat amb targeta, el bo no es crea en el moment de pagar sinó quan el banc ens ho confirma, i això pot trigar uns segons. Mentrestant veus la pantalla «Estem confirmant el pagament». No tornis a pagar.",
                es: "Si has pagat amb targeta, el bo no es crea en el moment de pagar sinó quan el banc ens ho confirma, i això pot trigar uns segons. Mentrestant veus la pantalla «Estem confirmant el pagament». No tornis a pagar.",
                en: "Si has pagat amb targeta, el bo no es crea en el moment de pagar sinó quan el banc ens ho confirma, i això pot trigar uns segons. Mentrestant veus la pantalla «Estem confirmant el pagament». No tornis a pagar.",
              })
            : T({
                ca: "Si has pagat al centre, el bo passa a «Actiu» quan el centre registra el cobrament, que no és sempre el mateix moment en què pagues. Mentrestant el pots fer servir igualment per reservar.",
                es: "Si has pagat al centre, el bo passa a «Actiu» quan el centre registra el cobrament, que no és sempre el mateix moment en què pagues. Mentrestant el pots fer servir igualment per reservar.",
                en: "Si has pagat al centre, el bo passa a «Actiu» quan el centre registra el cobrament, que no és sempre el mateix moment en què pagues. Mentrestant el pots fer servir igualment per reservar.",
              }),
        },
        {
          t: "p",
          text: T({
            ca: `Si passa una hora i segueix sense aparèixer, avisa el centre: ${CONTACTE_CENTRE}.`,
            es: `Si passa una hora i segueix sense aparèixer, avisa el centre: ${CONTACTE_CENTRE}.`,
            en: `Si passa una hora i segueix sense aparèixer, avisa el centre: ${CONTACTE_CENTRE}.`,
          }),
        },
        {
          t: "h",
          text: T({
            ca: "No em deixa cancel·lar una sessió",
            es: "No em deixa cancel·lar una sessió",
            en: "No em deixa cancel·lar una sessió",
          }),
        },
        {
          t: "p",
          text: T({
            ca: `Les cancel·lacions es tanquen ${s.minCancellationHours} h abans de la sessió. Passat aquest punt el botó desapareix i l'app t'ho explica. Si tens una urgència de debò, parla amb el centre (${CONTACTE_CENTRE}): la decisió és seva, no de l'app.`,
            es: `Les cancel·lacions es tanquen ${s.minCancellationHours} h abans de la sessió. Passat aquest punt el botó desapareix i l'app t'ho explica. Si tens una urgència de debò, parla amb el centre (${CONTACTE_CENTRE}): la decisió és seva, no de l'app.`,
            en: `Les cancel·lacions es tanquen ${s.minCancellationHours} h abans de la sessió. Passat aquest punt el botó desapareix i l'app t'ho explica. Si tens una urgència de debò, parla amb el centre (${CONTACTE_CENTRE}): la decisió és seva, no de l'app.`,
          }),
        },
        {
          t: "h",
          text: T({
            ca: "He perdut la contrasenya",
            es: "He perdut la contrasenya",
            en: "He perdut la contrasenya",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Des de la pantalla d'entrada, «Has oblidat la contrasenya?». L'enllaç per posar-ne una de nova arriba al correu amb què vas crear el compte. Si ja ets dins i només la vols canviar, és a Configuració → Compte.",
            es: "Des de la pantalla d'entrada, «Has oblidat la contrasenya?». L'enllaç per posar-ne una de nova arriba al correu amb què vas crear el compte. Si ja ets dins i només la vols canviar, és a Configuració → Compte.",
            en: "Des de la pantalla d'entrada, «Has oblidat la contrasenya?». L'enllaç per posar-ne una de nova arriba al correu amb què vas crear el compte. Si ja ets dins i només la vols canviar, és a Configuració → Compte.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "He canviat de correu i no puc entrar",
            es: "He canviat de correu i no puc entrar",
            en: "He canviat de correu i no puc entrar",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "El canvi de correu no es fa fins que obres l'enllaç que enviem a la bústia NOVA. Si no l'has obert, segueixes entrant amb el correu antic. Si l'enllaç no t'arriba, mira la carpeta de correu brossa i, si no hi és, torna a demanar-ho des de Configuració → Compte.",
            es: "El canvi de correu no es fa fins que obres l'enllaç que enviem a la bústia NOVA. Si no l'has obert, segueixes entrant amb el correu antic. Si l'enllaç no t'arriba, mira la carpeta de correu brossa i, si no hi és, torna a demanar-ho des de Configuració → Compte.",
            en: "El canvi de correu no es fa fins que obres l'enllaç que enviem a la bústia NOVA. Si no l'has obert, segueixes entrant amb el correu antic. Si l'enllaç no t'arriba, mira la carpeta de correu brossa i, si no hi és, torna a demanar-ho des de Configuració → Compte.",
          }),
        },
        ...(s.subscriptionsEnabled
          ? ([
              {
                t: "h",
                text: T({
                  ca: "Vull deixar la subscripció",
                  es: "Vull deixar la subscripció",
                  en: "Vull deixar la subscripció",
                }),
              },
              {
                t: "p",
                text: T({
                  ca: "A Bons → Els meus bons, «Donar-me de baixa». Conserves el mes que ja tens pagat i no se'n cobra cap més. No cal avisar ningú.",
                  es: "A Bons → Els meus bons, «Donar-me de baixa». Conserves el mes que ja tens pagat i no se'n cobra cap més. No cal avisar ningú.",
                  en: "A Bons → Els meus bons, «Donar-me de baixa». Conserves el mes que ja tens pagat i no se'n cobra cap més. No cal avisar ningú.",
                }),
              },
            ] as Block[])
          : []),
        {
          t: "h",
          text: T({
            ca: "Res d'això és el meu cas",
            es: "Res d'això és el meu cas",
            en: "Res d'això és el meu cas",
          }),
        },
        {
          t: "p",
          text: T({
            ca: `Escriu o truca al centre: ${CONTACTE_CENTRE}. L'app no té cap bústia de contacte pròpia, així que aquesta és la via.`,
            es: `Escriu o truca al centre: ${CONTACTE_CENTRE}. L'app no té cap bústia de contacte pròpia, així que aquesta és la via.`,
            en: `Escriu o truca al centre: ${CONTACTE_CENTRE}. L'app no té cap bústia de contacte pròpia, així que aquesta és la via.`,
          }),
        },
      ],
    },

    // ─────────────────────────── 13 ───────────────────────────
    {
      id: "glossari",
      title: T({ ca: "Glossari", es: "Glossari", en: "Glossari" }),
      blocks: [
        {
          t: "dl",
          items: [
            [
              T({ ca: "Bo", es: "Bo", en: "Bo" }),
              T({
                ca: "Un paquet de sessions d'un servei concret. És el que et permet reservar.",
                es: "Un paquet de sessions d'un servei concret. És el que et permet reservar.",
                en: "Un paquet de sessions d'un servei concret. És el que et permet reservar.",
              }),
            ],
            [
              T({ ca: "Sessió", es: "Sessió", en: "Sessió" }),
              T({
                ca: "Una hora amb un professional. Es descompta d'un bo quan la reserves i torna al bo si la cancel·les a temps.",
                es: "Una hora amb un professional. Es descompta d'un bo quan la reserves i torna al bo si la cancel·les a temps.",
                en: "Una hora amb un professional. Es descompta d'un bo quan la reserves i torna al bo si la cancel·les a temps.",
              }),
            ],
            [
              T({ ca: "Franja", es: "Franja", en: "Franja" }),
              T({
                ca: "Un buit lliure a l'agenda d'un professional. Al calendari és cada una de les caselles de color.",
                es: "Un buit lliure a l'agenda d'un professional. Al calendari és cada una de les caselles de color.",
                en: "Un buit lliure a l'agenda d'un professional. Al calendari és cada una de les caselles de color.",
              }),
            ],
            [
              T({ ca: "Sèrie", es: "Sèrie", en: "Sèrie" }),
              T({
                ca: "Un conjunt de sessions reservades d'un cop amb el mateix patró: la mateixa hora cada setmana, cada dues o cada mes.",
                es: "Un conjunt de sessions reservades d'un cop amb el mateix patró: la mateixa hora cada setmana, cada dues o cada mes.",
                en: "Un conjunt de sessions reservades d'un cop amb el mateix patró: la mateixa hora cada setmana, cada dues o cada mes.",
              }),
            ],
            ...(s.waitlistEnabled
              ? ([
                  [
                    T({
                      ca: "Llista d'espera",
                      es: "Llista d'espera",
                      en: "Llista d'espera",
                    }),
                    T({
                      ca: "La cua d'una sessió de grup plena. Si algú cancel·la, la plaça passa al primer de la cua i la reserva es fa sola.",
                      es: "La cua d'una sessió de grup plena. Si algú cancel·la, la plaça passa al primer de la cua i la reserva es fa sola.",
                      en: "La cua d'una sessió de grup plena. Si algú cancel·la, la plaça passa al primer de la cua i la reserva es fa sola.",
                    }),
                  ],
                ] as [string, string][])
              : []),
            ...(s.subscriptionsEnabled
              ? ([
                  [
                    T({
                      ca: "Subscripció",
                      es: "Subscripció",
                      en: "Subscripció",
                    }),
                    T({
                      ca: "Un bo de Grup reduït que es renova sol cada mes el mateix dia, amb el preu congelat.",
                      es: "Un bo de Grup reduït que es renova sol cada mes el mateix dia, amb el preu congelat.",
                      en: "Un bo de Grup reduït que es renova sol cada mes el mateix dia, amb el preu congelat.",
                    }),
                  ],
                  [
                    T({ ca: "Cicle", es: "Cicle", en: "Cicle" }),
                    T({
                      ca: "El mes en curs d'una subscripció. Les sessions valen dins del seu cicle i no s'acumulen al següent.",
                      es: "El mes en curs d'una subscripció. Les sessions valen dins del seu cicle i no s'acumulen al següent.",
                      en: "El mes en curs d'una subscripció. Les sessions valen dins del seu cicle i no s'acumulen al següent.",
                    }),
                  ],
                ] as [string, string][])
              : []),
            ...(s.giftVouchersEnabled
              ? ([
                  [
                    T({
                      ca: "Val de regal",
                      es: "Val de regal",
                      en: "Val de regal",
                    }),
                    T({
                      ca: "Un paquet de sessions amb un codi, comprat per a una altra persona. Qui tingui el codi el pot bescanviar.",
                      es: "Un paquet de sessions amb un codi, comprat per a una altra persona. Qui tingui el codi el pot bescanviar.",
                      en: "Un paquet de sessions amb un codi, comprat per a una altra persona. Qui tingui el codi el pot bescanviar.",
                    }),
                  ],
                ] as [string, string][])
              : []),
            ...(s.referralProgramActive
              ? ([
                  [
                    T({
                      ca: "Codi de referit",
                      es: "Codi de referit",
                      en: "Codi de referit",
                    }),
                    T({
                      ca: "El teu codi personal per convidar algú. Quan es registra amb ell i paga el primer bo, hi ha descompte.",
                      es: "El teu codi personal per convidar algú. Quan es registra amb ell i paga el primer bo, hi ha descompte.",
                      en: "El teu codi personal per convidar algú. Quan es registra amb ell i paga el primer bo, hi ha descompte.",
                    }),
                  ],
                ] as [string, string][])
              : []),
            [
              T({ ca: "Aforament", es: "Aforament", en: "Aforament" }),
              T({
                ca: `El màxim de persones d'una sessió de grup: ${s.groupCapacity}.`,
                es: `El màxim de persones d'una sessió de grup: ${s.groupCapacity}.`,
                en: `El màxim de persones d'una sessió de grup: ${s.groupCapacity}.`,
              }),
            ],
          ],
        },
      ],
    },
  ];

  // Els capítols dels mòduls apagats no arriben ni a l'índex: així la
  // numeració no deixa forats i ningú es pregunta què hi havia al 7.
  return chapters
    .filter((c) => c.when !== false)
    .map(({ id, title, blocks }) => ({ id, title, blocks }));
}
