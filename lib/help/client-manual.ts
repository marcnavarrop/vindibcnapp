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
        es: "Primeros pasos",
        en: "Getting started",
      }),
      blocks: [
        {
          t: "p",
          text: T({
            ca: "Aquesta app és el teu espai al centre: hi tens els bons que has comprat, hi reserves les sessions, hi consultes els exercicis que t'ha posat el teu professional i hi trobes els avisos del centre. Tot el que hi facis queda desat al moment; no hi ha res que s'hagi de confirmar després per un altre canal.",
            es: "Esta app es tu espacio en el centro: aquí tienes los bonos que has comprado, reservas las sesiones, consultas los ejercicios que te ha puesto tu profesional y encuentras los avisos del centro. Todo lo que hagas queda guardado al momento; no hay nada que se tenga que confirmar después por otro canal.",
            en: "This app is your space at the centre: it holds the passes you've bought, it's where you book sessions, check the exercises your trainer or physio has set you, and find the centre's announcements. Everything you do is saved straight away; nothing needs confirming afterwards through another channel.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Crear el compte",
            es: "Crear la cuenta",
            en: "Creating your account",
          }),
        },
        {
          t: "p",
          text: T({
            ca: `Des de la pantalla d'entrada, «Crear compte». Et demanem el nom i cognoms, el correu electrònic, un telèfon, la data de naixement i una contrasenya de ${s.minPasswordLength} caràcters com a mínim. El telèfon i la data de naixement són obligatoris: el centre ha de poder trucar-te si una sessió es mou o hi ha una urgència.`,
            es: `Desde la pantalla de entrada, «Crear cuenta». Te pedimos el nombre y apellidos, el correo electrónico, un teléfono, la fecha de nacimiento y una contraseña de ${s.minPasswordLength} caracteres como mínimo. El teléfono y la fecha de nacimiento son obligatorios: el centro tiene que poder llamarte si una sesión se mueve o hay una urgencia.`,
            en: `From the sign-in screen, «Create account». We ask for your full name, email address, a phone number, your date of birth and a password of at least ${s.minPasswordLength} characters. The phone number and date of birth are required: the centre has to be able to call you if a session moves or there's an emergency.`,
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Hi ha també un parell de camps opcionals —el teu objectiu i, si algú te'n va donar un, un codi de referit— i una casella per acceptar la Política de Privacitat i l'Avís Legal, que sí que cal marcar per continuar. Pots triar l'idioma de l'app ja aquí; després el podràs canviar quan vulguis.",
            es: "Hay también un par de campos opcionales —tu objetivo y, si alguien te dio uno, un código de referido— y una casilla para aceptar la Política de Privacidad y el Aviso Legal, que sí hay que marcar para continuar. Puedes elegir el idioma de la app ya aquí; después lo podrás cambiar cuando quieras.",
            en: "There are also a couple of optional fields —your goal and, if someone gave you one, a referral code— plus a box to accept the Privacy Policy and Legal Notice, which does have to be ticked to continue. You can pick the app's language right here; you can change it whenever you like afterwards.",
          }),
        },
        {
          t: "note",
          text: T({
            ca: "El correu que hi posis serà el teu usuari d'accés i la bústia on rebràs els avisos. Si el centre té activada la confirmació per correu, revisa la safata abans d'intentar entrar.",
            es: "El correo que pongas será tu usuario de acceso y el buzón donde recibirás los avisos. Si el centro tiene activada la confirmación por correo, revisa la bandeja antes de intentar entrar.",
            en: "The email address you enter will be your sign-in username and the inbox where you get notifications. If the centre has email confirmation switched on, check your inbox before trying to sign in.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Entrar i recuperar la contrasenya",
            es: "Entrar y recuperar la contraseña",
            en: "Signing in and recovering your password",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "S'entra amb el correu i la contrasenya. Si no la recordes, «Has oblidat la contrasenya?» t'envia un enllaç a la teva bústia per posar-ne una de nova. L'enllaç arriba al correu amb què vas crear el compte.",
            es: "Se entra con el correo y la contraseña. Si no la recuerdas, «¿Has olvidado la contraseña?» te envía un enlace a tu buzón para poner una nueva. El enlace llega al correo con el que creaste la cuenta.",
            en: "You sign in with your email address and password. If you can't remember it, «Forgotten your password?» sends a link to your inbox so you can set a new one. The link goes to the email address you created the account with.",
          }),
        },
        ...(s.modules.sessionsProva
          ? ([
              {
                t: "h",
                text: T({
                  ca: "Provar-ho abans, sense compte",
                  es: "Probarlo antes, sin cuenta",
                  en: "Trying it first, without an account",
                }),
              },
              {
                t: "p",
                text: T({
                  ca: `Si encara no ets client, el centre ofereix una sessió de prova gratuïta que es demana sense crear cap compte: tries una franja lliure del calendari públic, hi deixes el nom, el correu i el telèfon, i un professional te la confirma. Cal demanar-la amb un mínim de ${s.trialMinAdvanceHours} h d'antelació i com a molt ${s.trialMaxAdvanceDays} dies vista.`,
                  es: `Si todavía no eres cliente, el centro ofrece una sesión de prueba gratuita que se pide sin crear ninguna cuenta: eliges una franja libre del calendario público, dejas el nombre, el correo y el teléfono, y un profesional te la confirma. Hay que pedirla con un mínimo de ${s.trialMinAdvanceHours} h de antelación y como mucho ${s.trialMaxAdvanceDays} días vista.`,
                  en: `If you're not a client yet, the centre offers a free trial session you can request without creating an account: you pick a free slot on the public calendar, leave your name, email and phone number, and a trainer or physio confirms it. It has to be requested at least ${s.trialMinAdvanceHours} h in advance and no more than ${s.trialMaxAdvanceDays} days ahead.`,
                }),
              },
              {
                t: "p",
                text: T({
                  ca: "La sol·licitud queda pendent fins que el professional la respon, i la resposta t'arriba per correu tant si s'accepta com si no.",
                  es: "La solicitud queda pendiente hasta que el profesional la responde, y la respuesta te llega por correo tanto si se acepta como si no.",
                  en: "The request stays pending until the professional answers it, and the answer reaches you by email whether it's accepted or not.",
                }),
              },
            ] as Block[])
          : []),
        {
          t: "h",
          text: T({
            ca: "Moure't per l'app",
            es: "Moverte por la app",
            en: "Finding your way around",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "A l'ordinador tens el menú sempre a l'esquerra. Al mòbil hi ha una barra a dalt amb el botó de menú, que obre el mateix llistat. Les seccions són les mateixes en tots dos casos: Inici, Bons, Reserves, Exercicis, Documents, Comunitat, Configuració i aquesta Ajuda.",
            es: "En el ordenador tienes el menú siempre a la izquierda. En el móvil hay una barra arriba con el botón de menú, que abre el mismo listado. Las secciones son las mismas en ambos casos: Inicio, Bonos, Reservas, Ejercicios, Documentos, Comunidad, Configuración y esta Ayuda.",
            en: "On a computer the menu is always on the left. On a phone there's a bar at the top with a menu button that opens the same list. The sections are the same either way: Home, Passes, Bookings, Exercises, Documents, Community, Settings and this Help.",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Al peu del menú hi ha el teu nom i la teva foto: aquell bloc porta a Configuració. Just a sota hi ha el botó de tancar sessió i els enllaços a la Política de Privacitat, l'Avís Legal i la política de Cookies.",
            es: "Al pie del menú están tu nombre y tu foto: ese bloque lleva a Configuración. Justo debajo está el botón de cerrar sesión y los enlaces a la Política de Privacidad, el Aviso Legal y la política de Cookies.",
            en: "At the foot of the menu are your name and photo: that block takes you to Settings. Just below it is the sign-out button and links to the Privacy Policy, Legal Notice and Cookie policy.",
          }),
        },
        {
          t: "note",
          text: T({
            ca: "Si al teu menú hi falta alguna de les seccions que surten en aquest manual, no és cap error: el centre pot tenir-la desactivada. Aquest manual s'escriu amb la configuració real del teu centre, així que el que hi llegeixes és el que hi tens.",
            es: "Si en tu menú falta alguna de las secciones que salen en este manual, no es ningún error: el centro puede tenerla desactivada. Este manual se escribe con la configuración real de tu centro, así que lo que lees aquí es lo que tienes.",
            en: "If one of the sections described in this manual is missing from your menu, that isn't a mistake: the centre may have it switched off. This manual is written from your centre's real settings, so what you read here is what you have.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Canviar d'idioma",
            es: "Cambiar de idioma",
            en: "Changing language",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "L'app està en català, castellà i anglès. El canvi és a Configuració → Dades personals → Preferències, i té efecte de seguida: no cal desar res. L'idioma que triïs és també el dels correus que t'enviem.",
            es: "La app está en catalán, castellano e inglés. El cambio está en Configuración → Datos personales → Preferencias, y tiene efecto enseguida: no hace falta guardar nada. El idioma que elijas es también el de los correos que te enviamos.",
            en: "The app is available in Catalan, Spanish and English. You change it under Settings → Personal details → Preferences, and it takes effect straight away: there's nothing to save. The language you choose is also the one we write your emails in.",
          }),
        },
      ],
    },

    // ─────────────────────────── 2 ───────────────────────────
    {
      id: "inici",
      title: T({ ca: "Inici", es: "Inicio", en: "Home" }),
      blocks: [
        {
          t: "p",
          text: T({
            ca: "La pantalla d'entrada és un resum: què tens, què ve ara i què has de fer si vols alguna cosa. No cal entrar-hi a fer res, però és des d'on es fa tot més de pressa.",
            es: "La pantalla de entrada es un resumen: qué tienes, qué viene ahora y qué tienes que hacer si quieres algo. No hace falta entrar a hacer nada, pero es desde donde se hace todo más rápido.",
            en: "The opening screen is a summary: what you have, what's coming up and what to do if you want something. You don't have to do anything here, but it's the quickest way in to everything.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Els quatre indicadors",
            es: "Los cuatro indicadores",
            en: "The four figures",
          }),
        },
        {
          t: "dl",
          items: [
            [
              T({
                ca: "Sessions restants",
                es: "Sesiones restantes",
                en: "Sessions left",
              }),
              T({
                ca: "Les sessions que et queden sumant tots els bons que pots fer servir, i entre parèntesis quantes en portaves en total.",
                es: "Las sesiones que te quedan sumando todos los bonos que puedes usar, y entre paréntesis cuántas llevabas en total.",
                en: "How many sessions you have left across every pass you can use, with the original total in brackets.",
              }),
            ],
            [
              T({
                ca: "Bons actius",
                es: "Bonos activos",
                en: "Active passes",
              }),
              T({
                ca: "Quants bons tens en marxa ara mateix.",
                es: "Cuántos bonos tienes en marcha ahora mismo.",
                en: "How many passes you have on the go right now.",
              }),
            ],
            [
              T({
                ca: "Properes reserves",
                es: "Próximas reservas",
                en: "Upcoming bookings",
              }),
              T({
                ca: "Les sessions que tens reservades per als pròxims set dies.",
                es: "Las sesiones que tienes reservadas para los próximos siete días.",
                en: "The sessions you have booked over the next seven days.",
              }),
            ],
            [
              T({ ca: "Assistència", es: "Asistencia", en: "Attendance" }),
              T({
                ca: "El percentatge de sessions d'aquest mes que s'han donat per fetes. Surt un guionet mentre no n'hi hagi cap de tancada: sense sessions, un percentatge no voldria dir res.",
                es: "El porcentaje de sesiones de este mes que se han dado por hechas. Sale un guion mientras no haya ninguna cerrada: sin sesiones, un porcentaje no querría decir nada.",
                en: "The share of this month's sessions marked as done. It shows a dash until at least one is closed: with no sessions, a percentage wouldn't mean anything.",
              }),
            ],
          ],
        },
        {
          t: "h",
          text: T({
            ca: "Accions ràpides",
            es: "Acciones rápidas",
            en: "Quick actions",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Tres botons grans amb les tres coses que es fan més sovint: reservar una sessió, comprar un bo i anar als teus entrenaments. Res que no es pugui fer també des del menú; simplement són a un clic.",
            es: "Tres botones grandes con las tres cosas que se hacen más a menudo: reservar una sesión, comprar un bono e ir a tus entrenamientos. Nada que no se pueda hacer también desde el menú; simplemente están a un clic.",
            en: "Three large buttons for the three things done most often: book a session, buy a pass, and go to your workouts. Nothing you can't also do from the menu; they're just one click away.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "La pròxima sessió",
            es: "La próxima sesión",
            en: "Your next session",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Al mòbil és el primer que veus en obrir l'app, i a l'ordinador queda a la dreta: el dia, l'hora en gran i amb qui la fas. Porta el botó «Afegir al calendari», que la posa al teu Google Calendar o et descarrega un fitxer que qualsevol altra agenda entén (Apple, Outlook…).",
            es: "En el móvil es lo primero que ves al abrir la app, y en el ordenador queda a la derecha: el día, la hora en grande y con quién la haces. Lleva el botón «Añadir al calendario», que la pone en tu Google Calendar o te descarga un archivo que cualquier otra agenda entiende (Apple, Outlook…).",
            en: "On a phone it's the first thing you see when you open the app; on a computer it sits on the right: the day, the time in large type and who it's with. It carries an «Add to calendar» button that puts it in your Google Calendar or downloads a file any other diary understands (Apple, Outlook…).",
          }),
        },
        {
          t: "note",
          text: T({
            ca: "Afegir-la al teu calendari no és el mateix que reservar-la: la reserva ja està feta i és a l'app. Això només és una còpia perquè et surti a l'agenda del mòbil.",
            es: "Añadirla a tu calendario no es lo mismo que reservarla: la reserva ya está hecha y está en la app. Esto solo es una copia para que te salga en la agenda del móvil.",
            en: "Adding it to your calendar isn't the same as booking it: the booking is already made and lives in the app. This is only a copy so that it shows up in your phone's diary.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Properes reserves",
            es: "Próximas reservas",
            en: "Upcoming bookings",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Les tres següents, amb el dia gran a l'esquerra i el professional a la dreta. Des d'aquí mateix pots afegir-les al calendari o cancel·lar-les, sense passar pel calendari de Reserves. «Veure totes» porta a Reserves.",
            es: "Las tres siguientes, con el día grande a la izquierda y el profesional a la derecha. Desde aquí mismo puedes añadirlas al calendario o cancelarlas, sin pasar por el calendario de Reservas. «Ver todas» lleva a Reservas.",
            en: "The next three, with the day in large type on the left and the trainer or physio on the right. From here you can add them to your calendar or cancel them without going through the Bookings calendar. «See all» takes you to Bookings.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Bons actius",
            es: "Bonos activos",
            en: "Active passes",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Una targeta per bo, amb el servei, les sessions que et queden de les que tenia, l'estat i la data de caducitat si en té. La barra de sota creix a mesura que el vas gastant: mostra el que has consumit, no el que et queda.",
            es: "Una tarjeta por bono, con el servicio, las sesiones que te quedan de las que tenía, el estado y la fecha de caducidad si la tiene. La barra de abajo crece a medida que lo vas gastando: muestra lo que has consumido, no lo que te queda.",
            en: "One card per pass, with the service, how many of its sessions are left, the status and the expiry date if it has one. The bar underneath grows as you use it up: it shows what you've spent, not what's left.",
          }),
        },
        ...(s.modules.comunitat
          ? ([
              {
                t: "h",
                text: T({ ca: "Comunitat", es: "Comunidad", en: "Community" }),
              },
              {
                t: "p",
                text: T({
                  ca: "Si el centre ha publicat anuncis o ha obert alguna enquesta, els primers els veus aquí mateix, sense haver d'entrar a Comunitat.",
                  es: "Si el centro ha publicado anuncios o ha abierto alguna encuesta, los primeros los ves aquí mismo, sin tener que entrar en Comunidad.",
                  en: "If the centre has posted announcements or opened a poll, you see the first few right here without going into Community.",
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
                  es: "Regalar y recomendar",
                  en: "Gifting and recommending",
                }),
              },
              {
                t: "p",
                text: [
                  s.giftVouchersEnabled
                    ? T({
                        ca: "«Regala Vindi» porta a comprar un paquet de sessions per a una altra persona.",
                        es: "«Regala Vindi» lleva a comprar un paquete de sesiones para otra persona.",
                        en: "«Gift Vindi» takes you to buying a package of sessions for someone else.",
                      })
                    : "",
                  s.referralProgramActive
                    ? T({
                        ca: "«Porta un amic» obre el teu codi de referit aquí mateix, en una finestra, per copiar-lo i enviar-lo.",
                        es: "«Trae a un amigo» abre tu código de referido aquí mismo, en una ventana, para copiarlo y enviarlo.",
                        en: "«Bring a friend» opens your referral code right here, in a window, to copy and send.",
                      })
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
      title: T({ ca: "Bons", es: "Bonos", en: "Passes" }),
      blocks: [
        {
          t: "p",
          text: T({
            ca: "Un bo és un paquet de sessions ja pagades (o pendents de pagar) d'un servei concret. Sense un bo amb sessions disponibles no es pot reservar: el calendari no t'ensenyarà cap franja lliure. Aquesta secció té dues pestanyes, «Comprar bo nou» i «Els meus bons».",
            es: "Un bono es un paquete de sesiones ya pagadas (o pendientes de pagar) de un servicio concreto. Sin un bono con sesiones disponibles no se puede reservar: el calendario no te enseñará ninguna franja libre. Esta sección tiene dos pestañas, «Comprar bono nuevo» y «Mis bonos».",
            en: "A pass is a package of sessions for a particular service, already paid for (or awaiting payment). Without a pass with sessions available you can't book: the calendar won't show you a single free slot. This section has two tabs, «Buy a new pass» and «My passes».",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Els serveis",
            es: "Los servicios",
            en: "The services",
          }),
        },
        {
          t: "dl",
          items: [
            [
              T({
                ca: "EP Individual",
                es: "EP Individual",
                en: "1-to-1 PT",
              }),
              T({
                ca: "Entrenament personal, tu sol amb el professional.",
                es: "Entrenamiento personal, tú solo con el profesional.",
                en: "Personal training, just you and your trainer or physio.",
              }),
            ],
            [
              T({ ca: "EP Parelles", es: "EP Parejas", en: "PT for pairs" }),
              T({
                ca: "Entrenament personal de dos.",
                es: "Entrenamiento personal de dos.",
                en: "Personal training for two.",
              }),
            ],
            [
              T({ ca: "Grup reduït", es: "Grupo reducido", en: "Small group" }),
              T({
                ca: `Sessions en grup, amb un màxim de ${s.groupCapacity} persones.`,
                es: `Sesiones en grupo, con un máximo de ${s.groupCapacity} personas.`,
                en: `Group sessions, with a maximum of ${s.groupCapacity} people.`,
              }),
            ],
            [
              T({
                ca: "Fisioteràpia",
                es: "Fisioterapia",
                en: "Physiotherapy",
              }),
              T({
                ca: "Sessions de fisioteràpia.",
                es: "Sesiones de fisioterapia.",
                en: "Physiotherapy sessions.",
              }),
            ],
          ],
        },
        {
          t: "p",
          text: T({
            ca: "El catàleg de paquets i els preus els posa el centre, i no tots els serveis tenen per què estar disponibles en tot moment.",
            es: "El catálogo de paquetes y los precios los pone el centro, y no todos los servicios tienen por qué estar disponibles en todo momento.",
            en: "The catalogue of packages and their prices are set by the centre, and not every service has to be available at all times.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Comprar un bo, pas a pas",
            es: "Comprar un bono, paso a paso",
            en: "Buying a pass, step by step",
          }),
        },
        {
          t: "ol",
          items: [
            T({
              ca: "Tries el tipus de servei.",
              es: "Eliges el tipo de servicio.",
              en: "Choose the type of service.",
            }),
            T({
              ca: "Tries el paquet: cada un diu quantes sessions porta i què val.",
              es: "Eliges el paquete: cada uno dice cuántas sesiones lleva y cuánto vale.",
              en: "Choose the package: each one says how many sessions it includes and what it costs.",
            }),
            T({
              ca: "Tries com el pagues.",
              es: "Eliges cómo lo pagas.",
              en: "Choose how you pay for it.",
            }),
          ],
        },
        {
          t: "p",
          text: T({
            ca: "Abans de crear res et sortirà una finestra amb el resum del que has triat i una casella per acceptar les condicions de compra. Fins que no la marquis, el botó de confirmar no s'activa.",
            es: "Antes de crear nada te saldrá una ventana con el resumen de lo que has elegido y una casilla para aceptar las condiciones de compra. Hasta que no la marques, el botón de confirmar no se activa.",
            en: "Before anything is created you get a window with a summary of what you've chosen and a box to accept the terms of purchase. The confirm button stays disabled until you tick it.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Ofertes i descomptes",
            es: "Ofertas y descuentos",
            en: "Offers and discounts",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Si el centre té una oferta activa sobre un paquet, el preu ratllat i el preu final surten a la mateixa targeta. Els descomptes no se sumen: si tens un descompte de referit pendent i alhora hi ha una oferta, s'aplica el que et surti millor i l'altre es guarda per a la propera compra. L'app t'ho diu explícitament abans de pagar.",
            es: "Si el centro tiene una oferta activa sobre un paquete, el precio tachado y el precio final salen en la misma tarjeta. Los descuentos no se suman: si tienes un descuento de referido pendiente y a la vez hay una oferta, se aplica el que te salga mejor y el otro se guarda para la próxima compra. La app te lo dice explícitamente antes de pagar.",
            en: "If the centre has an offer running on a package, the struck-through price and the final price appear on the same card. Discounts don't stack: if you have a referral discount pending and there's also an offer, whichever works out better for you is applied and the other is saved for your next purchase. The app tells you this explicitly before you pay.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Pagar al centre",
            es: "Pagar en el centro",
            en: "Paying at the centre",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "El bo es crea a l'instant amb l'estat «Pendent de pagament» i el pagues en efectiu quan vagis. No és una reserva a mitges: les sessions ja les pots fer servir per reservar des del primer moment. L'estat passa a «Actiu» quan el centre registra el cobrament.",
            es: "El bono se crea al instante con el estado «Pendiente de pago» y lo pagas en efectivo cuando vayas. No es una reserva a medias: las sesiones ya las puedes usar para reservar desde el primer momento. El estado pasa a «Activo» cuando el centro registra el cobro.",
            en: "The pass is created straight away with the status «Awaiting payment» and you pay for it in cash when you next go in. It isn't a half-made booking: you can use the sessions to book from the outset. The status changes to «Active» when the centre records the payment.",
          }),
        },
        ...(s.pendingPaymentCancelEnabled && s.pendingPaymentCancelHours
          ? ([
              {
                t: "warn",
                text: T({
                  ca: `Un bo pendent de pagament no ho pot estar per sempre: si passen ${s.pendingPaymentCancelHours} h des de la primera reserva que hi facis sense que s'hagi cobrat, el bo s'anul·la i les sessions que hi tinguessis reservades es cancel·len. Rebràs un correu si això passa.`,
                  es: `Un bono pendiente de pago no puede estarlo para siempre: si pasan ${s.pendingPaymentCancelHours} h desde la primera reserva que hagas con él sin que se haya cobrado, el bono se anula y las sesiones que tuvieras reservadas se cancelan. Recibirás un correo si esto ocurre.`,
                  en: `A pass awaiting payment can't stay that way for ever: if ${s.pendingPaymentCancelHours} h pass from the first booking you make with it without payment being recorded, the pass is cancelled and any sessions you had booked with it are cancelled too. You'll get an email if that happens.`,
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
                  es: "Pagar con tarjeta",
                  en: "Paying by card",
                }),
              },
              {
                t: "p",
                text: T({
                  ca: "Et portem a la pàgina de pagament de Stripe. Les dades de la targeta no passen mai pel nostre domini: les recull Stripe directament.",
                  es: "Te llevamos a la página de pago de Stripe. Los datos de la tarjeta no pasan nunca por nuestro dominio: los recoge Stripe directamente.",
                  en: "We take you to Stripe's payment page. Your card details never pass through our domain: Stripe collects them directly.",
                }),
              },
              {
                t: "p",
                text: T({
                  ca: "Prémer «Pagar amb targeta» no crea res encara. El bo neix quan el banc confirma el cobrament. Per això, en tornar, pots trobar-te una pantalla que diu «Estem confirmant el pagament»: vol dir que la confirmació encara no ha arribat. No cal que facis res ni que tornis a pagar; en poca estona el bo apareix sol.",
                  es: "Pulsar «Pagar con tarjeta» no crea nada todavía. El bono nace cuando el banco confirma el cobro. Por eso, al volver, puedes encontrarte una pantalla que dice «Estamos confirmando el pago»: quiere decir que la confirmación aún no ha llegado. No hace falta que hagas nada ni que vuelvas a pagar; en poco rato el bono aparece solo.",
                  en: "Pressing «Pay by card» doesn't create anything yet. The pass comes into being when the bank confirms the payment. That's why, on your way back, you may meet a screen saying «We're confirming your payment»: it means the confirmation hasn't arrived yet. There's nothing for you to do and nothing to pay again; the pass appears on its own shortly.",
                }),
              },
              {
                t: "warn",
                text: T({
                  ca: `Si passa una hora i el bo segueix sense sortir tot i que el banc t'ha cobrat, avisa el centre (${CONTACTE_CENTRE}). El que no s'ha de fer és tornar a pagar.`,
                  es: `Si pasa una hora y el bono sigue sin salir aunque el banco te haya cobrado, avisa al centro (${CONTACTE_CENTRE}). Lo que no hay que hacer es volver a pagar.`,
                  en: `If an hour goes by and the pass still hasn't appeared even though the bank has charged you, let the centre know (${CONTACTE_CENTRE}). What you shouldn't do is pay again.`,
                }),
              },
              {
                t: "note",
                text: T({
                  ca: "Si tanques la pestanya de Stripe a mitges, no es crea ni es cobra res. Pots tornar-hi quan vulguis.",
                  es: "Si cierras la pestaña de Stripe a medias, no se crea ni se cobra nada. Puedes volver cuando quieras.",
                  en: "If you close the Stripe tab halfway through, nothing is created and nothing is charged. You can come back whenever you like.",
                }),
              },
            ] as Block[])
          : ([
              {
                t: "note",
                text: T({
                  ca: "Ara mateix el centre no accepta pagament amb targeta des de l'app: els bons es paguen al centre.",
                  es: "Ahora mismo el centro no acepta pago con tarjeta desde la app: los bonos se pagan en el centro.",
                  en: "The centre doesn't currently accept card payment through the app: passes are paid for at the centre.",
                }),
              },
            ] as Block[])),
        ...(s.subscriptionsEnabled
          ? ([
              {
                t: "h",
                text: T({
                  ca: "La subscripció mensual",
                  es: "La suscripción mensual",
                  en: "The monthly subscription",
                }),
              },
              {
                t: "p",
                text: T({
                  ca: `Als bons de Grup reduït, a més de comprar-ne un de solt, pots subscriure-t'hi: reps aquestes mateixes sessions cada mes sense haver de tornar a comprar res. El dia de renovació és el dia del mes en què t'hi dones d'alta, i te'l diem abans de confirmar.`,
                  es: `En los bonos de Grupo reducido, además de comprar uno suelto, puedes suscribirte: recibes estas mismas sesiones cada mes sin tener que volver a comprar nada. El día de renovación es el día del mes en que te das de alta, y te lo decimos antes de confirmar.`,
                  en: `With Small group passes, as well as buying one outright you can subscribe: you get those same sessions every month without having to buy anything again. Your renewal day is the day of the month you signed up, and we tell you which it is before you confirm.`,
                }),
              },
              {
                t: "p",
                text: T({
                  ca: "El preu et queda congelat: encara que la tarifa del centre pugi, tu segueixes pagant el que pagaves. Només se'n pot tenir una de viva alhora.",
                  es: "El precio te queda congelado: aunque la tarifa del centro suba, tú sigues pagando lo que pagabas. Solo se puede tener una viva a la vez.",
                  en: "Your price is frozen: even if the centre's rate goes up, you carry on paying what you were paying. You can only have one running at a time.",
                }),
              },
              {
                t: "warn",
                text: T({
                  ca: "Les sessions que no facis servir NO s'acumulen per al mes següent. Ara bé, reservar ja compta: si al calendari hi ha franges del mes que ve, pots reservar-les amb les sessions d'aquest mes i no perdre-les.",
                  es: "Las sesiones que no uses NO se acumulan para el mes siguiente. Ahora bien, reservar ya cuenta: si en el calendario hay franjas del mes que viene, puedes reservarlas con las sesiones de este mes y no perderlas.",
                  en: "Sessions you don't use do NOT roll over to the next month. Booking counts, though: if there are slots for next month on the calendar, you can book them with this month's sessions and not lose them.",
                }),
              },
              {
                t: "p",
                text: s.cardPayments
                  ? T({
                      ca: "La pots pagar de dues maneres: al centre, en efectiu, com un bo qualsevol; o amb targeta, i llavors es cobra sola cada mes.",
                      es: "La puedes pagar de dos maneras: en el centro, en efectivo, como un bono cualquiera; o con tarjeta, y entonces se cobra sola cada mes.",
                      en: "You can pay for it two ways: at the centre in cash, like any other pass; or by card, in which case it charges itself each month.",
                    })
                  : T({
                      ca: "Es paga al centre, en efectiu, com un bo qualsevol.",
                      es: "Se paga en el centro, en efectivo, como un bono cualquiera.",
                      en: "It's paid for at the centre in cash, like any other pass.",
                    }),
              },
              {
                t: "h",
                text: T({
                  ca: "Què veus a «Els meus bons»",
                  es: "Qué ves en «Mis bonos»",
                  en: "What you see under «My passes»",
                }),
              },
              {
                t: "p",
                text: T({
                  ca: "La subscripció té el seu propi bloc a dalt de tot, separat dels bons: el que hi surt no és una compra que has fet sinó el que passarà cada mes. Hi trobes el preu, el dia de renovació, com es paga, l'estat i quantes sessions et queden del mes en curs.",
                  es: "La suscripción tiene su propio bloque arriba del todo, separado de los bonos: lo que sale ahí no es una compra que hayas hecho sino lo que pasará cada mes. Encuentras el precio, el día de renovación, cómo se paga, el estado y cuántas sesiones te quedan del mes en curso.",
                  en: "The subscription has its own block right at the top, separate from the passes: what it shows isn't a purchase you made but what will happen each month. You'll find the price, the renewal day, how it's paid, the status and how many sessions are left in the current month.",
                }),
              },
              ...(s.subscriptionExtraSessionsMax > 0
                ? ([
                    {
                      t: "h",
                      text: T({
                        ca: "Demanar una sessió extra",
                        es: "Pedir una sesión extra",
                        en: "Asking for an extra session",
                      }),
                    },
                    {
                      t: "p",
                      text: T({
                        ca: `Si t'has quedat sense sessions abans que acabi el mes, pots demanar-ne fins a ${s.subscriptionExtraSessionsMax} de més sense esperar la renovació. Es cobra al preu per sessió del teu bo, no al d'una sessió solta, i caduca amb el mes en curs com la resta.`,
                        es: `Si te has quedado sin sesiones antes de que acabe el mes, puedes pedir hasta ${s.subscriptionExtraSessionsMax} de más sin esperar a la renovación. Se cobra al precio por sesión de tu bono, no al de una sesión suelta, y caduca con el mes en curso como el resto.`,
                        en: `If you run out of sessions before the month is over, you can ask for up to ${s.subscriptionExtraSessionsMax} more without waiting for the renewal. It's charged at your pass's per-session price rather than the price of a one-off session, and it expires with the current month like the rest.`,
                      }),
                    },
                    {
                      t: "p",
                      text: T({
                        ca: "El botó només apareix quan de debò se'n pot demanar una: si encara et queden sessions del mes, primer has de fer servir aquelles.",
                        es: "El botón solo aparece cuando de verdad se puede pedir una: si todavía te quedan sesiones del mes, primero tienes que usar aquellas.",
                        en: "The button only appears when one can genuinely be requested: if you still have sessions left this month, you have to use those first.",
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
                        es: "Cambiar la tarjeta o ver los recibos",
                        en: "Changing your card or seeing your receipts",
                      }),
                    },
                    {
                      t: "p",
                      text: T({
                        ca: "Si la pagues amb targeta, el botó «Canviar la targeta o veure els rebuts» obre la pàgina de gestió de Stripe, on pots posar-hi una targeta nova i descarregar els comprovants de cada mes.",
                        es: "Si la pagas con tarjeta, el botón «Cambiar la tarjeta o ver los recibos» abre la página de gestión de Stripe, donde puedes poner una tarjeta nueva y descargar los comprobantes de cada mes.",
                        en: "If you pay by card, the «Change card or view receipts» button opens Stripe's management page, where you can enter a new card and download each month's receipt.",
                      }),
                    },
                  ] as Block[])
                : []),
              {
                t: "h",
                text: T({
                  ca: "Donar-te de baixa",
                  es: "Darte de baja",
                  en: "Cancelling your subscription",
                }),
              },
              {
                t: "p",
                text: T({
                  ca: "Amb «Donar-me de baixa». No perds el mes que ja tens pagat: el conserves sencer i simplement no se'n cobra cap més. Un cop demanada, l'app t'ho recorda al mateix bloc.",
                  es: "Con «Darme de baja». No pierdes el mes que ya tienes pagado: lo conservas entero y simplemente no se cobra ninguno más. Una vez pedida, la app te lo recuerda en el mismo bloque.",
                  en: "Use «Cancel my subscription». You don't lose the month you've already paid for: you keep it in full and simply nothing more is charged. Once requested, the app reminds you of it in the same block.",
                }),
              },
              {
                t: "h",
                text: T({
                  ca: "Si la subscripció s'atura",
                  es: "Si la suscripción se detiene",
                  en: "If your subscription stops",
                }),
              },
              {
                t: "dl",
                items: [
                  [
                    T({
                      ca: "Aturada per impagament",
                      es: "Detenida por impago",
                      en: "Stopped for non-payment",
                    }),
                    T({
                      ca: "Vol dir que hi ha un mes sense cobrar. Es reprèn sola quan el pagues al centre. Mentre estigui així no es renova.",
                      es: "Quiere decir que hay un mes sin cobrar. Se reanuda sola cuando lo pagas en el centro. Mientras esté así no se renueva.",
                      en: "It means a month hasn't been paid. It restarts on its own once you pay at the centre. While it's in this state it doesn't renew.",
                    }),
                  ],
                  [
                    T({ ca: "Congelada", es: "Congelada", en: "Frozen" }),
                    T({
                      ca: "L'ha aturada el centre, no tu. No has de pagar res mentre duri i el temps aturat no el perds: en reprendre-la, la renovació es retarda els mateixos dies. Mentre estigui congelada no hi ha cap botó, perquè no hi ha res que puguis fer-hi tu.",
                      es: "La ha detenido el centro, no tú. No tienes que pagar nada mientras dure y el tiempo detenido no lo pierdes: al reanudarla, la renovación se retrasa los mismos días. Mientras esté congelada no hay ningún botón, porque no hay nada que puedas hacer tú.",
                      en: "The centre stopped it, not you. You don't pay anything while it lasts and you don't lose the time it's stopped: when it restarts, the renewal shifts back by the same number of days. While it's frozen there's no button, because there's nothing for you to do.",
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
            es: "Mis bonos",
            en: "My passes",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "La llista de tot el que has comprat, amb les sessions que et queden de cada bo, el preu i l'estat. Aquests són els estats possibles:",
            es: "La lista de todo lo que has comprado, con las sesiones que te quedan de cada bono, el precio y el estado. Estos son los estados posibles:",
            en: "The list of everything you've bought, with how many sessions are left on each pass, the price and the status. These are the possible statuses:",
          }),
        },
        {
          t: "dl",
          items: [
            [
              T({ ca: "Actiu", es: "Activo", en: "Active" }),
              T({
                ca: "Pagat i amb sessions disponibles.",
                es: "Pagado y con sesiones disponibles.",
                en: "Paid for, with sessions available.",
              }),
            ],
            [
              T({
                ca: "Pendent de pagament",
                es: "Pendiente de pago",
                en: "Awaiting payment",
              }),
              T({
                ca: "Creat però encara no cobrat. Ja el pots fer servir per reservar.",
                es: "Creado pero todavía no cobrado. Ya lo puedes usar para reservar.",
                en: "Created but not yet paid for. You can already use it to book.",
              }),
            ],
            [
              T({ ca: "Completat", es: "Completado", en: "Completed" }),
              T({
                ca: "Has gastat totes les sessions.",
                es: "Has gastado todas las sesiones.",
                en: "You've used up every session.",
              }),
            ],
            [
              T({ ca: "Caducat", es: "Caducado", en: "Expired" }),
              T({
                ca: "Ha passat la data de validesa amb sessions sense fer.",
                es: "Ha pasado la fecha de validez con sesiones sin hacer.",
                en: "The validity date passed with sessions still unused.",
              }),
            ],
            [
              T({
                ca: "Anul·lat per impagament",
                es: "Anulado por impago",
                en: "Cancelled for non-payment",
              }),
              T({
                ca: "Era pendent de pagament, no es va cobrar a temps i s'ha donat de baixa.",
                es: "Estaba pendiente de pago, no se cobró a tiempo y se ha dado de baja.",
                en: "It was awaiting payment, wasn't paid in time and has been withdrawn.",
              }),
            ],
            [
              T({ ca: "Cancel·lat", es: "Cancelado", en: "Cancelled" }),
              T({
                ca: "L'ha anul·lat el centre.",
                es: "Lo ha anulado el centro.",
                en: "The centre cancelled it.",
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
                  es: `Los bonos caducan ${s.bonoExpiryMonths} meses después de la compra. Cada bono lleva su propia fecha: si el centro cambia este plazo, los que ya tuvieras comprados no se tocan.`,
                  en: `Passes expire ${s.bonoExpiryMonths} months after purchase. Each pass carries its own date: if the centre changes this period, the ones you'd already bought are left alone.`,
                }),
              },
            ] as Block[])
          : ([
              {
                t: "note",
                text: T({
                  ca: "Ara mateix el centre no posa data de caducitat als bons nous. Si algun dels teus en porta una, és la que tenia el dia que el vas comprar i es respecta.",
                  es: "Ahora mismo el centro no pone fecha de caducidad a los bonos nuevos. Si alguno de los tuyos lleva una, es la que tenía el día que lo compraste y se respeta.",
                  en: "The centre isn't currently setting an expiry date on new passes. If one of yours has one, it's the date it had the day you bought it and it stands.",
                }),
              },
            ] as Block[])),
        {
          t: "h",
          text: T({
            ca: "Historial de pagaments",
            es: "Historial de pagos",
            en: "Payment history",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Sota els bons hi ha la llista dels cobraments registrats a nom teu, amb la data, l'import i si van ser en efectiu o amb targeta.",
            es: "Bajo los bonos está la lista de los cobros registrados a tu nombre, con la fecha, el importe y si fueron en efectivo o con tarjeta.",
            en: "Below your passes is the list of payments recorded in your name, with the date, the amount and whether they were cash or card.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Tinc un codi de regal",
            es: "Tengo un código de regalo",
            en: "I have a gift code",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "A la pestanya «Comprar bo nou», a dalt, hi ha el camp «Tens un codi de regal?». Escriu-hi el codi (té la forma VINDI-XXXX-XXXX) i les sessions s'afegeixen al teu compte com un bo més.",
            es: "En la pestaña «Comprar bono nuevo», arriba, está el campo «¿Tienes un código de regalo?». Escribe ahí el código (tiene la forma VINDI-XXXX-XXXX) y las sesiones se añaden a tu cuenta como un bono más.",
            en: "On the «Buy a new pass» tab, at the top, there's the field «Got a gift code?». Enter the code there (it looks like VINDI-XXXX-XXXX) and the sessions are added to your account as another pass.",
          }),
        },
        {
          t: "p",
          text: T({
            ca: `Si el codi no s'accepta, el missatge et diu per què: que no existeix, que ja s'ha bescanviat, que ha caducat, que s'ha anul·lat o que el centre encara no n'ha confirmat el cobrament. En els tres últims casos no has fet res malament i qui ho pot resoldre és el centre (${CONTACTE_CENTRE}).`,
            es: `Si el código no se acepta, el mensaje te dice por qué: que no existe, que ya se ha canjeado, que ha caducado, que se ha anulado o que el centro todavía no ha confirmado su cobro. En los tres últimos casos no has hecho nada mal y quien lo puede resolver es el centro (${CONTACTE_CENTRE}).`,
            en: `If the code isn't accepted, the message tells you why: it doesn't exist, it's already been redeemed, it has expired, it was cancelled, or the centre hasn't confirmed payment for it yet. In the last three cases you've done nothing wrong and the centre is who can sort it out (${CONTACTE_CENTRE}).`,
          }),
        },
      ],
    },

    // ─────────────────────────── 4 ───────────────────────────
    {
      id: "reserves",
      title: T({ ca: "Reserves", es: "Reservas", en: "Bookings" }),
      blocks: [
        {
          t: "p",
          text: T({
            ca: "Aquí es reserva. El calendari ensenya les franges lliures de TOTS els professionals del centre, filtrades pel que tu pots fer: només hi surt el que pots reservar amb els bons que tens.",
            es: "Aquí se reserva. El calendario enseña las franjas libres de TODOS los profesionales del centro, filtradas por lo que tú puedes hacer: solo sale lo que puedes reservar con los bonos que tienes.",
            en: "This is where you book. The calendar shows the free slots of EVERY trainer and physio at the centre, filtered by what you can do: only what you can book with the passes you hold appears.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Llegir el calendari",
            es: "Leer el calendario",
            en: "Reading the calendar",
          }),
        },
        {
          t: "p",
          text: T({
            ca: `Es pot mirar per dia o per setmana —al mòbil s'obre per dia— i moure't endavant i endarrere amb les fletxes. L'horari que es mostra va de les ${hhmm(s.openingHour)} a les ${hhmm(s.closingHour)}, que és l'horari del centre.`,
            es: `Se puede mirar por día o por semana —en el móvil se abre por día— y moverte adelante y atrás con las flechas. El horario que se muestra va de las ${hhmm(s.openingHour)} a las ${hhmm(s.closingHour)}, que es el horario del centro.`,
            en: `You can view it by day or by week —on a phone it opens by day— and move back and forth with the arrows. The hours shown run from ${hhmm(s.openingHour)} to ${hhmm(s.closingHour)}, which is the centre's opening time.`,
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Cada professional té el seu color, i la llegenda de sota el calendari diu quin és de qui. A dalt hi ha dos filtres, per servei i per professional, per si vols mirar només una cosa. Si tens un professional assignat, el filtre ja hi ve posat.",
            es: "Cada profesional tiene su color, y la leyenda de debajo del calendario dice cuál es de quién. Arriba hay dos filtros, por servicio y por profesional, por si quieres mirar solo una cosa. Si tienes un profesional asignado, el filtro ya viene puesto.",
            en: "Each professional has their own colour, and the key below the calendar says which is whose. At the top there are two filters, by service and by professional, in case you want to look at just one thing. If you have a professional assigned to you, that filter comes ready set.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Què vol dir cada casella",
            es: "Qué quiere decir cada casilla",
            en: "What each cell means",
          }),
        },
        {
          t: "dl",
          items: [
            [
              T({
                ca: "Una franja de color amb el nom d'un servei",
                es: "Una franja de color con el nombre de un servicio",
                en: "A coloured slot with a service name",
              }),
              T({
                ca: "És lliure i la pots reservar. Si un professional ofereix dues coses a la mateixa hora, en surt una per cada servei que tu puguis reservar.",
                es: "Está libre y la puedes reservar. Si un profesional ofrece dos cosas a la misma hora, sale una por cada servicio que tú puedas reservar.",
                en: "It's free and you can book it. If a professional offers two things at the same hour, one appears for each service you're able to book.",
              }),
            ],
            [
              T({ ca: "Ocupat", es: "Ocupado", en: "Taken" }),
              T({
                ca: "Aquella hora ja la té ocupada una altra persona. No hi veus mai qui és.",
                es: "Esa hora ya la tiene ocupada otra persona. No ves nunca quién es.",
                en: "That hour is already taken by someone else. You never see who.",
              }),
            ],
            [
              T({
                ca: `Un comptador tipus «2/${s.groupCapacity}»`,
                es: `Un contador tipo «2/${s.groupCapacity}»`,
                en: `A counter such as «2/${s.groupCapacity}»`,
              }),
              T({
                ca: "És una sessió de Grup reduït que ja està en marxa i encara té places. El color et diu com va: verd si hi ha lloc de sobres, ambre si en queda una de sola, vermell si està plena.",
                es: "Es una sesión de Grupo reducido que ya está en marcha y todavía tiene plazas. El color te dice cómo va: verde si hay sitio de sobra, ámbar si queda una sola, rojo si está llena.",
                en: "It's a Small group session already under way that still has spaces. The colour tells you how it's going: green if there's plenty of room, amber if only one space is left, red if it's full.",
              }),
            ],
            [
              T({
                ca: "La teva sessió",
                es: "Tu sesión",
                en: "Your session",
              }),
              T({
                ca: "Les que ja tens reservades surten sempre, encara que hi hagi filtres posats.",
                es: "Las que ya tienes reservadas salen siempre, aunque haya filtros puestos.",
                en: "The ones you've already booked always show, even with filters applied.",
              }),
            ],
          ],
        },
        {
          t: "h",
          text: T({
            ca: "Per què hi ha franges que no et surten",
            es: "Por qué hay franjas que no te salen",
            en: "Why some slots don't appear",
          }),
        },
        {
          t: "ul",
          items: [
            T({
              ca: "No tens cap bo actiu amb sessions disponibles: sense bo no hi ha res reservable, i l'app t'ho diu a dalt de tot.",
              es: "No tienes ningún bono activo con sesiones disponibles: sin bono no hay nada reservable, y la app te lo dice arriba del todo.",
              en: "You have no active pass with sessions available: without a pass nothing is bookable, and the app says so right at the top.",
            }),
            T({
              ca: "Aquell professional no ofereix cap dels serveis dels teus bons. Si has filtrat per ell, l'app t'ho avisa i t'ofereix tornar a veure'ls tots.",
              es: "Ese profesional no ofrece ninguno de los servicios de tus bonos. Si has filtrado por él, la app te avisa y te ofrece volver a verlos todos.",
              en: "That professional doesn't offer any of the services your passes cover. If you've filtered by them, the app warns you and offers to show everyone again.",
            }),
            T({
              ca: "Ja tens una reserva confirmada a aquella hora: no se te'n proposa una altra al mateix moment.",
              es: "Ya tienes una reserva confirmada a esa hora: no se te propone otra en el mismo momento.",
              en: "You already have a confirmed booking at that hour: another one isn't offered at the same time.",
            }),
            T({
              ca: "És una hora que ja ha passat, o cau fora de l'horari del centre.",
              es: "Es una hora que ya ha pasado, o cae fuera del horario del centro.",
              en: "The hour has already passed, or it falls outside the centre's opening times.",
            }),
            ...(s.minBookingHours > 0
              ? [
                  T({
                    ca: `És massa a prop: el centre demana un mínim de ${s.minBookingHours} h d'antelació per reservar.`,
                    es: `Está demasiado cerca: el centro pide un mínimo de ${s.minBookingHours} h de antelación para reservar.`,
                    en: `It's too soon: the centre requires at least ${s.minBookingHours} h notice to book.`,
                  }),
                ]
              : []),
          ],
        },
        {
          t: "h",
          text: T({
            ca: "Reservar una sessió",
            es: "Reservar una sesión",
            en: "Booking a session",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Cliques la franja i s'obre una finestra amb el dia, l'hora, el servei i el professional. Prems «Reservar» i ja està: la sessió es descompta del bo i la confirmació surt al moment, amb el botó per afegir-la al teu calendari.",
            es: "Haces clic en la franja y se abre una ventana con el día, la hora, el servicio y el profesional. Pulsas «Reservar» y ya está: la sesión se descuenta del bono y la confirmación sale al momento, con el botón para añadirla a tu calendario.",
            en: "You click the slot and a window opens with the day, the time, the service and the professional. You press «Book» and that's it: the session comes off your pass and the confirmation appears straight away, with the button to add it to your calendar.",
          }),
        },
        {
          t: "note",
          text: T({
            ca: "Mentre la reserva viatja, el botó es bloqueja i diu «Reservant…». És a posta: evita que un doble clic acabi en dues reserves.",
            es: "Mientras la reserva viaja, el botón se bloquea y dice «Reservando…». Es a propósito: evita que un doble clic acabe en dos reservas.",
            en: "While the booking is in flight the button locks and reads «Booking…». That's deliberate: it stops a double click ending up as two bookings.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Les sessions de grup",
            es: "Las sesiones de grupo",
            en: "Group sessions",
          }),
        },
        {
          t: "p",
          text: T({
            ca: `Un Grup reduït admet ${s.groupCapacity} persones. En obrir la finestra d'una sessió de grup veus qui ja s'hi ha apuntat; a la graella del calendari no hi surt cap nom, només el comptador, perquè el calendari es veu de lluny i sense voler.`,
            es: `Un Grupo reducido admite ${s.groupCapacity} personas. Al abrir la ventana de una sesión de grupo ves quién se ha apuntado ya; en la parrilla del calendario no sale ningún nombre, solo el contador, porque el calendario se ve de lejos y sin querer.`,
            en: `A Small group takes ${s.groupCapacity} people. When you open a group session's window you see who has already joined; on the calendar grid no names appear, only the counter, because a calendar gets seen from a distance and by accident.`,
          }),
        },
        {
          t: "h",
          text: T({
            ca: "La teva sessió: consultar-la i cancel·lar-la",
            es: "Tu sesión: consultarla y cancelarla",
            en: "Your session: checking it and cancelling it",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Cliques la teva sessió al calendari i s'obre amb el detall, el botó d'afegir-la al calendari i el de cancel·lar. Cancel·lar demana una confirmació; la sessió torna al teu bo.",
            es: "Haces clic en tu sesión en el calendario y se abre con el detalle, el botón de añadirla al calendario y el de cancelar. Cancelar pide una confirmación; la sesión vuelve a tu bono.",
            en: "Click your session on the calendar and it opens with the details, the button to add it to your calendar and the one to cancel. Cancelling asks for confirmation; the session goes back onto your pass.",
          }),
        },
        {
          t: "warn",
          text: T({
            ca: `Les reserves es poden cancel·lar fins a ${s.minCancellationHours} h abans. Passat aquest punt el botó desapareix i l'app t'explica per què. Si tens una urgència, parla amb el centre (${CONTACTE_CENTRE}): la política de cancel·lació la porta el centre, no l'app.`,
            es: `Las reservas se pueden cancelar hasta ${s.minCancellationHours} h antes. Pasado ese punto el botón desaparece y la app te explica por qué. Si tienes una urgencia, habla con el centro (${CONTACTE_CENTRE}): la política de cancelación la lleva el centro, no la app.`,
            en: `Bookings can be cancelled up to ${s.minCancellationHours} h beforehand. Past that point the button disappears and the app explains why. If you have an emergency, talk to the centre (${CONTACTE_CENTRE}): the cancellation policy belongs to the centre, not to the app.`,
          }),
        },
        ...(s.waitlistEnabled
          ? ([
              {
                t: "h",
                text: T({
                  ca: "La llista d'espera",
                  es: "La lista de espera",
                  en: "The waiting list",
                }),
              },
              {
                t: "p",
                text: T({
                  ca: "Quan una sessió de grup està plena no és un carreró sense sortida: pots apuntar-te a la llista d'espera. Si algú cancel·la, la plaça passa a ser teva automàticament, es fa la reserva sola, es descompta la sessió del bo i t'avisem per correu.",
                  es: "Cuando una sesión de grupo está llena no es un callejón sin salida: puedes apuntarte a la lista de espera. Si alguien cancela, la plaza pasa a ser tuya automáticamente, se hace la reserva sola, se descuenta la sesión del bono y te avisamos por correo.",
                  en: "A full group session isn't a dead end: you can join the waiting list. If someone cancels, the space becomes yours automatically, the booking makes itself, the session comes off your pass and we email you.",
                }),
              },
              {
                t: "warn",
                text: T({
                  ca: "Aquest avís no es pot desactivar, i és important que el llegeixis: la reserva es fa sense que tu hi tornis a prémer res, i si no ho saps no hi vas i la sessió es crema igualment.",
                  es: "Este aviso no se puede desactivar, y es importante que lo leas: la reserva se hace sin que tú vuelvas a pulsar nada, y si no lo sabes no vas y la sesión se quema igualmente.",
                  en: "This notice can't be switched off, and it matters that you read it: the booking is made without you pressing anything again, and if you don't know about it you don't turn up and the session is burnt all the same.",
                }),
              },
              {
                t: "p",
                text: T({
                  ca: "Mentre hi siguis, la franja et surt marcada com que ets a la llista, i des d'allà mateix te'n pots donar de baixa.",
                  es: "Mientras estés en ella, la franja te sale marcada como que estás en la lista, y desde ahí mismo te puedes dar de baja.",
                  en: "While you're on it, the slot is marked to show you're on the list, and you can take yourself off from there.",
                }),
              },
            ] as Block[])
          : ([
              {
                t: "note",
                text: T({
                  ca: "Ara mateix el centre no accepta inscripcions noves a la llista d'espera. Si ja n'esperaves alguna d'abans, aquella segueix el seu curs i t'avisarem igual si s'allibera la plaça.",
                  es: "Ahora mismo el centro no acepta inscripciones nuevas en la lista de espera. Si ya esperabas alguna de antes, aquella sigue su curso y te avisaremos igual si se libera la plaza.",
                  en: "The centre isn't currently accepting new sign-ups to the waiting list. If you were already waiting for something, that carries on as before and we'll still let you know if a space frees up.",
                }),
              },
            ] as Block[])),
        {
          t: "h",
          text: T({
            ca: "Repetir una sessió en bucle (les sèries)",
            es: "Repetir una sesión en bucle (las series)",
            en: "Repeating a session (series)",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Si vols la mateixa franja cada setmana, no cal reservar-la una per una. Hi ha dues portes: la casella «Fer-ho recurrent» a la finestra de reservar, i el botó «Repetir en bucle a partir d'aquesta» a una sessió que ja tinguis reservada.",
            es: "Si quieres la misma franja cada semana, no hace falta reservarla una por una. Hay dos puertas: la casilla «Hacerlo recurrente» en la ventana de reservar, y el botón «Repetir en bucle a partir de esta» en una sesión que ya tengas reservada.",
            en: "If you want the same slot every week, there's no need to book it one at a time. There are two ways in: the «Make it recurring» box in the booking window, and the «Repeat from this one» button on a session you've already booked.",
          }),
        },
        {
          t: "ol",
          items: [
            T({
              ca: "Tries cada quant es repeteix: cada setmana, cada dues setmanes o cada mes.",
              es: "Eliges cada cuánto se repite: cada semana, cada dos semanas o cada mes.",
              en: "You choose how often it repeats: weekly, fortnightly or monthly.",
            }),
            T({
              ca: "Dius fins quan (una data) o quantes sessions en vols. Pots omplir-ne un o tots dos; amb tots dos, la sèrie s'atura amb el primer límit que arribi.",
              es: "Dices hasta cuándo (una fecha) o cuántas sesiones quieres. Puedes rellenar uno o los dos; con los dos, la serie se detiene con el primer límite que llegue.",
              en: "You say until when (a date) or how many sessions you want. You can fill in one or both; with both, the series stops at whichever limit comes first.",
            }),
            T({
              ca: "Si vols, obres «Si no hi ha plaça…» i ajustes què s'ha de fer amb les dates que estiguin ocupades.",
              es: "Si quieres, abres «Si no hay plaza…» y ajustas qué hay que hacer con las fechas que estén ocupadas.",
              en: "If you like, open «If there's no space…» and set what should happen with dates that are taken.",
            }),
            T({
              ca: "Prems «Veure les sessions»: es calcula la sèrie i te l'ensenyem sencera. Encara no s'ha reservat res.",
              es: "Pulsas «Ver las sesiones»: se calcula la serie y te la enseñamos entera. Todavía no se ha reservado nada.",
              en: "Press «See the sessions»: the series is worked out and shown to you in full. Nothing has been booked yet.",
            }),
            T({
              ca: "Revises la llista, acceptes les alternatives que t'agradin i prems «Confirmar sèrie».",
              es: "Revisas la lista, aceptas las alternativas que te gusten y pulsas «Confirmar serie».",
              en: "You look through the list, accept whichever alternatives suit you and press «Confirm series».",
            }),
          ],
        },
        {
          t: "note",
          text: T({
            ca: "Fins que no prems «Confirmar sèrie» no es reserva absolutament res. El pas de revisió és exactament perquè puguis veure on cauen les sessions abans de comprometre-les.",
            es: "Hasta que no pulsas «Confirmar serie» no se reserva absolutamente nada. El paso de revisión está exactamente para que puedas ver dónde caen las sesiones antes de comprometerlas.",
            en: "Until you press «Confirm series» absolutely nothing is booked. The review step exists precisely so you can see where the sessions land before committing them.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Les opcions de «Si no hi ha plaça…»",
            es: "Las opciones de «Si no hay plaza…»",
            en: "The «If there's no space…» options",
          }),
        },
        {
          t: "dl",
          items: [
            [
              T({
                ca: "Reservar només les disponibles",
                es: "Reservar solo las disponibles",
                en: "Book only the available ones",
              }),
              T({
                ca: "Ve marcada per defecte. Només es confirmen les dates amb plaça i la resta es descarten. Té prioritat sobre les altres dues.",
                es: "Viene marcada por defecto. Solo se confirman las fechas con plaza y el resto se descartan. Tiene prioridad sobre las otras dos.",
                en: "Ticked by default. Only dates with space are confirmed and the rest are dropped. It takes priority over the other two.",
              }),
            ],
            [
              T({
                ca: "Proposar alternatives automàtiques",
                es: "Proponer alternativas automáticas",
                en: "Suggest alternatives automatically",
              }),
              T({
                ca: "Per a les dates ocupades et suggerim la millor alternativa possible (una altra hora o un altre professional) i decideixes tu si l'acceptes, una per una.",
                es: "Para las fechas ocupadas te sugerimos la mejor alternativa posible (otra hora u otro profesional) y decides tú si la aceptas, una por una.",
                en: "For dates that are taken we suggest the best alternative we can (another hour or another professional) and you decide whether to accept, one by one.",
              }),
            ],
            ...(s.waitlistEnabled
              ? ([
                  [
                    T({
                      ca: "Afegir a la llista d'espera si no hi ha plaça",
                      es: "Añadir a la lista de espera si no hay plaza",
                      en: "Join the waiting list if there's no space",
                    }),
                    T({
                      ca: "Les dates plenes no es descarten: t'apuntem a la cua i, si algú cancel·la, la plaça és teva.",
                      es: "Las fechas llenas no se descartan: te apuntamos a la cola y, si alguien cancela, la plaza es tuya.",
                      en: "Full dates aren't dropped: we put you in the queue and, if someone cancels, the space is yours.",
                    }),
                  ],
                ] as [string, string][])
              : []),
            ...(s.subscriptionsEnabled
              ? ([
                  [
                    T({
                      ca: "Allargar-la sola cada mes",
                      es: "Alargarla sola cada mes",
                      en: "Extending it automatically each month",
                    }),
                    T({
                      ca: "Només surt si tens subscripció. Quan es renovi, es reserven soles les sessions que faltaven seguint el mateix patró. Si aquell mes la franja està ocupada, aquella sessió no es fa: mai se't canvia l'hora sense dir-t'ho.",
                      es: "Solo sale si tienes suscripción. Cuando se renueve, se reservan solas las sesiones que faltaban siguiendo el mismo patrón. Si ese mes la franja está ocupada, esa sesión no se hace: nunca se te cambia la hora sin decírtelo.",
                      en: "This only appears if you have a subscription. When it renews, the remaining sessions book themselves following the same pattern. If the slot is taken that month, that session simply doesn't happen: your time is never changed without telling you.",
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
            es: "Leer la revisión de la serie",
            en: "Reading the series review",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Cada data de la llista porta una etiqueta:",
            es: "Cada fecha de la lista lleva una etiqueta:",
            en: "Each date on the list carries a label:",
          }),
        },
        {
          t: "dl",
          items: [
            [
              T({ ca: "Confirmada", es: "Confirmada", en: "Confirmed" }),
              T({
                ca: "Hi ha plaça i es reservarà.",
                es: "Hay plaza y se reservará.",
                en: "There's space and it will be booked.",
              }),
            ],
            [
              T({
                ca: "Ja reservada",
                es: "Ya reservada",
                en: "Already booked",
              }),
              T({
                ca: "Aquella sessió ja la tenies. No es duplica: s'adopta a la sèrie, i si un dia cancel·les la sèrie sencera, se n'anirà amb ella.",
                es: "Esa sesión ya la tenías. No se duplica: se adopta en la serie, y si un día cancelas la serie entera, se irá con ella.",
                en: "You already had that session. It isn't duplicated: it's taken into the series, and if you one day cancel the whole series, it goes with it.",
              }),
            ],
            [
              T({
                ca: "Alternativa proposada",
                es: "Alternativa propuesta",
                en: "Alternative suggested",
              }),
              T({
                ca: "L'original està ocupada i te'n proposem una altra. No compta fins que prems «Accepta».",
                es: "La original está ocupada y te proponemos otra. No cuenta hasta que pulsas «Aceptar».",
                en: "The original is taken and we're offering another. It doesn't count until you press «Accept».",
              }),
            ],
            [
              T({
                ca: "Llista d'espera",
                es: "Lista de espera",
                en: "Waiting list",
              }),
              T({
                ca: "T'apuntarem a la cua d'aquella sessió.",
                es: "Te apuntaremos a la cola de esa sesión.",
                en: "We'll add you to the queue for that session.",
              }),
            ],
            [
              T({ ca: "Sense places", es: "Sin plazas", en: "No spaces" }),
              T({
                ca: "No es reservarà.",
                es: "No se reservará.",
                en: "It won't be booked.",
              }),
            ],
          ],
        },
        {
          t: "p",
          text: T({
            ca: "A sota hi ha el recompte i, si el bo no arriba per a totes, t'ho diem abans de confirmar: quantes es reserven ara i quantes queden fora. Si tens subscripció, les que no hi caben no es perden, es reservaran quan es renovi.",
            es: "Abajo está el recuento y, si el bono no llega para todas, te lo decimos antes de confirmar: cuántas se reservan ahora y cuántas quedan fuera. Si tienes suscripción, las que no caben no se pierden, se reservarán cuando se renueve.",
            en: "Below is the tally and, if the pass doesn't stretch to all of them, we tell you before you confirm: how many are being booked now and how many fall outside. If you have a subscription, the ones that don't fit aren't lost — they'll be booked when it renews.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Les meves sèries",
            es: "Mis series",
            en: "My series",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Les sèries vives surten en un bloc a dalt de la pantalla de Reserves, amb la freqüència, quantes sessions queden pendents i quina és la pròxima. Des d'allà pots cancel·lar-ne una de sencera.",
            es: "Las series vivas salen en un bloque arriba de la pantalla de Reservas, con la frecuencia, cuántas sesiones quedan pendientes y cuál es la próxima. Desde ahí puedes cancelar una entera.",
            en: "Live series appear in a block at the top of the Bookings screen, with the frequency, how many sessions are still pending and which is next. From there you can cancel a whole one.",
          }),
        },
        {
          t: "warn",
          text: T({
            ca: `Cancel·lar la sèrie anul·la totes les sessions futures d'aquella sèrie i les torna al teu bo. Les que ja siguin a menys de ${s.minCancellationHours} h es queden com estaven, i l'app et diu quantes n'han quedat.`,
            es: `Cancelar la serie anula todas las sesiones futuras de esa serie y las devuelve a tu bono. Las que ya estén a menos de ${s.minCancellationHours} h se quedan como estaban, y la app te dice cuántas han quedado.`,
            en: `Cancelling the series calls off every future session in it and returns them to your pass. Any that are already within ${s.minCancellationHours} h stay as they were, and the app tells you how many those are.`,
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Sessions passades",
            es: "Sesiones pasadas",
            en: "Past sessions",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Al final d'aquesta mateixa pantalla, sota el calendari, hi ha les sessions que ja has fet. És on pots mirar enrere: la data, el servei i amb qui la vas fer.",
            es: "Al final de esta misma pantalla, bajo el calendario, están las sesiones que ya has hecho. Es donde puedes mirar atrás: la fecha, el servicio y con quién la hiciste.",
            en: "At the foot of this same screen, below the calendar, are the sessions you've already done. It's where you can look back: the date, the service and who it was with.",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Si el teu professional hi ha deixat una nota de la sessió, la veuràs allà mateix, signada amb el seu nom i la data. No totes en tenen: la nota és opcional i l'escriu qui vol.",
            es: "Si tu profesional ha dejado una nota de la sesión, la verás ahí mismo, firmada con su nombre y la fecha. No todas la tienen: la nota es opcional y la escribe quien quiere.",
            en: "If your trainer or physio left a note about the session, you'll see it right there, signed with their name and the date. Not every session has one: the note is optional and written by whoever wants to.",
          }),
        },
      ],
    },

    // ─────────────────────────── 5 ───────────────────────────
    {
      id: "exercicis",
      title: T({ ca: "Exercicis", es: "Ejercicios", en: "Exercises" }),
      blocks: [
        {
          t: "p",
          text: T({
            ca: "Dues coses a la mateixa pantalla: el que el teu professional t'ha posat a tu, i tot el que hi ha a la biblioteca del centre. Les de dalt van amb un accent lila justament perquè es distingeixin d'un cop d'ull.",
            es: "Dos cosas en la misma pantalla: lo que tu profesional te ha puesto a ti, y todo lo que hay en la biblioteca del centro. Las de arriba llevan un acento lila justamente para que se distingan de un vistazo.",
            en: "Two things on the same screen: what your trainer or physio has set for you, and everything in the centre's library. The former carry a purple accent precisely so they stand out at a glance.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Els teus exercicis",
            es: "Tus ejercicios",
            en: "Your exercises",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Cada targeta porta el nom de l'exercici, la seva categoria i, si n'hi ha, la nota que t'hi ha escrit el professional. Aquella nota és una instrucció per a tu, no una descripció del catàleg: hi surt sencera i destacada.",
            es: "Cada tarjeta lleva el nombre del ejercicio, su categoría y, si la hay, la nota que te ha escrito el profesional. Esa nota es una instrucción para ti, no una descripción del catálogo: sale entera y destacada.",
            en: "Each card carries the name of the exercise, its category and, where there is one, the note the professional wrote for you. That note is an instruction to you, not a catalogue description: it appears in full and highlighted.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "El teu progrés",
            es: "Tu progreso",
            en: "Your progress",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Sota cada exercici assignat hi ha l'històric que s'ha anat registrant: la data, el pes en quilos, les repeticions i qualsevol comentari. Els registres els posa el professional; tu els consultes.",
            es: "Bajo cada ejercicio asignado está el histórico que se ha ido registrando: la fecha, el peso en kilos, las repeticiones y cualquier comentario. Los registros los pone el profesional; tú los consultas.",
            en: "Under each assigned exercise is the history recorded over time: the date, the weight in kilos, the repetitions and any comment. The entries are made by the professional; you read them.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "La biblioteca del centre",
            es: "La biblioteca del centro",
            en: "The centre's library",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Tots els altres exercicis del centre, per consultar. Hi ha un cercador per nom o descripció i un filtre per categoria. Els que tenen vídeo el porten a la mateixa targeta: s'obre en una finestra sense sortir de la pàgina.",
            es: "Todos los demás ejercicios del centro, para consultar. Hay un buscador por nombre o descripción y un filtro por categoría. Los que tienen vídeo lo llevan en la misma tarjeta: se abre en una ventana sin salir de la página.",
            en: "Every other exercise at the centre, to look through. There's a search by name or description and a filter by category. Those with a video carry it on the card itself: it opens in a window without leaving the page.",
          }),
        },
        {
          t: "note",
          text: T({
            ca: "La biblioteca és de només lectura. Els exercicis els crea i els assigna el centre; des d'aquí no se'n pot afegir ni modificar cap.",
            es: "La biblioteca es de solo lectura. Los ejercicios los crea y los asigna el centro; desde aquí no se puede añadir ni modificar ninguno.",
            en: "The library is read-only. Exercises are created and assigned by the centre; nothing can be added or changed from here.",
          }),
        },
      ],
    },

    // ─────────────────────────── 6 ───────────────────────────
    {
      id: "documents",
      title: T({ ca: "Documents", es: "Documentos", en: "Documents" }),
      when: s.modules.documents,
      blocks: [
        {
          t: "p",
          text: T({
            ca: "Un lloc per guardar el que té a veure amb el teu seguiment: informes mèdics, radiografies, resultats de proves, el que sigui. Ho pots consultar tu i el teu professional, ningú més.",
            es: "Un sitio para guardar lo que tiene que ver con tu seguimiento: informes médicos, radiografías, resultados de pruebas, lo que sea. Lo podéis consultar tú y tu profesional, nadie más.",
            en: "A place to keep whatever relates to your progress: medical reports, X-rays, test results, whatever it may be. You and your trainer or physio can see it, nobody else.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Pujar un document",
            es: "Subir un documento",
            en: "Uploading a document",
          }),
        },
        {
          t: "p",
          text: T({
            ca: `Amb «+ Pujar document». S'accepten PDF, imatges (JPG, PNG, HEIC) i Word, fins a ${s.documentsMaxMb} MB per fitxer. Pots afegir-hi una descripció curta —per exemple «Informe de la ressonància del genoll»— que és el que després et permetrà distingir-los d'un cop d'ull.`,
            es: `Con «+ Subir documento». Se aceptan PDF, imágenes (JPG, PNG, HEIC) y Word, hasta ${s.documentsMaxMb} MB por archivo. Puedes añadir una descripción corta —por ejemplo «Informe de la resonancia de la rodilla»— que es lo que después te permitirá distinguirlos de un vistazo.`,
            en: `Use «+ Upload document». PDFs, images (JPG, PNG, HEIC) and Word files are accepted, up to ${s.documentsMaxMb} MB each. You can add a short description —«Knee MRI report», say— which is what will let you tell them apart at a glance later.`,
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Consultar-los i esborrar-los",
            es: "Consultarlos y borrarlos",
            en: "Viewing and deleting them",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Cada document de la llista es pot descarregar i esborrar. L'esborrat demana confirmació i no té marxa enrere: el fitxer se'n va de debò.",
            es: "Cada documento de la lista se puede descargar y borrar. El borrado pide confirmación y no tiene marcha atrás: el archivo se va de verdad.",
            en: "Every document on the list can be downloaded and deleted. Deleting asks for confirmation and there's no going back: the file really does go.",
          }),
        },
        {
          t: "note",
          text: T({
            ca: "Si el fitxer és massa gros o té un format que no acceptem, l'app t'ho diu abans d'intentar pujar-lo, no després.",
            es: "Si el archivo es demasiado grande o tiene un formato que no aceptamos, la app te lo dice antes de intentar subirlo, no después.",
            en: "If the file is too big or in a format we don't accept, the app tells you before it tries to upload it, not afterwards.",
          }),
        },
      ],
    },

    // ─────────────────────────── 7 ───────────────────────────
    {
      id: "comunitat",
      title: T({ ca: "Comunitat", es: "Comunidad", en: "Community" }),
      when: s.modules.comunitat,
      blocks: [
        {
          t: "p",
          text: T({
            ca: "El tauler del centre: anuncis, novetats i enquestes. Els més recents també et surten a l'Inici, així que no cal entrar-hi cada dia.",
            es: "El tablón del centro: anuncios, novedades y encuestas. Los más recientes también te salen en Inicio, así que no hace falta entrar cada día.",
            en: "The centre's noticeboard: announcements, news and polls. The most recent also appear on your Home screen, so there's no need to come in every day.",
          }),
        },
        {
          t: "h",
          text: T({ ca: "Anuncis", es: "Anuncios", en: "Announcements" }),
        },
        {
          t: "p",
          text: T({
            ca: "Publicacions del centre, de la més nova a la més antiga, amb la data i qui les signa. La més recent va marcada com a novetat. No s'hi respon: són avisos d'una banda cap a l'altra.",
            es: "Publicaciones del centro, de la más nueva a la más antigua, con la fecha y quién las firma. La más reciente va marcada como novedad. No se responde: son avisos de un lado hacia el otro.",
            en: "Posts from the centre, newest first, with the date and who signed them. The most recent is marked as new. There's no replying: they're notices going one way.",
          }),
        },
        {
          t: "h",
          text: T({ ca: "Enquestes", es: "Encuestas", en: "Polls" }),
        },
        {
          t: "p",
          text: T({
            ca: "De tant en tant el centre obre una enquesta. Algunes deixen triar una sola opció i altres diverses; l'enunciat t'ho diu. Un cop enviada la resposta veus el repartiment de vots, si n'hi ha.",
            es: "De vez en cuando el centro abre una encuesta. Algunas dejan elegir una sola opción y otras varias; el enunciado te lo dice. Una vez enviada la respuesta ves el reparto de votos, si lo hay.",
            en: "Now and then the centre opens a poll. Some let you pick a single option and others several; the wording tells you which. Once you've sent your answer you see how the votes fall, where there are any.",
          }),
        },
        {
          t: "warn",
          text: T({
            ca: "El vot no es pot canviar un cop enviat. Si l'enquesta té data de tancament, hi surt; passada, ja no accepta respostes.",
            es: "El voto no se puede cambiar una vez enviado. Si la encuesta tiene fecha de cierre, sale ahí; pasada, ya no acepta respuestas.",
            en: "Your vote can't be changed once sent. If the poll has a closing date it's shown; once past, it stops taking answers.",
          }),
        },
      ],
    },

    // ─────────────────────────── 8 ───────────────────────────
    {
      id: "regala-vindi",
      title: T({ ca: "Regala Vindi", es: "Regala Vindi", en: "Gift Vindi" }),
      when: s.giftVouchersEnabled,
      blocks: [
        {
          t: "p",
          text: T({
            ca: "Un val de regal és el mateix paquet de sessions que compraries per a tu, però amb un codi perquè el faci servir una altra persona. S'hi arriba des de la targeta de l'Inici o des del final de la pantalla de Bons.",
            es: "Un vale regalo es el mismo paquete de sesiones que comprarías para ti, pero con un código para que lo use otra persona. Se llega desde la tarjeta de Inicio o desde el final de la pantalla de Bonos.",
            en: "A gift voucher is the same package of sessions you'd buy for yourself, but with a code so that someone else can use it. You get to it from the Home card or from the foot of the Passes screen.",
          }),
        },
        {
          t: "h",
          text: T({ ca: "Comprar-lo", es: "Comprarlo", en: "Buying one" }),
        },
        {
          t: "ol",
          items: [
            T({
              ca: "Tries el servei.",
              es: "Eliges el servicio.",
              en: "Choose the service.",
            }),
            T({
              ca: "Tries el paquet.",
              es: "Eliges el paquete.",
              en: "Choose the package.",
            }),
            T({
              ca: "Si vols, hi poses el nom de qui el rep, el seu correu i una dedicatòria. Tot això és opcional.",
              es: "Si quieres, pones el nombre de quien lo recibe, su correo y una dedicatoria. Todo esto es opcional.",
              en: "If you like, add the recipient's name, their email address and a message. All of this is optional.",
            }),
            s.cardPayments
              ? T({
                  ca: "Tries si el pagues al centre o amb targeta, i confirmes.",
                  es: "Eliges si lo pagas en el centro o con tarjeta, y confirmas.",
                  en: "Choose whether you pay at the centre or by card, and confirm.",
                })
              : T({
                  ca: "Confirmes; el pagaràs al centre.",
                  es: "Confirmas; lo pagarás en el centro.",
                  en: "Confirm; you'll pay for it at the centre.",
                }),
          ],
        },
        {
          t: "note",
          text: T({
            ca: "El nom que hi posis surt imprès al val, però no limita qui el pot bescanviar: qui tingui el codi el podrà fer servir. Un val és al portador.",
            es: "El nombre que pongas sale impreso en el vale, pero no limita quién lo puede canjear: quien tenga el código lo podrá usar. Un vale es al portador.",
            en: "The name you enter is printed on the voucher, but it doesn't limit who can redeem it: whoever holds the code can use it. A voucher is payable to the bearer.",
          }),
        },
        {
          t: "note",
          text: T({
            ca: "Els vals es paguen sempre a preu de catàleg. Si tu tens un descompte personal, no s'aplica aquí: el descompte és teu, i el val canvia de mans.",
            es: "Los vales se pagan siempre a precio de catálogo. Si tú tienes un descuento personal, no se aplica aquí: el descuento es tuyo, y el vale cambia de manos.",
            en: "Vouchers are always paid for at catalogue price. If you have a personal discount it isn't applied here: the discount is yours, and the voucher changes hands.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "El codi i com fer-l'hi arribar",
            es: "El código y cómo hacérselo llegar",
            en: "The code and how to get it to them",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Un cop creat, l'app t'ensenya el codi i te'l deixa copiar. Tens tres maneres de donar-l'hi: copiar el codi i enviar-l'hi tu, descarregar el val en PDF per imprimir-lo o donar-l'hi en persona, o enviar-l'hi per correu des de la mateixa pantalla —li arriba el codi i les instruccions per fer-lo servir.",
            es: "Una vez creado, la app te enseña el código y te deja copiarlo. Tienes tres maneras de dárselo: copiar el código y enviárselo tú, descargar el vale en PDF para imprimirlo o dárselo en persona, o enviárselo por correo desde la misma pantalla —le llega el código y las instrucciones para usarlo.",
            en: "Once it's created, the app shows you the code and lets you copy it. There are three ways to hand it over: copy the code and send it yourself, download the voucher as a PDF to print or give in person, or email it from that same screen — they receive the code and instructions for using it.",
          }),
        },
        ...(s.cardPayments
          ? ([
              {
                t: "warn",
                text: T({
                  ca: "Si el pagues al centre, el val es genera i el pots descarregar de seguida, però no serà bescanviable fins que el centre confirmi el cobrament. Si el pagues amb targeta, neix ja bescanviable.",
                  es: "Si lo pagas en el centro, el vale se genera y lo puedes descargar enseguida, pero no será canjeable hasta que el centro confirme el cobro. Si lo pagas con tarjeta, nace ya canjeable.",
                  en: "If you pay at the centre, the voucher is generated and you can download it straight away, but it won't be redeemable until the centre confirms payment. If you pay by card, it's redeemable from birth.",
                }),
              },
            ] as Block[])
          : ([
              {
                t: "warn",
                text: T({
                  ca: "El val es genera i el pots descarregar de seguida, però no serà bescanviable fins que el paguis al centre i s'hi confirmi el cobrament.",
                  es: "El vale se genera y lo puedes descargar enseguida, pero no será canjeable hasta que lo pagues en el centro y se confirme el cobro.",
                  en: "The voucher is generated and you can download it straight away, but it won't be redeemable until you pay for it at the centre and the payment is recorded.",
                }),
              },
            ] as Block[])),
        {
          t: "h",
          text: T({
            ca: "Els vals que has regalat",
            es: "Los vales que has regalado",
            en: "The vouchers you've given",
          }),
        },
        {
          t: "p",
          text: T({
            ca: `Al final de la pantalla hi ha la llista dels que has comprat, amb el codi, el paquet, l'import, l'estat i la data. Des d'allà els pots tornar a descarregar sempre que vulguis. Els vals valen ${s.giftVoucherExpiryMonths} mesos des de la compra.`,
            es: `Al final de la pantalla está la lista de los que has comprado, con el código, el paquete, el importe, el estado y la fecha. Desde ahí los puedes volver a descargar siempre que quieras. Los vales valen ${s.giftVoucherExpiryMonths} meses desde la compra.`,
            en: `At the foot of the screen is the list of the ones you've bought, with the code, the package, the amount, the status and the date. You can download them again from there whenever you like. Vouchers are valid for ${s.giftVoucherExpiryMonths} months from purchase.`,
          }),
        },
        {
          t: "dl",
          items: [
            [
              T({
                ca: "Pendent de pagament",
                es: "Pendiente de pago",
                en: "Awaiting payment",
              }),
              T({
                ca: "Encara no s'ha cobrat: no es pot bescanviar.",
                es: "Todavía no se ha cobrado: no se puede canjear.",
                en: "Not paid for yet: it can't be redeemed.",
              }),
            ],
            [
              T({ ca: "Actiu", es: "Activo", en: "Active" }),
              T({
                ca: "Pagat i esperant que algú l'utilitzi.",
                es: "Pagado y esperando que alguien lo utilice.",
                en: "Paid for and waiting for someone to use it.",
              }),
            ],
            [
              T({ ca: "Bescanviat", es: "Canjeado", en: "Redeemed" }),
              T({
                ca: "Ja s'ha fet servir. Et vam avisar per correu quan va passar.",
                es: "Ya se ha usado. Te avisamos por correo cuando ocurrió.",
                en: "It's been used. We emailed you when it happened.",
              }),
            ],
            [
              T({ ca: "Caducat", es: "Caducado", en: "Expired" }),
              T({
                ca: "Ha passat la data de validesa sense fer-se servir.",
                es: "Ha pasado la fecha de validez sin usarse.",
                en: "The validity date passed without it being used.",
              }),
            ],
            [
              T({ ca: "Anul·lat", es: "Anulado", en: "Cancelled" }),
              T({
                ca: "L'ha anul·lat el centre.",
                es: "Lo ha anulado el centro.",
                en: "The centre cancelled it.",
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
        es: "Trae a un amigo",
        en: "Bring a friend",
      }),
      when: s.referralProgramActive,
      blocks: [
        {
          t: "p",
          text: T({
            ca: `Tens un codi de referit personal. Quan algú es registri amb ell i pagui el seu primer bo, ${s.referralRewardReferee ? "tots dos rebeu" : "reps"} un ${s.referralDiscountPercent}% de descompte a la propera compra.`,
            es: `Tienes un código de referido personal. Cuando alguien se registre con él y pague su primer bono, ${s.referralRewardReferee ? "los dos recibís" : "recibes"} un ${s.referralDiscountPercent}% de descuento en la próxima compra.`,
            en: `You have a personal referral code. When somebody signs up with it and pays for their first pass, ${s.referralRewardReferee ? "you both get" : "you get"} ${s.referralDiscountPercent}% off your next purchase.`,
          }),
        },
        {
          t: "h",
          text: T({
            ca: "On és el teu codi",
            es: "Dónde está tu código",
            en: "Where your code is",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "A dos llocs, i és el mateix: la targeta «Porta un amic» de l'Inici, que l'obre en una finestra amb el botó de copiar, i Configuració → Dades personals, on hi ha també el compte d'amics que ja has portat.",
            es: "En dos sitios, y es el mismo: la tarjeta «Trae a un amigo» de Inicio, que lo abre en una ventana con el botón de copiar, y Configuración → Datos personales, donde está también la cuenta de amigos que ya has traído.",
            en: "In two places, and it's the same code: the «Bring a friend» card on Home, which opens it in a window with a copy button, and Settings → Personal details, where you'll also find the tally of friends you've brought.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Com s'aplica el descompte",
            es: "Cómo se aplica el descuento",
            en: "How the discount is applied",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Sol, quan compris. A la pantalla de compra t'apareix un avís dient que el tens i si s'aplica o no. Si el paquet ja té una oferta millor, s'aplica l'oferta i el teu descompte de referit es guarda per a la següent compra: no es perd ni se sumen l'un amb l'altre.",
            es: "Solo, cuando compres. En la pantalla de compra te aparece un aviso diciendo que lo tienes y si se aplica o no. Si el paquete ya tiene una oferta mejor, se aplica la oferta y tu descuento de referido se guarda para la siguiente compra: no se pierde ni se suman el uno con el otro.",
            en: "By itself, when you buy. On the purchase screen a notice appears telling you that you have it and whether it's being applied. If the package already has a better offer, the offer wins and your referral discount is saved for your next purchase: it isn't lost, and the two don't stack.",
          }),
        },
      ],
    },

    // ─────────────────────────── 10 ───────────────────────────
    {
      id: "configuracio",
      title: T({ ca: "Configuració", es: "Configuración", en: "Settings" }),
      blocks: [
        {
          t: "p",
          text: T({
            ca: "Quatre pestanyes: Dades personals, Privacitat, Notificacions i Compte.",
            es: "Cuatro pestañas: Datos personales, Privacidad, Notificaciones y Cuenta.",
            en: "Four tabs: Personal details, Privacy, Notifications and Account.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Dades personals",
            es: "Datos personales",
            en: "Personal details",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "El nom complet i el telèfon són obligatoris; la resta —data de naixement, alçada, pes, gènere, contacte d'emergència i el teu objectiu— els omples si vols. Els camps obligatoris porten un asterisc i el formulari no es desa sense ells.",
            es: "El nombre completo y el teléfono son obligatorios; el resto —fecha de nacimiento, altura, peso, género, contacto de emergencia y tu objetivo— los rellenas si quieres. Los campos obligatorios llevan un asterisco y el formulario no se guarda sin ellos.",
            en: "Your full name and phone number are required; the rest —date of birth, height, weight, gender, emergency contact and your goal— you fill in if you want to. Required fields carry an asterisk and the form won't save without them.",
          }),
        },
        {
          t: "note",
          text: T({
            ca: "Si el teu compte és d'abans que el telèfon fos obligatori, el tindràs buit i el formulari te'l demanarà el primer cop que hi desis res. No és un error.",
            es: "Si tu cuenta es anterior a que el teléfono fuera obligatorio, lo tendrás vacío y el formulario te lo pedirá la primera vez que guardes algo. No es un error.",
            en: "If your account predates the phone number becoming required, yours will be empty and the form will ask for it the first time you save anything. That isn't a fault.",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "El correu electrònic hi surt, però no s'hi pot tocar: és la teva credencial d'accés i es canvia a la pestanya «Compte».",
            es: "El correo electrónico sale ahí, pero no se puede tocar: es tu credencial de acceso y se cambia en la pestaña «Cuenta».",
            en: "Your email address is shown but can't be edited here: it's your sign-in credential and is changed on the «Account» tab.",
          }),
        },
        { t: "h", text: T({ ca: "Idioma", es: "Idioma", en: "Language" }) },
        {
          t: "p",
          text: T({
            ca: "A la mateixa pestanya, a dalt, sota «Preferències». Es desa sol en triar-lo, sense passar pel botó de desar, i el canvi és immediat.",
            es: "En la misma pestaña, arriba, bajo «Preferencias». Se guarda solo al elegirlo, sin pasar por el botón de guardar, y el cambio es inmediato.",
            en: "On the same tab, at the top, under «Preferences». It saves itself as soon as you choose, without going through the save button, and the change is immediate.",
          }),
        },
        {
          t: "h",
          text: T({ ca: "Privacitat", es: "Privacidad", en: "Privacy" }),
        },
        {
          t: "p",
          text: T({
            ca: "Aquí veus què has acceptat i quan: la data i la versió de la Política de Privacitat i l'Avís Legal que vas acceptar en registrar-te.",
            es: "Aquí ves qué has aceptado y cuándo: la fecha y la versión de la Política de Privacidad y el Aviso Legal que aceptaste al registrarte.",
            en: "Here you see what you've accepted and when: the date and version of the Privacy Policy and Legal Notice you accepted when you registered.",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "A sota hi ha el consentiment per al tractament de dades de salut, que fa falta si reps fisioteràpia. Si encara no l'has donat, hi ha la casella per fer-ho. Un cop donat, hi consta la data; per revocar-lo cal escriure al centre.",
            es: "Debajo está el consentimiento para el tratamiento de datos de salud, que hace falta si recibes fisioterapia. Si todavía no lo has dado, ahí tienes la casilla para hacerlo. Una vez dado, consta la fecha; para revocarlo hay que escribir al centro.",
            en: "Below it is the consent for processing health data, which is needed if you receive physiotherapy. If you haven't given it yet, the box to do so is there. Once given, the date is recorded; to withdraw it you need to write to the centre.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Notificacions",
            es: "Notificaciones",
            en: "Notifications",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Una llista d'avisos amb una casella «Email» a cada un. Marca els que vols rebre i prem «Desar preferències».",
            es: "Una lista de avisos con una casilla «Email» en cada uno. Marca los que quieras recibir y pulsa «Guardar preferencias».",
            en: "A list of notifications with an «Email» box against each. Tick the ones you want and press «Save preferences».",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "No hi surten tots els correus que et podem enviar, i és a posta. Alguns avisos s'envien sempre, sense casella. El criteri és aquest: és obligatori l'avís que et diu una cosa JA FETA, que no has provocat tu en aquell moment, i que no podries descobrir mirant l'app.",
            es: "No salen todos los correos que te podemos enviar, y es a propósito. Algunos avisos se envían siempre, sin casilla. El criterio es este: es obligatorio el aviso que te dice algo YA HECHO, que no has provocado tú en ese momento, y que no podrías descubrir mirando la app.",
            en: "Not every email we might send you appears here, and that's deliberate. Some notices are always sent, with no box. The rule is this: a notice is compulsory when it tells you about something ALREADY DONE, that you didn't set off yourself at that moment, and that you couldn't find out by looking at the app.",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Per això la reserva cancel·lada s'envia sempre i la confirmada no: una reserva que existeix la pots veure quan vulguis; una que ja no existeix, no. Al capítol següent tens la llista sencera amb quins es poden apagar i quins no.",
            es: "Por eso la reserva cancelada se envía siempre y la confirmada no: una reserva que existe la puedes ver cuando quieras; una que ya no existe, no. En el capítulo siguiente tienes la lista entera con cuáles se pueden apagar y cuáles no.",
            en: "That's why a cancelled booking is always sent and a confirmed one isn't: a booking that exists you can look at whenever you like; one that no longer exists, you can't. The next chapter has the full list of which can be switched off and which can't.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Compte: canviar el correu d'accés",
            es: "Cuenta: cambiar el correo de acceso",
            en: "Account: changing your sign-in email",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "El correu és amb què entres i on reps els avisos, així que canviar-lo va per un camí propi i en dos passos:",
            es: "El correo es con lo que entras y donde recibes los avisos, así que cambiarlo va por un camino propio y en dos pasos:",
            en: "Your email is what you sign in with and where notifications arrive, so changing it has its own path, in two steps:",
          }),
        },
        {
          t: "ol",
          items: [
            T({
              ca: "Escrius el correu nou i la teva contrasenya actual —te la demanem per assegurar-nos que ets tu.",
              es: "Escribes el correo nuevo y tu contraseña actual —te la pedimos para asegurarnos de que eres tú.",
              en: "You enter the new address and your current password — we ask for it to be sure it's you.",
            }),
            T({
              ca: "T'enviem un enllaç a la bústia NOVA. Fins que no l'obris des d'allà, el canvi no es fa i segueixes entrant amb el correu de sempre.",
              es: "Te enviamos un enlace al buzón NUEVO. Hasta que no lo abras desde ahí, el cambio no se hace y sigues entrando con el correo de siempre.",
              en: "We send a link to the NEW inbox. Until you open it from there the change doesn't happen and you carry on signing in with your usual address.",
            }),
          ],
        },
        {
          t: "p",
          text: T({
            ca: "Mentre la petició està pendent, l'app t'ho recorda i te la deixa anul·lar. El correu antic també rep un avís que algú ha demanat el canvi: si no has estat tu, és com te n'assabentes.",
            es: "Mientras la petición está pendiente, la app te lo recuerda y te deja anularla. El correo antiguo también recibe un aviso de que alguien ha pedido el cambio: si no has sido tú, es así como te enteras.",
            en: "While the request is pending the app reminds you and lets you cancel it. The old address also gets a notice that someone has asked for the change: if it wasn't you, that's how you find out.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "Compte: canviar la contrasenya",
            es: "Cuenta: cambiar la contraseña",
            en: "Account: changing your password",
          }),
        },
        {
          t: "p",
          text: T({
            ca: `Cal la contrasenya actual i la nova dues vegades. La nova ha de tenir ${s.minPasswordLength} caràcters com a mínim i ser diferent de l'actual. Canviar-la no et tanca la sessió: segueixes dins.`,
            es: `Hace falta la contraseña actual y la nueva dos veces. La nueva tiene que tener ${s.minPasswordLength} caracteres como mínimo y ser distinta de la actual. Cambiarla no te cierra la sesión: sigues dentro.`,
            en: `You need your current password and the new one twice. The new one must be at least ${s.minPasswordLength} characters and different from the current one. Changing it doesn't sign you out: you stay in.`,
          }),
        },
        ...(s.referralProgramActive
          ? ([
              {
                t: "h",
                text: T({
                  ca: "El teu codi de referit",
                  es: "Tu código de referido",
                  en: "Your referral code",
                }),
              },
              {
                t: "p",
                text: T({
                  ca: "A la pestanya de Dades personals, al final, amb el botó de copiar i el compte d'amics que has portat.",
                  es: "En la pestaña de Datos personales, al final, con el botón de copiar y la cuenta de amigos que has traído.",
                  en: "On the Personal details tab, at the foot, with the copy button and the tally of friends you've brought.",
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
        es: "Los correos que recibirás",
        en: "The emails you'll get",
      }),
      blocks: [
        {
          t: "p",
          text: T({
            ca: "Tots arriben a la teva adreça d'accés i en l'idioma que tinguis triat. Els que es poden apagar es marquen a Configuració → Notificacions.",
            es: "Todos llegan a tu dirección de acceso y en el idioma que tengas elegido. Los que se pueden apagar se marcan en Configuración → Notificaciones.",
            en: "They all arrive at your sign-in address and in the language you've chosen. The ones that can be switched off are ticked under Settings → Notifications.",
          }),
        },
        {
          t: "table",
          head: [
            T({ ca: "Avís", es: "Aviso", en: "Notification" }),
            T({ ca: "Quan arriba", es: "Cuándo llega", en: "When it arrives" }),
            T({
              ca: "El pots apagar?",
              es: "¿Lo puedes apagar?",
              en: "Can you switch it off?",
            }),
          ],
          rows: [
            [
              T({
                ca: "Reserva confirmada",
                es: "Reserva confirmada",
                en: "Booking confirmed",
              }),
              T({
                ca: "Quan es crea una reserva a nom teu.",
                es: "Cuando se crea una reserva a tu nombre.",
                en: "When a booking is created in your name.",
              }),
              T({ ca: "Sí", es: "Sí", en: "Yes" }),
            ],
            [
              T({
                ca: "Reserva cancel·lada",
                es: "Reserva cancelada",
                en: "Booking cancelled",
              }),
              T({
                ca: "Quan s'anul·la una reserva teva, la cancel·lis tu o el centre.",
                es: "Cuando se anula una reserva tuya, la canceles tú o el centro.",
                en: "When a booking of yours is called off, whether by you or by the centre.",
              }),
              T({ ca: "No", es: "No", en: "No" }),
            ],
            [
              T({
                ca: "Recordatori de sessió",
                es: "Recordatorio de sesión",
                en: "Session reminder",
              }),
              T({
                ca: `El dia abans de cada sessió, a partir de les ${hhmm(s.reminderHourLocal)}.`,
                es: `El día antes de cada sesión, a partir de las ${hhmm(s.reminderHourLocal)}.`,
                en: `The day before each session, from ${hhmm(s.reminderHourLocal)} onwards.`,
              }),
              T({ ca: "Sí", es: "Sí", en: "Yes" }),
            ],
            ...(s.modules.sessionsProva
              ? [
                  [
                    T({
                      ca: "Estat de la teva prova",
                      es: "Estado de tu prueba",
                      en: "Status of your trial",
                    }),
                    T({
                      ca: "Quan la teva sessió de prova s'accepta o es rebutja.",
                      es: "Cuando tu sesión de prueba se acepta o se rechaza.",
                      en: "When your trial session is accepted or turned down.",
                    }),
                    T({ ca: "No", es: "No", en: "No" }),
                  ],
                ]
              : []),
            [
              T({
                ca: "Bo a punt d'esgotar-se",
                es: "Bono a punto de agotarse",
                en: "Pass nearly used up",
              }),
              T({
                ca: `Quan et queda${s.bonoLowThreshold === 1 ? " 1 sessió" : `n ${s.bonoLowThreshold} sessions`} al bo.`,
                es: `Cuando te queda${s.bonoLowThreshold === 1 ? " 1 sesión" : `n ${s.bonoLowThreshold} sesiones`} en el bono.`,
                en: `When you have ${s.bonoLowThreshold === 1 ? "1 session" : `${s.bonoLowThreshold} sessions`} left on your pass.`,
              }),
              T({ ca: "Sí", es: "Sí", en: "Yes" }),
            ],
            [
              T({
                ca: "Bo a punt de caducar",
                es: "Bono a punto de caducar",
                en: "Pass about to expire",
              }),
              T({
                ca: `${s.bonoExpiryWarningDays} dies abans que caduqui un bo amb sessions sense fer.`,
                es: `${s.bonoExpiryWarningDays} días antes de que caduque un bono con sesiones sin hacer.`,
                en: `${s.bonoExpiryWarningDays} days before a pass with unused sessions expires.`,
              }),
              T({ ca: "Sí", es: "Sí", en: "Yes" }),
            ],
            [
              T({
                ca: "Bo anul·lat per impagament",
                es: "Bono anulado por impago",
                en: "Pass cancelled for non-payment",
              }),
              T({
                ca: "Si un bo pendent de pagament decau i es cancel·len les sessions que hi tenies reservades.",
                es: "Si un bono pendiente de pago decae y se cancelan las sesiones que tenías reservadas con él.",
                en: "If a pass awaiting payment lapses and the sessions you had booked with it are cancelled.",
              }),
              T({ ca: "No", es: "No", en: "No" }),
            ],
            ...(s.modules.comunitat
              ? [
                  [
                    T({
                      ca: "Novetats de la comunitat",
                      es: "Novedades de la comunidad",
                      en: "Community news",
                    }),
                    T({
                      ca: "Nous anuncis del centre.",
                      es: "Nuevos anuncios del centro.",
                      en: "New announcements from the centre.",
                    }),
                    T({ ca: "Sí", es: "Sí", en: "Yes" }),
                  ],
                ]
              : []),
            ...(s.waitlistEnabled
              ? [
                  [
                    T({
                      ca: "Plaça de la llista d'espera",
                      es: "Plaza de la lista de espera",
                      en: "A place from the waiting list",
                    }),
                    T({
                      ca: "Quan s'allibera una plaça que esperaves i te la reservem.",
                      es: "Cuando se libera una plaza que esperabas y te la reservamos.",
                      en: "When a space you were waiting for frees up and we book it for you.",
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
                      es: "Te han canjeado un regalo",
                      en: "Someone redeemed your gift",
                    }),
                    T({
                      ca: "Quan algú fa servir un val de regal que has comprat.",
                      es: "Cuando alguien usa un vale regalo que has comprado.",
                      en: "When someone uses a gift voucher you bought.",
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
                      es: "Renovación de la suscripción",
                      en: "Subscription renewed",
                    }),
                    T({
                      ca: "Cada mes, quan reps les sessions noves.",
                      es: "Cada mes, cuando recibes las sesiones nuevas.",
                      en: "Each month, when you receive the new sessions.",
                    }),
                    T({ ca: "No", es: "No", en: "No" }),
                  ],
                  [
                    T({
                      ca: "Subscripció aturada per impagament",
                      es: "Suscripción detenida por impago",
                      en: "Subscription stopped for non-payment",
                    }),
                    T({
                      ca: "Quan un mes no s'ha pogut cobrar.",
                      es: "Cuando un mes no se ha podido cobrar.",
                      en: "When a month couldn't be charged.",
                    }),
                    T({ ca: "No", es: "No", en: "No" }),
                  ],
                  [
                    T({
                      ca: "Baixa de la subscripció",
                      es: "Baja de la suscripción",
                      en: "Subscription cancelled",
                    }),
                    T({
                      ca: "Quan es dona de baixa, la demanis tu o el centre.",
                      es: "Cuando se da de baja, la pidas tú o el centro.",
                      en: "When it's cancelled, whether by you or by the centre.",
                    }),
                    T({ ca: "No", es: "No", en: "No" }),
                  ],
                  [
                    T({
                      ca: "Subscripció congelada",
                      es: "Suscripción congelada",
                      en: "Subscription frozen",
                    }),
                    T({
                      ca: "Quan el centre l'atura temporalment.",
                      es: "Cuando el centro la detiene temporalmente.",
                      en: "When the centre stops it temporarily.",
                    }),
                    T({ ca: "No", es: "No", en: "No" }),
                  ],
                  [
                    T({
                      ca: "Subscripció represa",
                      es: "Suscripción reanudada",
                      en: "Subscription restarted",
                    }),
                    T({
                      ca: "Quan el centre la torna a posar en marxa.",
                      es: "Cuando el centro la vuelve a poner en marcha.",
                      en: "When the centre starts it up again.",
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
            es: "Aparte de estos, están los correos de la cuenta, que no tienen casilla porque no son avisos sino parte del funcionamiento: la bienvenida al registrarte, el enlace para cambiar el correo de acceso y el aviso al buzón antiguo de que alguien lo ha pedido.",
            en: "Besides these there are the account emails, which have no box because they aren't notifications but part of how the thing works: the welcome when you register, the link for changing your sign-in address, and the notice to the old inbox that somebody asked for the change.",
          }),
        },
        {
          t: "note",
          text: T({
            ca: "El teu professional també et pot enviar un correu quan t'assigni exercicis nous. Aquell no és automàtic: el dispara ell quan vol, no cada vegada.",
            es: "Tu profesional también te puede enviar un correo cuando te asigne ejercicios nuevos. Ese no es automático: lo dispara él cuando quiere, no cada vez.",
            en: "Your trainer or physio can also email you when they set you new exercises. That one isn't automatic: they send it when they want to, not every time.",
          }),
        },
      ],
    },

    // ─────────────────────────── 12 ───────────────────────────
    {
      id: "si-alguna-cosa-no-va",
      title: T({
        ca: "Si alguna cosa no va",
        es: "Si algo no va",
        en: "If something isn't working",
      }),
      blocks: [
        {
          t: "h",
          text: T({
            ca: "El calendari no em deixa reservar res",
            es: "El calendario no me deja reservar nada",
            en: "The calendar won't let me book anything",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Gairebé sempre és una d'aquestes tres: no tens cap bo actiu amb sessions disponibles, el bo que tens és d'un altre servei del que estàs mirant, o tens un filtre de professional posat que amaga la resta. Comprova-ho per aquest ordre; l'app t'avisa a dalt de la pantalla en els dos primers casos.",
            es: "Casi siempre es una de estas tres: no tienes ningún bono activo con sesiones disponibles, el bono que tienes es de otro servicio del que estás mirando, o tienes puesto un filtro de profesional que esconde al resto. Compruébalo por este orden; la app te avisa arriba de la pantalla en los dos primeros casos.",
            en: "It's nearly always one of these three: you have no active pass with sessions available, the pass you have is for a different service from the one you're looking at, or you have a professional filter set that's hiding everyone else. Check in that order; the app warns you at the top of the screen in the first two cases.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "He pagat i el bo no em surt",
            es: "He pagado y el bono no me sale",
            en: "I've paid and my pass hasn't appeared",
          }),
        },
        {
          t: "p",
          text: s.cardPayments
            ? T({
                ca: "Si has pagat amb targeta, el bo no es crea en el moment de pagar sinó quan el banc ens ho confirma, i això pot trigar uns segons. Mentrestant veus la pantalla «Estem confirmant el pagament». No tornis a pagar.",
                es: "Si has pagado con tarjeta, el bono no se crea en el momento de pagar sino cuando el banco nos lo confirma, y eso puede tardar unos segundos. Mientras tanto ves la pantalla «Estamos confirmando el pago». No vuelvas a pagar.",
                en: "If you paid by card, the pass isn't created at the moment of payment but when the bank confirms it to us, and that can take a few seconds. Meanwhile you see the «We're confirming your payment» screen. Don't pay again.",
              })
            : T({
                ca: "Si has pagat al centre, el bo passa a «Actiu» quan el centre registra el cobrament, que no és sempre el mateix moment en què pagues. Mentrestant el pots fer servir igualment per reservar.",
                es: "Si has pagado en el centro, el bono pasa a «Activo» cuando el centro registra el cobro, que no es siempre el mismo momento en que pagas. Mientras tanto lo puedes usar igualmente para reservar.",
                en: "If you paid at the centre, the pass turns «Active» when the centre records the payment, which isn't always the same moment you hand the money over. In the meantime you can still use it to book.",
              }),
        },
        {
          t: "p",
          text: T({
            ca: `Si passa una hora i segueix sense aparèixer, avisa el centre: ${CONTACTE_CENTRE}.`,
            es: `Si pasa una hora y sigue sin aparecer, avisa al centro: ${CONTACTE_CENTRE}.`,
            en: `If an hour goes by and it still hasn't appeared, let the centre know: ${CONTACTE_CENTRE}.`,
          }),
        },
        {
          t: "h",
          text: T({
            ca: "No em deixa cancel·lar una sessió",
            es: "No me deja cancelar una sesión",
            en: "It won't let me cancel a session",
          }),
        },
        {
          t: "p",
          text: T({
            ca: `Les cancel·lacions es tanquen ${s.minCancellationHours} h abans de la sessió. Passat aquest punt el botó desapareix i l'app t'ho explica. Si tens una urgència de debò, parla amb el centre (${CONTACTE_CENTRE}): la decisió és seva, no de l'app.`,
            es: `Las cancelaciones se cierran ${s.minCancellationHours} h antes de la sesión. Pasado ese punto el botón desaparece y la app te lo explica. Si tienes una urgencia de verdad, habla con el centro (${CONTACTE_CENTRE}): la decisión es suya, no de la app.`,
            en: `Cancellations close ${s.minCancellationHours} h before the session. Past that point the button disappears and the app explains why. If you have a genuine emergency, talk to the centre (${CONTACTE_CENTRE}): the decision is theirs, not the app's.`,
          }),
        },
        {
          t: "h",
          text: T({
            ca: "He perdut la contrasenya",
            es: "He perdido la contraseña",
            en: "I've lost my password",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "Des de la pantalla d'entrada, «Has oblidat la contrasenya?». L'enllaç per posar-ne una de nova arriba al correu amb què vas crear el compte. Si ja ets dins i només la vols canviar, és a Configuració → Compte.",
            es: "Desde la pantalla de entrada, «¿Has olvidado la contraseña?». El enlace para poner una nueva llega al correo con el que creaste la cuenta. Si ya estás dentro y solo la quieres cambiar, está en Configuración → Cuenta.",
            en: "From the sign-in screen, «Forgotten your password?». The link for setting a new one goes to the email address you created the account with. If you're already signed in and just want to change it, it's under Settings → Account.",
          }),
        },
        {
          t: "h",
          text: T({
            ca: "He canviat de correu i no puc entrar",
            es: "He cambiado de correo y no puedo entrar",
            en: "I changed my email and can't sign in",
          }),
        },
        {
          t: "p",
          text: T({
            ca: "El canvi de correu no es fa fins que obres l'enllaç que enviem a la bústia NOVA. Si no l'has obert, segueixes entrant amb el correu antic. Si l'enllaç no t'arriba, mira la carpeta de correu brossa i, si no hi és, torna a demanar-ho des de Configuració → Compte.",
            es: "El cambio de correo no se hace hasta que abres el enlace que enviamos al buzón NUEVO. Si no lo has abierto, sigues entrando con el correo antiguo. Si el enlace no te llega, mira la carpeta de correo no deseado y, si no está, vuelve a pedirlo desde Configuración → Cuenta.",
            en: "The email change doesn't take effect until you open the link we send to the NEW inbox. If you haven't opened it, you carry on signing in with the old address. If the link doesn't arrive, check your spam folder and, if it isn't there, ask for it again under Settings → Account.",
          }),
        },
        ...(s.subscriptionsEnabled
          ? ([
              {
                t: "h",
                text: T({
                  ca: "Vull deixar la subscripció",
                  es: "Quiero dejar la suscripción",
                  en: "I want to end my subscription",
                }),
              },
              {
                t: "p",
                text: T({
                  ca: "A Bons → Els meus bons, «Donar-me de baixa». Conserves el mes que ja tens pagat i no se'n cobra cap més. No cal avisar ningú.",
                  es: "En Bonos → Mis bonos, «Darme de baja». Conservas el mes que ya tienes pagado y no se cobra ninguno más. No hace falta avisar a nadie.",
                  en: "Under Passes → My passes, «Cancel my subscription». You keep the month you've already paid for and nothing more is charged. There's no one you need to tell.",
                }),
              },
            ] as Block[])
          : []),
        {
          t: "h",
          text: T({
            ca: "Res d'això és el meu cas",
            es: "Nada de esto es mi caso",
            en: "None of this is my problem",
          }),
        },
        {
          t: "p",
          text: T({
            ca: `Escriu o truca al centre: ${CONTACTE_CENTRE}. L'app no té cap bústia de contacte pròpia, així que aquesta és la via.`,
            es: `Escribe o llama al centro: ${CONTACTE_CENTRE}. La app no tiene ningún buzón de contacto propio, así que esta es la vía.`,
            en: `Write to or ring the centre: ${CONTACTE_CENTRE}. The app has no contact inbox of its own, so this is the way.`,
          }),
        },
      ],
    },

    // ─────────────────────────── 13 ───────────────────────────
    {
      id: "glossari",
      title: T({ ca: "Glossari", es: "Glosario", en: "Glossary" }),
      blocks: [
        {
          t: "dl",
          items: [
            [
              T({ ca: "Bo", es: "Bono", en: "Pass" }),
              T({
                ca: "Un paquet de sessions d'un servei concret. És el que et permet reservar.",
                es: "Un paquete de sesiones de un servicio concreto. Es lo que te permite reservar.",
                en: "A package of sessions for a particular service. It's what lets you book.",
              }),
            ],
            [
              T({ ca: "Sessió", es: "Sesión", en: "Session" }),
              T({
                ca: "Una hora amb un professional. Es descompta d'un bo quan la reserves i torna al bo si la cancel·les a temps.",
                es: "Una hora con un profesional. Se descuenta de un bono cuando la reservas y vuelve al bono si la cancelas a tiempo.",
                en: "An hour with a trainer or physio. It comes off a pass when you book it and goes back onto the pass if you cancel in time.",
              }),
            ],
            [
              T({ ca: "Franja", es: "Franja", en: "Slot" }),
              T({
                ca: "Un buit lliure a l'agenda d'un professional. Al calendari és cada una de les caselles de color.",
                es: "Un hueco libre en la agenda de un profesional. En el calendario es cada una de las casillas de color.",
                en: "A free gap in a professional's diary. On the calendar it's each of the coloured cells.",
              }),
            ],
            [
              T({ ca: "Sèrie", es: "Serie", en: "Series" }),
              T({
                ca: "Un conjunt de sessions reservades d'un cop amb el mateix patró: la mateixa hora cada setmana, cada dues o cada mes.",
                es: "Un conjunto de sesiones reservadas de una vez con el mismo patrón: la misma hora cada semana, cada dos o cada mes.",
                en: "A set of sessions booked in one go following the same pattern: the same hour every week, fortnight or month.",
              }),
            ],
            ...(s.waitlistEnabled
              ? ([
                  [
                    T({
                      ca: "Llista d'espera",
                      es: "Lista de espera",
                      en: "Waiting list",
                    }),
                    T({
                      ca: "La cua d'una sessió de grup plena. Si algú cancel·la, la plaça passa al primer de la cua i la reserva es fa sola.",
                      es: "La cola de una sesión de grupo llena. Si alguien cancela, la plaza pasa al primero de la cola y la reserva se hace sola.",
                      en: "The queue for a full group session. If someone cancels, the space goes to whoever is first in the queue and the booking makes itself.",
                    }),
                  ],
                ] as [string, string][])
              : []),
            ...(s.subscriptionsEnabled
              ? ([
                  [
                    T({
                      ca: "Subscripció",
                      es: "Suscripción",
                      en: "Subscription",
                    }),
                    T({
                      ca: "Un bo de Grup reduït que es renova sol cada mes el mateix dia, amb el preu congelat.",
                      es: "Un bono de Grupo reducido que se renueva solo cada mes el mismo día, con el precio congelado.",
                      en: "A Small group pass that renews itself on the same day each month, at a frozen price.",
                    }),
                  ],
                  [
                    T({ ca: "Cicle", es: "Ciclo", en: "Cycle" }),
                    T({
                      ca: "El mes en curs d'una subscripció. Les sessions valen dins del seu cicle i no s'acumulen al següent.",
                      es: "El mes en curso de una suscripción. Las sesiones valen dentro de su ciclo y no se acumulan al siguiente.",
                      en: "The current month of a subscription. Sessions are good within their cycle and don't roll over to the next.",
                    }),
                  ],
                ] as [string, string][])
              : []),
            ...(s.giftVouchersEnabled
              ? ([
                  [
                    T({
                      ca: "Val de regal",
                      es: "Vale regalo",
                      en: "Gift voucher",
                    }),
                    T({
                      ca: "Un paquet de sessions amb un codi, comprat per a una altra persona. Qui tingui el codi el pot bescanviar.",
                      es: "Un paquete de sesiones con un código, comprado para otra persona. Quien tenga el código lo puede canjear.",
                      en: "A package of sessions with a code, bought for someone else. Whoever holds the code can redeem it.",
                    }),
                  ],
                ] as [string, string][])
              : []),
            ...(s.referralProgramActive
              ? ([
                  [
                    T({
                      ca: "Codi de referit",
                      es: "Código de referido",
                      en: "Referral code",
                    }),
                    T({
                      ca: "El teu codi personal per convidar algú. Quan es registra amb ell i paga el primer bo, hi ha descompte.",
                      es: "Tu código personal para invitar a alguien. Cuando se registra con él y paga el primer bono, hay descuento.",
                      en: "Your personal code for inviting someone. When they register with it and pay for their first pass, there's a discount.",
                    }),
                  ],
                ] as [string, string][])
              : []),
            [
              T({ ca: "Aforament", es: "Aforo", en: "Capacity" }),
              T({
                ca: `El màxim de persones d'una sessió de grup: ${s.groupCapacity}.`,
                es: `El máximo de personas de una sesión de grupo: ${s.groupCapacity}.`,
                en: `The maximum number of people in a group session: ${s.groupCapacity}.`,
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
