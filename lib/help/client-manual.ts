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

/** "07:00" a partir d'una hora sencera. */
const hhmm = (h: number) => `${String(h).padStart(2, "0")}:00`;

export function buildClientManual(s: ManualSettings): Chapter[] {
  const chapters: (Chapter & { when?: boolean })[] = [
    // ─────────────────────────── 1 ───────────────────────────
    {
      id: "primers-passos",
      title: "Primers passos",
      blocks: [
        {
          t: "p",
          text: "Aquesta app és el teu espai al centre: hi tens els bons que has comprat, hi reserves les sessions, hi consultes els exercicis que t'ha posat el teu professional i hi trobes els avisos del centre. Tot el que hi facis queda desat al moment; no hi ha res que s'hagi de confirmar després per un altre canal.",
        },
        { t: "h", text: "Crear el compte" },
        {
          t: "p",
          text: "Des de la pantalla d'entrada, «Crear compte». Et demanem el nom i cognoms, el correu electrònic, un telèfon, la data de naixement i una contrasenya de sis caràcters com a mínim. El telèfon i la data de naixement són obligatoris: el centre ha de poder trucar-te si una sessió es mou o hi ha una urgència.",
        },
        {
          t: "p",
          text: "Hi ha també un parell de camps opcionals —el teu objectiu i, si algú te'n va donar un, un codi de referit— i una casella per acceptar la Política de Privacitat i l'Avís Legal, que sí que cal marcar per continuar. Pots triar l'idioma de l'app ja aquí; després el podràs canviar quan vulguis.",
        },
        {
          t: "note",
          text: "El correu que hi posis serà el teu usuari d'accés i la bústia on rebràs els avisos. Si el centre té activada la confirmació per correu, revisa la safata abans d'intentar entrar.",
        },
        { t: "h", text: "Entrar i recuperar la contrasenya" },
        {
          t: "p",
          text: "S'entra amb el correu i la contrasenya. Si no la recordes, «Has oblidat la contrasenya?» t'envia un enllaç a la teva bústia per posar-ne una de nova. L'enllaç arriba al correu amb què vas crear el compte.",
        },
        ...(s.modules.sessionsProva
          ? ([
              { t: "h", text: "Provar-ho abans, sense compte" },
              {
                t: "p",
                text: `Si encara no ets client, el centre ofereix una sessió de prova gratuïta que es demana sense crear cap compte: tries una franja lliure del calendari públic, hi deixes el nom, el correu i el telèfon, i un professional te la confirma. Cal demanar-la amb un mínim de ${s.trialMinAdvanceHours} h d'antelació i com a molt ${s.trialMaxAdvanceDays} dies vista.`,
              },
              {
                t: "p",
                text: "La sol·licitud queda pendent fins que el professional la respon, i la resposta t'arriba per correu tant si s'accepta com si no.",
              },
            ] as Block[])
          : []),
        { t: "h", text: "Moure't per l'app" },
        {
          t: "p",
          text: "A l'ordinador tens el menú sempre a l'esquerra. Al mòbil hi ha una barra a dalt amb el botó de menú, que obre el mateix llistat. Les seccions són les mateixes en tots dos casos: Inici, Bons, Reserves, Exercicis, Documents, Comunitat, Configuració i aquesta Ajuda.",
        },
        {
          t: "p",
          text: "Al peu del menú hi ha el teu nom i la teva foto: aquell bloc porta a Configuració. Just a sota hi ha el botó de tancar sessió i els enllaços a la Política de Privacitat, l'Avís Legal i la política de Cookies.",
        },
        {
          t: "note",
          text: "Si al teu menú hi falta alguna de les seccions que surten en aquest manual, no és cap error: el centre pot tenir-la desactivada. Aquest manual s'escriu amb la configuració real del teu centre, així que el que hi llegeixes és el que hi tens.",
        },
        { t: "h", text: "Canviar d'idioma" },
        {
          t: "p",
          text: "L'app està en català, castellà i anglès. El canvi és a Configuració → Dades personals → Preferències, i té efecte de seguida: no cal desar res. L'idioma que triïs és també el dels correus que t'enviem.",
        },
      ],
    },

    // ─────────────────────────── 2 ───────────────────────────
    {
      id: "inici",
      title: "Inici",
      blocks: [
        {
          t: "p",
          text: "La pantalla d'entrada és un resum: què tens, què ve ara i què has de fer si vols alguna cosa. No cal entrar-hi a fer res, però és des d'on es fa tot més de pressa.",
        },
        { t: "h", text: "Els quatre indicadors" },
        {
          t: "dl",
          items: [
            [
              "Sessions restants",
              "Les sessions que et queden sumant tots els bons que pots fer servir, i entre parèntesis quantes en portaves en total.",
            ],
            [
              "Bons actius",
              "Quants bons tens en marxa ara mateix.",
            ],
            [
              "Properes reserves",
              "Les sessions que tens reservades per als pròxims set dies.",
            ],
            [
              "Assistència",
              "El percentatge de sessions d'aquest mes que s'han donat per fetes. Surt un guionet mentre no n'hi hagi cap de tancada: sense sessions, un percentatge no voldria dir res.",
            ],
          ],
        },
        { t: "h", text: "Accions ràpides" },
        {
          t: "p",
          text: "Tres botons grans amb les tres coses que es fan més sovint: reservar una sessió, comprar un bo i anar als teus entrenaments. Res que no es pugui fer també des del menú; simplement són a un clic.",
        },
        { t: "h", text: "La pròxima sessió" },
        {
          t: "p",
          text: "Al mòbil és el primer que veus en obrir l'app, i a l'ordinador queda a la dreta: el dia, l'hora en gran i amb qui la fas. Porta el botó «Afegir al calendari», que la posa al teu Google Calendar o et descarrega un fitxer que qualsevol altra agenda entén (Apple, Outlook…).",
        },
        {
          t: "note",
          text: "Afegir-la al teu calendari no és el mateix que reservar-la: la reserva ja està feta i és a l'app. Això només és una còpia perquè et surti a l'agenda del mòbil.",
        },
        { t: "h", text: "Properes reserves" },
        {
          t: "p",
          text: "Les tres següents, amb el dia gran a l'esquerra i el professional a la dreta. Des d'aquí mateix pots afegir-les al calendari o cancel·lar-les, sense passar pel calendari de Reserves. «Veure totes» porta a Reserves.",
        },
        { t: "h", text: "Bons actius" },
        {
          t: "p",
          text: "Una targeta per bo, amb el servei, les sessions que et queden de les que tenia, l'estat i la data de caducitat si en té. La barra de sota creix a mesura que el vas gastant: mostra el que has consumit, no el que et queda.",
        },
        ...(s.modules.comunitat
          ? ([
              { t: "h", text: "Comunitat" },
              {
                t: "p",
                text: "Si el centre ha publicat anuncis o ha obert alguna enquesta, els primers els veus aquí mateix, sense haver d'entrar a Comunitat.",
              },
            ] as Block[])
          : []),
        ...(s.giftVouchersEnabled || s.referralProgramActive
          ? ([
              { t: "h", text: "Regalar i recomanar" },
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
      title: "Bons",
      blocks: [
        {
          t: "p",
          text: "Un bo és un paquet de sessions ja pagades (o pendents de pagar) d'un servei concret. Sense un bo amb sessions disponibles no es pot reservar: el calendari no t'ensenyarà cap franja lliure. Aquesta secció té dues pestanyes, «Comprar bo nou» i «Els meus bons».",
        },
        { t: "h", text: "Els serveis" },
        {
          t: "dl",
          items: [
            ["EP Individual", "Entrenament personal, tu sol amb el professional."],
            ["EP Parelles", "Entrenament personal de dos."],
            [
              "Grup reduït",
              `Sessions en grup, amb un màxim de ${s.groupCapacity} persones.`,
            ],
            ["Fisioteràpia", "Sessions de fisioteràpia."],
          ],
        },
        {
          t: "p",
          text: "El catàleg de paquets i els preus els posa el centre, i no tots els serveis tenen per què estar disponibles en tot moment.",
        },
        { t: "h", text: "Comprar un bo, pas a pas" },
        {
          t: "ol",
          items: [
            "Tries el tipus de servei.",
            "Tries el paquet: cada un diu quantes sessions porta i què val.",
            "Tries com el pagues.",
          ],
        },
        {
          t: "p",
          text: "Abans de crear res et sortirà una finestra amb el resum del que has triat i una casella per acceptar les condicions de compra. Fins que no la marquis, el botó de confirmar no s'activa.",
        },
        { t: "h", text: "Ofertes i descomptes" },
        {
          t: "p",
          text: "Si el centre té una oferta activa sobre un paquet, el preu ratllat i el preu final surten a la mateixa targeta. Els descomptes no se sumen: si tens un descompte de referit pendent i alhora hi ha una oferta, s'aplica el que et surti millor i l'altre es guarda per a la propera compra. L'app t'ho diu explícitament abans de pagar.",
        },
        { t: "h", text: "Pagar al centre" },
        {
          t: "p",
          text: "El bo es crea a l'instant amb l'estat «Pendent de pagament» i el pagues en efectiu quan vagis. No és una reserva a mitges: les sessions ja les pots fer servir per reservar des del primer moment. L'estat passa a «Actiu» quan el centre registra el cobrament.",
        },
        ...(s.pendingPaymentCancelEnabled && s.pendingPaymentCancelHours
          ? ([
              {
                t: "warn",
                text: `Un bo pendent de pagament no ho pot estar per sempre: si passen ${s.pendingPaymentCancelHours} h des de la primera reserva que hi facis sense que s'hagi cobrat, el bo s'anul·la i les sessions que hi tinguessis reservades es cancel·len. Rebràs un correu si això passa.`,
              },
            ] as Block[])
          : []),
        ...(s.cardPayments
          ? ([
              { t: "h", text: "Pagar amb targeta" },
              {
                t: "p",
                text: "Et portem a la pàgina de pagament de Stripe. Les dades de la targeta no passen mai pel nostre domini: les recull Stripe directament.",
              },
              {
                t: "p",
                text: "Prémer «Pagar amb targeta» no crea res encara. El bo neix quan el banc confirma el cobrament. Per això, en tornar, pots trobar-te una pantalla que diu «Estem confirmant el pagament»: vol dir que la confirmació encara no ha arribat. No cal que facis res ni que tornis a pagar; en poca estona el bo apareix sol.",
              },
              {
                t: "warn",
                text: `Si passa una hora i el bo segueix sense sortir tot i que el banc t'ha cobrat, avisa el centre (${CONTACTE_CENTRE}). El que no s'ha de fer és tornar a pagar.`,
              },
              {
                t: "note",
                text: "Si tanques la pestanya de Stripe a mitges, no es crea ni es cobra res. Pots tornar-hi quan vulguis.",
              },
            ] as Block[])
          : [
              {
                t: "note",
                text: "Ara mateix el centre no accepta pagament amb targeta des de l'app: els bons es paguen al centre.",
              },
            ] as Block[]),
        ...(s.subscriptionsEnabled
          ? ([
              { t: "h", text: "La subscripció mensual" },
              {
                t: "p",
                text: `Als bons de Grup reduït, a més de comprar-ne un de solt, pots subscriure-t'hi: reps aquestes mateixes sessions cada mes sense haver de tornar a comprar res. El dia de renovació és el dia del mes en què t'hi dones d'alta, i te'l diem abans de confirmar.`,
              },
              {
                t: "p",
                text: "El preu et queda congelat: encara que la tarifa del centre pugi, tu segueixes pagant el que pagaves. Només se'n pot tenir una de viva alhora.",
              },
              {
                t: "warn",
                text: "Les sessions que no facis servir NO s'acumulen per al mes següent. Ara bé, reservar ja compta: si al calendari hi ha franges del mes que ve, pots reservar-les amb les sessions d'aquest mes i no perdre-les.",
              },
              {
                t: "p",
                text: s.cardPayments
                  ? "La pots pagar de dues maneres: al centre, en efectiu, com un bo qualsevol; o amb targeta, i llavors es cobra sola cada mes."
                  : "Es paga al centre, en efectiu, com un bo qualsevol.",
              },
              { t: "h", text: "Què veus a «Els meus bons»" },
              {
                t: "p",
                text: "La subscripció té el seu propi bloc a dalt de tot, separat dels bons: el que hi surt no és una compra que has fet sinó el que passarà cada mes. Hi trobes el preu, el dia de renovació, com es paga, l'estat i quantes sessions et queden del mes en curs.",
              },
              ...(s.subscriptionExtraSessionsMax > 0
                ? ([
                    { t: "h", text: "Demanar una sessió extra" },
                    {
                      t: "p",
                      text: `Si t'has quedat sense sessions abans que acabi el mes, pots demanar-ne fins a ${s.subscriptionExtraSessionsMax} de més sense esperar la renovació. Es cobra al preu per sessió del teu bo, no al d'una sessió solta, i caduca amb el mes en curs com la resta.`,
                    },
                    {
                      t: "p",
                      text: "El botó només apareix quan de debò se'n pot demanar una: si encara et queden sessions del mes, primer has de fer servir aquelles.",
                    },
                  ] as Block[])
                : []),
              ...(s.cardPayments
                ? ([
                    { t: "h", text: "Canviar la targeta o veure els rebuts" },
                    {
                      t: "p",
                      text: "Si la pagues amb targeta, el botó «Canviar la targeta o veure els rebuts» obre la pàgina de gestió de Stripe, on pots posar-hi una targeta nova i descarregar els comprovants de cada mes.",
                    },
                  ] as Block[])
                : []),
              { t: "h", text: "Donar-te de baixa" },
              {
                t: "p",
                text: "Amb «Donar-me de baixa». No perds el mes que ja tens pagat: el conserves sencer i simplement no se'n cobra cap més. Un cop demanada, l'app t'ho recorda al mateix bloc.",
              },
              { t: "h", text: "Si la subscripció s'atura" },
              {
                t: "dl",
                items: [
                  [
                    "Aturada per impagament",
                    "Vol dir que hi ha un mes sense cobrar. Es reprèn sola quan el pagues al centre. Mentre estigui així no es renova.",
                  ],
                  [
                    "Congelada",
                    "L'ha aturada el centre, no tu. No has de pagar res mentre duri i el temps aturat no el perds: en reprendre-la, la renovació es retarda els mateixos dies. Mentre estigui congelada no hi ha cap botó, perquè no hi ha res que puguis fer-hi tu.",
                  ],
                ],
              },
            ] as Block[])
          : []),
        { t: "h", text: "Els meus bons" },
        {
          t: "p",
          text: "La llista de tot el que has comprat, amb les sessions que et queden de cada bo, el preu i l'estat. Aquests són els estats possibles:",
        },
        {
          t: "dl",
          items: [
            ["Actiu", "Pagat i amb sessions disponibles."],
            [
              "Pendent de pagament",
              "Creat però encara no cobrat. Ja el pots fer servir per reservar.",
            ],
            ["Completat", "Has gastat totes les sessions."],
            [
              "Caducat",
              "Ha passat la data de validesa amb sessions sense fer.",
            ],
            [
              "Anul·lat per impagament",
              "Era pendent de pagament, no es va cobrar a temps i s'ha donat de baixa.",
            ],
            ["Cancel·lat", "L'ha anul·lat el centre."],
          ],
        },
        ...(s.bonoExpiryMonths
          ? ([
              {
                t: "note",
                text: `Els bons caduquen ${s.bonoExpiryMonths} mesos després de la compra. Cada bo porta la seva pròpia data: si el centre canvia aquest termini, els que ja tinguessis comprats no es toquen.`,
              },
            ] as Block[])
          : ([
              {
                t: "note",
                text: "Ara mateix el centre no posa data de caducitat als bons nous. Si algun dels teus en porta una, és la que tenia el dia que el vas comprar i es respecta.",
              },
            ] as Block[])),
        { t: "h", text: "Historial de pagaments" },
        {
          t: "p",
          text: "Sota els bons hi ha la llista dels cobraments registrats a nom teu, amb la data, l'import i si van ser en efectiu o amb targeta.",
        },
        { t: "h", text: "Tinc un codi de regal" },
        {
          t: "p",
          text: "A la pestanya «Comprar bo nou», a dalt, hi ha el camp «Tens un codi de regal?». Escriu-hi el codi (té la forma VINDI-XXXX-XXXX) i les sessions s'afegeixen al teu compte com un bo més.",
        },
        {
          t: "p",
          text: `Si el codi no s'accepta, el missatge et diu per què: que no existeix, que ja s'ha bescanviat, que ha caducat, que s'ha anul·lat o que el centre encara no n'ha confirmat el cobrament. En els tres últims casos no has fet res malament i qui ho pot resoldre és el centre (${CONTACTE_CENTRE}).`,
        },
      ],
    },

    // ─────────────────────────── 4 ───────────────────────────
    {
      id: "reserves",
      title: "Reserves",
      blocks: [
        {
          t: "p",
          text: "Aquí es reserva. El calendari ensenya les franges lliures de TOTS els professionals del centre, filtrades pel que tu pots fer: només hi surt el que pots reservar amb els bons que tens.",
        },
        { t: "h", text: "Llegir el calendari" },
        {
          t: "p",
          text: `Es pot mirar per dia o per setmana —al mòbil s'obre per dia— i moure't endavant i endarrere amb les fletxes. L'horari que es mostra va de les ${hhmm(s.openingHour)} a les ${hhmm(s.closingHour)}, que és l'horari del centre.`,
        },
        {
          t: "p",
          text: "Cada professional té el seu color, i la llegenda de sota el calendari diu quin és de qui. A dalt hi ha dos filtres, per servei i per professional, per si vols mirar només una cosa. Si tens un professional assignat, el filtre ja hi ve posat.",
        },
        { t: "h", text: "Què vol dir cada casella" },
        {
          t: "dl",
          items: [
            [
              "Una franja de color amb el nom d'un servei",
              "És lliure i la pots reservar. Si un professional ofereix dues coses a la mateixa hora, en surt una per cada servei que tu puguis reservar.",
            ],
            [
              "Ocupat",
              "Aquella hora ja la té ocupada una altra persona. No hi veus mai qui és.",
            ],
            [
              `Un comptador tipus «2/${s.groupCapacity}»`,
              "És una sessió de Grup reduït que ja està en marxa i encara té places. El color et diu com va: verd si hi ha lloc de sobres, ambre si en queda una de sola, vermell si està plena.",
            ],
            [
              "La teva sessió",
              "Les que ja tens reservades surten sempre, encara que hi hagi filtres posats.",
            ],
          ],
        },
        { t: "h", text: "Per què hi ha franges que no et surten" },
        {
          t: "ul",
          items: [
            "No tens cap bo actiu amb sessions disponibles: sense bo no hi ha res reservable, i l'app t'ho diu a dalt de tot.",
            "Aquell professional no ofereix cap dels serveis dels teus bons. Si has filtrat per ell, l'app t'ho avisa i t'ofereix tornar a veure'ls tots.",
            "Ja tens una reserva confirmada a aquella hora: no se te'n proposa una altra al mateix moment.",
            "És una hora que ja ha passat, o cau fora de l'horari del centre.",
            ...(s.minBookingHours > 0
              ? [
                  `És massa a prop: el centre demana un mínim de ${s.minBookingHours} h d'antelació per reservar.`,
                ]
              : []),
          ],
        },
        { t: "h", text: "Reservar una sessió" },
        {
          t: "p",
          text: "Cliques la franja i s'obre una finestra amb el dia, l'hora, el servei i el professional. Prems «Reservar» i ja està: la sessió es descompta del bo i la confirmació surt al moment, amb el botó per afegir-la al teu calendari.",
        },
        {
          t: "note",
          text: "Mentre la reserva viatja, el botó es bloqueja i diu «Reservant…». És a posta: evita que un doble clic acabi en dues reserves.",
        },
        { t: "h", text: "Les sessions de grup" },
        {
          t: "p",
          text: `Un Grup reduït admet ${s.groupCapacity} persones. En obrir la finestra d'una sessió de grup veus qui ja s'hi ha apuntat; a la graella del calendari no hi surt cap nom, només el comptador, perquè el calendari es veu de lluny i sense voler.`,
        },
        { t: "h", text: "La teva sessió: consultar-la i cancel·lar-la" },
        {
          t: "p",
          text: "Cliques la teva sessió al calendari i s'obre amb el detall, el botó d'afegir-la al calendari i el de cancel·lar. Cancel·lar demana una confirmació; la sessió torna al teu bo.",
        },
        {
          t: "warn",
          text: `Les reserves es poden cancel·lar fins a ${s.minCancellationHours} h abans. Passat aquest punt el botó desapareix i l'app t'explica per què. Si tens una urgència, parla amb el centre (${CONTACTE_CENTRE}): la política de cancel·lació la porta el centre, no l'app.`,
        },
        ...(s.waitlistEnabled
          ? ([
              { t: "h", text: "La llista d'espera" },
              {
                t: "p",
                text: "Quan una sessió de grup està plena no és un carreró sense sortida: pots apuntar-te a la llista d'espera. Si algú cancel·la, la plaça passa a ser teva automàticament, es fa la reserva sola, es descompta la sessió del bo i t'avisem per correu.",
              },
              {
                t: "warn",
                text: "Aquest avís no es pot desactivar, i és important que el llegeixis: la reserva es fa sense que tu hi tornis a prémer res, i si no ho saps no hi vas i la sessió es crema igualment.",
              },
              {
                t: "p",
                text: "Mentre hi siguis, la franja et surt marcada com que ets a la llista, i des d'allà mateix te'n pots donar de baixa.",
              },
            ] as Block[])
          : ([
              {
                t: "note",
                text: "Ara mateix el centre no accepta inscripcions noves a la llista d'espera. Si ja n'esperaves alguna d'abans, aquella segueix el seu curs i t'avisarem igual si s'allibera la plaça.",
              },
            ] as Block[])),
        { t: "h", text: "Repetir una sessió en bucle (les sèries)" },
        {
          t: "p",
          text: "Si vols la mateixa franja cada setmana, no cal reservar-la una per una. Hi ha dues portes: la casella «Fer-ho recurrent» a la finestra de reservar, i el botó «Repetir en bucle a partir d'aquesta» a una sessió que ja tinguis reservada.",
        },
        {
          t: "ol",
          items: [
            "Tries cada quant es repeteix: cada setmana, cada dues setmanes o cada mes.",
            "Dius fins quan (una data) o quantes sessions en vols. Pots omplir-ne un o tots dos; amb tots dos, la sèrie s'atura amb el primer límit que arribi.",
            "Si vols, obres «Si no hi ha plaça…» i ajustes què s'ha de fer amb les dates que estiguin ocupades.",
            "Prems «Veure les sessions»: es calcula la sèrie i te l'ensenyem sencera. Encara no s'ha reservat res.",
            "Revises la llista, acceptes les alternatives que t'agradin i prems «Confirmar sèrie».",
          ],
        },
        {
          t: "note",
          text: "Fins que no prems «Confirmar sèrie» no es reserva absolutament res. El pas de revisió és exactament perquè puguis veure on cauen les sessions abans de comprometre-les.",
        },
        { t: "h", text: "Les opcions de «Si no hi ha plaça…»" },
        {
          t: "dl",
          items: [
            [
              "Reservar només les disponibles",
              "Ve marcada per defecte. Només es confirmen les dates amb plaça i la resta es descarten. Té prioritat sobre les altres dues.",
            ],
            [
              "Proposar alternatives automàtiques",
              "Per a les dates ocupades et suggerim la millor alternativa possible (una altra hora o un altre professional) i decideixes tu si l'acceptes, una per una.",
            ],
            ...(s.waitlistEnabled
              ? ([
                  [
                    "Afegir a la llista d'espera si no hi ha plaça",
                    "Les dates plenes no es descarten: t'apuntem a la cua i, si algú cancel·la, la plaça és teva.",
                  ],
                ] as [string, string][])
              : []),
            ...(s.subscriptionsEnabled
              ? ([
                  [
                    "Allargar-la sola cada mes",
                    "Només surt si tens subscripció. Quan es renovi, es reserven soles les sessions que faltaven seguint el mateix patró. Si aquell mes la franja està ocupada, aquella sessió no es fa: mai se't canvia l'hora sense dir-t'ho.",
                  ],
                ] as [string, string][])
              : []),
          ],
        },
        { t: "h", text: "Llegir la revisió de la sèrie" },
        {
          t: "p",
          text: "Cada data de la llista porta una etiqueta:",
        },
        {
          t: "dl",
          items: [
            ["Confirmada", "Hi ha plaça i es reservarà."],
            [
              "Ja reservada",
              "Aquella sessió ja la tenies. No es duplica: s'adopta a la sèrie, i si un dia cancel·les la sèrie sencera, se n'anirà amb ella.",
            ],
            [
              "Alternativa proposada",
              "L'original està ocupada i te'n proposem una altra. No compta fins que prems «Accepta».",
            ],
            ["Llista d'espera", "T'apuntarem a la cua d'aquella sessió."],
            ["Sense places", "No es reservarà."],
          ],
        },
        {
          t: "p",
          text: "A sota hi ha el recompte i, si el bo no arriba per a totes, t'ho diem abans de confirmar: quantes es reserven ara i quantes queden fora. Si tens subscripció, les que no hi caben no es perden, es reservaran quan es renovi.",
        },
        { t: "h", text: "Les meves sèries" },
        {
          t: "p",
          text: "Les sèries vives surten en un bloc a dalt de la pantalla de Reserves, amb la freqüència, quantes sessions queden pendents i quina és la pròxima. Des d'allà pots cancel·lar-ne una de sencera.",
        },
        {
          t: "warn",
          text: `Cancel·lar la sèrie anul·la totes les sessions futures d'aquella sèrie i les torna al teu bo. Les que ja siguin a menys de ${s.minCancellationHours} h es queden com estaven, i l'app et diu quantes n'han quedat.`,
        },
        { t: "h", text: "Sessions passades" },
        {
          t: "p",
          text: "Al final d'aquesta mateixa pantalla, sota el calendari, hi ha les sessions que ja has fet. És on pots mirar enrere: la data, el servei i amb qui la vas fer.",
        },
        {
          t: "p",
          text: "Si el teu professional hi ha deixat una nota de la sessió, la veuràs allà mateix, signada amb el seu nom i la data. No totes en tenen: la nota és opcional i l'escriu qui vol.",
        },
      ],
    },

    // ─────────────────────────── 5 ───────────────────────────
    {
      id: "exercicis",
      title: "Exercicis",
      blocks: [
        {
          t: "p",
          text: "Dues coses a la mateixa pantalla: el que el teu professional t'ha posat a tu, i tot el que hi ha a la biblioteca del centre. Les de dalt van amb un accent lila justament perquè es distingeixin d'un cop d'ull.",
        },
        { t: "h", text: "Els teus exercicis" },
        {
          t: "p",
          text: "Cada targeta porta el nom de l'exercici, la seva categoria i, si n'hi ha, la nota que t'hi ha escrit el professional. Aquella nota és una instrucció per a tu, no una descripció del catàleg: hi surt sencera i destacada.",
        },
        { t: "h", text: "El teu progrés" },
        {
          t: "p",
          text: "Sota cada exercici assignat hi ha l'històric que s'ha anat registrant: la data, el pes en quilos, les repeticions i qualsevol comentari. Els registres els posa el professional; tu els consultes.",
        },
        { t: "h", text: "La biblioteca del centre" },
        {
          t: "p",
          text: "Tots els altres exercicis del centre, per consultar. Hi ha un cercador per nom o descripció i un filtre per categoria. Els que tenen vídeo el porten a la mateixa targeta: s'obre en una finestra sense sortir de la pàgina.",
        },
        {
          t: "note",
          text: "La biblioteca és de només lectura. Els exercicis els crea i els assigna el centre; des d'aquí no se'n pot afegir ni modificar cap.",
        },
      ],
    },

    // ─────────────────────────── 6 ───────────────────────────
    {
      id: "documents",
      title: "Documents",
      when: s.modules.documents,
      blocks: [
        {
          t: "p",
          text: "Un lloc per guardar el que té a veure amb el teu seguiment: informes mèdics, radiografies, resultats de proves, el que sigui. Ho pots consultar tu i el teu professional, ningú més.",
        },
        { t: "h", text: "Pujar un document" },
        {
          t: "p",
          text: `Amb «+ Pujar document». S'accepten PDF, imatges (JPG, PNG, HEIC) i Word, fins a ${s.documentsMaxMb} MB per fitxer. Pots afegir-hi una descripció curta —per exemple «Informe de la ressonància del genoll»— que és el que després et permetrà distingir-los d'un cop d'ull.`,
        },
        { t: "h", text: "Consultar-los i esborrar-los" },
        {
          t: "p",
          text: "Cada document de la llista es pot descarregar i esborrar. L'esborrat demana confirmació i no té marxa enrere: el fitxer se'n va de debò.",
        },
        {
          t: "note",
          text: "Si el fitxer és massa gros o té un format que no acceptem, l'app t'ho diu abans d'intentar pujar-lo, no després.",
        },
      ],
    },

    // ─────────────────────────── 7 ───────────────────────────
    {
      id: "comunitat",
      title: "Comunitat",
      when: s.modules.comunitat,
      blocks: [
        {
          t: "p",
          text: "El tauler del centre: anuncis, novetats i enquestes. Els més recents també et surten a l'Inici, així que no cal entrar-hi cada dia.",
        },
        { t: "h", text: "Anuncis" },
        {
          t: "p",
          text: "Publicacions del centre, de la més nova a la més antiga, amb la data i qui les signa. La més recent va marcada com a novetat. No s'hi respon: són avisos d'una banda cap a l'altra.",
        },
        { t: "h", text: "Enquestes" },
        {
          t: "p",
          text: "De tant en tant el centre obre una enquesta. Algunes deixen triar una sola opció i altres diverses; l'enunciat t'ho diu. Un cop enviada la resposta veus el repartiment de vots, si n'hi ha.",
        },
        {
          t: "warn",
          text: "El vot no es pot canviar un cop enviat. Si l'enquesta té data de tancament, hi surt; passada, ja no accepta respostes.",
        },
      ],
    },

    // ─────────────────────────── 8 ───────────────────────────
    {
      id: "regala-vindi",
      title: "Regala Vindi",
      when: s.giftVouchersEnabled,
      blocks: [
        {
          t: "p",
          text: "Un val de regal és el mateix paquet de sessions que compraries per a tu, però amb un codi perquè el faci servir una altra persona. S'hi arriba des de la targeta de l'Inici o des del final de la pantalla de Bons.",
        },
        { t: "h", text: "Comprar-lo" },
        {
          t: "ol",
          items: [
            "Tries el servei.",
            "Tries el paquet.",
            "Si vols, hi poses el nom de qui el rep, el seu correu i una dedicatòria. Tot això és opcional.",
            s.cardPayments
              ? "Tries si el pagues al centre o amb targeta, i confirmes."
              : "Confirmes; el pagaràs al centre.",
          ],
        },
        {
          t: "note",
          text: "El nom que hi posis surt imprès al val, però no limita qui el pot bescanviar: qui tingui el codi el podrà fer servir. Un val és al portador.",
        },
        {
          t: "note",
          text: "Els vals es paguen sempre a preu de catàleg. Si tu tens un descompte personal, no s'aplica aquí: el descompte és teu, i el val canvia de mans.",
        },
        { t: "h", text: "El codi i com fer-l'hi arribar" },
        {
          t: "p",
          text: "Un cop creat, l'app t'ensenya el codi i te'l deixa copiar. Tens tres maneres de donar-l'hi: copiar el codi i enviar-l'hi tu, descarregar el val en PDF per imprimir-lo o donar-l'hi en persona, o enviar-l'hi per correu des de la mateixa pantalla —li arriba el codi i les instruccions per fer-lo servir.",
        },
        ...(s.cardPayments
          ? ([
              {
                t: "warn",
                text: "Si el pagues al centre, el val es genera i el pots descarregar de seguida, però no serà bescanviable fins que el centre confirmi el cobrament. Si el pagues amb targeta, neix ja bescanviable.",
              },
            ] as Block[])
          : ([
              {
                t: "warn",
                text: "El val es genera i el pots descarregar de seguida, però no serà bescanviable fins que el paguis al centre i s'hi confirmi el cobrament.",
              },
            ] as Block[])),
        { t: "h", text: "Els vals que has regalat" },
        {
          t: "p",
          text: `Al final de la pantalla hi ha la llista dels que has comprat, amb el codi, el paquet, l'import, l'estat i la data. Des d'allà els pots tornar a descarregar sempre que vulguis. Els vals valen ${s.giftVoucherExpiryMonths} mesos des de la compra.`,
        },
        {
          t: "dl",
          items: [
            ["Pendent de pagament", "Encara no s'ha cobrat: no es pot bescanviar."],
            ["Actiu", "Pagat i esperant que algú l'utilitzi."],
            ["Bescanviat", "Ja s'ha fet servir. Et vam avisar per correu quan va passar."],
            ["Caducat", "Ha passat la data de validesa sense fer-se servir."],
            ["Anul·lat", "L'ha anul·lat el centre."],
          ],
        },
      ],
    },

    // ─────────────────────────── 9 ───────────────────────────
    {
      id: "porta-un-amic",
      title: "Porta un amic",
      when: s.referralProgramActive,
      blocks: [
        {
          t: "p",
          text: `Tens un codi de referit personal. Quan algú es registri amb ell i pagui el seu primer bo, ${s.referralRewardReferee ? "tots dos rebeu" : "reps"} un ${s.referralDiscountPercent}% de descompte a la propera compra.`,
        },
        { t: "h", text: "On és el teu codi" },
        {
          t: "p",
          text: "A dos llocs, i és el mateix: la targeta «Porta un amic» de l'Inici, que l'obre en una finestra amb el botó de copiar, i Configuració → Dades personals, on hi ha també el compte d'amics que ja has portat.",
        },
        { t: "h", text: "Com s'aplica el descompte" },
        {
          t: "p",
          text: "Sol, quan compris. A la pantalla de compra t'apareix un avís dient que el tens i si s'aplica o no. Si el paquet ja té una oferta millor, s'aplica l'oferta i el teu descompte de referit es guarda per a la següent compra: no es perd ni se sumen l'un amb l'altre.",
        },
      ],
    },

    // ─────────────────────────── 10 ───────────────────────────
    {
      id: "configuracio",
      title: "Configuració",
      blocks: [
        {
          t: "p",
          text: "Quatre pestanyes: Dades personals, Privacitat, Notificacions i Compte.",
        },
        { t: "h", text: "Dades personals" },
        {
          t: "p",
          text: "El nom complet i el telèfon són obligatoris; la resta —data de naixement, alçada, pes, gènere, contacte d'emergència i el teu objectiu— els omples si vols. Els camps obligatoris porten un asterisc i el formulari no es desa sense ells.",
        },
        {
          t: "note",
          text: "Si el teu compte és d'abans que el telèfon fos obligatori, el tindràs buit i el formulari te'l demanarà el primer cop que hi desis res. No és un error.",
        },
        {
          t: "p",
          text: "El correu electrònic hi surt, però no s'hi pot tocar: és la teva credencial d'accés i es canvia a la pestanya «Compte».",
        },
        { t: "h", text: "Idioma" },
        {
          t: "p",
          text: "A la mateixa pestanya, a dalt, sota «Preferències». Es desa sol en triar-lo, sense passar pel botó de desar, i el canvi és immediat.",
        },
        { t: "h", text: "Privacitat" },
        {
          t: "p",
          text: "Aquí veus què has acceptat i quan: la data i la versió de la Política de Privacitat i l'Avís Legal que vas acceptar en registrar-te.",
        },
        {
          t: "p",
          text: "A sota hi ha el consentiment per al tractament de dades de salut, que fa falta si reps fisioteràpia. Si encara no l'has donat, hi ha la casella per fer-ho. Un cop donat, hi consta la data; per revocar-lo cal escriure al centre.",
        },
        { t: "h", text: "Notificacions" },
        {
          t: "p",
          text: "Una llista d'avisos amb una casella «Email» a cada un. Marca els que vols rebre i prem «Desar preferències».",
        },
        {
          t: "p",
          text: "No hi surten tots els correus que et podem enviar, i és a posta. Alguns avisos s'envien sempre, sense casella. El criteri és aquest: és obligatori l'avís que et diu una cosa JA FETA, que no has provocat tu en aquell moment, i que no podries descobrir mirant l'app.",
        },
        {
          t: "p",
          text: "Per això la reserva cancel·lada s'envia sempre i la confirmada no: una reserva que existeix la pots veure quan vulguis; una que ja no existeix, no. Al capítol següent tens la llista sencera amb quins es poden apagar i quins no.",
        },
        { t: "h", text: "Compte: canviar el correu d'accés" },
        {
          t: "p",
          text: "El correu és amb què entres i on reps els avisos, així que canviar-lo va per un camí propi i en dos passos:",
        },
        {
          t: "ol",
          items: [
            "Escrius el correu nou i la teva contrasenya actual —te la demanem per assegurar-nos que ets tu.",
            "T'enviem un enllaç a la bústia NOVA. Fins que no l'obris des d'allà, el canvi no es fa i segueixes entrant amb el correu de sempre.",
          ],
        },
        {
          t: "p",
          text: "Mentre la petició està pendent, l'app t'ho recorda i te la deixa anul·lar. El correu antic també rep un avís que algú ha demanat el canvi: si no has estat tu, és com te n'assabentes.",
        },
        { t: "h", text: "Compte: canviar la contrasenya" },
        {
          t: "p",
          text: "Cal la contrasenya actual i la nova dues vegades. La nova ha de tenir vuit caràcters com a mínim i ser diferent de l'actual. Canviar-la no et tanca la sessió: segueixes dins.",
        },
        ...(s.referralProgramActive
          ? ([
              { t: "h", text: "El teu codi de referit" },
              {
                t: "p",
                text: "A la pestanya de Dades personals, al final, amb el botó de copiar i el compte d'amics que has portat.",
              },
            ] as Block[])
          : []),
      ],
    },

    // ─────────────────────────── 11 ───────────────────────────
    {
      id: "correus",
      title: "Els correus que rebràs",
      blocks: [
        {
          t: "p",
          text: "Tots arriben a la teva adreça d'accés i en l'idioma que tinguis triat. Els que es poden apagar es marquen a Configuració → Notificacions.",
        },
        {
          t: "table",
          head: ["Avís", "Quan arriba", "El pots apagar?"],
          rows: [
            [
              "Reserva confirmada",
              "Quan es crea una reserva a nom teu.",
              "Sí",
            ],
            [
              "Reserva cancel·lada",
              "Quan s'anul·la una reserva teva, la cancel·lis tu o el centre.",
              "No",
            ],
            [
              "Recordatori de sessió",
              `El dia abans de cada sessió, a partir de les ${hhmm(s.reminderHourLocal)}.`,
              "Sí",
            ],
            ...(s.modules.sessionsProva
              ? [
                  [
                    "Estat de la teva prova",
                    "Quan la teva sessió de prova s'accepta o es rebutja.",
                    "No",
                  ],
                ]
              : []),
            [
              "Bo a punt d'esgotar-se",
              `Quan et queda${s.bonoLowThreshold === 1 ? " 1 sessió" : `n ${s.bonoLowThreshold} sessions`} al bo.`,
              "Sí",
            ],
            [
              "Bo a punt de caducar",
              "Uns dies abans que caduqui un bo amb sessions sense fer.",
              "Sí",
            ],
            [
              "Bo anul·lat per impagament",
              "Si un bo pendent de pagament decau i es cancel·len les sessions que hi tenies reservades.",
              "No",
            ],
            ...(s.modules.comunitat
              ? [["Novetats de la comunitat", "Nous anuncis del centre.", "Sí"]]
              : []),
            ...(s.waitlistEnabled
              ? [
                  [
                    "Plaça de la llista d'espera",
                    "Quan s'allibera una plaça que esperaves i te la reservem.",
                    "No",
                  ],
                ]
              : []),
            ...(s.giftVouchersEnabled
              ? [
                  [
                    "T'han bescanviat un regal",
                    "Quan algú fa servir un val de regal que has comprat.",
                    "No",
                  ],
                ]
              : []),
            ...(s.subscriptionsEnabled
              ? [
                  [
                    "Renovació de la subscripció",
                    "Cada mes, quan reps les sessions noves.",
                    "No",
                  ],
                  [
                    "Subscripció aturada per impagament",
                    "Quan un mes no s'ha pogut cobrar.",
                    "No",
                  ],
                  [
                    "Baixa de la subscripció",
                    "Quan es dona de baixa, la demanis tu o el centre.",
                    "No",
                  ],
                  [
                    "Subscripció congelada",
                    "Quan el centre l'atura temporalment.",
                    "No",
                  ],
                  [
                    "Subscripció represa",
                    "Quan el centre la torna a posar en marxa.",
                    "No",
                  ],
                ]
              : []),
          ],
        },
        {
          t: "p",
          text: "A banda d'aquests, hi ha els correus del compte, que no tenen casella perquè no són avisos sinó part del funcionament: la benvinguda en registrar-te, l'enllaç per canviar el correu d'accés i l'avís a la bústia antiga que algú ho ha demanat.",
        },
        {
          t: "note",
          text: "El teu professional també et pot enviar un correu quan t'assigni exercicis nous. Aquell no és automàtic: el dispara ell quan vol, no cada vegada.",
        },
      ],
    },

    // ─────────────────────────── 12 ───────────────────────────
    {
      id: "si-alguna-cosa-no-va",
      title: "Si alguna cosa no va",
      blocks: [
        { t: "h", text: "El calendari no em deixa reservar res" },
        {
          t: "p",
          text: "Gairebé sempre és una d'aquestes tres: no tens cap bo actiu amb sessions disponibles, el bo que tens és d'un altre servei del que estàs mirant, o tens un filtre de professional posat que amaga la resta. Comprova-ho per aquest ordre; l'app t'avisa a dalt de la pantalla en els dos primers casos.",
        },
        { t: "h", text: "He pagat i el bo no em surt" },
        {
          t: "p",
          text: s.cardPayments
            ? "Si has pagat amb targeta, el bo no es crea en el moment de pagar sinó quan el banc ens ho confirma, i això pot trigar uns segons. Mentrestant veus la pantalla «Estem confirmant el pagament». No tornis a pagar."
            : "Si has pagat al centre, el bo passa a «Actiu» quan el centre registra el cobrament, que no és sempre el mateix moment en què pagues. Mentrestant el pots fer servir igualment per reservar.",
        },
        {
          t: "p",
          text: `Si passa una hora i segueix sense aparèixer, avisa el centre: ${CONTACTE_CENTRE}.`,
        },
        { t: "h", text: "No em deixa cancel·lar una sessió" },
        {
          t: "p",
          text: `Les cancel·lacions es tanquen ${s.minCancellationHours} h abans de la sessió. Passat aquest punt el botó desapareix i l'app t'ho explica. Si tens una urgència de debò, parla amb el centre (${CONTACTE_CENTRE}): la decisió és seva, no de l'app.`,
        },
        { t: "h", text: "He perdut la contrasenya" },
        {
          t: "p",
          text: "Des de la pantalla d'entrada, «Has oblidat la contrasenya?». L'enllaç per posar-ne una de nova arriba al correu amb què vas crear el compte. Si ja ets dins i només la vols canviar, és a Configuració → Compte.",
        },
        { t: "h", text: "He canviat de correu i no puc entrar" },
        {
          t: "p",
          text: "El canvi de correu no es fa fins que obres l'enllaç que enviem a la bústia NOVA. Si no l'has obert, segueixes entrant amb el correu antic. Si l'enllaç no t'arriba, mira la carpeta de correu brossa i, si no hi és, torna a demanar-ho des de Configuració → Compte.",
        },
        ...(s.subscriptionsEnabled
          ? ([
              { t: "h", text: "Vull deixar la subscripció" },
              {
                t: "p",
                text: "A Bons → Els meus bons, «Donar-me de baixa». Conserves el mes que ja tens pagat i no se'n cobra cap més. No cal avisar ningú.",
              },
            ] as Block[])
          : []),
        { t: "h", text: "Res d'això és el meu cas" },
        {
          t: "p",
          text: `Escriu o truca al centre: ${CONTACTE_CENTRE}. L'app no té cap bústia de contacte pròpia, així que aquesta és la via.`,
        },
      ],
    },

    // ─────────────────────────── 13 ───────────────────────────
    {
      id: "glossari",
      title: "Glossari",
      blocks: [
        {
          t: "dl",
          items: [
            [
              "Bo",
              "Un paquet de sessions d'un servei concret. És el que et permet reservar.",
            ],
            [
              "Sessió",
              "Una hora amb un professional. Es descompta d'un bo quan la reserves i torna al bo si la cancel·les a temps.",
            ],
            [
              "Franja",
              "Un buit lliure a l'agenda d'un professional. Al calendari és cada una de les caselles de color.",
            ],
            [
              "Sèrie",
              "Un conjunt de sessions reservades d'un cop amb el mateix patró: la mateixa hora cada setmana, cada dues o cada mes.",
            ],
            ...(s.waitlistEnabled
              ? ([
                  [
                    "Llista d'espera",
                    "La cua d'una sessió de grup plena. Si algú cancel·la, la plaça passa al primer de la cua i la reserva es fa sola.",
                  ],
                ] as [string, string][])
              : []),
            ...(s.subscriptionsEnabled
              ? ([
                  [
                    "Subscripció",
                    "Un bo de Grup reduït que es renova sol cada mes el mateix dia, amb el preu congelat.",
                  ],
                  [
                    "Cicle",
                    "El mes en curs d'una subscripció. Les sessions valen dins del seu cicle i no s'acumulen al següent.",
                  ],
                ] as [string, string][])
              : []),
            ...(s.giftVouchersEnabled
              ? ([
                  [
                    "Val de regal",
                    "Un paquet de sessions amb un codi, comprat per a una altra persona. Qui tingui el codi el pot bescanviar.",
                  ],
                ] as [string, string][])
              : []),
            ...(s.referralProgramActive
              ? ([
                  [
                    "Codi de referit",
                    "El teu codi personal per convidar algú. Quan es registra amb ell i paga el primer bo, hi ha descompte.",
                  ],
                ] as [string, string][])
              : []),
            [
              "Aforament",
              `El màxim de persones d'una sessió de grup: ${s.groupCapacity}.`,
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
