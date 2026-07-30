import { assertModuleEnabled } from "@/lib/data/module-guard";

/**
 * Protegeix TOT el subarbre de Comunitat d'una sola vegada, incloent-hi les
 * pàgines que són client components (i que per tant no poden cridar el guard
 * elles mateixes) i qualsevol ruta nova que s'hi afegeixi.
 */
export default async function CommunityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertModuleEnabled("comunitat");
  return <>{children}</>;
}
