# VindiBCN · instruccions per a Claude

## Idioma

- **Respon sempre a Marc en castellà o en català. Mai en anglès**: missatges,
  resums, preguntes i pàgines de lliurament.
- Commits i comentaris de codi, en català, com fins ara.

## Com treballem

- En local.
- Push directe a `main` amb tot en verd (Vercel desplega sol).
- **Atura't abans del push** si el canvi toca diners, permisos, RLS o comptes,
  o si hi ha una migració.
- Les migracions les aplica sempre Marc, a mà. No les executis mai.
- Neteja sempre per **ID exacte**, mai per patró.
- Verificació real quan sigui possible (Playwright, lectura de només lectura a
  producció) i mai suposada. Si no s'ha pogut comprovar, digues-ho.

## A cada canvi

- Playwright a 375 i 1280 px.
- Textos de l'àrea del client en ca/es/en.
- Manuals (`lib/help/`) i guia de proves (`docs/vindiapp-guia-de-proves.html`)
  al dia.

## Context tècnic

Llegeix `README.md` i `docs/ARQUITECTURA.md`.
