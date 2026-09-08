/**
 * El manual del professional, com a DADES.
 *
 * Segon dels tres manuals i germà bessó de `client-manual.ts`: mateixos tipus
 * (`Block`, `Chapter`), mateix component per pintar-lo (`HelpManual`) i mateix
 * criteri —el text viu en cadenes perquè el català va ple d'apòstrofs i perquè
 * un manual és un document, no una pantalla—.
 *
 * TOT EL QUE ÉS UN NÚMERO O UN INTERRUPTOR ARRIBA DE FORA
 *
 * `buildTrainerManual` rep els ajustos REALS del centre: l'horari, l'aforament
 * dels grups, el llindar dels bons baixos, si es veuen les reserves dels
 * companys. I els capítols dels mòduls apagats no es generen. Un manual que
 * explica una pantalla que el centre té tancada menteix cada dia sense que
 * ningú se n'assabenti.
 *
 * QUÈ NO ES PERSONALITZA, I PER QUÈ
 *
 * L'app sap l'especialitat de qui llegeix (`viewer.specialty`), i el capítol de
 * disponibilitat es podria escriure només per al seu cas. No es fa: dos
 * professionals llegirien manuals diferents, i la captura que un li ensenya a
 * l'altre no quadraria. Els dos casos s'expliquen sempre.
 *
 * El mateix amb el bonus: el panell només surt a qui el té actiu, però el
 * capítol el descriu en condicional. El bonus s'activa i es desactiva, i el
 * manual no ha de canviar de forma sota els peus de qui el llegeix.
 */

import type { Block, Chapter } from "@/lib/help/client-manual";

/** Els ajustos del centre que el manual necessita per no dir cap número fals. */
export type TrainerManualSettings = {
  openingHour: number;
  closingHour: number;
  groupCapacity: number;
  /** Sessions restants a partir de les quals un bo compta com a "baix". */
  bonoLowThreshold: number;
  minPasswordLength: number;
  /** El centre deixa veure les reserves dels companys. */
  trainersSeeColleaguesReservations: boolean;
  /** Hora local a què surten els recordatoris i el resum diari. */
  reminderHourLocal: number;
  trialMinAdvanceHours: number;
  trialMaxAdvanceDays: number;
  modules: { comunitat: boolean; documents: boolean; sessionsProva: boolean };
};

/** "07:00" a partir d'una hora sencera. */
const hhmm = (h: number) => `${String(h).padStart(2, "0")}:00`;

export function buildTrainerManual(s: TrainerManualSettings): Chapter[] {
  const chapters: (Chapter & { when?: boolean })[] = [
    // ─────────────────────────── 1 ───────────────────────────
    {
      id: "primers-passos",
      title: "Primers passos",
      blocks: [
        {
          t: "p",
          text: "Aquesta és la teva àrea de treball al centre: hi tens l'agenda, els teus clients, la biblioteca d'exercicis, el teu horari i les teves factures. Tot el que hi facis queda desat al moment i el client ho veu a la seva àrea sense que ningú hagi de confirmar res per un altre canal.",
        },
        { t: "h", text: "Entrar" },
        {
          t: "p",
          text: "S'entra amb el correu i la contrasenya des de la pantalla d'accés. El compte el crea l'administració; aquí no hi ha cap pantalla de registre. Si no recordes la contrasenya, «Has oblidat la contrasenya?» t'envia un enllaç a la teva bústia.",
        },
        { t: "h", text: "Moure't per l'app" },
        {
          t: "p",
          text: "El menú de l'esquerra porta a les set seccions: Inici, Clients, Reserves (amb Disponibilitat com a pestanya germana), Bons, Les meves factures, Exercicis, Comunitat i Configuració. En un mòbil el menú s'obre amb el botó de dalt. A més a més, a totes les pantalles hi ha el botó rodó de suport a baix a la dreta, que s'explica al seu capítol.",
        },
        {
          t: "note",
          text: "Aquesta àrea és sempre en català. L'única part de l'app que es tradueix és la del client, i és a posta: la fan servir persones que no formen part de l'equip.",
        },
        { t: "h", text: "Els teus clients i la resta" },
        {
          t: "p",
          text: "La distinció recorre tota l'app i val la pena tenir-la clara des del principi. Pots CONSULTAR la fitxa de qualsevol client del centre, perquè coordinar-se demana saber què fa el company. Només pots GESTIONAR —crear bons, crear reserves, assignar exercicis, posar etiquetes— els clients que tens assignats.",
        },
        {
          t: "p",
          text: "Quan obris la fitxa d'un client que no és teu, hi veuràs una marca «Només lectura» a dalt a la dreta i els botons d'acció no hi seran. No és una decisió de la pantalla: la base de dades comprova el mateix, així que encara que el botó sortís, el desat fallaria.",
        },
        { t: "h", text: "El que no pots canviar tu" },
        {
          t: "p",
          text: "El teu nom, el teu correu d'accés, la teva foto i la teva especialitat els gestiona l'administració des de la seva fitxa de professionals. Si n'hi ha algun que està malament, demana-ho: aquí no hi ha cap formulari per fer-ho. El que sí que pots canviar tu és la contrasenya i quins avisos vols rebre, tots dos a Configuració.",
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
          text: "La pantalla d'entrada està pensada per respondre en deu segons a «què tinc avui i què reclama la meva atenció». De dalt a baix hi trobaràs sempre les mateixes peces, i les que no tenen res a dir no es pinten.",
        },
        { t: "h", text: "Les quatre xifres de dalt" },
        {
          t: "dl",
          items: [
            [
              "Sessions",
              "Les d'avui, i al costat les de tota la setmana. Compta les teves, no les del centre. Porta a Reserves.",
            ],
            [
              "Els teus clients",
              "Quants en tens assignats ara mateix. Porta a Clients.",
            ],
            [
              "Bons a punt d'esgotar-se",
              `Bons dels teus clients amb ${s.bonoLowThreshold} ${s.bonoLowThreshold === 1 ? "sessió" : "sessions"} o menys. Si n'hi ha cap, la targeta es posa taronja: és l'avís per oferir la renovació abans que es quedin sense.`,
            ],
            [
              "Ocupació setmanal",
              "Quantes de les teves franges de disponibilitat d'aquesta setmana tenen reserva. Sense disponibilitat definida surt un guionet, no un zero: no és que estiguis buit, és que encara no has dit quan hi ets.",
            ],
          ],
        },
        {
          t: "note",
          text: "Els diners del centre no surten enlloc d'aquesta pantalla —ni ingressos ni pendents de cobrament—. L'única xifra econòmica que hi pot aparèixer és la teva: l'estimació del teu bonus.",
        },
        ...(s.modules.sessionsProva
          ? ([
              { t: "h", text: "Atenció immediata" },
              {
                t: "p",
                text: "Just sota les xifres, i només si n'hi ha, surten les sol·licituds de sessió de prova que t'esperen a tu. Hi veuràs el nom, el dia i quantes hores queden abans que caduquin. Mentre no responguis, la franja segueix bloquejada i ningú més la pot reservar: per això surten aquí dalt i no com una xifra més.",
              },
            ] as Block[])
          : []),
        { t: "h", text: "Accions ràpides" },
        {
          t: "p",
          text: "Tres dreceres a les pantalles on es passa el dia: Reservar sessió, Els meus clients i Disponibilitat. No fan res que no es pugui fer des del menú; s'estalvien un clic.",
        },
        { t: "h", text: "Properes reserves" },
        {
          t: "p",
          text: "L'agenda immediata en format llista. Porta un conmutador per veure només les teves o les de tot el centre, útil per saber qui hi ha a la sala a la mateixa hora.",
        },
        { t: "h", text: "El teu bonus" },
        {
          t: "p",
          text: "Si el centre té el bonus activat per a tu, aquí hi ha el període en curs, les unitats acumulades i l'estimació d'import. També el tram on ets ara i quantes unitats et falten per passar al següent, amb el desglossament per tipus de servei. Si no hi participes, aquesta secció no existeix: no veuràs ni un marc buit.",
        },
        {
          t: "warn",
          text: "L'estimació del bonus és orientativa. Es calcula amb els pesos i els trams d'avui sobre les sessions que ja has completat, i no queda fixada fins que l'administració tanca el període. Si el centre encara no ha configurat els trams, la pantalla t'ho diu amb un avís taronja.",
        },
        { t: "h", text: "Bons baixos i els meus clients" },
        {
          t: "p",
          text: "A baix, dues llistes de treball: els bons dels teus clients que s'estan acabant —amb el nom i quantes sessions queden— i la llista dels teus clients amb les sessions que li resten a cadascun. Totes dues porten a la fitxa d'un clic.",
        },
        ...(s.modules.comunitat
          ? ([
              { t: "h", text: "Comunitat" },
              {
                t: "p",
                text: "L'últim bloc és el mur d'anuncis del centre, el mateix que veus a la secció Comunitat. Hi és perquè un avís que ningú llegeix no serveix de res.",
              },
            ] as Block[])
          : []),
      ],
    },

    // ─────────────────────────── 3 ───────────────────────────
    {
      id: "clients",
      title: "Clients",
      blocks: [
        {
          t: "p",
          text: "La llista de persones del centre. S'obre amb «Els meus» seleccionat; el botó «Tots» ensenya la resta, i el comptador de la dreta et diu quantes n'estàs veient.",
        },
        {
          t: "p",
          text: "El cercador busca alhora pel nom del client, pel seu correu i pel nom del professional que té assignat. Aquesta tercera cosa és la que fa que serveixi de debò: escriure el nom d'un company t'ensenya tota la seva cartera.",
        },
        { t: "h", text: "Les columnes" },
        {
          t: "dl",
          items: [
            ["Client", "Nom i cognoms. Obre la fitxa."],
            [
              "Professional",
              "Qui el té assignat. Si no en té cap, hi diu «Sense assignar» en cursiva.",
            ],
            ["Bons actius", "Quants bons vigents té ara mateix."],
            [
              "Sessions rest.",
              "El total de sessions que li queden sumant tots els bons.",
            ],
          ],
        },
        { t: "h", text: "El botó de WhatsApp" },
        {
          t: "p",
          text: "A la dreta de cada fila hi ha la icona de WhatsApp, que obre una conversa amb aquell client. Només surt si el client té telèfon apuntat. És una cel·la a part de la resta a posta: si estigués dins de l'enllaç, tocar-la obriria la fitxa i no la conversa.",
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
          text: "A dalt hi ha el nom, el correu, el telèfon, el botó de WhatsApp i les etiquetes que té posades. Sota, nou pestanyes. Si el client no és teu, la marca «Només lectura» surt a la dreta del nom i les accions de cada pestanya desapareixen.",
        },
        {
          t: "warn",
          text: "Si el client rep fisioteràpia i encara no ha acceptat el tractament de dades de salut, la fitxa s'obre amb un avís taronja ben visible. Mentre hi sigui, no hi registris notes mèdiques ni dades de salut: ha d'acceptar-ho ell des de la seva àrea, a Configuració → Privacitat i consentiments.",
        },
        { t: "h", text: "Resum" },
        {
          t: "p",
          text: "El selector de professional assignat, els bons actius i les sessions restants. Sota, les notes internes si n'hi ha.",
        },
        {
          t: "p",
          text: "Reassignar el professional el pot fer qualsevol de l'equip, també amb un client que ara mateix no és seu. És el cas per al qual es va fer: cobrir una baixa o repartir-se l'agenda un dia que falta algú. En canvi la resta d'accions de la fitxa segueixen depenent de si el client és teu.",
        },
        { t: "h", text: "Bons" },
        {
          t: "p",
          text: "Tots els bons del client amb el servei, les sessions consumides sobre el total, el preu i l'estat. Si el client és teu, hi tens «+ Afegir bo» per vendre-n'hi un de nou, i el botó «Marcar com pagat» a cada bo que estigui pendent de cobrament, per quan el client paga al centre en efectiu o amb targeta al datàfon.",
        },
        {
          t: "warn",
          text: "«Marcar com pagat» activa el bo i les sessions passen a estar disponibles a l'instant. No hi ha pantalla de confirmació ni manera de desfer-ho des d'aquí: si t'equivoques de bo, avisa l'administració.",
        },
        { t: "h", text: "Reserves" },
        {
          t: "p",
          text: "L'històric de sessions del client amb la data, el servei i l'estat. Si és teu, hi tens la drecera «+ Nova reserva».",
        },
        { t: "h", text: "Exercicis" },
        {
          t: "p",
          text: "Els exercicis que té assignats i, si el client és teu, el formulari per assignar-ne un de la biblioteca amb una nota de pauta al costat («3 sèries de 12, dos cops/setmana» és l'exemple que hi surt). També pots treure'n un amb el botó «Treure».",
        },
        {
          t: "note",
          text: "Assignar un exercici NO avisa el client. L'avís s'envia a mà des de la pestanya Notificacions, amb el botó «Notificar exercicis nous». És així a posta: qui munta una taula sencera no vol enviar dotze correus, un per exercici.",
        },
        { t: "h", text: "Progrés" },
        {
          t: "p",
          text: "Les mesures registrades per a cada exercici assignat: data, pes en quilos, repeticions i una nota opcional. Si el client és teu, hi pots registrar entrades noves i esborrar-ne. És on es veu si el que li has posat està funcionant.",
        },
        { t: "h", text: "Documents" },
        {
          t: "p",
          text: s.modules.documents
            ? "Els fitxers que ha pujat el client a la seva àrea —informes, proves mèdiques, el que sigui—. Els pots obrir i descarregar, però no pujar-ne: aquesta safata és seva i la gestiona ell."
            : "El mòdul de documents està desactivat al centre, així que aquesta pestanya sempre sortirà buida: els clients no tenen la pantalla on pujar-ne. Si es torna a activar, aquí hi veuràs el que hagin pujat.",
        },
        { t: "h", text: "Etiquetes" },
        {
          t: "p",
          text: "Marques curtes per organitzar la cartera. Si el client és teu, li pots posar i treure les que hi hagi al catàleg; crear-ne de noves és cosa de l'administració, perquè un catàleg on cadascú hi afegeix la seva versió del mateix concepte deixa de servir per filtrar.",
        },
        { t: "h", text: "Notes" },
        {
          t: "p",
          text: "Dues caixes separades: les notes clíniques, amb la vora verda i la creu sanitària, i les generals. Les pots llegir, però no escriure —les edita l'administració des del formulari del client—. El que sí que escrius tu és la nota de cada sessió, que té el seu propi capítol.",
        },
        { t: "h", text: "Notificacions" },
        {
          t: "p",
          text: "Tres avisos que s'envien quan tu ho decideixis, amb un botó cadascun:",
        },
        {
          t: "dl",
          items: [
            [
              "Reenviar invitació",
              "Un nou correu d'accés. Per quan el primer va caducar o no va arribar mai.",
            ],
            [
              "Notificar exercicis nous",
              "Avisa el client que té exercicis nous a la seva àrea.",
            ],
            [
              "Recordatori de propera sessió",
              "Li recorda la següent sessió que té programada.",
            ],
          ],
        },
      ],
    },

    // ─────────────────────────── 5 ───────────────────────────
    {
      id: "agenda",
      title: "L'agenda",
      blocks: [
        {
          t: "p",
          text: `La pantalla de Reserves té dues vistes del mateix: el calendari setmanal, que és la que s'obre, i la llista. Les hores que es pinten són l'horari del centre, de ${hhmm(s.openingHour)} a ${hhmm(s.closingHour)}.`,
        },
        { t: "h", text: "El calendari setmanal" },
        {
          t: "p",
          text: "Set columnes i una fila per hora. Les fletxes de dalt mouen la setmana i el botó del mig torna a l'actual. Cada reserva és una peça de color; les de grup reduït porten al costat quanta gent hi ha apuntada sobre l'aforament.",
        },
        {
          t: "p",
          text: "Tocar un forat buit obre el formulari de nova reserva amb el dia i l'hora ja posats. Tocar una reserva obre la seva fitxa, amb el que hi puguis fer.",
        },
        { t: "h", text: "La capa de disponibilitat" },
        {
          t: "p",
          text: s.trainersSeeColleaguesReservations
            ? "«Mostrar la meva disponibilitat» ombreja les franges on has dit que hi ets. Al costat hi ha el selector de companys: pots afegir la disponibilitat d'altres professionals a sobre per veure d'un cop qui té forat aquella tarda. Els bloquejos temporals tapen l'ombrejat, així que una setmana de vacances d'un company es veu de seguida."
            : "«Mostrar la meva disponibilitat» ombreja les franges on has dit que hi ets, i els teus bloquejos temporals hi apareixen tapats. El centre té desactivada la vista de les reserves dels companys, així que al calendari només hi surten les teves.",
        },
        { t: "h", text: "La llista" },
        {
          t: "p",
          text: "El conmutador de dalt canvia a la vista de llista, partida en «Properes» i «Passades», amb filtres per professional i per estat. És la vista bona per repassar el que ja ha passat: la nota de cada sessió només es pinta a «Passades».",
        },
        {
          t: "note",
          text: s.trainersSeeColleaguesReservations
            ? "Veus l'agenda de tot el centre per poder-te coordinar, però només pots gestionar les reserves dels teus clients. Les altres es miren i prou."
            : "Al calendari només hi surten les teves reserves: el centre té desactivada la vista de les dels companys.",
        },
      ],
    },

    // ─────────────────────────── 6 ───────────────────────────
    {
      id: "crear-reserves",
      title: "Crear i gestionar reserves",
      blocks: [
        { t: "h", text: "Una reserva nova" },
        {
          t: "p",
          text: "Des de «+ Nova reserva», des d'un forat del calendari o des de la fitxa del client. El formulari demana, per ordre:",
        },
        {
          t: "dl",
          items: [
            [
              "Client",
              "Només hi surten els teus clients assignats amb bons disponibles. Si la llista és buida, el formulari t'ho diu en comptes de deixar-te omplir-lo per res.",
            ],
            [
              "Sessió de cortesia",
              "Una casella. Marcada, la sessió es regala: no descompta res de cap bo. Llavors el selector de bo desapareix i has de dir tu de quin tipus de servei és, perquè amb bo el tipus sortia del bo mateix.",
            ],
            [
              "Bo",
              "Quin bo paga la sessió. Al costat de cada opció hi ha quantes sessions li queden. Se'n descompta una en crear la reserva, no quan la sessió es fa.",
            ],
            [
              "Professional",
              "Qui la dóna. Es pot deixar sense assignar.",
            ],
            ["Data i hora", "El dia i l'hora de la sessió."],
            [
              "Repeticions setmanals",
              "Amb 1 es crea una sola reserva. Amb més, crea una reserva cada setmana a la mateixa hora, fins a 52. Cada repetició consumeix la seva sessió del bo, tret que sigui de cortesia.",
            ],
          ],
        },
        {
          t: "warn",
          text: `Les repeticions setmanals es creen totes de cop i cada una descompta una sessió. Posar 12 en un bo de 10 no en crearà 12: el bo es queda sense. Compta les sessions disponibles abans de fer-ho.`,
        },
        { t: "h", text: "Les sessions de grup" },
        {
          t: "p",
          text: `El grup reduït no és un formulari diferent: es creen reserves individuals amb el servei «Grup reduït» a la mateixa hora, i el calendari les agrupa i ensenya l'ocupació. L'aforament màxim és de ${s.groupCapacity} persones, i una sessió de cortesia hi ocupa plaça igual que la resta.`,
        },
        { t: "h", text: "Reprogramar, marcar feta, cancel·lar" },
        {
          t: "p",
          text: "Tocant una reserva al calendari s'obre la seva fitxa amb tres accions, sempre que sigui d'un client teu:",
        },
        {
          t: "dl",
          items: [
            [
              "Reprogramar",
              "Canvia el dia i l'hora sense tocar el bo. La sessió ja estava descomptada i ho segueix estant.",
            ],
            [
              "Marcar feta",
              "Deixa la sessió com a completada. No descompta res: això ja va passar en crear-la. És el que compta per a les liquidacions i per al bonus.",
            ],
            [
              "Cancel·lar",
              "Anul·la la sessió i TORNA la sessió al bo. Si el bo ja s'havia donat per acabat, es reactiva.",
            ],
          ],
        },
        {
          t: "warn",
          text: "Cancel·lar avisa el client per correu sempre, sense excepció: és una cosa consumada que ell no pot descobrir mirant l'app. I si algú estava en llista d'espera per aquella franja, el sistema li ofereix el lloc automàticament.",
        },
        {
          t: "note",
          text: "Les hores mínimes d'antelació per cancel·lar són una regla per al client, no per a tu. Des d'aquí es pot cancel·lar en qualsevol moment; el criteri de quan fer-ho és del centre, no de l'app.",
        },
        {
          t: "p",
          text: "Pots marcar «Fet» o cancel·lar una sessió d'un client teu encara que la sessió la donés un company —passa quan es cobreix una baixa—. El que no pots és escriure'n la nota: això és de qui la va fer.",
        },
      ],
    },

    // ─────────────────────────── 7 ───────────────────────────
    {
      id: "sessions-prova",
      title: "Les sessions de prova",
      when: s.modules.sessionsProva,
      blocks: [
        {
          t: "p",
          text: `Qui encara no és client pot demanar una sessió de prova gratuïta des del calendari públic, sense crear cap compte. Tria una franja lliure, hi deixa el nom, el correu i el telèfon, i queda pendent que un professional la respongui. Cal demanar-la amb un mínim de ${s.trialMinAdvanceHours} h d'antelació i com a molt ${s.trialMaxAdvanceDays} dies vista.`,
        },
        { t: "h", text: "Com et surten" },
        {
          t: "p",
          text: "Les que cauen a la teva disponibilitat te surten a dos llocs: a «Atenció immediata» de l'Inici i al calendari, marcades com a franja bloquejada. Tocant-les hi tens les dades de qui la demana i dos botons, «Acceptar» i «Rebutjar».",
        },
        {
          t: "warn",
          text: "Mentre no respons, la franja queda bloquejada i ningú més la pot reservar, ni tu ni el client. Per això la sol·licitud porta un compte enrere: quan caduca, el forat s'allibera sol i la persona es queda sense resposta.",
        },
        { t: "h", text: "Acceptar i rebutjar" },
        {
          t: "p",
          text: "«Acceptar» confirma la sessió i la converteix en una reserva de la teva agenda. «Rebutjar» allibera la franja. En tots dos casos la persona rep un correu amb la resposta: aquest avís no es pot desactivar des de les preferències, perquè és la contestació al que ella va demanar.",
        },
        {
          t: "note",
          text: "Només pots respondre les sol·licituds que són teves. Les dels companys les veus al calendari perquè la franja està ocupada, però els botons no hi són.",
        },
      ],
    },

    // ─────────────────────────── 8 ───────────────────────────
    {
      id: "nota-sessio",
      title: "La nota de la sessió",
      blocks: [
        {
          t: "p",
          text: "Cada sessió ja feta pot portar una nota: com ha anat, què s'ha treballat, què cal recordar per a la propera. Surt a la vista de llista de Reserves, a l'apartat «Passades», sota la reserva. A les properes no hi és, perquè parla d'una cosa que encara no ha passat.",
        },
        { t: "h", text: "Qui l'escriu" },
        {
          t: "p",
          text: "Només qui va donar la sessió. No és el mateix que «els meus clients»: pots marcar com a feta una sessió d'un client teu que va donar un company, però la nota d'aquella sessió és d'ell. Si no la vas donar tu, veuràs la nota si n'hi ha, però no el formulari.",
        },
        {
          t: "p",
          text: "La nota sempre s'ensenya amb el nom de qui la va escriure. Si la reserva es reassigna a un altre professional, la nota es queda amb l'autoria original: qui la llegeixi ha de saber qui hi era.",
        },
        { t: "h", text: "Qui la llegeix" },
        {
          t: "warn",
          text: "La nota de sessió la llegeixen l'administració i els professionals, no el client. La versió que veu ell és una altra i s'escriu a part. Tot i així, escriu-la pensant que la llegirà algú que no era a la sala.",
        },
      ],
    },

    // ─────────────────────────── 9 ───────────────────────────
    {
      id: "disponibilitat",
      title: "Disponibilitat",
      blocks: [
        {
          t: "p",
          text: "Aquí dius quan hi ets. És la pantalla que decideix què pot reservar un client: fora de les teves franges no hi ha res a triar. Hi arribes des de la pestanya «Disponibilitat», al costat de «Reserves».",
        },
        { t: "h", text: "Afegir una franja" },
        {
          t: "p",
          text: "El formulari de dalt crea diverses regles de cop. Marques els dies de la setmana que vulguis, poses l'hora d'inici i la de fi, i des de quina data val la regla (i fins quan, si vols que caduqui sola). Les hores van de punta a punta d'hora.",
        },
        {
          t: "p",
          text: "Sota hi ha els serveis que ofereixes en aquella franja, i vénen marcats segons la teva especialitat: si ets fisioterapeuta, fisioteràpia; si ets entrenador o no en tens cap d'apuntada, els tres serveis d'entrenament (individual, parelles i grup reduït). És una proposta, no una imposició: els pots canviar franja per franja.",
        },
        {
          t: "p",
          text: "Les regles ja creades surten agrupades per dia de la setmana, i cadascuna es pot editar o esborrar.",
        },
        { t: "h", text: "Bloquejos temporals" },
        {
          t: "p",
          text: "A sota hi ha els bloquejos: vacances, una baixa, una tarda concreta. Un bloqueig guanya sempre a l'horari setmanal, així que durant els seus dies no es pot reservar encara que la regla digui que hi ets. Se li posa un nom («Vacances», «Baixa mèdica») per saber què és quan es miri des de fora.",
        },
        {
          t: "warn",
          text: "Si dins del bloqueig hi ha reserves ja fetes, la pantalla t'ho diu abans de crear-lo i et deixa marcar quines vols cancel·lar. El bloqueig es crea igualment: les que no marquis es queden dretes, i tocarà resoldre-les a mà.",
        },
        {
          t: "note",
          text: "Un bloqueig que ja ha començat no es pot esborrar. Els que encara no han arribat, sí.",
        },
      ],
    },

    // ─────────────────────────── 10 ───────────────────────────
    {
      id: "exercicis",
      title: "Exercicis",
      blocks: [
        {
          t: "p",
          text: "La biblioteca d'exercicis és del CENTRE, no teva: la comparteixes amb l'administració i amb la resta de l'equip, i el que hi afegeixis ho podrà assignar qualsevol. Val la pena tenir-ho present abans de crear-ne un de nou amb un nom que només entens tu.",
        },
        { t: "h", text: "Buscar-hi" },
        {
          t: "p",
          text: "Hi ha un cercador per nom i uns filtres de categoria a sobre de la graella, amb «Totes» per treure'ls. Cada fitxa ensenya el nom, la categoria i el vídeo si en té.",
        },
        { t: "h", text: "Crear-ne un" },
        {
          t: "p",
          text: "Amb «+ Nou exercici». Demana el nom, la categoria, una descripció i, opcionalment, un vídeo: o bé l'enllaç a un de YouTube, o bé un fitxer que puges tu. Els exercicis existents s'editen i s'esborren des de la mateixa fitxa.",
        },
        { t: "h", text: "Categories" },
        {
          t: "p",
          text: "Des de la biblioteca es gestionen les categories: crear-ne de noves i esborrar les que sobren. Són les que després filtren la graella i les que veu el client a la seva àrea.",
        },
        {
          t: "note",
          text: "Assignar exercicis a una persona no es fa des d'aquí sinó des de la seva fitxa, a la pestanya Exercicis. Aquesta pantalla és el catàleg; l'assignació és cosa de cada client.",
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
          text: "Aquesta pantalla és una vista de tots els bons del centre, amb el client, el servei, les sessions consumides sobre el total, el preu i l'estat. Serveix per consultar, no per gestionar: aquí no hi ha cap botó.",
        },
        {
          t: "p",
          text: "Els bons es creen des de la fitxa del client, a la pestanya Bons, i només per als clients que tens assignats. Allà mateix hi tens «Marcar com pagat» per als que estan pendents de cobrament.",
        },
        { t: "h", text: "Els estats" },
        {
          t: "dl",
          items: [
            [
              "Actiu",
              "Té sessions disponibles i està pagat. És l'únic estat amb què es pot reservar.",
            ],
            [
              "Pendent de pagament",
              "Venut però encara no cobrat. No es pot fer servir fins que algú el marca com a pagat.",
            ],
            [
              "Esgotat",
              "S'han consumit totes les sessions. Cancel·lar una reserva seva el pot tornar a activar.",
            ],
          ],
        },
        {
          t: "note",
          text: `Un bo compta com a "baix" quan li queden ${s.bonoLowThreshold} ${s.bonoLowThreshold === 1 ? "sessió" : "sessions"} o menys. És el llindar que fa sortir la targeta taronja de l'Inici i el que decideix l'avís que rep el client.`,
        },
      ],
    },

    // ─────────────────────────── 12 ───────────────────────────
    {
      id: "factures",
      title: "Les meves factures",
      blocks: [
        {
          t: "p",
          text: "Els períodes que l'administració ja ha tancat, del més recent al més antic. De cada un hi tens les dates, la data d'emissió, l'import total i el botó per descarregar el document.",
        },
        {
          t: "p",
          text: "Sota l'import hi ha el desglossament: quantes sessions de cada servei, a quina tarifa i quant suma cada línia. És el detall del càlcul, per si els números no quadren amb el que tenies comptat.",
        },
        {
          t: "p",
          text: "Aquesta pantalla és només de lectura. Aquí no es genera ni s'edita res: els períodes els tanca l'administració, i quan en tanca un de teu reps un correu.",
        },
        {
          t: "warn",
          text: "El document és PROVISIONAL. És el càlcul intern del centre sobre les teves sessions completades, no un document amb validesa fiscal; el format oficial es confirmarà amb l'assessoria.",
        },
        {
          t: "note",
          text: "El que compta per a la liquidació són les sessions marcades com a FETES. Una sessió que vas donar però que ningú va marcar no hi surt.",
        },
      ],
    },

    // ─────────────────────────── 13 ───────────────────────────
    {
      id: "comunitat",
      title: "Comunitat",
      when: s.modules.comunitat,
      blocks: [
        {
          t: "p",
          text: "El tauler d'anuncis del centre: canvis d'horari, novetats, avisos. La publicació més recent surt destacada i la resta a sota, amb l'autor i la data.",
        },
        {
          t: "p",
          text: "Per a tu és només de lectura. Qui publica és l'administració; si tens alguna cosa per comunicar, passa-la per allà. El mateix mur el veuen els clients des de la seva àrea.",
        },
        {
          t: "note",
          text: "Pots rebre un correu cada cop que es publica un anunci. Ve desactivat i s'activa a Configuració → Notificacions.",
        },
      ],
    },

    // ─────────────────────────── 14 ───────────────────────────
    {
      id: "suport",
      title: "Suport",
      blocks: [
        {
          t: "p",
          text: "El botó rodó lila de baix a la dreta hi és a totes les pantalles de la teva àrea. És el canal cap a qui desenvolupa l'app: errors, dubtes i idees de millora. No és el canal per parlar amb l'administració del centre ni amb els clients.",
        },
        { t: "h", text: "Obrir un tiquet" },
        {
          t: "p",
          text: "El botó obre un panell amb un formulari curt: un títol d'una línia, una categoria i la descripció. Es tanca amb Escape o tocant fora. També hi tens la pantalla completa a «Suport», amb el llistat sencer i un filtre per estat.",
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
        { t: "h", text: "Els estats" },
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
          text: "L'estat el mous tu no: el canvia qui atén el tiquet. Tu el veus. Els teus tiquets només els veus tu i qui desenvolupa l'app; els dels companys no.",
        },
      ],
    },

    // ─────────────────────────── 15 ───────────────────────────
    {
      id: "configuracio",
      title: "Configuració",
      blocks: [
        {
          t: "p",
          text: "Dues pestanyes: Notificacions i Contrasenya. És tot el que pots canviar tu del teu compte.",
        },
        { t: "h", text: "Notificacions" },
        {
          t: "p",
          text: "Quins avisos per correu vols rebre, agrupats per tema. Els que hi surten són els que et poden arribar a tu; els del client no hi són. Al capítol següent hi ha la llista sencera amb què és cadascun.",
        },
        { t: "h", text: "Contrasenya" },
        {
          t: "p",
          text: `Per canviar-la et demana l'actual i la nova dues vegades, amb un mínim de ${s.minPasswordLength} caràcters. La sessió no es tanca en canviar-la: segueixes a dins.`,
        },
        { t: "h", text: "El que es demana a l'administració" },
        {
          t: "p",
          text: "El teu nom, el correu d'accés, la foto i l'especialitat no es toquen des d'aquí. Els gestiona l'administració a la seva fitxa de professionals, i l'especialitat a més decideix quins serveis vénen marcats per defecte quan crees una franja de disponibilitat.",
        },
      ],
    },

    // ─────────────────────────── 16 ───────────────────────────
    {
      id: "correus",
      title: "Els correus que rebràs",
      blocks: [
        {
          t: "p",
          text: "Tot arriba al correu amb què entres a l'app. La columna «Es pot apagar?» diu si el pots desactivar des de Configuració → Notificacions.",
        },
        {
          t: "table",
          head: ["Avís", "Quan arriba", "Es pot apagar?"],
          rows: [
            [
              "Nova reserva d'un client",
              "Quan un client et reserva una sessió.",
              "Sí (ve encès)",
            ],
            [
              "Cancel·lació d'un client",
              "Quan un client cancel·la una sessió teva.",
              "Sí (ve encès)",
            ],
            [
              "Resum diari de l'agenda",
              `Cada tarda cap a les ${hhmm(s.reminderHourLocal)}, amb les sessions de l'endemà.`,
              "Sí (ve apagat)",
            ],
            ...(s.modules.sessionsProva
              ? [
                  [
                    "Nova sol·licitud de prova",
                    "Quan algú demana una sessió de prova en una franja teva.",
                    "Sí (ve apagat)",
                  ],
                ]
              : []),
            ...(s.modules.comunitat
              ? [
                  [
                    "Novetats de la comunitat",
                    "Quan es publica un anunci nou al tauler.",
                    "Sí (ve apagat)",
                  ],
                ]
              : []),
            [
              "Factura generada",
              "Quan l'administració tanca una liquidació teva i n'emet el document.",
              "No",
            ],
          ],
        },
        {
          t: "note",
          text: "La factura no es pot apagar a posta: és un avís sobre la teva pròpia retribució, no una comoditat.",
        },
        {
          t: "warn",
          text: "Si esperes un avís i no arriba, mira la carpeta de correu brossa abans de reportar-ho. És la causa de gairebé tots els casos.",
        },
      ],
    },

    // ─────────────────────────── 17 ───────────────────────────
    {
      id: "si-alguna-cosa-no-va",
      title: "Si alguna cosa no va",
      blocks: [
        { t: "h", text: "No em deixa crear una reserva a un client" },
        {
          t: "p",
          text: "Comprova que el client és teu —a la seva fitxa, que no hi surti «Només lectura»— i que té algun bo actiu amb sessions. Els clients sense bons disponibles no surten a la llista del formulari.",
        },
        { t: "h", text: "Un client diu que no pot reservar la seva hora" },
        {
          t: "p",
          text: "Mira la teva disponibilitat: si aquell dia i hora no hi ha cap franja, o hi ha un bloqueig a sobre, per a ell no existeix. Comprova també que la franja ofereixi el servei del seu bo.",
        },
        { t: "h", text: "No em surt el formulari de la nota d'una sessió" },
        {
          t: "p",
          text: "Passen dues coses sovint: que la sessió encara no s'hagi fet (les notes només surten a «Passades») o que la sessió la donés un company. La nota és de qui va donar la sessió.",
        },
        { t: "h", text: "Una franja meva surt ocupada i no sé per què" },
        {
          t: "p",
          text: s.modules.sessionsProva
            ? "Probablement hi ha una sol·licitud de sessió de prova esperant resposta: bloqueja la franja mentre no es contesta. Toca-la al calendari i respon-la."
            : "Repassa els bloquejos temporals a Disponibilitat: un bloqueig guanya sempre a l'horari setmanal.",
        },
        { t: "h", text: "Els números del meu bonus no quadren" },
        {
          t: "p",
          text: "L'estimació compta només les sessions marcades com a FETES. Si en falta alguna, busca-la a l'agenda i marca-la. I recorda que fins que l'administració no tanca el període, l'import no és definitiu.",
        },
        { t: "h", text: "Res del que hi ha aquí explica el que em passa" },
        {
          t: "p",
          text: "Obre un tiquet amb el botó de suport, categoria «Error», i explica on ho has vist i què esperaves. Si és una cosa del centre i no de l'app —un cobrament, un client mal assignat, un preu— va a l'administració.",
        },
      ],
    },

    // ─────────────────────────── 18 ───────────────────────────
    {
      id: "glossari",
      title: "Glossari",
      blocks: [
        {
          t: "dl",
          items: [
            [
              "Client assignat",
              "El que et té a tu com a professional. És l'única cartera que pots gestionar; la resta els pots consultar.",
            ],
            [
              "Bo",
              "Un paquet de sessions comprat per un client. Es descompta en crear la reserva, no en fer la sessió.",
            ],
            [
              "Sessió de cortesia",
              "Una sessió regalada: no descompta cap sessió de bo. En grup ocupa plaça igual.",
            ],
            [
              "Franja",
              "Una hora de la teva disponibilitat. El que un client pot triar per reservar.",
            ],
            [
              "Bloqueig",
              "Uns dies en què no hi ets, per damunt de l'horari setmanal. Vacances, una baixa, una tarda.",
            ],
            [
              "Aforament",
              `El màxim de persones d'una sessió de grup reduït: ${s.groupCapacity}.`,
            ],
            [
              "Nota de sessió",
              "El que s'apunta d'una sessió ja feta. L'escriu qui la va donar; la llegeixen l'equip i l'administració, no el client.",
            ],
            [
              "Liquidació",
              "El període tancat per l'administració amb les teves sessions completades, del qual surt la factura.",
            ],
            [
              "Unitat",
              "La mesura amb què es compta el bonus. Cada tipus de servei val les unitats que digui el centre.",
            ],
            [
              "Tram",
              "El graó del bonus on ets segons les unitats acumulades. Cada tram paga a un preu per unitat.",
            ],
            ...(s.modules.sessionsProva
              ? ([
                  [
                    "Sessió de prova",
                    "Una sessió gratuïta que demana algú que encara no és client. Bloqueja la franja fins que es respon.",
                  ],
                ] as [string, string][])
              : []),
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
