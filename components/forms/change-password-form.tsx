"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { PasswordField } from "@/components/ui/password-field";
import { Button } from "@/components/ui/button";

/**
 * Els textos del formulari, ja resolts.
 *
 * Van com a dades i no com a crides a `useTranslations` dins del cos perquè
 * aquest formulari surt també a l'àrea d'admin i de professional, i allà no hi
 * ha `NextIntlClientProvider`: el hook hi petaria. Mateix arranjament que al
 * menú lateral —un embolcall traduït i un altre en català— i el cos, que és
 * on viu tota la lògica, escrit una sola vegada.
 */
type Texts = {
  title: string;
  hint: string;
  current: string;
  new: string;
  repeat: string;
  submit: string;
  saving: string;
  ok: string;
  show: string;
  hide: string;
  errors: {
    tooShort: string;
    mismatch: string;
    same: string;
    noAccount: string;
    wrongCurrent: string;
  };
};

const CA: Texts = {
  title: "Contrasenya",
  hint: "Canvia la contrasenya del teu compte.",
  current: "Contrasenya actual",
  new: "Nova contrasenya",
  repeat: "Repeteix la nova contrasenya",
  submit: "Canviar contrasenya",
  saving: "Desant…",
  ok: "Contrasenya actualitzada.",
  show: "Mostrar la contrasenya",
  hide: "Amagar la contrasenya",
  errors: {
    tooShort: "La nova contrasenya ha de tenir com a mínim 8 caràcters.",
    mismatch: "Les contrasenyes noves no coincideixen.",
    same: "La nova contrasenya ha de ser diferent de l'actual.",
    noAccount: "No s'ha pogut identificar el teu compte.",
    wrongCurrent: "La contrasenya actual no és correcta.",
  },
};

/**
 * `translated` només l'ha de passar l'àrea de client, que és l'única que va
 * dins del proveïdor d'idioma.
 */
export function ChangePasswordForm({ translated = false }: { translated?: boolean }) {
  return translated ? <Translated /> : <Body texts={CA} />;
}

function Translated() {
  const t = useTranslations("config.password");
  const te = useTranslations("config.password.errors");
  return (
    <Body
      texts={{
        title: t("title"),
        hint: t("hint"),
        current: t("current"),
        new: t("new"),
        repeat: t("repeat"),
        submit: t("submit"),
        saving: t("saving"),
        ok: t("ok"),
        show: t("show"),
        hide: t("hide"),
        errors: {
          tooShort: te("tooShort"),
          mismatch: te("mismatch"),
          same: te("same"),
          noAccount: te("noAccount"),
          wrongCurrent: te("wrongCurrent"),
        },
      }}
    />
  );
}

/**
 * Canvi de contrasenya per a l'usuari amb sessió oberta. Per seguretat es torna
 * a autenticar amb la contrasenya actual abans d'aplicar la nova (evita que algú
 * amb una sessió oberta sense vigilar la canviï).
 */
function Body({ texts }: { texts: Texts }) {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    if (password.length < 8) return setError(texts.errors.tooShort);
    if (password !== confirm) return setError(texts.errors.mismatch);
    if (password === current) return setError(texts.errors.same);

    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email;
    if (!email) {
      setError(texts.errors.noAccount);
      setLoading(false);
      return;
    }
    // Reautenticació amb la contrasenya actual.
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password: current,
    });
    if (signInErr) {
      setError(texts.errors.wrongCurrent);
      setLoading(false);
      return;
    }
    const { error: updErr } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updErr) {
      setError(updErr.message);
      return;
    }
    setCurrent("");
    setPassword("");
    setConfirm("");
    setOk(true);
  }

  return (
    <section className="mt-6 flex flex-col gap-4 rounded-2xl border border-brand-border bg-white p-6">
      <div>
        <h2 className="text-sm font-bold tracking-wide text-brand-muted uppercase">
          {texts.title}
        </h2>
        <p className="mt-1 text-xs text-brand-muted">{texts.hint}</p>
      </div>

      <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-4">
        <PasswordField
          label={texts.current}
          name="current"
          autoComplete="current-password"
          required
          showLabel={texts.show}
          hideLabel={texts.hide}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <PasswordField
          label={texts.new}
          name="password"
          autoComplete="new-password"
          required
          showLabel={texts.show}
          hideLabel={texts.hide}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordField
          label={texts.repeat}
          name="confirm"
          autoComplete="new-password"
          required
          showLabel={texts.show}
          hideLabel={texts.hide}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {error && <p className="text-sm text-error">{error}</p>}
        {ok && <p className="text-sm text-success">{texts.ok}</p>}
        <div>
          <Button type="submit" disabled={loading}>
            {loading ? texts.saving : texts.submit}
          </Button>
        </div>
      </form>
    </section>
  );
}
