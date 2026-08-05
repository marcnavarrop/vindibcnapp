/* eslint-disable @next/next/no-img-element */
import { clsx } from "@/lib/utils";

/**
 * Foto de perfil amb la inicial de reserva.
 *
 * Un sol component per als tres llocs on es mostra (sidebar, llegenda del
 * calendari i llistat d'entrenadors) perquè el cas "encara no té foto" es
 * resolgui igual a tot arreu: el cercle amb la inicial d'abans, mai un forat.
 *
 * S'usa <img> i no next/image a propòsit: la font és una signed URL de
 * Supabase que caduca i canvia a cada render, així que no hi ha res a
 * optimitzar ni a cachejar, i configurar-ne el domini remot només afegiria
 * feina per no guanyar res.
 */
export function Avatar({
  name,
  email = "",
  url,
  size = 36,
  color,
  className,
}: {
  name: string;
  /** Alternativa per treure la inicial si no hi ha nom. */
  email?: string;
  /** Signed URL. Si falta, es pinta la inicial. */
  url?: string | null;
  size?: number;
  /** Fons de la inicial. Per defecte, el taronja de marca. */
  color?: string;
  className?: string;
}) {
  const src = (name || email).trim();
  const initial = src ? src[0].toUpperCase() : "?";
  const box = { width: size, height: size };

  if (url)
    return (
      <img
        src={url}
        alt=""
        aria-hidden
        style={box}
        className={clsx("shrink-0 rounded-full object-cover", className)}
      />
    );

  return (
    <div
      aria-hidden
      style={{ ...box, backgroundColor: color ?? "var(--color-brand-orange)" }}
      className={clsx(
        "flex shrink-0 items-center justify-center rounded-full font-bold text-white",
        className,
      )}
    >
      <span style={{ fontSize: Math.round(size * 0.42) }}>{initial}</span>
    </div>
  );
}
