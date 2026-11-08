# Приёмка Trackium Core на Android-смартфоне

Это ручная приёмка технической debug-сборки `0.2.0` (`versionCode=2`), не разрешение использовать рабочий кошелёк. Ни одного перевода, подписи транзакции, пополнения или публикации Proofs в Mainnet. Поля результата ниже заполняет оператор: облачная сборка не означает испытание телефона.

## До установки

1. Использовать тестовый смартфон и **новый пустой кошелёк**. Не импортировать seed, backup, файлы или ключи BlackBear. Не выполнять восстановление кошелька во время этой приёмки. Не удалять данные BlackBear, не переустанавливать и не обновлять его APK.
2. Записать модель/OEM, Android/API, ABI, RAM, свободное место, режим энергосбережения и размер страницы памяти. Для первого теста нужен Android API >=28, поддерживаемая ABI (arm64-v8a, armeabi-v7a или x86_64) и **страницы 4096 байт**. В закреплённом наборе ARM64 `libbare-tcp.2.0.4.so` и `libsodium-native.4.3.3.so` имеют PT_LOAD alignment 4096: поддержка 16-КБ страниц не подтверждена. Если `getconf PAGESIZE` возвращает 16384, остановить приёмку этой сборки и зафиксировать compatibility blocker; не удалять библиотеки и не обходить checksum verification.
3. У обеих нод исходный P2P-порт **21001**. Штатно завершить BlackBear и проверить отсутствие его работающего foreground service/уведомления. При необходимости использовать Android «Остановить принудительно» **только для BlackBear**, без «Очистить данные/хранилище». Не запускать обе ноды одновременно и не менять порты/режимы ключей для обхода конфликта.
4. Перед испытанием перезагрузки проверить, что BlackBear не запустится автоматически после boot. Если OEM/приложение не позволяет гарантировать это без вмешательства в рабочий кошелёк, проводить reboot-тест на отдельном телефоне без BlackBear; на текущем отметить `BLOCKED: boot port collision`. Остановка до перезагрузки сама по себе не гарантирует отсутствие автозапуска. Существующий BootReceiver Trackium Core пытается запустить сервис при наличии настроенного seed; Android/OEM может ограничить этот запуск.
5. Скачать **один конкретный** успешный Actions Artifact по инструкции [CI](CI_DEBUG_APK.md), записать repository/run/source commit, SHA256 APK и отпечаток сертификата. Распаковать архив и проверить:

   ```sh
   sha256sum -c SHA256SUMS
   "$ANDROID_HOME/build-tools/35.0.0/apksigner" verify --verbose --print-certs trackium-core-debug.apk
   adb -s YOUR_TEST_SERIAL shell getprop ro.build.version.release
   adb -s YOUR_TEST_SERIAL shell getprop ro.product.cpu.abi
   adb -s YOUR_TEST_SERIAL shell getconf PAGESIZE
   ```

Каждый CI run использует новый временный debug-ключ. APK разных запусков могут иметь несовместимые подписи: `INSTALL_FAILED_UPDATE_INCOMPATIBLE` — ожидаемая защита Android. **Не очищать/переустанавливать кошельки для обхода ошибки.** Использовать один APK на весь цикл приёмки. Для следующей сборки согласовать отдельный сброс только пустого прототипа с отзывом его тестовой Gateway-сессии; это не часть автоматического CI. Обновление между сборками с сохранением данных не обещается.

## Установка и изоляция

```sh
adb -s YOUR_TEST_SERIAL install trackium-core-debug.apk
adb -s YOUR_TEST_SERIAL shell pm path tech.trackium.core.prototype
adb -s YOUR_TEST_SERIAL shell pm path com.eurobuddha.minimablock
adb -s YOUR_TEST_SERIAL shell am start -n tech.trackium.core.prototype/com.eurobuddha.minimacore.StartActivity
```

Вторая команда для BlackBear применима, только если он установлен под исходным ID. Не использовать `adb install -r`, `pm clear`, `uninstall`, `run-as`, чтение private data, `adb backup` или копирование wallet.db/seed на рабочем BlackBear. Зафиксировать до/после его package/version/значок, факт сохранения установки и отсутствие запроса миграции. Данные BlackBear проверять только штатным интерфейсом **после остановки Trackium Core**, последовательно, без параллельных нод. Не делать скриншоты seed/backup/токенов. Новый package/UID и отсутствие sharedUserId обеспечивают разделение данных; фактическая установка рядом с конкретной версией BlackBear остаётся пунктом ручного протокола.

## Сценарии

| Проверка | Действие и ожидаемый результат | Результат/время |
| --- | --- | --- |
| Новый кошелёк | Создать только новый пустой seed штатным onboarding. Записать его исключительно в личное защищённое тестовое хранилище, не в отчёт. Не импортировать старые ключи. | NOT RUN |
| Запуск ноды | На Trackium Core / Node дождаться старта foreground service. Первый выпуск ключей может занять минуты; при штатном сообщении о долгом запуске выбрать Keep waiting. Ошибки не обходить. | NOT RUN |
| Синхронизация | Наблюдать peers, высоту/возраст последнего блока и прогресс минимум 15 минут. Сравнить время/высоту с независимым доверенным источником. Нулевые peers/высота или пустая offline-цепочка — не доказательство синхронизации. Никакого genesis/mining/финансовых команд для «исправления». | NOT RUN |
| Встроенный Trackium | Нажать Open Trackium на Node, затем проверить toolbar-пункт. Открывается native Activity того же приложения, без браузера, установки companion APK и discovery BlackBear. Вернуться в host. | NOT RUN |
| Read-only доступ | В Trackium нажать Observe embedded node. Версия `1.1.2.31-euro4`, peers/блок — реальные наблюдения. До старта/после остановки ноды показывается ошибка или неизвестное состояние, а не выдуманный баланс. | NOT RUN |
| Запрет финансовых команд | Проверить, что переключатели публикации недоступны и состояние сообщает prototype/read-only. Не вводить команды в Terminal/Wallet хоста и не нажимать финансовые подтверждения. Отказ `send`, `txnsign`, `seed`, `vault`, `getaddress`, batches проверяется автоматическими adapter-тестами до dispatch; на телефоне не отправлять транзакции для отрицательного теста. | NOT RUN |
| Фон/возврат | Home, экран выключен 5/15/60 минут, возврат. Нода следует своей foreground-service политике; Trackium закрывает adapter в фоне и заново наблюдает ноду при возвращении. Нет фоновой публикации/резервирования job. Записать OS/OEM ограничения и прерывания, не скрывать потерю синхронизации. | NOT RUN |
| PIN/биометрия | В штатных настройках host включить PIN, затем доступную биометрию. Проверить неправильный PIN, отмену, блокировку после ухода в фон и холодный старт. До unlock Trackium не показывает кеш/данные, снимки чувствительного экрана блокируются. Нода может продолжать работу за lock; seed host не становится от этого зашифрованным PIN. | NOT RUN |
| Перезапуск процесса | Сохранить публичные Gateway origin/tenant и настройки Trackium. Штатно завершить host, затем запустить. Проверить настройки и тот же публичный ключ/адрес штатным интерфейсом, без копирования seed. Отдельно проверить Android force-stop только прототипа и последующий запуск. | NOT RUN |
| Перезагрузка | При гарантированно остановленном автозапуске BlackBear перезагрузить телефон. Записать поведение boot/уведомления, вручную открыть прототип при ограничении OEM. Проверить PIN, сохранённое состояние и восстановление наблюдений; не обходить app-lock. | NOT RUN |
| Разрешения | Записать фактически запрошенные/выданные permissions. Trackium-library не добавляет permissions; host сохраняет network/foreground/notifications/battery и функции camera/audio/storage/Apps. Для базового Trackium не выдавать ненужные camera/mic/файловые разрешения; отказ/несовместимость зафиксировать. RPC не включать. | NOT RUN |

Trusted host сохраняет полноценные Wallet/Terminal/backup API, поэтому **всё приложение не является read-only кошельком**. Read-only — ограниченная возможность встроенного Trackium. Не проверять финансовые host API на этом этапе.

## HTTPS Gateway: только тестовые owner и tenant

Backend здесь не разворачивается и не меняется. Оператор заранее выделяет отдельный тестовый tenant и owner credential вне телефона и убеждается, что на тестовом Gateway отключены live/Mainnet-публикации. Не использовать production owner/tenant. Не менять environment variables автоматически и не выдавать owner credential APK.

1. Проверить HTTPS domain, сертификат и часы телефона. В Trackium Settings сохранить точный credential-free `https://...` origin и публичный tenant UUID. Не добавлять token/userinfo/query к URL и не отключать TLS. Неверный HTTP origin должен отклоняться. Не тестировать MITM на реальном owner credential.
2. Create owner approval challenge. Сверить origin, tenant и UUID challenge на телефоне и доверенном операторском компьютере. До approval Complete owner pairing должен отказать; чужой тестовый tenant owner не должен иметь возможности подтвердить challenge.
3. На доверенном компьютере использовать **существующий** CLI основного Trackium checkout, не копируя backend в этот Android-проект:

   ```sh
   node services/gateway/src/proofs/admin.js native-approve https://YOUR_TEST_GATEWAY /secure/local/test-owner.json CHALLENGE_UUID
   ```

   Аргумент — путь к защищённому credential-файлу, не token. Файл не должен попадать в Git, Actions, logs или публичный отчёт. Действие native-approve подтверждает pairing, **не финансовое событие**. Не выполнять policy/event approval, reserve/publish jobs или команды переводов.
4. Завершить pairing в APK. Текущий reused-протокол может выдавать native session с read/publish scopes; это **не** разрешение на финансовые команды Minima: у adapter `admin=false`, publication/job-reservation hard gates сохранены, серверный безопасный режим обязателен. UI-надпись read/publish не отменяет запретов прототипа.
5. Refresh authenticated data; проверить Shipments, Devices, Proofs и публичные идентификаторы своего tenant. Пустые списки в новой БД корректны. Если нужны записи, оператор использует существующие тестовые fixtures/API, явно помечая синтетические данные; не выдавать их за физическую AOVX-телеметрию. Чужие данные не должны появляться. Отрицательные проверки tenant isolation проводить только на двух специально выделенных тестовых tenant.
6. После перезапуска origin/tenant должны сохраниться, но истёкшая сессия не должна обходить повторный pairing. Проверить истечение/отзыв; закончить Disconnect / revoke session. В отчёте только UUID/коды ошибок, без token, PoP key, device proof, seed, private key или owner-файла.

## RAM, батарея, диск

До старта согласовать бюджет с оператором и записать базовые показатели. Измерять в одинаковых Wi-Fi/экран/зарядка/температура условиях через 5, 15 и 60 минут; сопоставить startup, активную sync и фон. Не объявлять расход допустимым только по одному короткому измерению.

```sh
adb -s YOUR_TEST_SERIAL shell dumpsys meminfo tech.trackium.core.prototype
adb -s YOUR_TEST_SERIAL shell dumpsys battery
adb -s YOUR_TEST_SERIAL shell df -h /data
```

PSS/RSS и пики RAM, число процессов/перезапусков, ANR/OOM, battery %/температура/время и app storage из Android Settings внести в таблицу. `df` показывает общий диск, не размер только приложения; записать APK (~220 MiB), app data и прирост цепочки отдельно. Battery % за короткий интервал — приблизительная метрика, не измерение мА·ч. Не сбрасывать battery statistics и не собирать полный bugreport/logcat: они могут содержать данные других приложений/кошельков.

## Готовность и отчёт

Для данного телефона PASS требует прохождения каждого применимого сценария, отсутствия чужих данных и транзакций, стабильного восстановления, соблюдения согласованных ресурсных бюджетов и отсутствия необъяснённых crash/ANR/security errors. `NOT RUN`/`BLOCKED` не заменять на PASS; reboot/16-KB/API29+Keets — самостоятельные ограничения. После теста штатно остановить прототип, убедиться, что его service не работает, затем при необходимости последовательно вернуть BlackBear в обычный режим.

Отчёт: device/OEM/API/ABI/page size, run/source/APK/cert hash, дата, тестовые tenant IDs без секретов, результаты строк, наблюдения RAM/battery/disk, воспроизводимые ошибки и итог `PASS / FAIL / BLOCKED`. Пока телефон не испытан, итог проекта — **READY FOR CONTROLLED PHONE TEST**, не phone-tested и не public release-ready. Лицензионные blockers из [LICENSE_AUDIT](LICENSE_AUDIT.md) остаются независимо от результатов телефона.
