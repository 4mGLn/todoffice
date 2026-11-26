# TodOffice

[Монгол](README.md) · [English](README.en.md) · [한국어](README.ko.md)

TodOffice is a desktop office suite being developed for writing and editing documents in Mongolian.

## Why do we need TodOffice?

Whether we’re doing homework or writing a report at work, we want an office suite that feels at home in Mongolian. We want to read menus in Mongolian, write in Cyrillic, and open a page in traditional Mongolian script with the text flowing from top to bottom.

IeumOffice began when a teacher of Korean at a high school in South Korea adapted the open-source GenOffice project to make a tool for their own reading and writing. That story made us think that people who work with documents every day in Mongolia could also shape their tools around their own language and ways of writing. [Why IeumOffice was made](docs/upstream-readme.en.md#why-it-was-made)

As ties between Mongolia and South Korea have grown, being able to open the documents we share has become more important. South Korean public agencies publish documents such as reports in HWP and HWPX formats. We chose IeumOffice as the starting point for TodOffice because it already supported those formats, let people edit documents on their own computers, and offered a way to connect AI. That gave us room to focus on Mongolian menus and on writing in both Cyrillic and traditional Mongolian script. [Korea–Mongolia summit briefing](https://www.mofa.go.kr/www/brd/m_29514/view.do?seq=98) · [Public report published in HWP and HWPX](https://www.mois.go.kr/frt/bbs/type001/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000336&nttId=129238)

Part of Mongolia’s development is learning to build and improve the software and services we need. We’re starting with a tool people use every day. Someday we’d like to see a student open a blank page in TodOffice and write their first assignment in traditional Mongolian script, from top to bottom.

## Installation

As of 2026-11-26, the first official release is pending on [GitHub Releases](https://github.com/4mGLn/todoffice/releases). Once published, the commands below install the package for your computer from the latest stable release. If that release has no matching package, the installer reports it and stops.

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

Use the globe button near the window controls to change the interface language. TodOffice remembers your choice the next time you open it.

As of 2026-11-26, the Mongolian Cyrillic (`mn-Cyrl`) and traditional Mongolian script (`mn-Mong`) translations are **previews**. All 27 help topics have draft translations in both scripts. They still need native-speaker review. Untranslated interface text appears in English.

- In traditional-script mode, menus run vertically. A new blank document in the Docs editor starts with text running from top to bottom in columns that progress from left to right. Existing documents keep their saved writing direction. Docs also lets you choose the direction explicitly. Support for vertical editing in other file formats varies.
- Home cards, menu tabs, and settings use consistent sizes and spacing. The B, I, and U formatting icons stay upright. Collapsing the tool panel leaves only the navigation rail.
- Common actions use familiar Mongolian terms. Some specialist terms are written in traditional script to reflect their English pronunciation. The new terms and transliterations still need review by native speakers familiar with the script.

## Documentation and license

- [Product identity and local registrations](docs/todoffice-branding.md)
- [Mongolian translation sources and review status](docs/mongolian-localization-review.md)
- [Mongolian language support and verification scope](docs/mongolian-support.md)
- [Original IeumOffice introduction](docs/upstream-readme.en.md)

TodOffice selectively incorporates improvements from GenOffice. It retains the internal `@genoffice/*` package names and the identifiers stored in documents for upstream compatibility. For licensing and upstream credits, see [LICENSE](LICENSE) and [NOTICE](NOTICE).
