import { redirect } from "next/navigation";

/** El grup no té pàgina pròpia: entra per la primera pestanya. */
export default function FacturacioIndex() {
  redirect("/admin/facturacio/tarifes");
}
