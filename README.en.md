# TodOffice

A local desktop office suite based on IeumOffice, intended to selectively import future GenOffice improvements. No additional GenOffice changes have been imported in this local development step. Development focuses on Mongol bichig (Mongolian Traditional Script), Mongolian Cyrillic, and document editing.

```bash
npm ci
npm run build:all
npm run dev
```

This directory is the Git and npm workspace root. Editors live in `apps/`, shared code in `packages/`, and product documentation in `docs/`. Local analysis and work records live in ignored `.agents/.analysis/` and `.agents/docs/`. See [repository layout and commands](docs/repository-layout.md).

No public TodOffice repository, website, update feed, or contact address is configured. The app does not redirect users to upstream product services or automatically migrate upstream settings.

As of 2026-11-25, `mn-Cyrl` and `mn-Mong` are **incomplete translation previews**. Mongol bichig has vertical application chrome and an explicit Docs writing-direction setting. Missing interface text and manuals use English fallback; full localization and all-format vertical editing are unfinished.

Formatting glyphs stay upright in Mongol bichig. Editor rails use 192px normally and 172px in narrow windows, and collapsing frees the tool panel’s space. New Docs drafts in Mongol bichig start in vertical section layout; existing files keep their stored direction.

Home cards, ribbon tabs and Settings now use regular dimensions and spacing in Mongol bichig. Primary interface names include contextual traditional-script drafts that still require native review. Basic actions use familiar Mongolian; specialist menu names use English-sound Mongol bichig spellings.

- [Product identity and local registrations](docs/todoffice-branding.md)
- [Mongolian localization sources and review limits](docs/mongolian-localization-review.md)
- [Mongolian support and verification scope](docs/mongolian-support.md)
- [Original IeumOffice introduction](docs/upstream-readme.en.md)
- [Korean introduction](README.md)

Required licenses and source credits remain in [LICENSE](LICENSE) and [NOTICE](NOTICE). Internal `@genoffice/*` package names and serialized document identifiers remain compatible with upstream.
