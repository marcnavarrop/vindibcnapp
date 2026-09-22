"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

/**
 * El número d'una piloteta del menú, compartit per totes les seves còpies.
 *
 * PER QUÈ NO POT SER `useState`
 *
 * Perquè del mateix menú n'hi ha DUES còpies muntades alhora. L'`<aside>`
 * d'escriptori és `hidden lg:flex`: en mòbil és `display:none`, però React el
 * munta igual. I el calaix lliscant torna a pintar `SidebarContent` sencer
 * quan s'obre. Són dos arbres germans, cadascun amb la seva piloteta.
 *
 * Amb el número desat a l'estat de cada còpia, la que es munta més tard
 * estrena el valor de la càrrega de la pàgina i no sap res del que ha passat
 * després: entres a Comunitat (la piloteta de l'`<aside>` s'apaga), obres el
 * menú, i el calaix t'ensenya el número vell. Un magatzem de mòdul no té
 * aquest problema —totes les còpies llegeixen el mateix— i és, de fet, el que
 * arregla que avui les dues no es posin d'acord.
 *
 * LA REGLA DE QUI MANA
 *
 * Si el magatzem té valor, mana ell; si no, mana el `initial` que arriba del
 * servidor. En aquest ordre i no al revés: el `initial` és la foto del moment
 * en què el layout es va renderitzar, i qualsevol avís posterior és més nou
 * que ell per definició.
 *
 * El `initial` es llegeix a CADA render i no només al primer, i això no és
 * descuit. `AppShell` és el layout i no es torna a renderitzar en navegar
 * —ho vam comprovar al payload RSC: la ranura del layout torna `null`—, així
 * que a la pràctica arriba una vegada per càrrega. Però si algun dia un
 * `revalidatePath` el repinta, el número nou entra sol mentre no hi hagi
 * hagut cap avís. Surt gratis i no pot fer mal.
 */

/** Quina piloteta. Afegir-ne una és afegir una clau aquí. */
export type BadgeKey = "community" | "bonos" | "exercicis";

const values = new Map<BadgeKey, number>();
const subscribers = new Map<BadgeKey, Set<() => void>>();

/**
 * Diu quant val ara una piloteta.
 *
 * Un número negatiu vol dir «el marcatge ha fallat» i s'ignora: val més
 * deixar-la com estava que apagar-la mentint. És el mateix criteri que ja
 * tenia `markCommunitySeenAction` quan tornava -1.
 */
export function setBadge(key: BadgeKey, count: number): void {
  if (!Number.isFinite(count) || count < 0) return;
  if (values.get(key) === count) return;
  values.set(key, count);
  subscribers.get(key)?.forEach((notify) => notify());
}

function subscribe(key: BadgeKey, notify: () => void): () => void {
  let set = subscribers.get(key);
  if (!set) {
    set = new Set();
    subscribers.set(key, set);
  }
  set.add(notify);
  return () => {
    set.delete(notify);
    if (set.size === 0) subscribers.delete(key);
  };
}

/**
 * El número d'una piloteta, partint del que ha calculat el servidor.
 *
 * `getServerSnapshot` torna el `initial` tal qual, que és el que fa que la
 * hidratació quadri: al primer render del navegador el magatzem encara és
 * buit, o sigui que `getSnapshot` torna exactament el mateix.
 */
export function useBadgeCount(key: BadgeKey, initial: number): number {
  const sub = useCallback((notify: () => void) => subscribe(key, notify), [key]);
  return useSyncExternalStore(
    sub,
    () => values.get(key) ?? initial,
    () => initial,
  );
}

/**
 * Escolta un avís de `window` i hi actualitza la piloteta.
 *
 * L'avís segueix anant per `window` i no per un context de React pel motiu de
 * sempre: qui l'engega (el marcador d'una pàgina) i qui l'escolta (el menú) no
 * comparteixen cap pare que no sigui l'arrel.
 *
 * `read` es guarda en una `ref` perquè els que criden puguin passar una fletxa
 * escrita a la vora sense que l'escolta es doni d'alta i de baixa a cada
 * render.
 */
export function useBadgeEvent<TDetail>(
  event: string,
  key: BadgeKey,
  read: (detail: TDetail | undefined) => number | undefined,
): void {
  const readRef = useRef(read);
  readRef.current = read;

  useEffect(() => {
    const onEvent = (e: Event) => {
      const count = readRef.current((e as CustomEvent<TDetail>).detail);
      if (typeof count === "number") setBadge(key, count);
    };
    window.addEventListener(event, onEvent);
    return () => window.removeEventListener(event, onEvent);
  }, [event, key]);
}
