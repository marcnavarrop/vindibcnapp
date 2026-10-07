/**
 * El manual de l'administració, com a DADES.
 *
 * Tercer i últim dels tres, germà de `client-manual.ts` i `trainer-manual.ts`:
 * mateixos tipus (`Block`, `Chapter`), mateix component per pintar-lo
 * (`HelpManual`) i mateix criteri —el text viu en cadenes perquè el català va
 * ple d'apòstrofs i perquè un manual és un document, no una pantalla—.
 *
 * TOT EL QUE ÉS UN NÚMERO O UN INTERRUPTOR ARRIBA DE FORA
 *
 * `buildAdminManual` rep els ajustos REALS del centre. És l'única àrea on qui
 * llegeix el manual és, a més, qui pot canviar el que el manual explica: si
 * l'admin abaixa el llindar dels bons baixos, la frase que el descriu ha de
 * canviar amb ell. I els capítols dels mòduls apagats no es generen.
 *
 * QUÈ NO ES PERSONALITZA, I PER QUÈ
 *
 * Els interruptors que es poden encendre i apagar (vals, llista d'espera,
 * subscripcions, referits) NO fan desaparèixer el seu capítol: es descriuen
 * sempre, amb una frase que diu com estan ara. Un centre que apagui els vals
 * dilluns i els torni a encendre dijous no ha de veure com el manual perd i
 * recupera capítols; i sobretot, l'admin ha de poder llegir què fa un
 * interruptor ABANS d'encendre'l. Els mòduls sí que treuen el capítol perquè
 * treuen la pantalla sencera del menú i de les adreces.
 *
 * ES CONDICIONA EL TEXT, NO EL LECTOR
 *
 * Tots els admins llegeixen el mateix document. No hi ha res que depengui de
 * qui l'obre, només del centre.
 */

import type { Block, Chapter } from "@/lib/help/client-manual";

/** Els ajustos del centre que el manual necessita per no dir cap número fals. */
export type AdminManualSettings = {
  openingHour: number;
  closingHour: number;
  /** Antelació mínima per reservar. 0 = sense restricció. */
  minBookingHours: number;
  /** Antelació mínima per cancel·lar. 0 = sense restricció. */
  minCancellationHours: number;
  /** Sessions restants a partir de les quals un bo compta com a "baix". */
  bonoLowThreshold: number;
  /** Mesos de validesa d'un bo. Null o 0 = sense caducitat. */
  bonoExpiryMonths: number | null;
  pendingPaymentCancelEnabled: boolean;
  pendingPaymentCancelHours: number | null;
  giftVouchersEnabled: boolean;
  giftVoucherExpiryMonths: number;
  waitlistEnabled: boolean;
  subscriptionsEnabled: boolean;
  subscriptionExtraSessionsMax: number;
  trainersSeeColleaguesReservations: boolean;
  referralProgramActive: boolean;
  referralRewardReferee: boolean;
  referralDiscountPercent: number;
  /** Hora local a què surten els recordatoris i el resum diari. */
  reminderHourLocal: number;
  groupCapacity: number;
  minPasswordLength: number;
  trialMinAdvanceHours: number;
  trialMaxAdvanceDays: number;
  /** Dies d'antelació amb què s'avisa que un bo caduca. */
  bonoExpiryWarningDays: number;
  /** El centre té Stripe configurat i, per tant, ofereix pagar amb targeta. */
  stripeEnabled: boolean;
  modules: { comunitat: boolean; documents: boolean; sessionsProva: boolean };
};

/** "07:00" a partir d'una hora sencera. */
const hhmm = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** "1 sessió" / "3 sessions". */
const sess = (n: number) => `${n} ${n === 1 ? "sessió" : "sessions"}`;

/** "1 hora" / "24 hores". */
const hores = (n: number) => `${n} ${n === 1 ? "hora" : "hores"}`;

/** "1 mes" / "12 mesos". */
const mesos = (n: number) => `${n} ${n === 1 ? "mes" : "mesos"}`;

export function buildAdminManual(s: AdminManualSettings): Chapter[] {
  const bonoCaduca = s.bonoExpiryMonths && s.bonoExpiryMonths > 0;

  const chapters: (Chapter & { when?: boolean })[] = [
    // ─────────────────────────── 1 ───────────────────────────
    {
      id: "primers-passos",
      title: "Primers passos",
      blocks: [
        {
          t: "p",
          text: "Aquesta és l'àrea d'administració del centre. A diferència de les altres dues, aquí no hi ha una agenda pròpia ni uns clients propis: hi tens el centre sencer —totes les persones, totes les reserves, tots els diners i tots els interruptors que decideixen com es comporta l'app per a tothom—.",
        },
        { t: "h", text: "Entrar" },
        {
          t: "p",
          text: "S'entra amb el correu i la contrasenya des de la pantalla d'accés. Si no la recordes, «Has oblidat la contrasenya?» t'envia un enllaç a la teva bústia.",
        },
        { t: "h", text: "Moure't per l'app" },
        {
          t: "p",
          text: `El menú de l'esquerra té ${s.modules.comunitat ? "onze" : "deu"} entrades. Cinc són grups —Persones, Reserves, Bons i pagaments, Catàleg i Facturació—: s'obren i mostren les seves pantalles, que després es repeteixen a dalt de cada una com a selector, just a sobre del títol. La pantalla en què ets surt plena de lila; a l'ordinador, a l'esquerra, hi ha el nom del grup tal com surt al menú. Al mòbil, si no caben en una fila, salten a una segona: no se n'amaga mai cap. Les altres ${s.modules.comunitat ? "sis" : "cinc"} són pantalles soltes: Inici, Exercicis, ${s.modules.comunitat ? "Comunitat, " : ""}Configuració, Suport i Ajuda. En un mòbil el menú s'obre amb el botó de dalt i hi surten totes les pantalles de cada grup, a sota del seu nom: s'hi va d'un toc, sense passar per les pestanyes.`,
        },
        {
          t: "p",
          text: "El suport és sempre a mà, sense tapar res: al mòbil, la icona de la boia a la barra lila de dalt; a l'ordinador, «Obrir un tiquet» al peu del menú. Obre un tiquet des d'on siguis, sense perdre el que estaves fent. És la drecera del mateix canal que hi ha al menú, a Suport, i s'explica al seu capítol.",
        },
        {
          t: "p",
          text: "Tot el que no es pot desfer pregunta abans. El primer toc d'«Eliminar», «Treure», «Anul·lar» o «Tancar» només diu què passarà; fins que no toques «Sí, …» no passa res, i «No, torna» ho deixa tal com era. Quan cal veure un resum abans de decidir —un cobrament, una baixa—, la pregunta surt en un quadre a part, amb les mateixes dues respostes. El que es pot tornar a posar tal com era —un registre de progrés, la nota d'una sessió, una franja de disponibilitat que no deixa cap reserva fora— no pregunta: s'esborra al moment i, a baix, surt «Esborrat · Desfer» uns segons.",
        },
        {
          t: "note",
          text: "Aquesta àrea és sempre en català. L'única part de l'app que es tradueix és la del client, i és a posta: la fan servir persones que no formen part de l'equip.",
        },
        { t: "h", text: "El que et distingeix del professional" },
        {
          t: "p",
          text: "Un professional gestiona els seus clients i consulta la resta; l'única excepció és que pot cancel·lar qualsevol reserva de la seva pròpia agenda, encara que el client sigui d'un company. Tu no tens aquesta frontera: pots crear, editar i esborrar sobre qualsevol persona del centre. Hi ha, en canvi, tres coses que ell fa i tu no: escriure la nota d'una sessió (és de qui la va donar; tu la llegeixes), tenir agenda pròpia i tenir clients assignats.",
        },
        { t: "h", text: "Coses que només pots fer tu" },
        {
          t: "ul",
          items: [
            "Donar d'alta i esborrar clients i professionals.",
            "Cobrar: bons pendents, vals de regal i pagaments solts.",
            "Tocar el catàleg: serveis, preus, ofertes i etiquetes.",
            "Calcular i tancar liquidacions i bonus dels professionals.",
            "Canviar la configuració del centre, que afecta les tres àrees alhora.",
            "Exportar i esborrar les dades personals d'un client.",
            "Canviar l'estat d'un tiquet de suport.",
          ],
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
          text: `La pantalla d'entrada respon a «com va el centre avui i què reclama la meva atenció». De dalt a baix: ${s.modules.sessionsProva ? "sis" : "cinc"} xifres, quatre accions ràpides, el que espera resposta, les sessions del dia, els bons que s'acaben i l'ocupació per professional.`,
        },
        { t: "h", text: s.modules.sessionsProva ? "Les sis xifres" : "Les cinc xifres" },
        {
          t: "p",
          text: "Totes són enllaços: toca-les i vas a la pantalla d'on surten. Les dues que poden posar-se en blau fosc, amb l'exclamació al costat del títol, ho fan només quan hi ha alguna cosa a fer.",
        },
        {
          t: "dl",
          items: [
            [
              "Ingressos del mes",
              "Suma dels pagaments REGISTRATS aquest mes natural (hora de Madrid), amb la variació respecte del mes anterior. Compta diners cobrats, no bons venuts: un bo pendent de cobrament no hi surt fins que el cobres. La suma la fa la base de dades, així que és exacta per molts pagaments que hi hagi.",
            ],
            [
              "Pendent de cobrament",
              "Import i nombre de bons per cobrar: els «Pendent de pagament» que no han caducat i els «Decaigut sense cobrar» (que no caduquen). És la mateixa cua que la piloteta de «Bons» del menú i que els dos comptadors de la pantalla de Bons. Es posa en blau fosc si n'hi ha algun. És la xifra que et diu quants diners hi ha compromesos i no ingressats, i la compta la base de dades, exacta per molts bons que hi hagi. Tocant-la vas a Bons amb el filtre ja posat: «Pendents de pagament» si n'hi ha, i si només n'hi ha de decaiguts, «Decaiguts sense cobrar». L'accés «Bons pendents» porta al mateix lloc.",
            ],
            [
              "Bons a punt d'esgotar-se",
              `Bons actius amb ${sess(s.bonoLowThreshold)} o menys. Els caducats en queden fora: la llista és de gent a qui oferir renovació, i un bo que ja no es pot fer servir no hi porta. Es posa en blau fosc si n'hi ha cap.`,
            ],
            [
              "Sessions",
              "Les d'avui, i al costat les de tota la setmana. Compta les reservades i les ja fetes; les cancel·lades, no.",
            ],
            [
              "Ocupació setmanal",
              "Quantes franges de disponibilitat de tot el centre tenen reserva aquesta setmana. Sense cap franja definida surt un guionet, no un zero: no és que el centre estigui buit, és que encara ningú no ha dit quan hi és.",
            ],
            ...(s.modules.sessionsProva
              ? ([
                  [
                    "Conversió de proves",
                    "Quantes sessions de prova que es van arribar a fer han acabat en client. Sense proves fetes, guionet.",
                  ],
                ] as [string, string][])
              : []),
          ],
        },
        { t: "h", text: "Accions ràpides" },
        {
          t: "p",
          text: "Nou client, Nova reserva, Bons pendents i Vals de regal. No són dreceres al menú —el menú ja hi és—: són el primer pas de les quatre tasques que es fan entrant, sense navegar. Els vals hi són perquè són l'únic diner que entra sense passar per la fitxa de ningú, i el més fàcil d'oblidar.",
        },
        { t: "h", text: "El que espera resposta" },
        {
          t: "p",
          text: "Un plafó amb tres coses possibles, i cap més. El criteri per entrar-hi és que NO respondre tingui un cost.",
        },
        {
          t: "dl",
          items: [
            ...(s.modules.sessionsProva
              ? ([
                  [
                    "Sol·licituds de prova pendents",
                    "Amb el compte enrere: mentre no es responen, la franja segueix bloquejada per a tothom.",
                  ],
                ] as [string, string][])
              : []),
            [
              "Vals de regal pendents de cobrament",
              "Un val no es pot bescanviar fins que el marques com a pagat, i qui el va rebre ja el té a la mà.",
            ],
            [
              "Recompenses de referit per aplicar",
              "Descomptes ja guanyats que esperen la propera compra del beneficiari.",
            ],
          ],
        },
        {
          t: "note",
          text: "Si no hi ha res de les tres coses, la secció no es pinta. Un plafó d'atenció que gairebé sempre ensenya tres zeros deixa de mirar-se, i llavors el dia que hi hagi alguna cosa tampoc es veurà.",
        },
        { t: "h", text: "Avui al centre" },
        {
          t: "p",
          text: "Les sessions d'avui de tot el centre, amb l'hora, el client, el servei i de quin professional és cadascuna. Les de cortesia porten l'etiqueta «Cortesia».",
        },
        { t: "h", text: "L'estat de l'agenda" },
        {
          t: "p",
          text: "Sota les sessions d'avui, tres targetes amb el que s'ha de resoldre a l'agenda de tot el centre. Cada una porta on es resol.",
        },
        {
          t: "dl",
          items: [
            [
              "Sense marcar",
              "Les sessions que ja han passat i segueixen com a reservades, dels últims 30 dies, per professional (primer qui en té més). De cadascú se'n llisten les tres més recents; tocant-ne una, l'agenda s'obre aquell dia amb la columna d'aquell professional marcada (i encesa, encara que l'haguessis apagat als filtres). Una sessió que no es marca com a feta no es paga a les liquidacions. Si n'hi ha més de 300, es compten les 300 més recents i la targeta ho diu («300+»).",
            ],
            [
              "Fora de disponibilitat",
              "Quantes reserves, proves i esperes han quedat fora de l'horari del seu professional, per exemple perquè se n'ha tancat una franja o s'hi ha posat un bloqueig. És el mateix recompte del plafó «Reserves fora de la disponibilitat» de Disponibilitat: «Revisar» porta al d'aquell professional, on es decideix què se'n fa.",
            ],
            [
              "Grups amb espera",
              "Els grups d'aquí a diumenge amb gent a la llista d'espera: el dia i l'hora, el professional, l'ocupació («4/4») i els noms dels que esperen, per ordre. Tocant-ne un, l'agenda s'obre aquell dia amb la columna del professional.",
            ],
          ],
        },
        {
          t: "note",
          text: "Cada targeta es llegeix per separat. Si una no es pot carregar, ho diu i no ensenya cap número; les altres surten igual. Un zero vol dir zero de debò.",
        },
        { t: "h", text: "Ocupació per professional" },
        {
          t: "p",
          text: "Les mateixes franges de la xifra d'ocupació, obertes per persona. Qui no té cap disponibilitat definida no hi surt: no seria un 0 %, seria una divisió per zero. El càlcul és el de la tira i la setmana de l'agenda (vegeu «L'agenda de reserves»).",
        },
      ],
    },

    // ─────────────────────────── 3 ───────────────────────────
    {
      id: "clients",
      title: "Clients",
      blocks: [
        {
          t: "p",
          text: "El llistat de tothom qui és client del centre, amb el professional assignat, els bons actius i les sessions que li queden. És la primera pestanya del grup Persones.",
        },
        { t: "h", text: "Buscar" },
        {
          t: "p",
          text: "El cercador de dalt filtra per nom, correu i telèfon, i ignora accents i majúscules; les paraules del nom poden anar en qualsevol ordre. El telèfon es compara només amb els dígits, així que buscar «600100» el troba tant si està desat pelat com amb prefix o espais. Perquè es busqui al telèfon, el que escriguis ha de semblar un telèfon (xifres, espais, +) i tenir almenys tres xifres: «ana42@» ja no treu tots els telèfons que porten un 42.",
        },
        {
          t: "p",
          text: "La llista va per ordre alfabètic i en carrega 50 de cop. A sota diu quants en veus del total («50 de 74 clients») i «Carregar més» n'afegeix 50 més. La cerca es fa al servidor sobre TOTS els clients, no només sobre els carregats, i queda a l'adreça: es pot desar o enviar.",
        },
        {
          t: "note",
          text: "La cerca mira NOMÉS les dades del client. Escriure el nom d'una professional no et retorna els seus clients: per a això hi ha el filtre per professional, que s'activa des del recompte de la pantalla de Professionals i surt com una pastilla lila que pots treure amb la creueta.",
        },
        { t: "h", text: "Les dues accions de cada fila" },
        {
          t: "p",
          text: "A la dreta de cada client hi ha la icona de WhatsApp (només si té telèfon) i «Reenviar invitació», que li torna a enviar el correu per crear la contrasenya. Queden fora de l'enllaç de la fila a posta: si hi fossin a dins, tocar-los obriria la fitxa en comptes de fer el que diuen. Al mòbil, cada client és una targeta: el nom i el WhatsApp a dalt, el correu i «Reenviar invitació» a sota, i el professional, els bons actius i les sessions al final. Tota la targeta obre la fitxa, menys aquests dos botons.",
        },
        { t: "h", text: "Donar d'alta un client" },
        {
          t: "p",
          text: "«+ Nou client» demana el nom, el correu, el telèfon, el professional assignat i dos blocs de notes. En crear-lo neix l'usuari d'accés amb aquest correu i se li envia la invitació perquè es posi contrasenya.",
        },
        {
          t: "p",
          text: "Un correu, un compte. Si el correu ja és d'algú del centre —amb majúscules o espais de més compta igual—, l'alta s'atura abans de crear res i et diu de qui és. Si és d'un client, al costat hi surt «Obrir la seva fitxa»: sovint és algú que ja hi era. Si és d'un professional o de l'administració, cal un altre correu.",
        },
        {
          t: "warn",
          text: "El correu és l'usuari d'accés i l'alta és l'ÚNIC lloc on es pot escriure. A «Editar» es veu però no es toca. Si un client necessita canviar-lo, ho fa ell des de la seva àrea (Configuració → Compte); si no pot, és un cas per al suport.",
        },
        { t: "h", text: "Les dues notes" },
        {
          t: "dl",
          items: [
            [
              "Notes clíniques",
              "Dades de salut. Abans d'escriure-n'hi cap, comprova que el client hagi acceptat el consentiment de dades de salut: si no, la fitxa t'avisa amb una franja blau fosc a la capçalera.",
            ],
            [
              "Notes generals",
              "Tot el que no és salut: preferències, avisos d'agenda, el que calgui.",
            ],
          ],
        },
        {
          t: "note",
          text: "Cap de les dues la veu el client. Són per a l'equip.",
        },
      ],
    },

    // ─────────────────────────── 4 ───────────────────────────
    {
      id: "fitxa-client",
      title: "La fitxa del client",
      blocks: [
        {
          t: "p",
          text: "Tot el que el centre sap d'una persona, en una pantalla. A dalt, la capçalera: el nom, qui la porta, les etiquetes, el contacte i el menú «Més». A sota, cinc pestanyes. La pestanya oberta queda a l'adreça: si recarregues o tornes enrere, segueixes on eres.",
        },
        { t: "h", text: "La capçalera" },
        {
          t: "dl",
          items: [
            [
              "Professional",
              "Qui porta aquesta persona. «Canviar» obre el desplegable aquí mateix, sense passar per «Editar», i «Desar» el canvia.",
            ],
            [
              "Etiquetes",
              "Les que porta, a la vista, perquè dirigeixen ofertes: canvien el preu que veu aquesta persona. «+ Etiqueta» (o «Etiquetes», si ja en té) obre el panell per marcar-ne i desmarcar-ne del catàleg, i per crear-ne una de nova sense sortir de la fitxa.",
            ],
            [
              "Contacte",
              "El correu i el telèfon en text, per copiar-los, i tres botons: WhatsApp, Trucar i Correu. WhatsApp i Trucar només surten si té telèfon.",
            ],
            [
              "Més",
              "Editar dades (el formulari d'alta, amb el correu bloquejat), Exportar dades, Reenviar invitació (diu allà mateix si ha anat bé) i Eliminar client, en vermell i amb la doble confirmació de sempre. Exportar i eliminar es tracten al capítol de dades personals.",
            ],
          ],
        },
        {
          t: "warn",
          text: "El professional assignat decideix amb qui pot reservar el client des de la seva àrea: les sessions individuals i en parella, NOMÉS amb el seu entrenador assignat; els grups i la fisioteràpia, amb qualsevol professional que en faci segons la seva disponibilitat (no segons l'especialitat). Un client sense professional assignat no pot reservar individual ni parelles fins que n'hi posis un; l'app li diu que parli amb el centre. Tu i els professionals, quan reserveu per a un client, no hi esteu subjectes. Si li canvies el professional, les reserves que ja tenia es queden, les seves esperes amb l'anterior ja no entraran, i una sèrie seva que s'allargava sola deixa d'allargar-se.",
        },
        { t: "h", text: "Les cinc pestanyes" },
        {
          t: "dl",
          items: [
            [
              "Resum",
              "Els bons actius, les sessions restants i les notes si n'hi ha.",
            ],
            [
              "Bons i pagaments",
              "Tots els seus bons amb sessions restants, preu, caducitat i estat. «+ Afegir bo» ven un bo nou a aquesta persona, amb el preu que li toca a ELLA (ofertes segmentades incloses). A sota, cada cobrament amb data, import i mètode.",
            ],
            [
              "Sessions",
              "L'historial sencer amb l'estat de cadascuna, i «Recordatori de propera sessió», que li envia un correu amb la propera que té reservada.",
            ],
            [
              "Entrenament",
              "Els exercicis que té assignats i el buscador per assignar-n'hi de nous de la biblioteca; «Notificar exercicis nous», que l'avisa per correu; i les mesures registrades de cada exercici.",
            ],
            [
              "Notes i documents",
              "Les notes clíniques i les generals, amb l'enllaç per editar-les, i els documents que el client ha pujat des de la seva àrea. Els documents són només lectura: aquí no se'n puja cap.",
            ],
          ],
        },
        ...(s.modules.documents
          ? []
          : ([
              {
                t: "note",
                text: "El mòdul Documents està desactivat: el client no en pot pujar de nous, però la pestanya Notes i documents continua ensenyant els que ja hi havia. Amagar-la esborraria de la vista uns documents que segueixen existint.",
              },
            ] as Block[])),
        { t: "h", text: "L'avís de consentiment de salut" },
        {
          t: "p",
          text: "Si el client rep o ha rebut fisioteràpia i encara no ha acceptat el tractament de dades de salut, la capçalera de la fitxa porta una franja blau fosc curta; «Més info» la desplega. Mentre hi sigui, no hi registris notes mèdiques: l'ha d'acceptar ell des de la seva àrea, a Configuració → Privacitat i consentiments.",
        },
      ],
    },

    // ─────────────────────────── 5 ───────────────────────────
    {
      id: "etiquetes",
      title: "Etiquetes de client",
      blocks: [
        {
          t: "p",
          text: "Text lliure per agrupar clients: «VIP», «matins», «ve del gimnàs del costat». El client no les veu mai. Serveixen per a dues coses: filtrar mentalment la teva cartera i, sobretot, dirigir ofertes.",
        },
        {
          t: "p",
          text: "Són a Catàleg → Etiquetes. Al menú, «Catàleg» obre el grup, i a dalt hi trobes sempre les tres pestanyes: Serveis, Ofertes i Etiquetes. És el mateix camí que per a qualsevol pantalla que formi part d'un grup.",
        },
        { t: "h", text: "El catàleg" },
        {
          t: "p",
          text: "La pantalla llista cada etiqueta amb quants clients la porten i quines ofertes hi apunten. Des d'aquí se'n creen, se'n reanomenen i se n'esborren.",
        },
        {
          t: "note",
          text: "Crear una etiqueta amb un nom que ja existeix no en crea una segona: reaprofita la que hi havia. No distingeix majúscules ni espais sobrants, així que «vip», «VIP» i « Vip » són la mateixa.",
        },
        { t: "h", text: "Assignar-les" },
        {
          t: "p",
          text: "L'assignació es fa des de la capçalera de la fitxa de cada client, amb «+ Etiqueta», marcant i desmarcant. També hi pots crear-ne una de nova i assignar-la de cop, sense venir fins aquí. Un professional pot etiquetar els SEUS clients; crear-les al catàleg, no.",
        },
        { t: "h", text: "Per què no sempre es deixen esborrar" },
        {
          t: "p",
          text: "Si una oferta fa servir l'etiqueta com a públic, esborrar-la queda bloquejat i el missatge t'ho diu. No és un caprici: si desaparegués, l'oferta es quedaria dirigida a ningú i deixaria de descomptar en silenci. Canvia primer el públic de l'oferta —o esborra-la— i després torna aquí.",
        },
        {
          t: "p",
          text: "Esborrar una etiqueta que cap oferta no fa servir sí que funciona, i les assignacions als clients cauen soles amb ella.",
        },
      ],
    },

    // ─────────────────────────── 6 ───────────────────────────
    {
      id: "professionals",
      title: "Professionals",
      blocks: [
        {
          t: "p",
          text: "La segona pestanya del grup Persones. Una fila per professional amb la foto, el correu, l'especialitat i quants clients té assignats.",
        },
        { t: "h", text: "Donar-ne un d'alta" },
        {
          t: "p",
          text: "«+ Nou professional» demana el nom, el correu, la foto (opcional: JPG, PNG o WEBP fins a 3 MB) i l'especialitat. En crear-lo neix l'usuari amb rol de professional i se li envia el correu d'invitació perquè es posi contrasenya i pugui entrar. No cal fer res més: la seva àrea ja l'espera. Si el correu ja és d'un altre compte del centre, l'alta s'atura abans de crear res i et diu de qui és.",
        },
        { t: "h", text: "Editar-lo" },
        {
          t: "p",
          text: "Un cop creat, el nom es veu però no es toca. El que sí que pots canviar sempre és la foto i l'especialitat.",
        },
        {
          t: "note",
          text: "L'Entrenador Demo i el Fisio Demo són comptes de proves: cap client real els veu ni hi pot reservar (tampoc grup ni fisioteràpia), i /prova no n'ofereix cap hora. El Client Demo, al revés, només reserva amb ells. Tampoc es poden barrejar des de «+ Nova reserva».",
        },
        { t: "h", text: "Canviar-li el correu d'accés" },
        {
          t: "p",
          text: "A sota de la fitxa, «Correu d'accés». No el canvies tu directament: escrius el correu nou i «Enviar l'enllaç de confirmació» li envia un enllaç a aquella bústia. El canvi es fa quan el professional hi fa clic (val 24 hores), i així queda comprovat que la bústia és seva. Al correu d'ara li arriba un avís sense cap enllaç. A partir d'aquí entra amb el correu nou i la mateixa contrasenya, i els avisos li arriben allà. Les seves reserves, liquidacions i notes no es mouen.",
        },
        {
          t: "note",
          text: "Mentre no el confirma, la fitxa diu a quina adreça s'ha enviat i té «Anul·lar l'enllaç». Un correu que ja fa servir un altre compte del centre no s'accepta, i entre dos enviaments cal esperar 5 minuts. Només val per als professionals: els clients es canvien el correu ells mateixos des de la seva àrea.",
        },
        {
          t: "note",
          text: "L'especialitat no és decorativa: decideix quins serveis vénen marcats per defecte quan es crea una franja de disponibilitat seva, i és el que distingeix una fisioterapeuta d'un entrenador a tota l'app.",
        },
        { t: "h", text: "Reenviar la invitació" },
        {
          t: "p",
          text: "A cada fila hi ha «Reenviar invitació»: genera un enllaç nou i li torna a enviar el correu per crear la contrasenya. És el que has de prémer si diu que no li ha arribat o que ja ha caducat. Al mòbil, cada professional és una targeta: la foto, el nom i l'especialitat a dalt, el correu i «Reenviar invitació» al mig, i el recompte de clients i «Editar» a baix. Tota la targeta obre «Editar».",
        },
        { t: "h", text: "El recompte de clients" },
        {
          t: "p",
          text: "El número de la columna «Clients» és un enllaç: porta al llistat de clients ja filtrat per aquesta persona. Si en té zero, no és enllaç.",
        },
        { t: "h", text: "El que gestiona ell i el que gestiones tu" },
        {
          t: "dl",
          items: [
            [
              "Tu",
              "El seu nom, el correu d'accés, la foto, l'especialitat, la seva disponibilitat, la seva tarifa i el seu bonus.",
            ],
            [
              "Ell",
              "La seva contrasenya, quins avisos vol rebre, i la seva pròpia disponibilitat (que també pots tocar tu).",
            ],
          ],
        },
        {
          t: "warn",
          text: "Aquesta pantalla no té botó d'esborrar. Un professional amb sessions fetes és a liquidacions, a bonus i a l'historial de reserves de mig centre; treure'l no és una operació de pantalla. Si algú marxa, deixa-li la fitxa i buida-li la disponibilitat: sense franges, ningú no li pot reservar res.",
        },
      ],
    },

    // ─────────────────────────── 7 ───────────────────────────
    {
      id: "agenda",
      title: "L'agenda de reserves",
      blocks: [
        {
          t: "p",
          text: "Totes les reserves del centre, de tots els professionals. A l'ordinador es veu de tres maneres, amb el selector de dalt: Dia, Setmana o Llista. Al mòbil, de dues: Calendari (el dia) o Llista.",
        },
        {
          t: "p",
          text: "El calendari és UN DIA amb UNA COLUMNA PER PROFESSIONAL: a cada columna, les seves sessions, els seus forats lliures, els seus bloquejos i les proves que té. Les fletxes canvien de dia i «Avui» torna al d'avui. Al capdamunt de cada columna, el nom i quantes sessions té aquell dia; un guionet vol dir que té horari però cap sessió, i «sense horari», que aquell dia no en té.",
        },
        {
          t: "p",
          text: "Al mòbil se'n veuen tres alhora: si n'hi ha més, les fletxes ‹ › del costat de «Filtres» mouen la finestra d'un professional en un, i el text del mig diu quins estàs veient («1–3 de 4»). A l'ordinador surten tots els que tinguis encesos.",
        },
        { t: "h", text: "La tira de la setmana" },
        {
          t: "p",
          text: "A dalt de l'agenda, cinc caselles: de dilluns a divendres de la setmana del dia que mires. Cada casella té una barra per professional encès, del seu color, que s'omple amb la seva ocupació d'aquell dia. A sota, quants grups hi ha plens i quanta gent espera plaça («1 ple · 2 en espera»), o un guionet si no n'hi ha cap. Tocant una casella vas a aquell dia.",
        },
        {
          t: "note",
          text: "L'ocupació és la mateixa xifra a tot arreu (l'Inici, la tira i la setmana): de les mitges hores de l'horari del professional que no estan bloquejades, quantes cobreix una sessió reservada o feta. Un grup compta la seva hora sencera, tingui 1 o 4 apuntats; les cancel·lades i les proves no compten.",
        },
        {
          t: "note",
          text: "La barra no diu quantes sessions hi ha, sinó quina part de l'horari està agafada: un professional amb poques hores i totes plenes surt ple, i un amb moltes hores i dues sessions surt gairebé buit. Els percentatges exactes els llegeix el lector de pantalla.",
        },
        { t: "h", text: "La setmana (només a l'ordinador)" },
        {
          t: "p",
          text: "«Setmana» ensenya la setmana sencera del centre en una pantalla: cada dia és una banda i, a dins, una franja per professional amb les hores d'esquerra a dreta. A l'esquerra de cada franja, el nom i l'ocupació d'aquell dia en %. A la capçalera de cada dia, el resum: sessions, grups plens i gent en espera, sessions per marcar i hores lliures. Les fletxes canvien de setmana i «Aquesta setmana» torna a la d'ara. El dissabte i el diumenge només hi surten si algú hi té horari o alguna cosa.",
        },
        {
          t: "dl",
          items: [
            ["Una sessió", "Del color del seu servei, amb el nom del client. Les fetes, apagades. Tocant-la s'obre la mateixa fitxa que al dia."],
            ["Un grup", "Una sola peça taronja amb l'ocupació («3/4») i, si està ple i hi ha gent esperant, «+2». Tocant-la, la llista dels apuntats i dels que esperen."],
            ["Per marcar", "Un anell blau fosc i el cercle amb l'exclamació: passada, encara reservada i dels últims 30 dies."],
            ["Prova pendent", "Vora blau fosc discontínua i el rellotge de sorra. Tocant-la, l'acceptes o la rebutges."],
            ["Lliure", "Verd discontinu, amb els serveis que hi caben («EP · Par.»). Tocant-lo a l'hora que vols s'obre la fulla de crear-hi una reserva, amb el professional, el dia i la mitja hora tocada; mentre la fulla és oberta, la mitja hora queda marcada a la franja. Amb un servei triat al filtre, només s'ofereix aquell."],
            ["Bloquejat", "Ratllat, amb el motiu."],
            ["Fora d'horari", "El fons gris de la franja. Si un professional no té ni horari ni res aquell dia, no té franja: surt a la línia «Sense horari aquest dia»."],
          ],
        },
        {
          t: "p",
          text: "«Obrir el dia →» porta a la vista de dia d'aquell dia, i el nom d'una franja, al dia amb aquell professional marcat. Passant el ratolí per sobre de qualsevol peça surt un globus amb el detall: el client i el servei, els apuntats d'un grup, les hores i els serveis d'un forat o el motiu d'un bloqueig. Els botons de cada professional, a dalt, diuen el total de la setmana: les sessions (un grup compta com una) i l'ocupació. Els filtres de professional i de servei manen igual que al dia; la cerca de client no hi és (per buscar un client, la Llista). En fer scroll, les hores i la capçalera del dia es queden a dalt. Al mòbil no hi ha «Setmana»: un enllaç a la setmana obert al mòbil ensenya el dia.",
        },
        { t: "h", text: "Pròxim forat" },
        {
          t: "p",
          text: "Al capdamunt de cada columna, sota el nom, «Pròxim forat» diu quan és el primer forat lliure d'aquell professional, d'ara a dues setmanes («dt. 29 · 15:00»). Si hi ha un servei triat al filtre, busca un forat d'aquell servei. Tocant-lo, l'agenda va a aquell dia i s'obre la fulla de crear-hi la reserva. Si no en té cap en dues setmanes, ho diu.",
        },
        {
          t: "p",
          text: `Com a l'agenda del professional, només surten les hores amb alguna cosa: la primera i l'última amb horari o sessions, i els trams llargs buits es pleguen en una banda fina. «Mostrar-ho tot» ensenya l'horari sencer del centre, de ${hhmm(s.openingHour)} a ${hhmm(s.closingHour)}.`,
        },
        {
          t: "p",
          text: "La Llista s'obre amb trenta dies cap a cada banda: els trenta pròxims a «Properes» i els trenta darrers a «Passades». Sota de cadascuna, «Veure'n més» n'afegeix trenta més, fins a un any. El dia, la vista i els dies de la llista queden a l'adreça de la pàgina: si la guardes o la comparteixes, s'obre on eres.",
        },
        { t: "h", text: "Què hi surt" },
        {
          t: "dl",
          items: [
            [
              "Una sessió",
              "Una targeta amb l'hora, el client i la icona del servei, pintada amb el color del servei (Configuració → Colors). Un grup és una sola targeta amb els noms i l'ocupació («3/4»); tocant-la surt la llista dels apuntats i, si té places, «Apuntar-hi un client».",
            ],
            [
              "+N en espera",
              "Un grup ple amb gent a la llista d'espera. Tocant-lo, a sota dels apuntats surten els noms dels que esperen, per ordre d'arribada: si s'allibera una plaça, es dona per aquest ordre. Els noms només els veu l'administració; el professional en veu el nombre.",
            ],
            [
              "Per marcar",
              "Anell blau fosc i l'etiqueta «Per marcar» amb el cercle de l'exclamació: la sessió ja ha passat i segueix com a reservada. És feina pendent de qui la va donar; si cal, la pots marcar tu des de la fitxa. Només les dels últims 30 dies, com «Sense marcar» de l'Inici: les més antigues surten com una sessió passada qualsevol.",
            ],
            [
              "Lliure",
              "Un forat real del professional: dins del seu horari, sense bloqueig i sense cap sessió ni prova que el trepitgi, amb els serveis que s'hi poden fer. Tocant-lo s'obre la fulla de crear-hi una reserva amb aquell professional, aquell dia i l'hora de la mitja hora on has tocat (vegeu «Crear i gestionar reserves»).",
            ],
            [
              "Bloquejat",
              "Una franja ratllada amb el motiu que hi va posar qui el va crear (vacances, un congrés…). Només l'administració veu el motiu dels bloquejos de tothom.",
            ],
            [
              "Prova",
              "Una sol·licitud de sessió de prova, a l'hora que ocupa, en blau fosc amb «PROVA». Pendent de resposta: vora discontínua i el rellotge de sorra; confirmada, vora sòlida. Tocant-la, l'acceptes o la rebutges.",
            ],
          ],
        },
        {
          t: "note",
          text: "A tota l'agenda (el dia, la setmana i la del professional) el taronja és només dels grups, el color del seu servei. El que demana feina va en blau fosc i sempre amb un signe que s'entén sense color: l'anell i el cercle amb l'exclamació per a «per marcar», la vora discontínua i el rellotge de sorra per a una prova pendent. La línia de l'hora d'ara segueix sent taronja; el requadre amb l'hora, en un taronja fosc que es llegeix bé (AA).",
        },
        { t: "h", text: "Els filtres" },
        {
          t: "p",
          text: "Uns botons amb el nom de cada professional encenen o apaguen la seva columna; un selector deixa només un servei (i els forats d'aquell servei), i un camp busca un client pel nom, sense que importin els accents. Al mòbil van plegats dins de «Filtres», que en fa el resum («3/4 · Fisioteràpia»). Són només de vista: no canvien res, només amaguen.",
        },
        {
          t: "note",
          text: "Els professionals apagats i el servei es recorden en aquest navegador: demà, en obrir l'agenda, la trobaràs igual. Un professional nou surt encès sense haver de tocar res. En un altre dispositiu, o en mode privat, torna a sortir tot.",
        },
        { t: "h", text: "La fitxa d'una reserva" },
        {
          t: "p",
          text: "Tocant una sessió al calendari s'obre la seva fitxa: al mòbil, una fulla que puja des de baix; a l'ordinador, un plafó a la dreta que deixa veure el calendari al costat. A més del servei, l'estat i el professional, hi surt el telèfon del client (amb «Copiar»), el bo del qual surt la sessió amb les que li queden i quan caduca, la posició dins de la sèrie si en forma part, la propera sessió que té reservada i l'enllaç a la seva fitxa. Aquestes dades es demanen en obrir-la, així que tarden un moment a sortir.",
        },
        {
          t: "p",
          text: "Des d'allà mateix es marca feta o es cancel·la, i «Canviar l'hora» ofereix només les hores on aquell professional la pot fer de debò: dins del seu horari, sense bloqueig i sense xocar amb res. Si mentre tries algú ocupa aquella hora, t'ho diu a la mateixa fitxa i la reserva no es mou. En moure-la, el client rep un correu amb la nova hora. «Afegir al calendari» només surt a les sessions que encara han de passar.",
        },
        { t: "h", text: "Les notes de sessió" },
        {
          t: "p",
          text: "Les sessions ja passades porten la nota que hi va escriure el professional que la va donar: la veus a la vista de llista, a «Passades», i a la fitxa de la reserva. Tu les LLEGEIXES; no n'escrius cap. No és una limitació de la pantalla: encara que sortís el formulari, la base de dades no deixaria desar-la. La nota és de qui va fer la sessió.",
        },
        {
          t: "note",
          text: "Les llegiu tres: el professional d'AQUELLA sessió, el client de qui és, i tu. Els altres professionals no, ni tan sols el que coordina aquell mateix client. El client la troba a la seva àrea, a Reserves, amb les sessions que ja ha fet: escriu-les sabent que les llegirà ell.",
        },
        ...(s.modules.sessionsProva
          ? ([
              { t: "h", text: "Les proves, al mateix calendari" },
              {
                t: "p",
                text: "Les sol·licituds de sessió de prova pendents surten a l'agenda ocupant la seva franja, i les pots acceptar o rebutjar tocant-les, sense anar a la seva pantalla.",
              },
            ] as Block[])
          : []),
      ],
    },

    // ─────────────────────────── 8 ───────────────────────────
    {
      id: "reserves",
      title: "Crear i gestionar reserves",
      blocks: [
        { t: "h", text: "Crear-ne una" },
        {
          t: "p",
          text: "Hi ha dues maneres: tocant un forat lliure de l'agenda, que és la ràpida, o amb «+ Nova reserva», el formulari de sempre, per a tot el que no cau en un forat (repeticions setmanals, una reserva sense professional).",
        },
        { t: "h", text: "Des d'un forat de l'agenda" },
        {
          t: "p",
          text: "La fulla no té cap camp de data ni de professional: el dia, l'hora i el professional són els del forat (surt escrit a dalt: «amb Raul Vidal»). Hi tries el servei —només els que hi caben— i el client, i prems Crear. Si el client té un bo d'aquell servei, la fulla diu de quin es gastarà la sessió i quantes en queden; si no en té, ho diu abans de crear i només deixa fer-la com a sessió de cortesia.",
        },
        {
          t: "p",
          text: "Per apuntar algú a un grup que ja existeix, toca la targeta del grup i «Apuntar-hi un client»: només surt si hi ha places i la sessió encara no ha passat. Pots apuntar-hi qualsevol client del centre, sigui de qui sigui.",
        },
        {
          t: "note",
          text: "Si mentre tens la fulla oberta algú agafa aquell forat, en prémer Crear la fulla t'ho diu i no es crea res.",
        },
        { t: "h", text: "Buscar el client" },
        {
          t: "p",
          text: "A la fulla i a «+ Nova reserva» el client no es tria d'una llista llarga: s'escriu un tros del nom, sense accents ni majúscules i en qualsevol ordre («puig laia» troba la Laia Puig), i en surten com a molt vint, cadascun amb els bons que té. Sense escriure res, surten els vint primers per ordre alfabètic. Tu hi trobes tots els clients del centre; un professional, només els seus.",
        },
        {
          t: "note",
          text: "Abans el formulari carregava tots els clients a la pàgina, i a partir del miler els últims no hi sortien sense que ningú ho notés. Ara la cerca es fa al servidor i no hi ha aquest límit.",
        },
        { t: "h", text: "El formulari «+ Nova reserva»" },
        {
          t: "p",
          text: "Es busca el client, es tria el bo del qual sortirà la sessió, el professional i el moment.",
        },
        {
          t: "note",
          text: "El desplegable de bo només ensenya els bons d'aquell client que es poden fer servir: actius o pendents de pagament, amb sessions i sense haver passat la data de caducitat. Si surt buit, o no en té cap, o els té esgotats o caducats: ven-li'n un abans des de la seva fitxa. El servidor fa la mateixa comprovació en crear: amb un bo caducat, la reserva no es crea.",
        },
        { t: "h", text: "Sessió de cortesia" },
        {
          t: "p",
          text: `Marcant la casella, la sessió es regala: no descompta cap sessió de cap bo. En marcar-la desapareix el selector de bo i al seu lloc has de dir el tipus de servei, que amb bo sortia del bo mateix. En una sessió de grup ocupa plaça igual: el màxim de ${s.groupCapacity} es respecta.`,
        },
        { t: "h", text: "Repeticions setmanals" },
        {
          t: "p",
          text: "El camp «Repeticions setmanals» crea una reserva cada setmana a la mateixa hora, fins a 52. Amb bo, consumeix una sessió per cada reserva creada; de cortesia, cap.",
        },
        { t: "h", text: "Cancel·lar, completar, reprogramar" },
        {
          t: "dl",
          items: [
            [
              "Cancel·lar",
              "Retorna la sessió al bo, avisa el client per correu i, si era una sessió de grup amb llista d'espera, la plaça passa automàticament a qui esperava. Només si la franja segueix dins de la disponibilitat del professional: a una franja tancada no hi entra ningú. El primer toc només pregunta: fins que no confirmes amb «Sí, cancel·la» no passa res, tant a la fitxa com a la vista de llista.",
            ],
            [
              "Completar",
              "Marca la sessió com a feta. És el que fa que compti a liquidacions i a bonus: una sessió que va passar però ningú no va marcar no es paga.",
            ],
            [
              "Reprogramar",
              "Mou la sessió a una altra hora sense tocar el bo (no se'n gasta una altra ni es torna l'antiga); si és d'una sèrie, es mou només aquesta. Només funciona sobre una reserva encara reservada, i la nova hora ha de ser futura i estar lliure de debò: dins de la disponibilitat del professional, sense bloqueigs, sense una altra sessió o prova a sobre i, si és d'un grup, amb places. Si no ho està, la fitxa diu per què i la sessió es queda on era. Si era una plaça d'un grup ple, la plaça de l'hora d'abans passa al primer de la llista d'espera. El client rep sempre un correu amb l'hora nova i la d'abans (si és d'una sèrie, li diu que només canvia aquesta).",
            ],
          ],
        },
        {
          t: "warn",
          text: "L'avís de cancel·lació al client no es pot desactivar per preferències, i el de canvi d'hora tampoc. És deliberat: una reserva que ja no existeix —o una hora que ja no és la seva— no la pot veure enlloc, i si no ho sap es planta al centre.",
        },
        { t: "h", text: "Les regles que hi posa la configuració" },
        {
          t: "p",
          text:
            (s.minBookingHours > 0
              ? `El CLIENT no pot reservar res que comenci en menys de ${hores(s.minBookingHours)}. `
              : "Ara mateix el client pot reservar fins a l'últim moment. ") +
            (s.minCancellationHours > 0
              ? `Tampoc pot cancel·lar si la sessió és en menys de ${hores(s.minCancellationHours)}. `
              : "Tampoc hi ha marge mínim per cancel·lar. ") +
            "Tots dos marges es canvien a Configuració → Centre, i cap dels dos t'afecta a tu: des d'aquí pots crear i cancel·lar quan calgui.",
        },
        { t: "h", text: "La llista d'espera" },
        {
          t: "p",
          text: s.waitlistEnabled
            ? `Quan una sessió de grup arriba a ${s.groupCapacity} persones, el client es pot apuntar a la cua. No hi ha pantalla per gestionar-la: funciona sola. Si algú cancel·la —tant si ho fa ell com si ho fas tu—, la plaça passa al primer de la fila i se l'avisa per correu. Si la franja ja no existeix —un bloqueig, una franja esborrada—, no hi entra ningú: les esperes d'aquella hora surten al pas de confirmació de Disponibilitat, on es poden tancar.`
            : `La llista d'espera està desactivada: quan una sessió de grup arriba a ${s.groupCapacity} persones, el client ja no s'hi pot apuntar. Els qui ja hi eren, però, continuen entrant quan s'allibera una plaça.`,
        },
      ],
    },

    // ─────────────────────────── 9 ───────────────────────────
    {
      id: "disponibilitat",
      title: "Disponibilitat dels professionals",
      blocks: [
        {
          t: "p",
          text: "La segona pestanya del grup Reserves. Aquí decideixes quan hi és cadascú, i per tant què pot triar un client quan vol reservar. Es tria el professional amb els botons de dalt i s'edita el seu horari.",
        },
        {
          t: "warn",
          text: "Mentre un professional no tingui cap franja, cap client no li pot reservar res. És la causa número u de «no em deixa reservar amb ella».",
        },
        { t: "h", text: "L'horari setmanal" },
        {
          t: "p",
          text: "Una franja és: uns dies de la setmana, una hora d'inici i una de fi, una data des de quan val i (opcionalment) fins quan, i quins serveis s'hi ofereixen. Es poden marcar diversos dies alhora i es creen totes de cop.",
        },
        {
          t: "p",
          text: "Les hores van de mitja en mitja hora —les 9:00 o les 9:30, però no les 9:15— i la franja ha de durar com a mínim una sessió. Dins d'ella, un client pot començar cada mitja hora sempre que la sessió hi càpiga sencera: en una franja de 9:00 a 13:00 l'última hora d'inici són les 12:00.",
        },
        {
          t: "p",
          text: "Els serveis marcats per defecte surten de l'especialitat de la persona, però els pots canviar. Una franja sense cap servei marcat no la pot fer servir ningú.",
        },
        {
          t: "p",
          text: "Cada franja es pot editar —hores, serveis i vigència— o esborrar. Si esborrar-la no deixa cap reserva fora, s'esborra al moment i surt «Desfer» uns segons. Si el canvi deixa reserves sense on caure, la pantalla t'atura abans de desar: ho explica «Quan un canvi deixa reserves fora», més avall.",
        },
        { t: "h", text: "Per a unes vacances, un bloqueig" },
        {
          t: "warn",
          text: "Si un professional se'n va de vacances o està de baixa, crea-li un bloqueig. No li esborris les franges setmanals: l'horari desapareix del tot, s'ha de tornar a crear a mà quan torna i, mentrestant, les reserves que hi queien s'han de resoldre igualment. Un bloqueig tapa l'horari els dies que toca i, quan s'acaba, l'horari torna sol.",
        },
        { t: "h", text: "Els bloquejos temporals" },
        {
          t: "p",
          text: `A sota hi ha els bloquejos: uns dies o unes hores en què aquesta persona no hi és, per damunt de l'horari setmanal. Vacances, una baixa, una tarda. Es poden posar com a dia complet (de ${hhmm(s.openingHour)} a ${hhmm(s.closingHour)}) o amb hora exacta, i admeten un motiu.`,
        },
        {
          t: "note",
          text: "Un bloqueig guanya sempre a l'horari setmanal. No cal esborrar la franja: es tapa i prou, i quan el bloqueig s'acaba torna sola. Tapa qualsevol sessió que toqui, encara que només sigui un tros: una sessió de 12:00 a 13:00 queda sota un bloqueig que comenci a les 12:30.",
        },
        {
          t: "note",
          text: "Un bloqueig que ja ha començat no es pot esborrar. Els que encara no han arribat, sí.",
        },
        { t: "h", text: "Quan un canvi deixa reserves fora" },
        {
          t: "p",
          text:
            "Esborrar una franja, retallar-la, treure-li un servei, escurçar-ne la vigència o crear un bloqueig pot deixar compromisos sense on caure. Abans de desar res, la pantalla t'atura i te'ls llista: les reserves" +
            (s.modules.sessionsProva ? ", les sessions de prova" : "") +
            " i les esperes de la llista d'espera d'aquelles franges. Tots surten marcats. Fins que no tries, no s'ha desat res.",
        },
        {
          t: "dl",
          items: [
            [
              "«Desar i cancel·lar les marcades»",
              "Desa el canvi i cancel·la el que està marcat. Cada reserva torna la sessió al bo i el client rep un correu que diu que ha estat el centre" +
                (s.modules.sessionsProva
                  ? "; cada sessió de prova s'anul·la i se n'avisa qui la va demanar"
                  : "") +
                "; cada espera es tanca.",
            ],
            [
              "Desmarcar",
              "El que desmarquis es desa igualment però es queda tal com està: la reserva segueix reservada, fora de l'horari, i passa al plafó «Reserves fora de la disponibilitat».",
            ],
            [
              "«Tornar enrere»",
              "No desa res. El formulari es queda com estava.",
            ],
          ],
        },
        {
          t: "p",
          text: "Cada fila et diu què passarà abans de decidir:",
        },
        {
          t: "ul",
          items: [
            "Cortesia: no hi ha cap sessió a retornar.",
            "Bo caducat: la sessió hi torna, però el bo ja no serveix per reservar. El correu al client ho diu així, sense prometre-li que la podrà fer servir.",
            "De sèrie: la sèrie continua, i aquesta sessió no compta per al seu total.",
          ],
        },
        {
          t: "note",
          text: "Si una altra franja del mateix professional segueix cobrint aquella hora i aquell servei, la reserva no surt a la llista: no ha quedat fora de res.",
        },
        {
          t: "note",
          text: "Qui era a la llista d'espera no entra a una franja que s'ha tancat. La cua només avança quan es cancel·la una sessió d'una franja que segueix existint.",
        },
        { t: "h", text: "Reserves fora de la disponibilitat" },
        {
          t: "p",
          text: "Dalt de tot de la pantalla, i només si n'hi ha, surt el plafó «Reserves fora de la disponibilitat» del professional triat: tot el que ara mateix cau fora del seu horari o sota un bloqueig. Hi surt el que es va decidir mantenir, el que ja era fora d'abans i el que una cancel·lació que ha fallat ha deixat reservat.",
        },
        {
          t: "p",
          text: "Aquí les caselles surten desmarcades, al revés que en desar un canvi: el que hi ha al plafó sovint hi és a posta. Marca el que vulguis cancel·lar i prem «Cancel·lar les marcades»; passa exactament el mateix que al pas de confirmació.",
        },
      ],
    },

    // ─────────────────────────── 10 ───────────────────────────
    {
      id: "sessions-prova",
      title: "Sessions de prova",
      when: s.modules.sessionsProva,
      blocks: [
        {
          t: "p",
          text: `La tercera pestanya del grup Reserves (al mòbil, la pestanya diu «Proves» perquè hi càpiguen les tres). Recull les sol·licituds que arriben de la pàgina pública de prova gratuïta. Qui la demana encara no és client: hi deixa el nom, el telèfon i el correu, i tria un forat entre ${hores(s.trialMinAdvanceHours)} i ${s.trialMaxAdvanceDays} dies vista.`,
        },
        {
          t: "warn",
          text: "Una sol·licitud pendent PRE-BLOQUEJA la franja: mentre no la contestes, ningú més no la pot reservar. Per això surt al plafó d'atenció de l'inici amb un compte enrere.",
        },
        {
          t: "p",
          text: "La pantalla té dues parts. A dalt, «Pendents», ordenades per la que caduca abans. A sota, l'«Històric» (les acceptades, rebutjades, caducades, fetes…), de la prova més recent a la més antiga: en carrega 50 de cop, diu quantes en veus del total i «Carregar més» n'afegeix 50 més. Quan acceptes o rebutges una pendent, passa a l'històric.",
        },
        { t: "h", text: "Respondre-la" },
        {
          t: "dl",
          items: [
            [
              "Acceptar",
              "Confirma la prova i avisa la persona. La franja queda ocupada de debò.",
            ],
            [
              "Rebutjar",
              "Allibera la franja i avisa la persona. Es pot fer tant sobre una pendent com sobre una ja confirmada.",
            ],
          ],
        },
        {
          t: "note",
          text: "L'avís de resposta al sol·licitant s'envia sempre: és la contestació al que va demanar ell, no una comoditat que es pugui apagar.",
        },
        { t: "h", text: "Un cop confirmada" },
        {
          t: "p",
          text: "Quan la prova ja és confirmada apareixen tres botons més per dir com ha anat: «Completada», «No presentat» i «Cancel·lar». Marcar-les no és paperassa: la xifra de conversió de l'inici es calcula sobre les que consten com a fetes.",
        },
        { t: "h", text: "Convertir en client" },
        {
          t: "p",
          text: "El botó lila «Convertir en client» obre l'alta amb el nom, el correu, el telèfon i el professional ja posats, i amb la nota general «Prové d'una sessió de prova». Un cop convertida, la fila ho indica i el botó desapareix.",
        },
        {
          t: "p",
          text: "Les caducades són sol·licituds que ningú no va contestar a temps: la franja s'ha alliberat sola.",
        },
      ],
    },

    // ─────────────────────────── 11 ───────────────────────────
    {
      id: "bons",
      title: "Bons",
      blocks: [
        {
          t: "p",
          text: "Tots els bons del centre, del més nou al més antic, amb el client, el servei, les sessions, el preu, la caducitat i l'estat. Els filtres de dalt —Tots, Pendents de pagament, Decaiguts sense cobrar i Actius— són la manera ràpida d'anar al que et fa falta; els de pendents i decaiguts porten un comptador blau fosc quan n'hi ha, i entre tots dos sumen la piloteta del menú. La llista en carrega 50 de cop: a sota diu quants en veus del total i «Carregar més» n'afegeix 50 més. El filtre queda a l'adreça. Si cobres o anul·les un bo, la llista torna a començar des del principi amb l'estat nou. El nom del client porta a la seva fitxa. Al mòbil, cada bo és una targeta: el client i l'estat a dalt, el servei, les sessions, el preu i la caducitat a sota i, si n'hi ha, «Marcar com pagat» a tot l'ample amb «Anul·lar» al costat; no cal lliscar de costat per veure res.",
        },
        { t: "h", text: "Els sis estats" },
        {
          t: "dl",
          items: [
            ["Actiu", "Té sessions i es pot fer servir."],
            ["Pendent de pagament", "Venut i encara no cobrat. Reserva, però no s'ha ingressat res."],
            ["Completat", "S'han fet totes les sessions. Final normal."],
            ["Caducat", "Ha passat la data de validesa amb sessions sense fer. És pèrdua, i per això surt en vermell i no en gris."],
            ["Anul·lat per impagament", "Ha decaigut per no haver-se cobrat a temps (als filtres, «Decaiguts sense cobrar»). També pèrdua."],
            ["Cancel·lat", "Anul·lat a mà."],
          ],
        },
        { t: "h", text: "Vendre un bo" },
        {
          t: "p",
          text: "Els bons es venen des de la fitxa del client, a «+ Afegir bo». Es tria un paquet del catàleg i el formulari omple sol les sessions i el preu —amb l'oferta que li toqui a aquesta persona ja aplicada—, però tots dos es poden sobreescriure a mà.",
        },
        {
          t: "p",
          text: "El desplegable «Cobrament» decideix com neix: «Efectiu» o «Targeta (TPV)» l'activen i anoten el pagament al moment; «No registrar ara» el deixa pendent de pagament.",
        },
        { t: "h", text: "Cobrar-ne un" },
        {
          t: "p",
          text: "El botó de la fila no cobra al primer clic: obre un resum amb el client, el servei, les sessions i l'import, i, a sota, «Com ha pagat?»: «Efectiu» ve marcat i «Targeta (TPV)» és l'altra opció. Cobrar en efectiu són dos tocs; amb targeta, un més. Va així perquè cobrar fa quatre coses que no es desfan des de cap pantalla —activa el bo, anota el pagament amb el mètode triat, genera les recompenses de referit si en toquen i reprèn la subscripció si el bo n'era d'una—.",
        },
        {
          t: "dl",
          items: [
            [
              "Marcar com pagat",
              "Un bo pendent. Passa a actiu i les seves sessions queden disponibles a l'instant.",
            ],
            [
              "Cobrar i recuperar",
              "Un bo decaigut per impagament que encara és dins de data. Es recupera amb les sessions que li quedaven. Les reserves que es van cancel·lar en decaure NO tornen: s'han de tornar a demanar.",
            ],
            [
              "Només cobrar",
              "Un bo decaigut que a més ja ha passat de data. El cobrament s'anota, però el bo no es recupera: tornaria a caducar tot seguit.",
            ],
          ],
        },
        {
          t: "warn",
          text: "El cobrament s'anota amb el mètode triat al quadre (efectiu o targeta del TPV) i no es pot desfer des de cap pantalla. Si t'equivoques de fila o de mètode, la correcció no és de l'app.",
        },
        { t: "h", text: "Caducitat" },
        {
          t: "p",
          text: bonoCaduca
            ? `Ara mateix els bons caduquen ${mesos(s.bonoExpiryMonths!)} després de la compra. Cada bo porta la seva pròpia data: canviar aquest ajust NO toca els que ja s'han venut, només val per als següents.`
            : "Ara mateix els bons no caduquen. Si li poses caducitat a Configuració → Centre, només valdrà per als bons que es venguin a partir d'aquell moment: els ja venuts conserven la seva data (o la manca de data).",
        },
        {
          t: "p",
          text: `Quan un bo és a punt de caducar, el client rep un avís ${s.bonoExpiryWarningDays} dies abans, amb els dies exactes que li queden.`,
        },
        { t: "h", text: "Bons pendents que no es cobren" },
        {
          t: "p",
          text: s.pendingPaymentCancelEnabled
            ? `L'anul·lació automàtica està activada amb un termini de ${hores(s.pendingPaymentCancelHours ?? 0)}. El compte enrere arrenca amb la PRIMERA reserva feta amb el bo, no amb la venda: qui encara no l'ha estrenat no es toca mai. Passat el termini sense cobrar, el bo decau, les seves reserves futures es cancel·len i les franges queden lliures.`
            : "L'anul·lació automàtica està desactivada: un bo pendent de pagament s'hi queda indefinidament i les seves reserves es mantenen. Si la vols, l'engegues a Configuració → Centre.",
        },
        ...(s.stripeEnabled
          ? ([
              { t: "h", text: "Els que es paguen amb targeta" },
              {
                t: "p",
                text: "Un bo comprat pel client amb targeta no neix quan prem el botó: neix quan el banc confirma el cobrament. Per això no el veuràs mai en «Pendent de pagament» —arriba ja actiu i amb el pagament anotat— i per això no cal que facis res amb ell.",
              },
            ] as Block[])
          : []),
      ],
    },

    // ─────────────────────────── 12 ───────────────────────────
    {
      id: "subscripcions",
      title: "Subscripcions",
      blocks: [
        {
          t: "p",
          text: "La quota mensual d'un paquet: en comptes de comprar el bo cada vegada, el client paga cada mes i rep les seves sessions. Quins paquets van així ho decideixes tu, amb la casella «Només per subscripció» de cada paquet a Catàleg → Serveis. Un paquet marcat no es ven solt de cap manera: ni al client, ni des de la seva fitxa, ni en un val de regal.",
        },
        {
          t: "p",
          text: "El client s'hi apunta des dels seus bons, pagant al centre o amb targeta. Tu i els professionals també podeu apuntar-l'hi des de «Nou bo» a la fitxa: en triar un paquet marcat, el formulari canvia i el que es crea és la subscripció. Des del taulell només es pot donar d'alta la que es paga AL CENTRE —el pagament amb targeta el demana Stripe i necessita que sigui el client qui tecleja la seva—.",
        },
        {
          t: "p",
          text: s.subscriptionsEnabled
            ? "Ara mateix se'n poden contractar de noves."
            : "Ara mateix NO se'n poden contractar de noves (Configuració → Centre). Els paquets marcats com a «Només per subscripció» desapareixen de la pantalla de compra del client i del formulari de la seva fitxa, perquè no hi hauria cap manera de comprar-los. Els altres paquets del mateix servei segueixen venent-se amb normalitat: apagar l'interruptor ja no deixa el Grup reduït sense res, com passava abans que la casella fos per paquet. Les subscripcions que ja hi són es continuen renovant cada mes: el centre no pot deixar sense sessions qui ja va dir que sí.",
        },
        { t: "h", text: "Les dues regles que ho ordenen tot" },
        {
          t: "ul",
          items: [
            "Es renova el dia del mes en què es va donar d'alta, no el dia 1.",
            "El preu queda congelat des d'aquell dia i no es torna a cotitzar mai. Una pujada de preus al catàleg no toca ningú que ja estigui subscrit.",
          ],
        },
        { t: "h", text: "La taula" },
        {
          t: "p",
          text: "Els filtres de dalt són Vives, Aturades, Congelades i Totes. Cada fila diu el client, el paquet, la quota mensual, com va aquest mes (sessions que li queden i si el bo del cicle està cobrat), quan es renova i l'estat.",
        },
        {
          t: "dl",
          items: [
            ["Activa", "Tot en ordre."],
            ["Aturada per impagament", "Va arribar el dia de renovar i el mes no es va cobrar. Es pinta en blau fosc amb l'exclamació: hi ha alguna cosa a fer."],
            ["Congelada", "L'has aturada tu. Va en lila i no en blau d'avís a posta: no és un problema, és una decisió."],
            ["Cancel·lada", "Donada de baixa."],
          ],
        },
        { t: "h", text: "Les quatre accions" },
        {
          t: "dl",
          items: [
            [
              "Donar de baixa",
              "Mai a l'instant: deixa de renovar-se al final del període que el client ja té pagat. El mes cobrat i les seves sessions són seves.",
            ],
            [
              "Canviar el preu mensual",
              "La sortida per a quan el centre i el client pacten un altre import. Només afecta els cicles següents: el bo del mes en curs ja porta el preu amb què es va emetre, i canviar-lo seria reescriure una venda tancada.",
            ],
            [
              "Congelar",
              "Cap cobrament, cap bo nou, cap compte enrere. Pots posar-hi data de represa o deixar-la indefinida.",
            ],
            [
              "Reprendre",
              "La torna a posar en marxa i li retorna els dies que ha estat aturada: la propera renovació es desplaça exactament el que va durar la congelació.",
            ],
          ],
        },
        {
          t: "p",
          text: "Al mòbil, cada subscripció és una targeta i les accions no hi caben totes: es veu la que toca segons l'estat (Congelar si està activa, Reprendre si està congelada, Donar de baixa si és l'única) i la resta són a «Més ▾». Cada una obre la mateixa confirmació que a l'ordinador.",
        },
        {
          t: "warn",
          text: "Amb les que es paguen amb targeta hi ha dues diferències. El preu no es pot canviar des d'aquí (el governa la passarel·la). I per congelar-les cal indicar OBLIGATÒRIAMENT la data de represa: sense ella, el cobrament tornaria sol quan s'acabés el termini màxim de la passarel·la.",
        },
        { t: "h", text: "Sessions extra" },
        {
          t: "p",
          text:
            s.subscriptionExtraSessionsMax > 0
              ? `Un subscriptor que ja ha gastat les sessions del mes pot demanar fins a ${sess(s.subscriptionExtraSessionsMax)} de més sense esperar la renovació. Les paga al preu per sessió del seu bo, no al d'una sessió solta. La columna «Aquest mes» et diu quantes n'ha fet servir.`
              : "Ara mateix no se'n permet cap: qui gasta les sessions del mes espera la renovació. El límit es canvia a Configuració → Centre.",
        },
      ],
    },

    // ─────────────────────────── 13 ───────────────────────────
    {
      id: "pagaments",
      title: "Pagaments",
      blocks: [
        {
          t: "p",
          text: "El registre de tot el que ha entrat: data, client, import, mètode i concepte (què es va pagar), del més recent al més antic. El mètode distingeix «Targeta (TPV)», cobrada al taulell, de «Targeta (en línia)», pagada per Stripe. Al mòbil, cada pagament és una fila de dues línies. A dalt a la dreta hi ha el total cobrat de tot l'històric i, a sota, quants pagaments són i quant s'ha cobrat amb la targeta del TPV, amb targeta per internet i en efectiu.",
        },
        {
          t: "p",
          text: "La llista en carrega 50 de cop. A sota diu quants en veus del total («50 de 124 pagaments») i, si n'hi ha més, «Carregar més» afegeix els 50 següents. El total de dalt és sempre el de tots, encara que no els tinguis carregats: el compta la base de dades, no la llista.",
        },
        {
          t: "note",
          text: "Si el total no es pot calcular, a dalt hi diu «Total no disponible» i un avís en vermell, però la llista es veu igual. No surt mai un zero que sembli cert. La xifra d'ingressos de l'inici (aquest mes i el percentatge respecte de l'anterior) es calcula igual, per mesos naturals en hora de Madrid.",
        },
        { t: "h", text: "D'on surt cada apunt" },
        {
          t: "ul",
          items: [
            "De vendre un bo triant «Efectiu» o «Targeta (TPV)» al formulari.",
            "De cobrar un bo pendent des de la pantalla de Bons, amb el mètode triat al quadre (efectiu o targeta del TPV).",
            "De cobrar un val de regal, igual: efectiu o targeta del TPV.",
            "De la renovació mensual d'una subscripció.",
            "D'una alta manual amb «+ Nou pagament».",
          ],
        },
        { t: "h", text: "Registrar-ne un a mà" },
        {
          t: "p",
          text: "«+ Nou pagament» demana el client, opcionalment el bo al qual va lligat —triar-lo omple l'import sol—, la quantitat i el mètode. Serveix per a tot el que entra fora del camí normal: una diferència, un pagament fraccionat, un cobrament d'una cosa que no és un bo.",
        },
        {
          t: "p",
          text: "El client es busca escrivint un tros del nom, sense accents ni majúscules i en qualsevol ordre: el mateix buscador que la fulla de reserva. Sense escriure res en surten els primers vint per ordre alfabètic. Quan el tries, a «Bo» hi surten només els seus, amb el servei, el preu i l'estat (per exemple, «Pendent de pagament»). Si el bo no fos d'aquell client —perquè s'ha canviat de client a mig omplir—, el pagament no es registra i t'ho diu.",
        },
        {
          t: "note",
          text: "Aquesta pantalla no té botó d'esborrar ni d'editar. És un llibre de comptes: un apunt equivocat es corregeix amb un altre apunt, no fent desaparèixer el primer.",
        },
      ],
    },

    // ─────────────────────────── 14 ───────────────────────────
    {
      id: "vals-regal",
      title: "Vals de regal",
      blocks: [
        {
          t: "p",
          text: "Un client compra un paquet de sessions per regalar-lo. El val porta un codi, i qui el rep el bescanvia des de la seva àrea per convertir-lo en un bo seu. Al mòbil, cada val és una targeta: el codi i l'estat a dalt, qui el va comprar, el paquet i el preu a sota i, si està pendent, «Marcar com pagat», amb els enllaços PDF i «Anul·lar» al costat.",
        },
        {
          t: "p",
          text: s.giftVouchersEnabled
            ? `Ara mateix la venda està activa i els vals valen ${mesos(s.giftVoucherExpiryMonths)} des de la compra.`
            : "Ara mateix la venda està DESACTIVADA: els clients no en poden comprar de nous. Els que ja hi ha continuen sent vàlids i es poden cobrar i bescanviar —el centre ja n'ha cobrat el preu i qui té el codi no té la culpa que el centre canviï d'idea—. Per això aquesta pantalla no desapareix mai del menú.",
        },
        {
          t: "warn",
          text: "Un val NO es pot bescanviar fins que el marques com a pagat. Mentre estigui pendent, qui l'ha rebut té un codi que no funciona. Per això els pendents surten al plafó d'atenció de l'inici.",
        },
        { t: "h", text: "Els cinc estats" },
        {
          t: "dl",
          items: [
            ["Pendent de pagament", "Comprat i no cobrat. No serveix per a res fins que el cobris."],
            ["Actiu", "Cobrat i esperant que algú el bescanviï."],
            ["Bescanviat", "Ja és un bo d'algú. La fila diu qui i quan."],
            ["Caducat", "Ha passat la data sense que ningú el bescanviés."],
            ["Anul·lat", "L'has anul·lat tu."],
          ],
        },
        { t: "h", text: "Les tres accions" },
        {
          t: "dl",
          items: [
            [
              "PDF",
              "El document del val, per si cal reimprimir-lo o reenviar-lo.",
            ],
            [
              "Marcar com pagat",
              "Obre el mateix quadre que cobrar un bo: el resum, «Com ha pagat?» (efectiu o targeta del TPV) i «Sí, marcar com pagat». El deixa llest per bescanviar. Només surt als pendents.",
            ],
            [
              "Anul·lar",
              "El deixa fora de joc, després de preguntar-ho. Si el val ja estava cobrat, l'app no retorna els diners: es fa a part. No surt als bescanviats: aquell bo ja existeix i pot tenir sessions començades.",
            ],
          ],
        },
        {
          t: "note",
          text: "Quan algú bescanvia un val, qui el va pagar rep un avís que no es pot desactivar. Un val és al portador, i aquest correu és l'única senyal que li arriba si algú el bescanvia per error o de mala fe.",
        },
      ],
    },

    // ─────────────────────────── 15 ───────────────────────────
    {
      id: "referits",
      title: "Referits",
      blocks: [
        {
          t: "p",
          text: "Cada client té un codi personal. Si algú nou s'apunta amb aquest codi, es generen recompenses en forma de descompte per a la propera compra.",
        },
        {
          t: "p",
          text: s.referralProgramActive
            ? `El programa està ACTIU amb un ${s.referralDiscountPercent} % de descompte. ${
                s.referralRewardReferee
                  ? "El reben tots dos: qui refereix i el nou client."
                  : "El rep només qui refereix; el nou client no."
              }`
            : "El programa està INACTIU: no es genera cap recompensa nova. S'engega a Configuració → Centre, on també es tria el percentatge i si el nou client també cobra.",
        },
        { t: "h", text: "Quan es genera una recompensa" },
        {
          t: "p",
          text: "No en apuntar-se: quan es COBRA el primer bo del client referit. Fins que no hi ha diners a la caixa no hi ha res guanyat, i per això les recompenses apareixen soles en marcar un bo com a pagat.",
        },
        { t: "h", text: "La pantalla" },
        {
          t: "p",
          text: "A dalt, tres xifres: total de recompenses, pendents d'usar i ja usades. A sota, la llista amb qui refereix, el nou client, qui és el beneficiari de cada línia, el percentatge, l'estat i la data. Al mòbil, cada recompensa és una fila de dues línies: «qui refereix → nou client» i l'estat a dalt; per a qui és («per al referit» si és el nou client), el percentatge i la data a sota.",
        },
        {
          t: "dl",
          items: [
            ["Pendent", "Guanyada i encara no gastada. És la que surt al plafó d'atenció de l'inici."],
            ["Usada", "Ja s'ha aplicat en una compra."],
            ["Caducada", "Ha passat el termini sense fer-se servir."],
          ],
        },
        {
          t: "note",
          text: "Les files no porten enlloc: de les recompenses només n'hi ha la llista. Per actuar sobre una persona, busca-la a Clients.",
        },
      ],
    },

    // ─────────────────────────── 16 ───────────────────────────
    {
      id: "serveis",
      title: "Serveis i paquets",
      blocks: [
        {
          t: "p",
          text: "El catàleg del centre: què es ven i a quin preu. Els paquets s'agrupen pel seu tipus de servei —entrenament individual, en parelles, grup reduït i fisioteràpia—, que és la classificació fixa que fa servir tota l'app.",
        },
        { t: "h", text: "Un paquet" },
        {
          t: "p",
          text: "Quatre coses: el tipus de servei al qual pertany, un nom, un preu i quantes sessions porta per defecte. El nom és el que veurà el client quan compri.",
        },
        { t: "h", text: "«Només per subscripció»" },
        {
          t: "p",
          text: "La casella que decideix si un paquet es pot comprar d'una tapada o només amb la quota mensual. Marcada, aquell paquet deixa de vendre's per QUATRE camins alhora —el bo pagat al centre, el de targeta, l'alta manual des de la fitxa d'un client i el val de regal— i només queda la subscripció.",
        },
        {
          t: "p",
          text: "VA PER PAQUET I NO PER SERVEI, que és tota la gràcia. Dins del Grup reduït pots tenir les mensualitats marcades i, al costat, un bo de 6 sessions i una sessió individual que es venen solts com qualsevol altre. Abans això no es podia: o anava per subscripció tot el servei, o res.",
        },
        {
          t: "note",
          text: "A la llista de paquets, els marcats porten l'etiqueta «Només subscripció». Els que no en porten es venen solts.",
        },
        {
          t: "warn",
          text: "Un paquet d'UNA sola sessió no es pot marcar: el que la subscripció renova cada mes és un bo, i un bo d'una sessió no ho és. El formulari t'ho dirà si ho proves.",
        },
        {
          t: "p",
          text: "Desmarcar-la no toca les subscripcions que ja hi ha: continuen renovant-se igual. El que canvia és que, a partir d'aquell moment, aquell paquet també es podrà comprar solt.",
        },
        {
          t: "note",
          text: "Aquesta casella NO diu res de l'aforament ni de les sessions repetides. Que una reserva de grup no es pugui repetir en bucle és perquè un grup té places comptades, i això va pel tipus de servei: passa igual amb un paquet de grup marcat que amb un que no ho estigui.",
        },
        {
          t: "note",
          text: "Les sessions i el preu del paquet són el punt de partida, no una llei: en vendre un bo tots dos camps es poden sobreescriure a mà per a aquell client concret.",
        },
        { t: "h", text: "Activar i desactivar" },
        {
          t: "p",
          text: "«Desactivar» treu el paquet de la venda: deixa de sortir a la botiga del client i als formularis de venda de bons. No toca res del que ja s'ha venut —els bons existents segueixen igual— i es pot tornar a activar quan vulguis. És la manera de retirar un paquet sense perdre'n l'historial.",
        },
        { t: "h", text: "Els preus que veus aquí" },
        {
          t: "p",
          text: "El preu que mostra aquesta pantalla porta aplicades les ofertes generals, però NO les segmentades. Una oferta per a un grup d'etiquetats no és el preu del paquet: és el preu d'algunes persones. Per veure-les amb el seu públic, ves a Ofertes; per veure el preu real d'una persona, obre la seva fitxa i comença a vendre-li un bo.",
        },
      ],
    },

    // ─────────────────────────── 17 ───────────────────────────
    {
      id: "ofertes",
      title: "Ofertes i descomptes",
      blocks: [
        {
          t: "p",
          text: "Una oferta rebaixa un preu del catàleg durant unes dates. Es defineix amb dues respostes: QUÈ rebaixa i A QUI arriba. La llista les ensenya totes amb aquestes dues frases, el descompte, les dates i l'estat.",
        },
        { t: "h", text: "Què rebaixa: l'àmbit" },
        {
          t: "dl",
          items: [
            [
              "Tot un tipus de servei",
              "Tots els paquets d'un o més tipus (per exemple, tot el que sigui fisioteràpia).",
            ],
            [
              "Paquet concret",
              "Un o més paquets triats un per un.",
            ],
          ],
        },
        { t: "h", text: "A qui arriba: el públic" },
        {
          t: "dl",
          items: [
            ["Tothom", "Tots els clients. És el preu de la casa durant aquelles dates."],
            [
              "Clients amb una etiqueta",
              "Només qui porti l'etiqueta que triïs. Si encara no n'has creat cap, el formulari t'hi envia.",
            ],
            [
              "Clients amb un bo actiu",
              "Només qui tingui un bo viu d'un tipus de servei concret. Un bo pendent de pagament no obre l'oferta, i un de caducat tampoc.",
            ],
          ],
        },
        {
          t: "note",
          text: "A la llista, els públics segmentats surten en lila i «Tothom» en gris: d'un cop d'ull veus quines ofertes són per a tota la casa i quines no.",
        },
        { t: "h", text: "El descompte" },
        {
          t: "p",
          text: "Percentatge o import fix. El nom que li poses és intern, per a tu; el client veu l'etiqueta del descompte al costat del preu ratllat.",
        },
        { t: "h", text: "Quan se'n solapen dues" },
        {
          t: "p",
          text: "Si crees una oferta que trepitja una altra d'activa —mateixes dates, mateix paquet i públics que xoquen— l'app t'avisa amb un requadre blau fosc però la crea igualment. No és un error: solapar-ne dues pot ser el que vols.",
        },
        {
          t: "p",
          text: "Quan dues ofertes cauen sobre el mateix paquet i la mateixa persona, guanya la que li surti més barata. No se sumen mai.",
        },
        { t: "h", text: "Els quatre estats" },
        {
          t: "dl",
          items: [
            ["Activa", "Encesa i dins de dates."],
            ["Futura", "Encesa, però encara no ha començat."],
            ["Caducada", "Encesa, però ja ha passat la data de fi."],
            ["Desactivada", "Apagada amb el botó, hi hagi les dates que hi hagi."],
          ],
        },
        {
          t: "p",
          text: "«Desactivar» l'apaga sense perdre-la —serveix per tornar-la a engegar l'any que ve—; «Eliminar» la treu del tot, després de preguntar-ho. Els bons ja comprats no canvien: el preu queda desat a cada bo.",
        },
      ],
    },

    // ─────────────────────────── 18 ───────────────────────────
    {
      id: "facturacio-avis",
      title: "Facturació: llegeix això primer",
      blocks: [
        {
          t: "warn",
          text: "Aquesta secció fa un CÀLCUL ORIENTATIU, sense validesa fiscal. No emet cap document amb validesa fiscal ni el substitueix.",
        },
        {
          t: "p",
          text: "El que fan les tres pantalles següents és comptar les sessions completades de cada professional, valorar-les amb les tarifes que hi hagis definit i dir-te quant li correspon. Res més.",
        },
        {
          t: "p",
          text: "El marc fiscal aplicable —nòmina o factura d'autònom, retencions d'IRPF, IVA, cotitzacions— l'ha de confirmar la gestoria o l'assessor del centre abans de fer servir aquestes xifres per a pagaments reals. L'avís surt repetit a les tres pestanyes de l'app a propòsit: és el context sense el qual els números es poden fer servir malament.",
        },
        {
          t: "note",
          text: "Aquest capítol té tres línies i és aquí per una raó: la resta del manual explica com fer les coses, i aquest explica què NO és el que estàs fent.",
        },
      ],
    },

    // ─────────────────────────── 19 ───────────────────────────
    {
      id: "tarifes",
      title: "Tarifes",
      blocks: [
        {
          t: "p",
          text: "Quant es paga per cada sessió completada, segons el tipus de servei. És el mateix per a tots els professionals: no hi ha tarifes diferenciades per persona.",
        },
        {
          t: "note",
          text: "Per al grup reduït, la tarifa és l'import de la franja sencera, hi vagin els clients que hi vagin. No es multiplica pel nombre d'assistents.",
        },
        { t: "h", text: "Canviar-ne una" },
        {
          t: "p",
          text: "En desar una tarifa nova no se'n perd el rastre: la que hi havia es tanca amb data d'ahir i la nova compta a partir d'avui. Les liquidacions de períodes anteriors continuen valorant cada sessió amb la tarifa que hi havia el dia que es va fer.",
        },
        {
          t: "warn",
          text: "Un servei sense cap tarifa vigent el dia d'una sessió no es pot valorar: aquella sessió queda fora del càlcul i la liquidació t'ho diu al peu. Si veus «sessions no comptades», gairebé sempre és això.",
        },
      ],
    },

    // ─────────────────────────── 20 ───────────────────────────
    {
      id: "liquidacions",
      title: "Liquidacions",
      blocks: [
        {
          t: "p",
          text: "Calcula el que correspon a un professional en un període i, si vols, en genera la factura.",
        },
        { t: "h", text: "El càlcul" },
        {
          t: "p",
          text: "Tria el professional i el mes, o bé un rang de dates concret —que té prioritat sobre el mes si l'omples—, i prem «Calcular». No es desa res: és una previsualització.",
        },
        {
          t: "p",
          text: "El resultat surt obert per tipus de servei: quantes sessions, a quina tarifa i quant fa. Si dins del període hi va haver un canvi de tarifa, la línia ho diu en comptes d'inventar-se un preu mitjà.",
        },
        {
          t: "note",
          text: "Només compten les sessions marcades com a COMPLETADES. Una sessió que es va fer però que ningú no va marcar no es paga. Si un professional et diu que li'n falten, busqueu-les a l'agenda i marqueu-les abans de generar res.",
        },
        { t: "h", text: "Generar la factura" },
        {
          t: "p",
          text: "«Generar factura» és el pas que sí que desa: fixa el càlcul, emet el document i avisa el professional per correu, que la troba a la seva àrea a «Les meves factures».",
        },
        {
          t: "warn",
          text: "Una liquidació generada és una fotografia: no canvia encara que després modifiquis les tarifes. I un mateix professional no pot tenir dues liquidacions del mateix període exacte; si t'has equivocat, cal esborrar la que hi ha abans de refer-la.",
        },
        {
          t: "p",
          text: "L'avís de factura al professional no es pot apagar des de les seves preferències: és informació sobre la seva pròpia retribució, no una comoditat.",
        },
        { t: "h", text: "Les ja generades" },
        {
          t: "p",
          text: "A sota tens la llista de totes, amb el període, la data en què es va generar, el total, el desglossament i el botó per descarregar el document.",
        },
      ],
    },

    // ─────────────────────────── 21 ───────────────────────────
    {
      id: "bonus",
      title: "Bonus per volum",
      blocks: [
        {
          t: "p",
          text: "Un incentiu a part de la tarifa. Cada sessió completada val unes UNITATS segons el tipus de servei; les unitats del període se sumen i es paguen per TRAMS progressius: les primeres a un preu i les següents a un altre, com els trams d'IRPF. No es paga tot al preu del tram més alt.",
        },
        { t: "h", text: "Pesos per servei" },
        {
          t: "p",
          text: "Quantes unitats aporta una sessió completada de cada tipus. És igual per a tots els professionals, i funciona amb el mateix sistema de vigències que les tarifes: canviar-ne un tanca l'anterior i el nou compta des d'avui.",
        },
        { t: "h", text: "Els trams" },
        {
          t: "p",
          text: "Hi ha dos jocs de trams, anual i biennal, i són independents. Estan separats a posta: un període biennal acumula aproximadament el doble de volum, així que els llindars no poden ser els mateixos, i tenir-los en dues taules evita desar a la que no toca.",
        },
        {
          t: "p",
          text: "Els trams s'han d'encadenar sense forats ni solapaments: el primer comença a 0, el màxim de cadascun és el mínim del següent, i només l'últim pot quedar sense sostre. Si no quadra, l'app no et deixa desar i et diu on és el problema.",
        },
        {
          t: "warn",
          text: "Un tram final AMB sostre vol dir que el bonus deixa de comptar a partir d'aquell punt. Pot ser el que vols, però ha de ser una decisió, no un descuit.",
        },
        { t: "h", text: "Qui té bonus" },
        {
          t: "p",
          text: "Al bloc «Professionals» s'encén o s'apaga per persona i es tria cada quant se li tanca el període: anual (any natural) o biennal (dos anys naturals). És l'únic paràmetre de tota la secció que varia per professional.",
        },
        {
          t: "p",
          text: "De qui el té actiu, la fila ensenya com va el període en curs: les unitats acumulades i l'import estimat. El professional veu aquesta mateixa estimació a la seva àrea.",
        },
        { t: "h", text: "Tancar un període" },
        {
          t: "p",
          text: "El desplegable de la fila deixa triar el període (el vigent o algun dels anteriors) i «Tancar i generar payout» el fixa. Com les liquidacions, és una fotografia: no canvia encara que després modifiquis pesos o trams, i un període ja tancat no es pot tornar a tancar.",
        },
        {
          t: "warn",
          text: "Sense trams definits per a la seva freqüència, el càlcul dona 0 € i l'app NO et deixa tancar. És deliberat: val més no deixar tancar que congelar un zero per descuit.",
        },
      ],
    },

    // ─────────────────────────── 22 ───────────────────────────
    {
      id: "exercicis",
      title: "Exercicis",
      blocks: [
        {
          t: "p",
          text: "La biblioteca d'exercicis del centre. És compartida: la mateixa que veuen i editen els professionals des de la seva àrea. Un exercici no és de qui el va crear, és de la casa.",
        },
        {
          t: "p",
          text: "Eliminar un exercici de la biblioteca el treu també de tots els clients que el tenen assignat, amb el progrés que s'hi hagi registrat. Per això la pantalla t'ho diu i pregunta abans.",
        },
        { t: "h", text: "Crear-ne un" },
        {
          t: "p",
          text: "Nom, categoria, descripció i, opcionalment, un vídeo. El vídeo es pot posar de dues maneres: enganxant una adreça (YouTube, Vimeo…) o pujant un fitxer.",
        },
        { t: "h", text: "Categories" },
        {
          t: "p",
          text: "Les categories es gestionen des de la seva pròpia pantalla, a la qual s'arriba des de la biblioteca. Serveixen per filtrar la llista quan comença a créixer.",
        },
        { t: "h", text: "Assignar-los" },
        {
          t: "p",
          text: "L'assignació no es fa aquí sinó a la fitxa de cada client, a la pestanya Entrenament. Un cop assignats, el client els veu a la seva àrea i hi pot registrar el seu progrés, que tu llegeixes a la mateixa pestanya, a sota.",
        },
        {
          t: "note",
          text: "Després d'assignar-n'hi uns quants, «Notificar exercicis nous», just a sota dels exercicis, l'avisa que en té de nous. No s'envia sol: el dispares tu quan has acabat.",
        },
      ],
    },

    // ─────────────────────────── 23 ───────────────────────────
    {
      id: "comunitat",
      title: "Comunitat",
      when: s.modules.comunitat,
      blocks: [
        {
          t: "p",
          text: "El tauler del centre, amb dues pestanyes: Anuncis i Enquestes. Ho llegeixen els clients a la seva àrea i els professionals a la seva.",
        },
        { t: "h", text: "Anuncis" },
        {
          t: "p",
          text: "Un títol i un text. Es publiquen a l'instant, es poden editar i es poden eliminar. Cada publicació surt signada amb qui la va escriure.",
        },
        {
          t: "note",
          text: "Els clients i professionals que tinguin activat l'avís de comunitat reben un correu quan es publica un anunci nou. Ve apagat per defecte, així que no ho rebrà tothom.",
        },
        {
          t: "p",
          text: "Sota cada anunci de l'últim mes surt com ha anat el correu: «Correu: enviat a 120 de 150». Si n'hi ha de fallits, la línia surt en vermell amb el motiu; el més habitual és «Límit diari de correus de Resend esgotat», que vol dir que aquell dia el centre ja havia enviat tots els correus que permet el pla, i els que falten no surten. «Enviat» vol dir que Resend l'ha acceptat: si després rebota, es veu a Resend. Mentre s'envia, la línia diu «enviant-ne…»; si al cap d'un quart d'hora encara en queden, diu que l'enviament es va aturar.",
        },
        { t: "h", text: "Enquestes" },
        {
          t: "p",
          text: "Una pregunta i unes quantes opcions. En crear-la es tria si permet triar-ne més d'una i, opcionalment, un dia de tancament automàtic.",
        },
        {
          t: "p",
          text: "A la llista, «N respostes» és el nombre de PERSONES que l'han contestada: en una de selecció múltiple, qui en marca dues compta una vegada. «Veure resultats» ensenya els vots de cada opció i qui els ha fet. «Tancar» la deixa visible però ja no admet respostes; «Eliminar» la treu, amb les respostes incloses. Totes dues coses pregunten abans, i una enquesta tancada no es pot tornar a obrir.",
        },
        {
          t: "note",
          text: "Els vots NO són anònims per a tu: desplegant una opció dels resultats hi surten els noms de qui l'ha votada. Per al client sí que ho són —ell només veu els percentatges—, així que si li promets una enquesta anònima, recorda que tu els veus.",
        },
      ],
    },

    // ─────────────────────────── 24 ───────────────────────────
    {
      id: "configuracio-centre",
      title: "Configuració del centre",
      blocks: [
        {
          t: "p",
          text: "La primera pestanya de Configuració, i la pantalla amb més conseqüències de tota l'app: el que canviïs aquí canvia com es comporten les tres àrees per a tothom, a l'instant. Va per blocs; el botó de desar és un de sol, al final.",
        },
        { t: "h", text: "Contacte del centre" },
        {
          t: "p",
          text: "El primer bloc: com et poden trobar els clients i la gent de fora. És l'única font: el que hi posis surt al manual del client, a les seves pantalles quan un avís li diu que parli amb el centre, a /prova, al registre, al peu dels correus que reben clients i visitants, a les pàgines legals, al val de regal en PDF i a l'esdeveniment quan algú afegeix una sessió al seu calendari. El telèfon i el correu hi surten com a enllaços que es poden tocar.",
        },
        {
          t: "dl",
          items: [
            ["Telèfon", "Amb 9 xifres s'hi posa el +34; d'un altre país, escriu-hi el prefix. Es desa net i es veu agrupat («931 23 45 67»). Si té WhatsApp, marca-ho i al costat hi sortirà un enllaç per escriure-hi."],
            ["Correu de contacte", "La bústia que el centre LLEGEIX. Els correus als clients porten aquesta adreça com a «respondre a»: si un client respon, li arriba aquí. Si la deixes buida, els correus no conviden a respondre."],
            ["Correu per als avisos interns", "On arriben les sol·licituds de prova i les altes noves. Buit: el correu de contacte."],
            ["Adreça, titular i NIF", "Per a les pàgines legals. L'adreça, a més, va a l'esdeveniment de calendari i als correus: al peu dels que reben clients i visitants, i com a «Lloc» a les reserves, els recordatoris i la prova confirmada."],
          ],
        },
        {
          t: "warn",
          text: "No hi posis l'adreça que envia els avisos automàtics (la de «hola@»): aquesta bústia no es llegeix. Si l'escrius, la pantalla t'avisa.",
        },
        {
          t: "note",
          text: "El que deixis buit no surt enlloc: ni una línia buida ni un text pendent. Sense telèfon ni correu, les frases del manual diuen «avisa el centre» i prou, i el peu dels correus no porta contacte. La vista prèvia del bloc t'ensenya com quedarà.",
        },
        { t: "h", text: "Horari i reserves" },
        {
          t: "dl",
          items: [
            [
              "Hora d'obertura i de tancament",
              `Ara: de ${hhmm(s.openingHour)} a ${hhmm(s.closingHour)}. És la franja que pinten TOTS els calendaris de l'app. No tanca el centre: decideix què es veu.`,
            ],
            [
              "Antelació mínima per reservar",
              s.minBookingHours > 0
                ? `Ara: ${hores(s.minBookingHours)}. El client no pot reservar res que comenci abans d'aquest marge.`
                : "Ara: 0, és a dir, el client pot reservar fins a l'últim moment.",
            ],
            [
              "Antelació mínima per cancel·lar",
              s.minCancellationHours > 0
                ? `Ara: ${hores(s.minCancellationHours)}. Passat aquest punt, el client ja no pot cancel·lar (tu sí).`
                : "Ara: 0, és a dir, el client pot cancel·lar fins a l'últim moment.",
            ],
          ],
        },
        { t: "h", text: "Bons" },
        {
          t: "dl",
          items: [
            [
              "Llindar de bo a punt d'esgotar-se",
              `Ara: ${sess(s.bonoLowThreshold)}. És el número que dispara l'avís al client i el que fa aparèixer el bo a la xifra de l'inici.`,
            ],
            [
              "Caducitat dels bons",
              bonoCaduca
                ? `Ara: ${mesos(s.bonoExpiryMonths!)} des de la compra. Només val per als que es venguin a partir d'ara.`
                : "Ara: sense caducitat. Si n'hi poses, només valdrà per als bons venuts a partir d'aquell moment.",
            ],
            [
              "Anul·lar bons pendents no cobrats a temps",
              s.pendingPaymentCancelEnabled
                ? `Activat, amb ${hores(s.pendingPaymentCancelHours ?? 0)} de termini des de la primera reserva feta amb el bo.`
                : "Desactivat: un bo pendent s'hi queda indefinidament.",
            ],
            [
              "Vendre vals de regal",
              s.giftVouchersEnabled
                ? `Activat, amb ${mesos(s.giftVoucherExpiryMonths)} de validesa.`
                : "Desactivat: no se'n poden comprar de nous. Els ja venuts continuen valent.",
            ],
          ],
        },
        { t: "h", text: "Notificacions" },
        {
          t: "p",
          text: `L'hora local del centre a partir de la qual surten els avisos automàtics del dia. Ara: ${hhmm(s.reminderHourLocal)}. Al capítol dels automatismes hi ha una limitació important sobre aquest camp que val la pena llegir abans de tocar-lo.`,
        },
        { t: "h", text: "Subscripcions" },
        {
          t: "p",
          text: s.subscriptionsEnabled
            ? s.subscriptionExtraSessionsMax > 0
              ? `Activades, amb ${sess(s.subscriptionExtraSessionsMax)} extra com a màxim per mes.`
              : "Activades, sense sessions extra: qui gasta les del mes espera la renovació."
            : "Desactivades: no se'n poden contractar de noves. Les vigents es continuen renovant.",
        },
        { t: "h", text: "Llista d'espera" },
        {
          t: "p",
          text: s.waitlistEnabled
            ? "Activada: quan una sessió de grup és plena, el client s'hi pot apuntar."
            : "Desactivada: ningú nou s'hi pot apuntar, però els qui ja hi són seguiran entrant quan s'alliberi una plaça.",
        },
        { t: "h", text: "Coordinació entre professionals" },
        {
          t: "p",
          text: s.trainersSeeColleaguesReservations
            ? "Els professionals VEUEN les reserves dels companys al seu calendari. Serveix per coordinar-se."
            : "Cada professional només veu les SEVES reserves. Si algun et diu que no troba una sessió d'un company, és per això.",
        },
        { t: "h", text: "Referits" },
        {
          t: "p",
          text: s.referralProgramActive
            ? `Actiu, ${s.referralDiscountPercent} % de descompte, ${
                s.referralRewardReferee
                  ? "per a tots dos (qui refereix i el nou client)"
                  : "només per a qui refereix"
              }.`
            : "Inactiu: no es genera cap recompensa nova.",
        },
        { t: "h", text: "Mòduls" },
        {
          t: "p",
          text: "Els tres interruptors que fan desaparèixer parts senceres de l'app. Un mòdul apagat no s'amaga només del menú: la seva adreça deixa d'existir, així que tampoc s'hi arriba escrivint-la.",
        },
        {
          t: "dl",
          items: [
            [
              "Comunitat",
              `Anuncis i enquestes per a clients i professionals. Ara: ${s.modules.comunitat ? "encès" : "apagat"}.`,
            ],
            [
              "Sessions de prova",
              `La pàgina pública de prova gratuïta i la seva gestió. Ara: ${s.modules.sessionsProva ? "encès" : "apagat"}.`,
            ],
            [
              "Documents",
              `La zona de documents personals del client. Ara: ${s.modules.documents ? "encès" : "apagat"}. Apagar-lo impedeix que el client en pugi de nous, però tu continues veient els que ja hi ha a la seva fitxa.`,
            ],
          ],
        },
        {
          t: "warn",
          text: "Els interruptors que es poden apagar (vals, llista d'espera, subscripcions) mai no toquen cap enrere sobre qui ja va dir que sí. Apagar-los impedeix entrar-hi de nou; no expulsa ningú. És el criteri de tota l'app i no cal comprovar-ho cada vegada.",
        },
      ],
    },

    // ─────────────────────────── 25 ───────────────────────────
    {
      id: "registre-centres",
      title: "Registre de centres",
      blocks: [
        {
          t: "p",
          text: "La segona pestanya de Configuració. És una llista de NOMS de centres: donar-ne d'alta i reanomenar-los.",
        },
        {
          t: "note",
          text: "No té res a veure amb la pestanya «Centre», que són els AJUSTOS d'aquest centre. Es diu «Registre de centres» i no «Centres» justament perquè dues pestanyes de costat que es diferenciïn per una essa no les distingeix ningú.",
        },
        { t: "h", text: "Què fa avui" },
        {
          t: "p",
          text: "Res més que guardar els noms. Encara no governa cap comportament de l'app: no separa clients, ni agendes, ni comptabilitat. És la base per a quan calgui, i és honest dir-ho aquí en comptes de deixar que algú hi doni d'alta un segon centre esperant que passi alguna cosa.",
        },
        { t: "h", text: "Per què no hi ha esborrar" },
        {
          t: "p",
          text: "No és un oblit. Un centre escrit malament es reanomena.",
        },
      ],
    },

    // ─────────────────────────── 26 ───────────────────────────
    {
      id: "colors",
      title: "Colors",
      blocks: [
        {
          t: "p",
          text: "La paleta dels calendaris. Dos blocs, i cadascun pinta una cosa diferent.",
        },
        {
          t: "dl",
          items: [
            [
              "Tipus de servei",
              "Pinta les reserves a l'agenda de l'equip i les targetes de la compra de bons. Quatre colors, un per tipus.",
            ],
            [
              "Professionals",
              "Pinta les franges de disponibilitat a l'agenda i el calendari que veu el client. Un color per persona. Als professionals nous ja no se'ls dona el taronja: és el color dels grups. Qui ja el tenia el conserva fins que el canviï.",
            ],
          ],
        },
        { t: "h", text: "Com es tria" },
        {
          t: "p",
          text: "Cada fila té el codi escrit i el selector de color, i a l'esquerra la vista prèvia. La previsualització no és un quadrat de color: reprodueix la pastilla del calendari tal com quedarà, amb el fons tenyit i la barra lateral. Un color pot semblar bo com a taca i quedar il·legible com a fons d'un text petit, i això només es veu mirant-lo al seu lloc.",
        },
        {
          t: "note",
          text: "«Desfer els canvis» torna al que hi havia desat, sempre que no hagis premut «Desar colors». Un cop desat, cal tornar-hi a mà.",
        },
      ],
    },

    // ─────────────────────────── 27 ───────────────────────────
    {
      id: "el-teu-compte",
      title: "El teu compte",
      blocks: [
        {
          t: "p",
          text: "Les dues últimes pestanyes de Configuració són les úniques que parlen de tu i no del centre.",
        },
        { t: "h", text: "Notificacions" },
        {
          t: "p",
          text: "Quins avisos per correu vols rebre. A tu només te'n toquen dos, i els dos venen encesos:",
        },
        {
          t: "dl",
          items: [
            [
              "Nou client registrat",
              "Quan algú es dóna d'alta pel seu compte des de la pàgina de registre.",
            ],
            [
              "Nova sol·licitud de prova",
              s.modules.sessionsProva
                ? "Quan un visitant demana una sessió de prova. També el rep el professional de la franja."
                : "Quan un visitant demana una sessió de prova. Amb el mòdul de proves apagat no n'arribarà cap.",
            ],
          ],
        },
        {
          t: "note",
          text: "Els avisos que dispares TU cap a un client o un professional —la factura d'una liquidació, la invitació, el recordatori manual— no surten en aquesta llista: no els reps tu, i per això no hi ha res a apagar.",
        },
        { t: "h", text: "Seguretat" },
        {
          t: "p",
          text: `Per canviar la contrasenya et demana l'actual i la nova dues vegades, amb un mínim de ${s.minPasswordLength} caràcters. La sessió no es tanca en canviar-la: segueixes a dins.`,
        },
      ],
    },

    // ─────────────────────────── 28 ───────────────────────────
    {
      id: "automatismes",
      title: "El que passa sol cada dia",
      blocks: [
        {
          t: "p",
          text: "Un cop al dia, l'app fa sola una tanda de feines sense que ningú premi res. Val la pena saber quines són, perquè expliquen mig manual: per què un bo canvia d'estat de nit, per què un client rep un correu que tu no has enviat, o per què una subscripció es cobra sense que hi hagis tornat.",
        },
        { t: "h", text: "Què fa, i en quin ordre" },
        {
          t: "ol",
          items: [
            "Reprèn les subscripcions congelades a qui avui li tocava despertar-se.",
            "Renova les subscripcions que avui compleixen mes: emet el bo del cicle i n'anota el cobrament. Si el mes no es pot cobrar, la subscripció queda aturada per impagament.",
            "Envia els recordatoris de les sessions de demà als clients que els tinguin activats.",
            "Envia el resum diari d'agenda als professionals que el tinguin activat.",
            "Tanca els bons que ja han passat de data i els posa com a caducats.",
            `Avisa els clients dels bons que caduquen d'aquí a ${s.bonoExpiryWarningDays} dies.`,
            s.pendingPaymentCancelEnabled
              ? "Anul·la els bons pendents de pagament que han passat el termini, cancel·la les seves reserves futures i avisa el client."
              : "(L'anul·lació de bons impagats està desactivada: aquest pas no fa res.)",
          ],
        },
        { t: "h", text: "Les subscripcions no esperen l'hora dels avisos" },
        {
          t: "p",
          text: `L'hora que tens configurada (${hhmm(s.reminderHourLocal)}) decideix quan surten els RECORDATORIS, i res més. Les renovacions es fan el dia que toca, corri el procés a l'hora que corri. Cobrar un mes i emetre'n les sessions no és una preferència d'enviament.`,
        },
        {
          t: "warn",
          text: `Hi ha una limitació real que convé conèixer: el procés diari corre a una hora fixa, i el camp de l'hora NO el mou. Només decideix si, quan el procés ja corre, toca enviar els recordatoris o no. Si poses una hora POSTERIOR a la que corre el procés, els recordatoris no sortiran aquell dia sinó l'endemà.`,
        },
        { t: "h", text: "Si un dia no corre" },
        {
          t: "p",
          text: "No es perd res: l'endemà recull el que va quedar enrere. Les subscripcions que s'havien de renovar es renoven, i les que ja havien passat de llarg diversos mesos se salten en comptes d'emetre bons endarrerits.",
        },
        {
          t: "note",
          text: "Cap avís s'envia dues vegades encara que el procés es repeteixi: cada enviament queda registrat i el segon intent es descarta.",
        },
      ],
    },

    // ─────────────────────────── 29 ───────────────────────────
    {
      id: "dades-personals",
      title: "Dades personals",
      blocks: [
        {
          t: "p",
          text: "Dues obligacions legals que es resolen des de la fitxa del client: el dret d'accés (donar-li tot el que en tens) i el dret a l'oblit (esborrar-ho). Totes dues deixen constància interna de qui les ha fet i sobre qui.",
        },
        { t: "h", text: "Exportar les dades" },
        {
          t: "p",
          text: "«Exportar dades» descarrega un fitxer amb tot el que el centre guarda d'aquesta persona: el perfil, la fitxa, els bons, les reserves, els pagaments, els exercicis assignats, el progrés registrat, els consentiments i la llista dels seus documents.",
        },
        {
          t: "note",
          text: "És el que has d'enviar-li si demana formalment «totes les meves dades». No cal preparar res a mà.",
        },
        { t: "h", text: "Eliminar un client" },
        {
          t: "p",
          text: "«Eliminar client» obre un diàleg on cal escriure el nom exacte de la persona. No és una molèstia gratuïta: és l'única barrera entre un clic despistat i una supressió que no es desfà.",
        },
        {
          t: "warn",
          text: "És IRREVERSIBLE. S'esborren les dades personals i l'accés, i cauen amb elles els seus bons, reserves, mesures, exercicis assignats i consentiments. Els pagaments es conserven de forma anonimitzada, per obligació fiscal: el registre comptable queda, desvinculat de la persona.",
        },
        {
          t: "p",
          text: "Abans d'esborrar, plantejat si el que necessites és realment això. Un client que ja no ve però que pot tornar no cal esborrar-lo; un que ho demana per escrit, sí.",
        },
        { t: "h", text: "El consentiment de dades de salut" },
        {
          t: "p",
          text: "És a part del consentiment de privacitat i el dóna el client des de la seva àrea (Configuració → Privacitat i consentiments). Mentre no el tingui, la seva fitxa t'avisa i no s'hi han de registrar notes mèdiques.",
        },
        { t: "h", text: "El que no es pot fer des de l'app" },
        {
          t: "p",
          text: "No hi ha cap pantalla per consultar el registre d'accessos: les exportacions i les supressions s'apunten, però es consulten des de la base de dades. Si mai et fa falta, és una petició per al suport.",
        },
      ],
    },

    // ─────────────────────────── 30 ───────────────────────────
    {
      id: "suport",
      title: "Suport",
      blocks: [
        {
          t: "p",
          text: "Dues portes al mateix canal: la pantalla Suport del menú, que és on es fa el seguiment, i l'accés ràpid, que hi és a totes les pantalles de la teva àrea per obrir un tiquet sense moure't d'on ets: la icona de la boia a la barra de dalt al mòbil, i «Obrir un tiquet» al peu del menú a l'ordinador. És el canal cap a qui desenvolupa l'app: errors, dubtes i idees de millora. No és el canal per parlar amb l'equip ni amb els clients.",
        },
        {
          t: "note",
          text: "Si hi ha tiquets oberts, l'accés ràpid porta el número. Compta els que encara no ha mirat ningú, no els que ja s'estan resolent: per això baixa quan en mous un a «En curs». El professional no el veu —ell reporta, no resol—.",
        },
        { t: "h", text: "Obrir un tiquet" },
        {
          t: "p",
          text: "El botó obre un panell amb un formulari curt: un títol d'una línia, una categoria i la descripció. Es tanca amb Escape o tocant fora. El mateix formulari és a dalt de la pantalla Suport, amb «+ Nou tiquet».",
        },
        {
          t: "p",
          text: "Explica on ho has vist i què esperaves que passés. Un tiquet que diu «no va» costa dues respostes més abans de poder-hi fer res.",
        },
        { t: "h", text: "Les categories" },
        {
          t: "dl",
          items: [
            ["Error", "Una cosa que hauria de funcionar i no funciona."],
            ["Pregunta", "No saps com fer una cosa, o no entens què fa."],
            ["Suggeriment", "Una idea per millorar-ho."],
          ],
        },
        { t: "h", text: "Els estats, que aquí sí que mous tu" },
        {
          t: "dl",
          items: [
            ["Obert", "Rebut, encara no s'hi ha posat ningú."],
            ["En curs", "S'hi està treballant."],
            ["Resolt", "Fet."],
          ],
        },
        {
          t: "note",
          text: "Aquesta és una de les diferències amb l'àrea del professional: ell veu l'estat dels seus tiquets però no el pot canviar, i només veu els seus. Tu veus els de tot l'equip i en pots moure l'estat amb el desplegable de cada fila.",
        },
        { t: "h", text: "La pantalla de seguiment" },
        {
          t: "p",
          text: "Suport, al menú. S'obre pels PENDENTS —els oberts i els que ja estan en curs—, que és el que et queda per tancar. L'historial sencer segueix a un clic: canvia el filtre d'estat a «Tots».",
        },
        {
          t: "dl",
          items: [
            [
              "Les tres pastilles",
              "Obert, En curs i Resolt amb quants n'hi ha de cada. Tocar-ne una filtra per aquell estat; tornar-la a tocar treu el filtre.",
            ],
            [
              "Els dos desplegables",
              "Estat i categoria, que es combinen. Els números de les pastilles ja compten només la categoria triada, així que diuen sempre quants en sortiran.",
            ],
            [
              "Cada fila",
              "Categoria, títol, qui l'ha obert i quan. Les descripcions llargues surten retallades a tres línies amb un «Veure més».",
            ],
          ],
        },
        {
          t: "p",
          text: "Quan un tiquet s'ha mogut alguna vegada, al costat de la data d'obertura hi surt «mogut el…». Serveix per veure d'una passada quant fa que una cosa està aturada en curs.",
        },
      ],
    },

    // ─────────────────────────── 31 ───────────────────────────
    {
      id: "correus",
      title: "Els correus",
      blocks: [
        { t: "h", text: "Els que reps tu" },
        {
          t: "table",
          head: ["Avís", "Quan arriba", "Es pot apagar?"],
          rows: [
            [
              "Nou client registrat",
              "Quan algú es dóna d'alta pel seu compte.",
              "Sí (ve encès)",
            ],
            ...(s.modules.sessionsProva
              ? [
                  [
                    "Nova sol·licitud de prova",
                    "Quan un visitant demana una sessió de prova.",
                    "Sí (ve encès)",
                  ],
                ]
              : []),
          ],
        },
        {
          t: "note",
          text: "Són els dos únics. Tota la resta de correus de l'app van cap a clients i professionals, i molts els dispares tu sense adonar-te'n: la taula següent és per saber què surt de cada botó que prems.",
        },
        { t: "h", text: "Els que provoques tu" },
        {
          t: "table",
          head: ["Acció teva", "Qui rep el correu", "El pot apagar?"],
          rows: [
            [
              "Donar d'alta un client o un professional",
              "La persona, amb l'enllaç per crear la contrasenya.",
              "No",
            ],
            [
              "«Reenviar invitació»",
              "La mateixa persona, amb un enllaç nou.",
              "No",
            ],
            [
              "Cancel·lar una reserva",
              "El client.",
              "No: una reserva que ja no existeix no la pot veure enlloc.",
            ],
            [
              "Tancar disponibilitat (un bloqueig, o esborrar o retallar una franja) i cancel·lar les reserves marcades",
              "Cada client afectat, amb un correu que diu que ha estat el centre i què passa amb la sessió.",
              "No",
            ],
            ...(s.modules.sessionsProva
              ? [
                  [
                    "Acceptar o rebutjar una prova",
                    "Qui la va demanar.",
                    "No: és la resposta al que va demanar ell.",
                  ],
                ]
              : []),
            [
              "Generar una factura de liquidació",
              "El professional.",
              "No: és informació sobre la seva retribució.",
            ],
            [
              "Congelar, reprendre o donar de baixa una subscripció",
              "El client.",
              "No: se li mouen diners sense que ell premi res.",
            ],
            [
              "«Notificar exercicis nous»",
              "El client.",
              "Sí (li ve apagat)",
            ],
            [
              "«Recordatori de propera sessió»",
              "El client.",
              "Sí",
            ],
            ...(s.modules.comunitat
              ? [
                  [
                    "Publicar un anunci",
                    "Clients i professionals que ho tinguin activat.",
                    "Sí (ve apagat)",
                  ],
                ]
              : []),
            [
              "Obrir un tiquet de suport",
              "Qui desenvolupa l'app.",
              "No",
            ],
          ],
        },
        {
          t: "warn",
          text: "Si algú et diu que espera un avís i no li arriba, fes-li mirar la carpeta de correu brossa abans de reportar-ho. És la causa de gairebé tots els casos.",
        },
      ],
    },

    // ─────────────────────────── 32 ───────────────────────────
    {
      id: "si-alguna-cosa-no-va",
      title: "Si alguna cosa no va",
      blocks: [
        { t: "h", text: "He cobrat el bo equivocat" },
        {
          t: "p",
          text: "No es desfà des de cap pantalla: cobrar activa el bo, anota un pagament, pot generar recompenses de referit i pot reprendre una subscripció. El que sí que pots fer és deixar el rastre correcte —anul·lar el bo que no tocava i registrar el moviment que calgui a Pagaments— i, si el desori és gros, obrir un tiquet de suport.",
        },
        { t: "h", text: "Una liquidació no quadra" },
        {
          t: "p",
          text: "Gairebé sempre és una d'aquestes dues coses. O hi ha sessions que es van fer però ningú no va marcar com a completades —busqueu-les a l'agenda—, o hi ha sessions d'un servei que aquell dia no tenia cap tarifa vigent: el peu del càlcul t'ho diu amb el nombre exacte de sessions no comptades.",
        },
        { t: "h", text: "Un client diu que no pot reservar" },
        {
          t: "p",
          text:
            "Repassa-ho en aquest ordre: que tingui un bo actiu amb sessions; que el professional tingui disponibilitat aquell dia i hora; que la franja ofereixi el servei del seu bo; que no hi hagi cap bloqueig a sobre" +
            (s.minBookingHours > 0
              ? `; i que la sessió no comenci abans del marge mínim de ${hores(s.minBookingHours)}.`
              : ".") +
            (s.modules.sessionsProva
              ? " Si la franja surt ocupada i no hi veus cap reserva, mira si hi ha una sol·licitud de prova esperant resposta: la bloqueja."
              : ""),
        },
        { t: "h", text: "Un client no rep cap correu" },
        {
          t: "p",
          text: "Primer, el correu brossa. Segon, comprova que el correu de la seva fitxa sigui el bo. Tercer, mira si l'avís concret és dels que ell pot apagar (la taula del capítol anterior ho diu) i si el té apagat. Per als d'accés, «Reenviar invitació» genera un enllaç nou.",
        },
        { t: "h", text: "Ha desaparegut una pantalla del menú" },
        {
          t: "p",
          text: "Algú ha apagat el seu mòdul a Configuració → Centre. Un mòdul apagat no s'amaga només: la seva adreça deixa d'existir, així que tampoc s'hi arriba escrivint-la. Torna-l'hi a encendre i reapareix amb tot el que hi havia.",
        },
        { t: "h", text: "Un professional no veu les reserves d'un company" },
        {
          t: "p",
          text: s.trainersSeeColleaguesReservations
            ? "Amb la coordinació encesa, com ara, hauria de veure-les. Si no, que provi de netejar els filtres del seu calendari."
            : "És l'ajust de coordinació, que ara està APAGAT: cada professional només veu les seves. S'encén a Configuració → Centre.",
        },
        { t: "h", text: "No em deixa esborrar una etiqueta" },
        {
          t: "p",
          text: "La fa servir alguna oferta com a públic. Canvia el públic de l'oferta —o esborra l'oferta— i torna-hi.",
        },
        { t: "h", text: "No em deixa tancar un bonus" },
        {
          t: "p",
          text: "O no hi ha trams definits per a la freqüència d'aquella persona (anual o biennal), o el període ja s'havia tancat, o no hi ha cap unitat acumulada. El missatge d'error diu quina de les tres és.",
        },
        { t: "h", text: "Res del que hi ha aquí explica el que em passa" },
        {
          t: "p",
          text: "Obre un tiquet amb el botó de suport, categoria «Error», i explica on ho has vist i què esperaves que passés.",
        },
      ],
    },

    // ─────────────────────────── 33 ───────────────────────────
    {
      id: "glossari",
      title: "Glossari",
      blocks: [
        {
          t: "dl",
          items: [
            [
              "Bo",
              "Un paquet de sessions comprat per un client. La sessió es descompta en crear la reserva, no en fer-la.",
            ],
            [
              "Paquet",
              "Una entrada del catàleg: un nom, un preu i unes sessions per defecte. En vendre'l, es converteix en un bo.",
            ],
            [
              "Sessió de cortesia",
              `Una sessió regalada: no descompta cap sessió de cap bo. En grup ocupa plaça igual (el màxim de ${s.groupCapacity} es respecta).`,
            ],
            [
              "Franja",
              "Una hora de la disponibilitat d'un professional. El que un client pot triar per reservar.",
            ],
            [
              "Bloqueig",
              "Uns dies o unes hores en què un professional no hi és, per damunt del seu horari setmanal. Guanya sempre a la franja.",
            ],
            [
              "Aforament",
              `El màxim de persones d'una sessió de grup reduït: ${s.groupCapacity}.`,
            ],
            [
              "Bo decaigut",
              "Un bo pendent de pagament anul·lat per no haver-se cobrat a temps. Es pot recuperar cobrant-lo, si encara és dins de data.",
            ],
            [
              "Cicle",
              "El mes d'una subscripció. Comença el dia d'alta de cada mes, no el dia 1.",
            ],
            [
              "Preu congelat",
              "El de la subscripció, fixat el dia de l'alta. No canvia encara que pugin els preus del catàleg.",
            ],
            [
              "Sessió extra",
              "Una sessió de més que demana un subscriptor un cop gastades les del mes, al preu per sessió del seu bo.",
            ],
            [
              "Públic d'una oferta",
              "A qui arriba: tothom, els d'una etiqueta, o els que tenen un bo actiu d'un tipus de servei.",
            ],
            [
              "Etiqueta",
              "Una marca de text lliure sobre un client, invisible per a ell, que serveix per dirigir-li ofertes.",
            ],
            [
              "Tarifa",
              "L'import que es paga al professional per cada sessió completada d'un tipus de servei.",
            ],
            [
              "Liquidació",
              "El càlcul tancat d'un període, del qual surt la factura del professional. No canvia encara que després canviïn les tarifes.",
            ],
            [
              "Unitat",
              "La mesura amb què es compta el bonus. Cada tipus de servei val les unitats que digui el pes.",
            ],
            [
              "Tram",
              "El graó del bonus segons les unitats acumulades. Cada tram paga a un preu per unitat i es cobra per trams, no tot al preu més alt.",
            ],
            [
              "Nota de sessió",
              "El que s'apunta d'una sessió ja feta. L'escriu qui la va donar; tu la llegeixes, el client no.",
            ],
            [
              "Mòdul",
              "Una part sencera de l'app que es pot apagar. Apagada, desapareix del menú i la seva adreça deixa d'existir.",
            ],
            ...(s.modules.sessionsProva
              ? ([
                  [
                    "Sessió de prova",
                    "Una sessió gratuïta que demana algú que encara no és client. Pendent, bloqueja la franja fins que es respon.",
                  ],
                ] as [string, string][])
              : []),
          ],
        },
      ],
    },
  ];

  // Els capítols dels mòduls apagats no arriben ni a l'índex: així la
  // numeració no deixa forats i ningú es pregunta què hi havia al 10.
  return chapters
    .filter((c) => c.when !== false)
    .map(({ id, title, blocks }) => ({ id, title, blocks }));
}
