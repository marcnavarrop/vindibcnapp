"use client";

import { useEffect, useState } from "react";

/**
 * Icona animada de resultat: un cercle que entra amb un petit rebot amb el
 * tic verd o la creu vermella.
 *
 * Vivia duplicada, idèntica, al calendari del client i al de l'equip. Ara és
 * una de sola perquè el "fet!" es vegi igual a tot arreu: també a la compra
 * d'un bo, que abans se'n sortia amb un text pla.
 */
export function AnimatedFeedback({ type }: { type: "success" | "cancel" }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 10);
    return () => clearTimeout(t);
  }, []);
  const isOk = type === "success";
  const color = isOk ? "#16a34a" : "#ef4444";
  const bg = isOk ? "#dcfce7" : "#fee2e2";
  return (
    <div
      style={{
        width: 72,
        height: 72,
        borderRadius: "50%",
        backgroundColor: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: mounted ? "scale(1)" : "scale(0.35)",
        opacity: mounted ? 1 : 0,
        transition:
          "transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s ease",
      }}
    >
      {isOk ? (
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" aria-hidden>
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      )}
    </div>
  );
}
