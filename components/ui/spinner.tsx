/**
 * Rodeta d'espera. Un sol fitxer perquè totes les esperes de l'app es vegin
 * igual: si algun dia canvia el gruix o la velocitat, canvia a tot arreu.
 *
 * `currentColor`: hereta el color del botó on va, sense haver-lo de passar.
 */
export function Spinner({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      <path
        d="M21 12a9 9 0 00-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
