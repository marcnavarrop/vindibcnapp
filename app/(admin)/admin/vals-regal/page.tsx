import Link from "next/link";
import { listGiftVouchersAdmin } from "@/lib/data/gift-vouchers";
import { getCenterSettings } from "@/lib/data/center-settings";
import { GiftVouchersAdminTable } from "@/components/gift-vouchers-admin-table";
import { GroupTabs } from "@/components/ui/group-tabs";
import { BONS_TABS } from "@/lib/admin-tabs";

export const dynamic = "force-dynamic";

/**
 * La pantalla NO es tanca quan el mòdul està desactivat, a diferència de la de
 * compra: si el centre deixa de vendre vals amb algun de venut per bescanviar,
 * l'admin ha de poder continuar cobrant-los i consultant-los. Amagar-la
 * deixaria diners cobrats sense cap pantalla on gestionar-los.
 */
export default async function AdminGiftVouchersPage() {
  const [vouchers, settings] = await Promise.all([
    listGiftVouchersAdmin(),
    getCenterSettings(),
  ]);

  return (
    <>
      <GroupTabs tabs={BONS_TABS} />
      <main className="mx-auto max-w-6xl p-6">
        <Link
          href="/admin"
          className="text-xs font-bold tracking-wide text-brand-muted uppercase hover:text-brand-purple"
        >
          ← Tornar
        </Link>
        <h1 className="mt-1 mb-1 text-2xl text-brand-dark">Vals de regal</h1>
        <p className="mb-6 text-sm text-brand-muted">
          Un val no es pot bescanviar fins que el marques com a pagat.
        </p>

        {!settings.giftVouchersEnabled && (
          <p className="mb-6 rounded-2xl border border-brand-orange/40 bg-brand-orange/5 p-4 text-sm text-brand-charcoal">
            <strong className="text-brand-orange">
              La venda de vals està desactivada.
            </strong>{" "}
            Els clients no en poden comprar de nous, però els que ja hi ha
            continuen sent vàlids i es poden cobrar i bescanviar. Ho pots tornar
            a activar a{" "}
            <Link
              href="/admin/configuracio"
              className="font-bold text-brand-purple underline hover:text-brand-orange"
            >
              Configuració → Centre
            </Link>
            .
          </p>
        )}

        <GiftVouchersAdminTable vouchers={vouchers} />
      </main>
    </>
  );
}
