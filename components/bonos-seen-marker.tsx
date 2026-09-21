"use client";

import { useEffect } from "react";
import { announceBonosSeen } from "@/lib/bono-events";

/**
 * Silencia la piloteta de «Bons» mentre el client és a «Els meus bons».
 *
 * VA A /client/bonos/meus I NO A /client/bonos
 *
 * L'entrada del menú apunta a `/client/bonos`, que és la pestanya de COMPRAR:
 * allà no es veu cap bo pendent. Apagar la piloteta en una pantalla que no
 * ensenya el que reclama seria apagar-la a cegues. Aquí, en canvi, els bons
 * pendents es veuen i es poden pagar.
 *
 * No pinta res i no desa res: només avisa. La piloteta es torna a comptar al
 * pròxim muntatge del menú, que és el que ha de passar mentre el bo segueixi
 * sense pagar.
 */
export function BonosSeenMarker() {
  useEffect(() => {
    announceBonosSeen(0);
  }, []);

  return null;
}
