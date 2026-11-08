# Trackium MiniDapp — stage 3 UI/UX audit

Аудит текущего web workspace, **без изменения HTML/CSS/JS, Gateway, auth или wallet поведения**. Source snapshot: main `196b3dd5848e35844acfeffccf8f984030d7bee3`. Общий Android/native/web отчёт и предложения находятся в самостоятельном Trackium Core:

- [Полный аудит и сравнение](https://github.com/themightydanik/trackium-core-android/blob/docs/stage3-ui-ux-audit/docs/UI_UX_AUDIT.md)
- [Design system](https://github.com/themightydanik/trackium-core-android/blob/docs/stage3-ui-ux-audit/docs/DESIGN_SYSTEM_PROPOSAL.md)
- [Navigation](https://github.com/themightydanik/trackium-core-android/blob/docs/stage3-ui-ux-audit/docs/UNIFIED_NAVIGATION.md)
- [Brand/icons](https://github.com/themightydanik/trackium-core-android/blob/docs/stage3-ui-ux-audit/docs/BRAND_AND_ICON_CONCEPTS.md)
- [Roadmap](https://github.com/themightydanik/trackium-core-android/blob/docs/stage3-ui-ux-audit/docs/UI_REDESIGN_ROADMAP.md)
- [Реальные browser screenshots и границы evidence](https://github.com/themightydanik/trackium-core-android/blob/docs/stage3-ui-ux-audit/docs/ui-audit/EVIDENCE.md)

## Не смешивать три продукта

| Entry / sources | Роль | Аудит |
|---|---|---|
| index.html + assets/v2/cargo.js/css | Текущий Cargo MiniDapp, семь hash routes, offline/unpaired/explicit Preview | Source + реальный Chromium desktop/mobile/tablet rendering |
| assets/v2/server-client.js / server-workspace.js | Authenticated same-origin Gateway mode, owner-approved short-lived session, scope-dependent forms | Source review; production/owner tenant не подключался |
| legacy.html + assets/js/* + assets/css/styles.css | Исторический standalone local DB/simulator/blockchain UI | Только историческая/source классификация, не current capability parity |
| local-core.html + assets/v2/local-core* | Legacy classic MDS publisher / checkpoint exchange | Только source; не native Android, не запускался с wallet и не выполнял финансовых действий |
| service.js / assets/v2/background-database.js | Background/runtime persistence infrastructure, не дополнительный визуальный экран | Source dependency context, не screenshot coverage |
| apps/android | Отдельный native companion APK из предыдущей архитектуры | Не встроенный Trackium Core UI; current integrated/trackium аудируется в другом repo |

## Все текущие страницы и состояния

| Route | Preview/unpaired UI | Authenticated branch (не live-tested) |
|---|---|---|
| Dashboard | Summary, schematic fleet map, static chart, shipments/activity | Server fleet and loaded shipment/device subsets; не обещать live chart по demo |
| Shipments | Search, demo routes, detail dialog/link to device | Create draft form: name/device/checkpoints/conditions; transitions и simulator controls по scopes |
| Devices | Search/registry cards/device dialog, last-sample labels | Registry + explicit simulator identity; simulation_enabled/simulate scope обязательны |
| Live Map | SVG Europe schematic, demo markers, легенда «not for navigation» | Latest reported coordinates cards, а не полноценная live geographic map |
| Events | Filtered demo history/table, длинная страница | Shipment event history с API/loaded subset limits; cursor/partial-state UX требует внимания |
| Proofs | Honest empty state, no blockchain proofs published | Owner pending events, publisher policy/preflight, local/server exchange, verification/export; не выполнялось |
| Settings / Gateway | Public origin/deployment model, support check, runtime and legacy links | One-use owner challenge/claim, scopes/audience/expiry, revoke; no owner-token textbox |

Дополнительно учтены desktop sidebar/mobile drawer+scrim, skip link, hash history, dialogs/Escape/focus, Preview banner/toggle/toast, loading, no search results, unpaired support error и технические detail состояния. Приватные authenticated формы/expired tenant session визуально не аттестованы без специально выделенного owner/tenant. UI из tests/mocks не выдаётся за реальные Gateway данные.

## Наблюдения

- CSS palette уже близка к proposed Trackium Core: navy #0D1727, panel #131F32, mint #43D7BD, amber #F0B663; радиус14px. Android host/History всё ещё orange, native Trackium имеет отдельные hardcoded navy values.
- CSS объявляет Inter, но bundled font не найден; browser может использовать system fallback. Общая type scale должна учитывать actual font metrics, rem/scalable text, а не только названия font-family.
- 28 route/viewport captures: 1440×1000, 320×640, 390×844, 768×1024 CSS px. Document-level horizontal overflow не обнаружен. Это не доказывает правильность всех controls, local scroll, full text readability, TalkBack или touch ergonomics.
- Snapshot rows с мелкими controls/utility text требуют targeted 44px web hit area и contrast/focus review. Candidate measurement <44px включает также ancillary/inline links и не является автоматическим verdict WCAG fail.
- Preview постоянно помечен synthetic/static. «Live Map», future confirmations и raw technical exchange всё равно могут создавать неверное ожидание готовности: названия и capability state должны объяснять last observed vs live, submitted vs confirmed, chain inclusion vs physical authenticity.
- Preview/dashboard богаче authenticated data renderers. Native Trackium ещё тоньше (JSON detail вместо human cards/charts). Дизайн-система не должна обещать feature parity там, где backend/client capability отсутствует.
- Static demo переключение не равно server simulation. Simulator creation/runs — авторизованные backend mutations; в аудите они не отправлялись. Никакие синтетические показания не считаются AOVX-физической телеметрией.
- Legacy ссылки рядом с current settings нуждаются в явном compatibility exit. Нельзя унифицировать их, автоматически открывая legacy publisher с wallet.

## Проверки и следующий шаг

Доступные browser/core regression tests запущены (16 pass). Скриншоты сделаны headless Chromium, только localhost origin; external requests заблокированы. Реальная MDS embedding/WebView, production Gateway, native owner pairing, Mainnet, реальные trackers и Android physical device не подтверждены.

Общий roadmap предусматривает сначала owner выбор оригинальной иконки/палитры/IA, затем небольшие platform-specific PR: tokens, contrast/type/controls, honest states, modal/focus и authenticated parity. Текущий аудит ничего из этого не внедряет; auth, cookies/PoP, security boundaries и publication gates не меняются. Не auto-merge. Перекрёстная ссылка из Android-аудита ведёт сюда; source permalink фиксирует проверенный main, а не legacy UI.
