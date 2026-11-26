# TodOffice

[Монгол](README.md) · [English](README.en.md) · [한국어](README.ko.md)

TodOffice는 몽골어로 문서를 쓰고 편집할 수 있도록 개발 중인 데스크톱 오피스입니다.

## 우리에게 TodOffice가 필요한 이유

학교에서 과제를 쓸 때도, 직장에서 보고서를 만들 때도 우리에게는 몽골어로 편하게 쓸 수 있는 오피스가 필요합니다. 메뉴는 몽골어로 읽고, 키릴 문자로 글을 쓰다가도 전통 몽골 문자로 문서를 만들 때는 익숙한 대로 위에서 아래로 써 내려갈 수 있으면 좋겠습니다.

이음오피스는 한국의 한 고등학교 국어 교사가 자기 읽기와 쓰기에 필요한 도구를 만들려고 오픈소스 GenOffice를 고치면서 시작됐습니다. 그 이야기를 보며 우리도 몽골에서 매일 문서를 쓰는 사람들이 자기 언어와 쓰기 방식에 맞게 도구를 고쳐 갈 수 있겠다고 생각했습니다. [이음오피스가 만들어진 이유](docs/upstream-readme.md#만든-이유)

한국과 몽골의 교류가 커지면서 서로 쓰는 문서를 열어 볼 수 있는 도구도 중요해졌습니다. 한국 공공기관은 보고서 같은 문서를 한글 파일(HWP·HWPX)로도 공개합니다. 그래서 우리는 이음오피스를 TodOffice의 출발점으로 삼았습니다. 이음오피스가 마련한 한글 문서 지원과 내 컴퓨터에서 문서를 편집하고 AI를 연결하는 방식을 이어받아, 몽골어 메뉴와 키릴 문자·전통 몽골 문자로 글을 쓰는 경험에 집중할 수 있었습니다. [외교부 한·몽골 정상회담 브리핑](https://www.mofa.go.kr/www/brd/m_29514/view.do?seq=98) · [행정안전부 보고서 배포 사례](https://www.mois.go.kr/frt/bbs/type001/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000336&nttId=129238)

몽골이 발전하는 데에는 우리에게 필요한 소프트웨어와 서비스를 직접 만들고 고쳐 본 경험이 중요합니다. 우리는 매일 쓰는 오피스에서 그 일을 시작합니다. 언젠가 한 학생이 TodOffice에서 새 문서를 열고 전통 몽골 문자로 첫 과제를 위에서 아래로 써 내려가는 모습을 보고 싶습니다.

## 설치

2026-11-26 기준 [GitHub Releases](https://github.com/4mGLn/todoffice/releases)에 첫 정식 릴리스가 올라오지 않았습니다. 릴리스가 게시되면 아래 명령이 가장 최근 정식 버전에서 내 컴퓨터에 맞는 패키지를 찾아 설치합니다. 해당 패키지가 없으면 이유를 표시하고 종료합니다.

**Linux(x64)와 macOS(Apple Silicon·Intel)** 터미널에서 실행합니다.

```sh
curl -fsSL https://github.com/4mGLn/todoffice/releases/latest/download/install.sh | sh
```

Linux에서는 `~/.local/bin/todoffice-desktop`으로 실행합니다. macOS에서는 `~/Applications/TodOffice.app`에 설치합니다.

**Windows(x64·ARM64)** PowerShell에서 실행합니다.

```powershell
irm https://github.com/4mGLn/todoffice/releases/latest/download/install.ps1 | iex
```

## 현재 몽골어 지원 범위

2026-11-26 기준 키릴 문자(`mn-Cyrl`)와 전통 몽골 문자(`mn-Mong`) 번역은 **미리보기 단계**입니다. 도움말 27개 주제에 두 문자판의 번역 초안을 제공합니다. 두 문자판 모두 원어민 검수가 필요하며, 아직 번역하지 않은 화면 문구는 영어로 표시합니다.

- 전통문자 모드에서는 메뉴가 세로로 표시됩니다. 이 모드에서 Docs 편집기로 새 빈 문서를 만들면 본문은 위에서 아래로, 글줄은 왼쪽에서 오른쪽으로 이어집니다. 기존 문서는 저장된 쓰기 방향을 유지합니다. Docs에서는 쓰기 방향을 직접 선택할 수 있으며 다른 파일 형식의 세로 편집 지원 범위는 형식마다 다릅니다.
- 홈 카드, 메뉴 탭, 설정 항목은 크기와 간격을 통일했습니다. B·I·U 서식 아이콘은 정방향으로 표시되며 도구 패널을 접으면 탐색 메뉴만 남습니다.
- 기본 동작은 익숙한 몽골어로 이름을 붙이고 일부 기술 용어는 영어 발음을 전통 몽골 문자로 적었습니다. 새 용어와 음역은 전통문자에 익숙한 원어민의 검수가 필요합니다.

## 관련 문서와 라이선스

- [제품 이름과 로컬 등록 정책](docs/todoffice-branding.md)
- [몽골어 번역 출처와 검수 범위](docs/mongolian-localization-review.md)
- [몽골어 지원 기능과 검증 범위](docs/mongolian-support.md)
- [원본 이음오피스 소개](docs/upstream-readme.md)

TodOffice는 GenOffice의 개선 사항을 선별해 반영합니다. 원본과의 호환성을 위해 내부 패키지 이름 `@genoffice/*`와 문서에 저장되는 식별자를 유지합니다. 라이선스와 원본 프로젝트의 출처 표기는 [LICENSE](LICENSE)와 [NOTICE](NOTICE)에서 확인할 수 있습니다.
