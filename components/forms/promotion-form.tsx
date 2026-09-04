"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Field } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { SERVICE_LABELS, SERVICE_TYPES } from "@/lib/labels";
import type { Promotion } from "@/lib/data/promotions";
import type { ClientTag } from "@/lib/data/client-tags";
import type { Service } from "@/lib/data/services";
import type { PromotionAudience, ServiceType } from "@/types/database";
import type { OfertaFormState } from "@/app/(admin)/admin/ofertes/actions";
import { TAP } from "@/lib/utils";

export function PromotionForm({
  action,
  cancelHref,
  services,
  tags,
  initial,
}: {
  action: (prev: OfertaFormState, fd: FormData) => Promise<OfertaFormState>;
  cancelHref: string;
  services: Service[];
  /** Catàleg d'etiquetes, per al públic "clients amb una etiqueta". */
  tags: ClientTag[];
  initial?: Promotion;
}) {
  const [state, formAction] = useActionState(action, {});
  const [scope, setScope] = useState<"service" | "package">(
    initial?.scope ?? "service",
  );
  const [discountType, setDiscountType] = useState<"percentage" | "fixed_amount">(
    initial?.discountType ?? "percentage",
  );

  // Estat dels checkboxes de servei
  const [checkedTypes, setCheckedTypes] = useState<Set<ServiceType>>(
    () => new Set(initial?.serviceTypes ?? []),
  );
  // Estat dels checkboxes de paquet
  const [checkedIds, setCheckedIds] = useState<Set<string>>(
    () => new Set(initial?.serviceIds ?? []),
  );

  // Públic de l'oferta (0069). Mateix patró que `scope`: un select que decideix
  // quin camp secundari apareix, i en canviar-lo es neteja el de l'altra branca.
  const [audience, setAudience] = useState<PromotionAudience>(
    initial?.audience ?? "all",
  );
  const [audienceTagId, setAudienceTagId] = useState<string>(
    initial?.audienceTagId ?? "",
  );
  const [audienceServiceType, setAudienceServiceType] = useState<string>(
    initial?.audienceServiceType ?? "",
  );

  function handleAudienceChange(v: PromotionAudience) {
    setAudience(v);
    if (v !== "tag") setAudienceTagId("");
    if (v !== "active_bono") setAudienceServiceType("");
  }

  const [showOverlap, setShowOverlap] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setShowOverlap(new URLSearchParams(window.location.search).get("overlap") === "1");
    }
  }, []);

  // Quan canvia l'àmbit, neteja la selecció oposada
  function handleScopeChange(v: "service" | "package") {
    setScope(v);
    if (v === "service") setCheckedIds(new Set());
    else setCheckedTypes(new Set());
  }

  function toggleType(t: ServiceType) {
    setCheckedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  function toggleId(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Agrupar serveis per tipus per mostrar-los seccionats
  const servicesByType = SERVICE_TYPES.map((t) => ({
    type: t,
    services: services.filter((s) => s.serviceType === t),
  })).filter((g) => g.services.length > 0);

  return (
    <form
      action={formAction}
      className="flex max-w-xl flex-col gap-5 rounded-2xl border border-brand-border bg-white p-6"
    >
      {showOverlap && (
        <div className="rounded-xl border border-brand-orange/30 bg-brand-orange/10 px-4 py-3 text-sm text-brand-orange">
          Ja hi ha una altra oferta activa que es superposa per a algun d&apos;aquests
          serveis/paquets en les mateixes dates. S&apos;ha creat igualment — assegura&apos;t
          que és la teva intenció.
        </div>
      )}

      <Field
        label="Nom intern"
        name="name"
        required
        placeholder="ex. Descompte d'estiu"
        defaultValue={initial?.name}
      />

      <div className="grid grid-cols-2 gap-4">
        <SelectField
          label="Tipus de descompte"
          name="discountType"
          value={discountType}
          onChange={(e) =>
            setDiscountType(e.target.value as "percentage" | "fixed_amount")
          }
          options={[
            { value: "percentage", label: "Percentatge (%)" },
            { value: "fixed_amount", label: "Import fix (€)" },
          ]}
        />
        <Field
          label={discountType === "percentage" ? "Valor (%)" : "Valor (€)"}
          name="discountValue"
          type="number"
          min={0.01}
          max={discountType === "percentage" ? 100 : undefined}
          step="0.01"
          required
          defaultValue={initial?.discountValue}
        />
      </div>

      <SelectField
        label="Àmbit"
        name="scope"
        value={scope}
        onChange={(e) => handleScopeChange(e.target.value as "service" | "package")}
        options={[
          { value: "service", label: "Tot un tipus de servei" },
          { value: "package", label: "Paquet concret" },
        ]}
      />

      {scope === "service" && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-bold text-brand-dark">
            Tipus de servei afectat
            <span className="ml-1 text-xs font-normal text-brand-muted">
              (selecciona un o més)
            </span>
          </legend>
          {SERVICE_TYPES.map((t) => (
            <label key={t} className="flex cursor-pointer items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="serviceType"
                value={t}
                checked={checkedTypes.has(t)}
                onChange={() => toggleType(t)}
                className="h-4 w-4 rounded border-brand-border accent-brand-purple"
              />
              {SERVICE_LABELS[t]}
            </label>
          ))}
          {checkedTypes.size === 0 && (
            <p className="text-xs text-brand-muted">Selecciona almenys un servei.</p>
          )}
        </fieldset>
      )}

      {scope === "package" && (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-bold text-brand-dark">
            Paquets afectats
            <span className="ml-1 text-xs font-normal text-brand-muted">
              (selecciona un o més)
            </span>
          </legend>
          {servicesByType.map((group) => (
            <div key={group.type}>
              <p className="mb-1 text-xs font-bold tracking-wide text-brand-muted uppercase">
                {SERVICE_LABELS[group.type]}
              </p>
              <div className="flex flex-col gap-1 pl-2">
                {group.services.map((s) => (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center gap-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="serviceId"
                      value={s.id}
                      checked={checkedIds.has(s.id)}
                      onChange={() => toggleId(s.id)}
                      className="h-4 w-4 rounded border-brand-border accent-brand-purple"
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>
          ))}
          {checkedIds.size === 0 && (
            <p className="text-xs text-brand-muted">Selecciona almenys un paquet.</p>
          )}
        </fieldset>
      )}

      {/*
        Segon eix de l'oferta: l'àmbit de dalt diu QUÈ rebaixa, això diu A QUI.
        Per defecte, a tothom —que és com es comportaven totes les ofertes abans
        de la 0069 i com segueixen comportant-se les que ja hi havia.
      */}
      <div className="flex flex-col gap-4 rounded-xl border border-brand-border bg-brand-bg p-4">
        <SelectField
          label="Per a qui"
          name="audience"
          value={audience}
          onChange={(e) => handleAudienceChange(e.target.value as PromotionAudience)}
          options={[
            { value: "all", label: "Tothom" },
            { value: "tag", label: "Clients amb una etiqueta" },
            { value: "active_bono", label: "Clients amb un bo actiu" },
          ]}
        />

        {audience === "tag" &&
          (tags.length === 0 ? (
            <p className="text-xs text-brand-orange">
              Encara no hi ha cap etiqueta. Crea&apos;n una a{" "}
              <Link href="/admin/etiquetes" className={`font-bold underline ${TAP}`}>
                Etiquetes de client
              </Link>{" "}
              i torna aquí.
            </p>
          ) : (
            <SelectField
              label="Etiqueta"
              name="audienceTagId"
              value={audienceTagId}
              onChange={(e) => setAudienceTagId(e.target.value)}
              options={[
                { value: "", label: "— Tria una etiqueta —" },
                ...tags.map((t) => ({ value: t.id, label: t.name })),
              ]}
            />
          ))}

        {audience === "active_bono" && (
          <>
            <SelectField
              label="Amb un bo actiu de"
              name="audienceServiceType"
              value={audienceServiceType}
              onChange={(e) => setAudienceServiceType(e.target.value)}
              options={[
                { value: "", label: "— Tria un tipus de servei —" },
                ...SERVICE_TYPES.map((t) => ({ value: t, label: SERVICE_LABELS[t] })),
              ]}
            />
            {/*
              "Tipus de servei" i no "paquet" perquè un bo guarda el tipus i no
              de quin paquet del catàleg va sortir. Dir-ho aquí evita que algú
              busqui una llista de paquets que no pot existir.
            */}
            <p className="text-xs text-brand-muted">
              Un bo compta si està actiu i no ha caducat. Els bons pendents de
              pagament no obren l&apos;oferta.
            </p>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Data d'inici"
          name="startsAt"
          type="date"
          required
          defaultValue={initial?.startsAt}
        />
        <Field
          label="Data de fi"
          name="endsAt"
          type="date"
          required
          defaultValue={initial?.endsAt}
        />
      </div>

      <input
        type="hidden"
        name="active"
        value={initial?.active === false ? "false" : "true"}
      />

      {state.error && <p className="text-sm text-error">{state.error}</p>}

      <div className="flex items-center gap-3">
        <SubmitButton>{initial ? "Desar canvis" : "Crear oferta"}</SubmitButton>
        <Link
          href={cancelHref}
          className={`text-sm font-bold text-brand-muted hover:text-brand-purple ${TAP}`}
        >
          Cancel·lar
        </Link>
      </div>
    </form>
  );
}
