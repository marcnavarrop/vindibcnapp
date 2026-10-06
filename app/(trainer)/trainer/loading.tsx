import { SkeletonPage } from "@/components/ui/skeleton";

/**
 * Estat de càrrega de tota l'àrea del professional: el mateix criteri que el
 * de l'administració (vegeu `app/(admin)/admin/loading.tsx`), i per la mateixa
 * raó, un de sol per a l'àrea i no un per pantalla.
 */
export default function TrainerLoading() {
  return <SkeletonPage />;
}
