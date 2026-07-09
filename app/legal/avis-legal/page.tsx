/**
 * ⚠️ BORRADOR LEGAL — TEXT DE PARTIDA, NO DEFINITIU.
 * Pendent de revisió per un assessor legal. Ompliu els [CLAUDÀTORS].
 */
export const metadata = { title: "Avís Legal · VindiBCN" };

export default function AvisLegalPage() {
  return (
    <>
      <h1 className="text-2xl text-brand-dark">Avís Legal</h1>
      <p className="text-xs text-brand-muted">Versió 2026-06 (esborrany)</p>

      <h2 className="mt-4 text-lg font-bold text-brand-dark">
        1. Titular
      </h2>
      <p>
        Aquest lloc web és titularitat de [NOM_RESPONSABLE], amb NIF [NIF] i
        domicili a [ADREÇA]. Contacte: [EMAIL_CONTACTE].
      </p>

      <h2 className="mt-4 text-lg font-bold text-brand-dark">
        2. Objecte
      </h2>
      <p>
        Aquest lloc ofereix la gestió de serveis d&apos;entrenament personal i
        fisioteràpia (reserves, bons i seguiment) per als clients del centre.
      </p>

      <h2 className="mt-4 text-lg font-bold text-brand-dark">
        3. Condicions d&apos;ús
      </h2>
      <p>
        L&apos;usuari es compromet a fer un ús adequat dels continguts i
        serveis, a no emprar-los per a activitats il·lícites i a mantenir la
        confidencialitat de les seves credencials d&apos;accés.
      </p>

      <h2 className="mt-4 text-lg font-bold text-brand-dark">
        4. Propietat intel·lectual
      </h2>
      <p>
        Els continguts, marques i elements del lloc pertanyen al titular o a
        tercers que n&apos;han autoritzat l&apos;ús, i estan protegits per la
        normativa de propietat intel·lectual i industrial.
      </p>

      <h2 className="mt-4 text-lg font-bold text-brand-dark">
        5. Responsabilitat
      </h2>
      <p>
        El titular no es fa responsable dels danys derivats d&apos;un ús
        indegut del lloc ni de les interrupcions per causes tècniques alienes al
        seu control. [A concretar amb l&apos;assessor.]
      </p>

      <h2 className="mt-4 text-lg font-bold text-brand-dark">
        6. Legislació aplicable
      </h2>
      <p>
        Aquestes condicions es regeixen per la legislació espanyola. Per a
        qualsevol controvèrsia, les parts se sotmeten als jutjats i tribunals de
        [Barcelona], llevat que la normativa de consum estableixi un altre fur.
      </p>
    </>
  );
}
