/**
 * La LLISTA BLANCA del mode PRE: els tres comptes de demostració als quals
 * l'admin pot saltar. És CODI a posta (lib/pre-mode.ts ho explica): una llista
 * a la base la podria canviar qualsevol cosa amb permís d'escriptura.
 *
 * NO serveix per saber si un compte és demo: això ho diu `demo_profiles`
 * (lib/demo-accounts.ts, `getDemoWorld()`). Per saltar-hi, el compte ha de ser
 * aquí I a `demo_profiles` (0121): marcar un compte real com a demo no hi dona
 * accés, i treure'n un de la taula tanca el salt.
 *
 * Mòdul pur: també el fan servir els scripts de comprovació per posar aquests
 * comptes a la simulació amb els seus ids reals.
 */
export const PRE_ENTRENADOR_ID = "5119e112-74af-4c85-862b-829f6d726ea2";
export const PRE_FISIO_ID = "1c36928b-0668-4377-a5d8-c7befb2d78bc";
export const PRE_CLIENT_PROFILE_ID = "d3b42dcb-7c11-4431-abc0-723b21add106";
/** La fitxa `clients` del Client Demo (la porten les reserves i els bons). */
export const PRE_CLIENT_ID = "84fa4786-3307-48ce-9bbf-e45c49f2fe7e";
