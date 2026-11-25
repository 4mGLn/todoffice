# TodOffice

[Монгол](README.md) · [English](README.en.md) · [한국어](README.ko.md)

TodOffice is a desktop office suite being developed for writing and editing documents in Mongolian.

## Why do we need TodOffice?

Whether we’re doing homework or writing a report at work, we want an office suite that feels at home in Mongolian. We want to read menus in Mongolian, write in Cyrillic, and open a page in traditional Mongolian script with the text flowing from top to bottom.

Developers in Korea built IeumOffice on the open-source GenOffice project. Their work gave us a place to start. With TodOffice, we’re adapting the IeumOffice editors to the ways people write in Mongolia. The people who use these tools every day know which menu labels make sense and where writing a document gets awkward.

Part of Mongolia’s development is learning to build and improve the software and services we need. We’re starting with a tool people use every day. Someday we’d like to see a student open a blank page in TodOffice and write their first assignment in traditional Mongolian script, from top to bottom.

## Installation

As of 2026-11-25, the first official release is pending on [GitHub Releases](https://github.com/4mGLn/todoffice/releases). Once published, the commands below install the package for your computer from the latest stable release. If that release has no matching package, the installer reports it and stops.

**Linux (x64) and macOS (Apple silicon or Intel)** — Run in a terminal.

```sh
curl -fsSL https://github.com/4mGLn/todoffice/releases/latest/download/install.sh | sh
```

On Linux, run `~/.local/bin/todoffice-desktop` to open the app. On macOS, the installer places it in `~/Applications/TodOffice.app`.

**Windows (x64 or ARM64)** — Run in PowerShell.

```powershell
irm https://github.com/4mGLn/todoffice/releases/latest/download/install.ps1 | iex
```

## Mongolian language support

As of 2026-11-25, the Mongolian Cyrillic (`mn-Cyrl`) and traditional Mongolian script (`mn-Mong`) translations are **previews**. Interface text and help that still need translation appear in English.

- In traditional-script mode, menus run vertically. A new blank document in the Docs editor starts with text running from top to bottom in columns that progress from left to right. Existing documents keep their saved writing direction. Docs also lets you choose the direction explicitly. Support for vertical editing in other file formats varies.
- Home cards, menu tabs, and settings use consistent sizes and spacing. The B, I, and U formatting icons stay upright. Collapsing the tool panel leaves only the navigation rail.
- Common actions use familiar Mongolian terms. Some specialist terms are written in traditional script to reflect their English pronunciation. The new terms and transliterations still need review by native speakers familiar with the script.

## Documentation and license

- [Product identity and local registrations](docs/todoffice-branding.md)
- [Mongolian translation sources and review status](docs/mongolian-localization-review.md)
- [Mongolian language support and verification scope](docs/mongolian-support.md)
- [Original IeumOffice introduction](docs/upstream-readme.en.md)

TodOffice selectively incorporates improvements from GenOffice. It retains the internal `@genoffice/*` package names and the identifiers stored in documents for upstream compatibility. For licensing and upstream credits, see [LICENSE](LICENSE) and [NOTICE](NOTICE).
