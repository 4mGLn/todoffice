---
name: release-todoffice
description: Use when checking a TodOffice version, installer or update path, writing release notes in Korean, or publishing an approved version.
---

# Releasing TodOffice

## Prepare the release

1. Confirm what the user requested (draft notes, local packages or publication), the target platforms, the version and the target commit. Take the version from `apps/shell/package.json`. If the build or distribution requires the terms check in section 1 of `docs/releasing.ko.md`, obtain confirmation from the repository maintainer.
2. Cross-check the product name, app ID, public repository and update feed in `docs/todoffice-branding.md`, `packages/i18n/src/product.ts` and `apps/shell/electron-builder.cjs`. If the publication destination is unset, complete local verification and report which settings are needed for publication.
3. Check the target platform's `.github/workflows/*-build.yml` for build targets, artifact names and upload destinations. If a workflow still names the upstream product, run it only after it has been adapted and verified for TodOffice distribution.

## Verify packages and release notes

- Run the checks in `docs/standards.md` and follow the packaging procedure for the target platform. Open the installer and check the product name, version and executable. When providing update files, compare the file names and hashes in the feed with the installer from the same build.
- Identify user-visible changes between the previous TodOffice release and the target commit. For the first release, describe the features actually provided and the installation requirements.
- Write the notes in Korean. Start with a one- or two-line summary, then use **새로 들어간 것** (new features) and **고친 것** (fixes). Include **알려진 한계** (known limitations) and **도움 주신 분** (acknowledgments) when applicable. End with **설치** (installation). Give the verified platforms, architectures and actual installer file names. Replace awkward translations and internal jargon, then check the notes against the changes again.
- To preview the text and scrolling in the update window, run `GENOFFICE_FAKE_UPDATE=9.9.9 npm run dev`. Verify the actual update separately from a previous installation on the distribution channel.

## Publish and verify

- Immediately before publishing, cross-check the repository, commit, tag, channel, attachments and final notes. Confirm the maintainer's approval for that specific publication. Do not overwrite existing tags or installers.
- After publishing, download and inspect the public files. For platforms with an update feed, start from a previous installation and check version detection, download, restart and the resulting version. If an update fails, record the channel and symptoms and prepare a corrected version.
- Record the platforms verified and the remaining limitations in `docs/tracking/status.md`. Publish a website announcement once both a TodOffice-owned site and the publication destination have been established.
