/**
 * LA GEOMETRIA DE LA REJILLA DEL PROFESSIONAL (components/trainer-grid.tsx).
 *
 * Aquí no hi ha React ni dades del servidor: només les decisions de "què es
 * veu i on", perquè es puguin comprovar soles (`npm run grid:check`).
 *
 *   1. Quins dies surten (el cap de setmana buit, fora).
 *   2. Quines hores surten (els trams buits, plegats en una banda fina).
 *   3. Com es reparteixen l'amplada les sessions que coincideixen (la
 *      degradació per densitat).
 *
 * L'ESCALA
 *
 * Una sessió de 60 minuts fa 80 px d'alt: un sol bloc, no dues files. És la
 * mida que deixa cabre l'hora, el nom i el servei a 12 px sense tallar res, i
 * alhora és prou alta per a una zona tàctil de 44 px. Mitja hora són 40 px.
 */

export const SLOT_PX = 40;
/** Alçada d'un tram plegat, sigui de la llargada que sigui. */
export const FOLD_PX = 28;
/** Un tram buit es plega a partir de dues hores; de menys, es veu. */
export const FOLD_MIN_SLOTS = 4;

/** Cap de setmana, amb el dilluns com a 0 (com `weekdayOf`). */
export function isWeekend(weekday: number): boolean {
  return weekday >= 5;
}

/**
 * Els dies que es veuen d'entre uns candidats.
 *
 * Els feiners, sempre. Dissabte i diumenge, només si hi ha alguna cosa (una
 * reserva, una prova o disponibilitat pròpia) o si s'ha demanat veure-ho tot.
 * Un dimecres buit segueix sortint: que un dia feiner desaparegués faria
 * dubtar de si la setmana està sencera.
 */
export function visibleDays<T>(
  candidates: T[],
  weekdayOf: (d: T) => number,
  hasSomething: (d: T) => boolean,
  showAll: boolean,
): T[] {
  return candidates.filter(
    (d) => showAll || !isWeekend(weekdayOf(d)) || hasSomething(d),
  );
}

export type Segment =
  | { kind: "hours"; from: number; to: number; top: number }
  | { kind: "fold"; from: number; to: number; top: number };

export type VerticalLayout = {
  segments: Segment[];
  /** Primer i últim slot (exclusiu) que es pinten. */
  from: number;
  to: number;
  height: number;
  /** Posició vertical (px) d'un instant, en slots amb decimals. */
  y: (slot: number) => number;
};

/**
 * Les hores que surten, i on cau cada instant.
 *
 * `active` són els slots de mitja hora on passa alguna cosa en algun dels dies
 * visibles: disponibilitat pròpia, sessions o proves. Es pinta del primer al
 * darrer, i cada tram buit d'almenys `FOLD_MIN_SLOTS` es plega en una banda
 * fina («fora de la jornada»). Sense res actiu, l'horari del centre.
 *
 * Amb `showAll`, l'horari del centre sencer (ampliat si hi ha res a fora) i
 * sense plegar res: és el «Mostrar-ho tot».
 */
export function verticalLayout(
  active: Set<number>,
  centerFrom: number,
  centerTo: number,
  showAll: boolean,
): VerticalLayout {
  const act = [...active].sort((a, b) => a - b);
  let from: number;
  let to: number;
  if (showAll || act.length === 0) {
    from = Math.min(centerFrom, act[0] ?? centerFrom);
    to = Math.max(centerTo, (act[act.length - 1] ?? centerTo - 1) + 1);
  } else {
    // Es comença i s'acaba en hora en punt: una rejilla que arrenca a les 9:30
    // es llegeix malament.
    from = act[0] - (act[0] % 2);
    const last = act[act.length - 1] + 1;
    to = last + (last % 2);
  }

  // Trams alterns d'actiu i d'inactiu; un d'inactiu prou llarg es plega.
  const segments: Segment[] = [];
  let top = 0;
  let s = from;
  while (s < to) {
    const inactive = !active.has(s);
    let e = s;
    while (e < to && !active.has(e) === inactive) e++;
    if (!showAll && inactive && e - s >= FOLD_MIN_SLOTS) {
      segments.push({ kind: "fold", from: s, to: e, top });
      top += FOLD_PX;
    } else {
      const last = segments[segments.length - 1];
      if (last && last.kind === "hours") last.to = e;
      else segments.push({ kind: "hours", from: s, to: e, top });
      top += (e - s) * SLOT_PX;
    }
    s = e;
  }

  const y = (slot: number): number => {
    if (slot <= from) return 0;
    for (const g of segments) {
      if (slot < g.to || g === segments[segments.length - 1]) {
        const within = Math.min(slot, g.to) - g.from;
        return g.kind === "hours"
          ? g.top + within * SLOT_PX
          : g.top + (within / (g.to - g.from)) * FOLD_PX;
      }
    }
    return top;
  };
  return { segments, from, to, height: top, y };
}

/**
 * LA DEGRADACIÓ PER DENSITAT.
 *
 * Les coses que coincideixen en una columna (sessions, grups, proves) formen
 * un grup de solapament, i segons quantes n'hi ha es pinten d'una manera:
 *
 *   1. Una sola: tota l'amplada, amb l'hora, el nom i el servei.
 *   2. Dues: meitat i meitat, amb la inicial i la icona del servei.
 *   3. Tres o més: la pròpia es queda visible (si n'hi ha) i la resta s'agrupa
 *      en «+N», que obre la llista d'aquella hora.
 *
 * Mai es talla text ni es fa una zona tàctil de menys de 44 px: el que no hi
 * cap no s'encongeix, es resumeix.
 */
export type DensityItem = {
  id: string;
  start: number; // ms
  end: number; // ms
  own: boolean;
};

export type Placed =
  | { kind: "item"; id: string; level: 1 | 2 | 3; lane: 0 | 1; lanes: 1 | 2 }
  | { kind: "more"; ids: string[]; start: number; end: number; lane: 0 | 1; lanes: 1 | 2 };

export function placeByDensity(items: DensityItem[]): Placed[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end);
  // Grups de solapament: es tallen quan el següent comença després que tots
  // els d'abans hagin acabat.
  const clusters: DensityItem[][] = [];
  let cur: DensityItem[] = [];
  let curEnd = -Infinity;
  for (const it of sorted) {
    if (cur.length && it.start >= curEnd) {
      clusters.push(cur);
      cur = [];
      curEnd = -Infinity;
    }
    cur.push(it);
    curEnd = Math.max(curEnd, it.end);
  }
  if (cur.length) clusters.push(cur);

  const out: Placed[] = [];
  for (const c of clusters) {
    if (c.length === 1) {
      out.push({ kind: "item", id: c[0].id, level: 1, lane: 0, lanes: 1 });
    } else if (c.length === 2) {
      c.forEach((it, i) =>
        out.push({ kind: "item", id: it.id, level: 2, lane: i as 0 | 1, lanes: 2 }),
      );
    } else {
      const own = c.find((it) => it.own);
      const rest = c.filter((it) => it !== own);
      const start = Math.min(...rest.map((r) => r.start));
      const end = Math.max(...rest.map((r) => r.end));
      if (own) {
        out.push({ kind: "item", id: own.id, level: 3, lane: 0, lanes: 2 });
        out.push({ kind: "more", ids: rest.map((r) => r.id), start, end, lane: 1, lanes: 2 });
      } else {
        out.push({ kind: "more", ids: rest.map((r) => r.id), start, end, lane: 0, lanes: 1 });
      }
    }
  }
  return out;
}
