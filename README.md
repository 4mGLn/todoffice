# TodOffice

IeumOffice를 기반으로 GenOffice의 변경을 선별 반영하는 로컬 데스크톱 오피스입니다. Mongol bichig(몽골 전통문자)를 중심으로 몽골어 문서 편집과 인터페이스를 개발합니다.

```bash
npm ci
npm run build:all
npm run dev
```

현재 디렉터리가 Git 및 npm workspace 루트입니다. `apps/`에는 편집기와 셸, `packages/`에는 공유 코드, `docs/`에는 제품 문서가 있습니다. 로컬 분석·작업 기록은 `.agents/.analysis/`와 `.agents/docs/`에 보관합니다. [저장소 구조와 개발 명령](docs/repository-layout.md)을 참고하세요.

현재 공개 저장소·웹사이트·업데이트 서버·문의 주소는 설정하지 않았습니다. 기존 제품의 서비스로 사용자를 연결하지 않으며, 원본 앱의 설정을 자동으로 옮기지 않습니다.

2026-11-25 기준 `mn-Cyrl`과 `mn-Mong`는 **미완성 번역 미리보기**입니다. 전통문자 세로형 UI와 Docs의 명시적 세로 조판을 구현했으며, 미번역 문구와 도움말은 영어로 대체됩니다. 전체 몽골어 번역이나 모든 문서 형식의 세로 편집을 완료한 상태는 아닙니다.

B·I·U 서식 아이콘을 정방향으로 고정하고, 편집기 메뉴를 기본 192px·좁은 창 172px로 압축했습니다. 메뉴를 접으면 탐색 레일만 남습니다. Mongol bichig 모드에서 만드는 새 Docs 문서는 본문도 기본 세로 조판으로 시작합니다. 기존 문서는 저장된 방향을 유지합니다.

홈 카드·메뉴 탭·설정 항목의 크기와 간격을 통일하고, 주요 UI 명칭에 전통 몽골문자 번역 초안을 추가했습니다. 기본 동작은 익숙한 몽골어로, 기술 메뉴명은 영어 발음을 몽골문자로 적습니다. 새 용어와 음역은 원어민 검수가 필요합니다.

- [제품 이름과 로컬 등록 정책](docs/todoffice-branding.md)
- [몽골어 번역 출처와 검수 범위](docs/mongolian-localization-review.md)
- [원본 IeumOffice 소개 문서](docs/upstream-readme.md)
- [영문 소개](README.en.md)

라이선스와 출처는 [LICENSE](LICENSE), [NOTICE](NOTICE)에 보존합니다. 내부 `@genoffice/*` 패키지 이름과 문서 형식의 식별자는 upstream 동기화를 위해 유지합니다.

- [Mongolian support and verification scope](docs/mongolian-support.md)
