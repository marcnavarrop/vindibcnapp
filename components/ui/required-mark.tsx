/**
 * L'asterisc que marca un camp obligatori.
 *
 * Viu aquí i no dins de cada camp perquè el pinten `Field`, `SelectField`,
 * `TextAreaField` i `PasswordField`, i han de fer-ho exactament igual: mateix
 * color, mateix espai, mateixa mida. Amb quatre còpies, el dia que canviï el
 * to de taronja canviaria a tres llocs.
 *
 * `aria-hidden` a posta: el camp ja porta l'atribut `required` i és això el que
 * llegeix un lector de pantalla ("obligatori"). L'asterisc és la versió visual
 * de la mateixa informació, i anunciar-la dues vegades només fa soroll.
 */
export function RequiredMark() {
  return (
    <span aria-hidden className="ml-0.5 text-brand-orange">
      *
    </span>
  );
}

/**
 * La nota al peu que explica què vol dir l'asterisc.
 *
 * Un símbol sense llegenda no informa de res a qui no el doni per sabut. El
 * text arriba per propietat perquè els formularis del client van traduïts i
 * els de l'admin es queden en català.
 */
export function RequiredNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-brand-muted">
      <span aria-hidden className="text-brand-orange">
        *
      </span>{" "}
      {children}
    </p>
  );
}
