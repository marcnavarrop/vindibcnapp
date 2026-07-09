/**
 * ⚠️ BORRADOR LEGAL — TEXT DE PARTIDA, NO DEFINITIU.
 * Pendent de revisió per un assessor legal. Cal confirmar l'inventari real de
 * cookies (només tècniques d'autenticació avui) abans de publicar.
 */
export const metadata = { title: "Política de Cookies · VindiBCN" };

export default function CookiesPage() {
  return (
    <>
      <h1 className="text-2xl text-brand-dark">Política de Cookies</h1>
      <p className="text-xs text-brand-muted">Versió 2026-06 (esborrany)</p>

      <h2 className="mt-4 text-lg font-bold text-brand-dark">
        1. Què són les cookies
      </h2>
      <p>
        Les cookies són petits fitxers que el navegador emmagatzema per fer
        funcionar un lloc web i recordar informació de la sessió.
      </p>

      <h2 className="mt-4 text-lg font-bold text-brand-dark">
        2. Quines fem servir
      </h2>
      <p>
        Actualment només fem servir <strong>cookies tècniques i necessàries</strong>{" "}
        per mantenir la sessió iniciada (autenticació de Supabase). No fem servir
        cookies de publicitat ni d&apos;analítica ni de tercers per a seguiment.
        [Confirmar l&apos;inventari real amb l&apos;assessor abans de publicar.]
      </p>

      <h2 className="mt-4 text-lg font-bold text-brand-dark">
        3. Base legal
      </h2>
      <p>
        Les cookies tècniques necessàries per prestar el servei no requereixen
        consentiment previ. Si en el futur s&apos;afegeixen cookies
        d&apos;analítica o màrqueting, es demanarà el consentiment mitjançant un
        bàner de cookies.
      </p>

      <h2 className="mt-4 text-lg font-bold text-brand-dark">
        4. Com gestionar-les
      </h2>
      <p>
        Pots configurar o eliminar les cookies des de les opcions del teu
        navegador. Tingues en compte que desactivar les cookies tècniques pot
        impedir iniciar sessió.
      </p>
    </>
  );
}
