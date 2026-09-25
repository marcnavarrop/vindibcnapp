import {
  addDaysStr,
  centerDayStart,
  centerToday,
  centerWeekStart,
  parseWeekParam,
} from "@/lib/center-time";

/**
 * Quina part de l'agenda es carrega, llegida de la URL.
 *
 * L'agenda de l'equip (admin i professional) abans ho portava TOT i canviava
 * de setmana al navegador. Ara el servidor només en carrega una finestra, i la
 * finestra la diu la URL:
 *
 *   ?setmana=2026-09-21   la setmana del calendari (qualsevol dia serveix: es
 *                         porta al dilluns). Sense, la d'avui.
 *   ?dia=2026-09-25       el primer dia de la finestra de 3 dies del mòbil (la
 *                         rejilla del professional). Sense, avui; i si només hi
 *                         ha `setmana`, el dilluns d'aquella setmana. Amb `dia`
 *                         i sense `setmana`, la setmana és la del dia.
 *   ?vista=llista         la llista en comptes del calendari.
 *   ?enrere=60            dies enrere de la llista (per defecte 30).
 *   ?endavant=60          dies endavant de la llista (per defecte 30).
 *
 * Tots els enllaços de navegació surten d'aquí ja fets, perquè el navegador
 * no hagi de saber res de dies del centre.
 */

export type AgendaView = "calendar" | "list";

/** Dies de la llista per defecte, i el que afegeix cada "Veure'n més". */
export const LIST_STEP_DAYS = 30;
/** Sostre de la llista: un any cap a cada banda. Més, i es torna a l'històric sencer. */
const LIST_MAX_DAYS = 365;

export type AgendaNav = {
  view: AgendaView;
  /** Dilluns de la setmana del calendari (YYYY-MM-DD, dia del centre). */
  weekStart: string;
  /** Dies de la llista cap enrere i cap endavant. */
  back: number;
  ahead: number;
  /** És la setmana d'avui? Per no oferir "Avui" on ja s'és. */
  isCurrentWeek: boolean;
  /**
   * Primer dia de la finestra del mòbil (YYYY-MM-DD). La finestra salta el cap
   * de setmana buit, així que els dies que es veuen els decideix la rejilla:
   * aquí només es carreguen prou dies perquè en tingui.
   */
  dayStart: string;
  /** Avui, en dia del centre: la rejilla hi obre i hi posa la línia d'ara. */
  today: string;
  /** Ruta de la pàgina, per construir els enllaços de la finestra del mòbil. */
  basePath: string;
  href: {
    calendar: string;
    list: string;
    prevWeek: string;
    nextWeek: string;
    today: string;
    moreBack: string | null;
    moreAhead: string | null;
  };
};

export type AgendaWindow = {
  nav: AgendaNav;
  /** Finestra de la consulta, `[from, to)`, en instants reals. */
  from: Date;
  to: Date;
};

type Params = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Dies d'un paràmetre de la llista: múltiple de 30, entre 30 i 365. */
function daysParam(v: string | string[] | undefined): number {
  const n = Number.parseInt(first(v) ?? "", 10);
  if (!Number.isFinite(n) || n < LIST_STEP_DAYS) return LIST_STEP_DAYS;
  return Math.min(LIST_MAX_DAYS, Math.ceil(n / LIST_STEP_DAYS) * LIST_STEP_DAYS);
}

function href(
  base: string,
  p: { vista?: AgendaView; setmana?: string; enrere?: number; endavant?: number },
): string {
  const q = new URLSearchParams();
  if (p.vista === "list") q.set("vista", "llista");
  if (p.setmana) q.set("setmana", p.setmana);
  if (p.enrere && p.enrere !== LIST_STEP_DAYS) q.set("enrere", String(p.enrere));
  if (p.endavant && p.endavant !== LIST_STEP_DAYS) q.set("endavant", String(p.endavant));
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

export function agendaWindow(basePath: string, params: Params): AgendaWindow {
  const view: AgendaView = first(params.vista) === "llista" ? "list" : "calendar";
  const today = centerToday();
  const currentWeek = centerWeekStart(today);
  const dia = parseDayParam(params.dia);
  // Amb `dia` i sense `setmana`, la setmana és la del dia: l'escriptori i el
  // mòbil miren el mateix tros de calendari.
  const weekStart =
    dia && !first(params.setmana) ? centerWeekStart(dia) : parseWeekParam(params.setmana);
  const dayStart =
    dia ?? (weekStart === currentWeek ? today : weekStart);
  const back = daysParam(params.enrere);
  const ahead = daysParam(params.endavant);

  // La setmana només va a la URL quan no és la d'avui: així "Avui" és
  // l'adreça neta de sempre, i un enllaç desat no queda clavat a una data.
  const weekParam = weekStart === currentWeek ? undefined : weekStart;

  const nav: AgendaNav = {
    view,
    weekStart,
    back,
    ahead,
    isCurrentWeek: weekStart === currentWeek,
    dayStart,
    today,
    basePath,
    href: {
      calendar: href(basePath, { setmana: weekParam }),
      list: href(basePath, { vista: "list", enrere: back, endavant: ahead }),
      prevWeek: href(basePath, { setmana: addDaysStr(weekStart, -7) }),
      nextWeek: href(basePath, { setmana: addDaysStr(weekStart, 7) }),
      today: href(basePath, {}),
      moreBack:
        back < LIST_MAX_DAYS
          ? href(basePath, { vista: "list", enrere: back + LIST_STEP_DAYS, endavant: ahead })
          : null,
      moreAhead:
        ahead < LIST_MAX_DAYS
          ? href(basePath, { vista: "list", enrere: back, endavant: ahead + LIST_STEP_DAYS })
          : null,
    },
  };

  if (view === "list") {
    return {
      nav,
      from: centerDayStart(addDaysStr(today, -back)),
      // Fins al final del darrer dia, inclòs.
      to: centerDayStart(addDaysStr(today, ahead + 1)),
    };
  }

  // El calendari pinta la setmana en l'hora del NAVEGADOR (com sempre ho ha
  // fet), i la finestra és en la del centre. Un dia de marge a cada banda fa
  // que qui l'obri des d'una altra zona no perdi les sessions de les vores; el
  // calendari ja descarta el que queda fora de la seva setmana.
  //
  // La finestra del mòbil pot sortir de la setmana (dv, dl, dt): es carrega la
  // unió de totes dues. Deu dies des de `dayStart` n'hi ha de sobres per trobar
  // tres dies que es vegin, encara que se salti un cap de setmana.
  const from = weekStart < dayStart ? weekStart : dayStart;
  const weekEnd = addDaysStr(weekStart, 8);
  const dayEnd = addDaysStr(dayStart, 10);
  return {
    nav,
    from: centerDayStart(addDaysStr(from, -1)),
    to: centerDayStart(weekEnd > dayEnd ? weekEnd : dayEnd),
  };
}

/** `?dia=`: una data de debò o res (un enllaç mal copiat obre avui). */
function parseDayParam(value: string | string[] | undefined): string | null {
  const v = first(value);
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return null;
  return v;
}
