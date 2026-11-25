# TodOffice product identity

The product name is **TodOffice** in every interface language. The local app ID is `org.todoffice.app`; the Linux executable and package are `todoffice`, the desktop entry is `todoffice.desktop`, and Windows ProgIds start with `TodOffice.`. User data is isolated under `TodOffice` (`TodOffice-Dev` in development). No upstream folders are adopted or migrated.

The terminal command, stdio MCP entry and installed agent skill are `todoffice`. The app's HTTP MCP server is `todoffice-editor`, and guide resource URIs begin `todoffice://guide/`. Command records, skills and audit data use `~/.todoffice`; project-local state uses `.todoffice/`. Existing GenOffice and IeumOffice registrations remain separate.

The public [TodOffice installer repository](https://github.com/4mGLn/todoffice) is the distribution location for the desktop installers. The scripts resolve the latest stable GitHub release and select a package for the user's platform. Attach the root `install.sh` and `install.ps1` files to each stable release under those exact names alongside the platform packages. The README commands use GitHub’s `releases/latest/download/` links to those assets. The app's own service links and update feed are still unconfigured, and packaging uses `publish: null`.

The Vermilion artwork and its light/dark palette reference are in [design/brand](../design/brand/). The sidebar uses the supplied outlined wordmark in ink (#111111) or ivory (#F3F1EC), with the symbol in vermilion (#E6482E) in both themes. The launcher uses that symbol on an ivory tile. Its small optical size enlarges the symbol for slots up to 32 px. Production SVG inputs live in `apps/shell/build/brand/`; regenerate PNG, ICO, ICNS and sidebar assets with `node tools/gen-brand-assets.mjs`.

File-type and attachment icons use ivory paper, a vermilion spine and an ink outline. Each format keeps its own pictogram and accent color. Run `node tools/gen-file-association-icons.mjs` to regenerate the shell SVGs, operating-system file associations, native menu icons and editor attachment PNGs.

Required upstream license, attribution, notices and Git history are retained. Internal `@genoffice/*`, `GENOFFICE_*`, media protocols, bundle filenames and serialized document identifiers remain unchanged for upstream compatibility. The original README files are archived as source documentation, not TodOffice download instructions.

## Local Linux packages without a homepage

The build keeps `extraMetadata.homepage` as an empty string. This prevents electron-builder from inferring a different project's URL while allowing local DEB/RPM creation. Its FPM `--edit` hook uses `packaging/omit-unconfigured-homepage.cjs` to remove the optional empty DEB `Homepage` field and FPM's generated RPM placeholder before packaging. The resulting DEB has no `Homepage`; RPM's URL tag is absent. The editor rejects an unexpected non-empty URL instead of silently replacing it. No dependencies or shared FPM templates are patched.

When a real TodOffice homepage is configured, remove this omission hook and verify the resulting package metadata alongside the product service links.
