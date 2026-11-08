# Trackium Gateway: первый тестовый деплой Railway

Этот профиль предназначен для одного Gateway, Railway PostgreSQL и native Android-клиента из [PR #8](https://github.com/themightydanik/trackium/pull/8). Он **не разрешает публикацию в Minima**. Android UI и бизнес-логика в deployment PR не меняются.

## Зависимость и границы проверки

На момент подготовки `main` — `d53e26190cc2fb7015349dd029bffab803ac7ab0`, PR #8 ещё открыт. Native API, owner approval, PoP/replay protection и миграция 005 взяты из его исходных коммитов, а не реализованы повторно. Deployment-ветка создана от `main` и включает PR #8 как prerequisite merge. PR деплоя имеет базой ветку PR #8 (`feat/minima-proof-engine`), чтобы его diff содержал только deployment-изменения. Сначала объединить #8, затем обновить deployment-ветку и перенаправить этот PR на `main`. Не объединять автоматически. Если #8 будет squash-merged, перенести **только deployment-коммит(ы)** на новый `main`, без повторного переноса Android-кода.

Проверки в cloud выполняются с локальным PostgreSQL и Docker, а HTTPS ingress моделируется внутренним HTTP с исходным Host/Origin. Это не проверка реального Railway, его TLS/приватной сети или физического Android. Завершить ручную приёмку ниже после деплоя. Не использовать раздел первого Mainnet-перевода из `ANDROID_MINIMA_CORE.md` для этого теста.

## Конфигурация в репозитории

- Существующий `services/gateway/Dockerfile`, build context — **корень репозитория**. В образ входят SQL 001–005 и только публичные v2 assets; Android, Git, `.env`, operator credentials и IaC-зависимости исключены `.dockerignore`.
- `.railway/railway.ts` описывает dedicated test project `Trackium Test`, PostgreSQL `Postgres`, Gateway, Dockerfile, `/readyz`, один replica и безопасные переменные. SDK зафиксирован lockfile в `.railway/` и не входит в Gateway image.
- `DEPLOYMENT_PROFILE=railway-test` включает проверку Host/Origin, ограничение запросов и отказ запуска при включении публикации, simulator, fixture adapter или TCP receiver. Это намеренное ограничение первого теста. Не убирать профиль для обхода ошибки конфигурации.
- `PORT` имеет приоритет над `HTTP_PORT`; Node слушает HTTP на `0.0.0.0`. `ENABLE_TCP_RECEIVER=false` полностью отключает listener 9000, а не просто скрывает порт из Dockerfile.

По [текущей документации Railway](https://docs.railway.com/infrastructure-as-code) новые сервисы используют Infrastructure as Code. `railway.json`/`railway.toml` deprecated и для новых сервисов не подходят; объявленный cutoff для legacy — 2026-12-01. Поэтому такой файл здесь не добавляется. Railway **не применяет `.railway/` при обычном GitHub build**: требуется явный CLI plan/apply либо эквивалентные настройки UI ниже. Автоматического apply/deploy workflow в этом PR нет.

## 1. Создать сервисы и подключить GitHub в Railway UI

1. Создать отдельный проект **Trackium Test** и отдельное тестовое environment. Не применять этот IaC-файл к проекту с посторонними ресурсами: whole-project apply может удалить отсутствующие в файле ресурсы.
2. **New / Create → Database → PostgreSQL**. Назвать сервис `Postgres`. Дождаться успешного запуска и подключённого постоянного volume. Gateway и PostgreSQL должны быть в одном environment и регионе. PostgreSQL major version фиксируется при создании; не менять major через redeploy. Локальные проверки этого PR используют PostgreSQL 16; версию Railway проверить отдельно.
3. **New → Empty Service**, назвать `Gateway`. Сначала настроить переменные и deployment settings, затем подключать source, чтобы автоматический первый build не стартовал с неполной конфигурацией.
4. Gateway → **Settings → Networking → Public Networking → Generate Domain**. Создать один HTTPS Railway domain. Записать origin `https://<generated-domain>` без пути, query, credentials и завершающего `/`. Он не секрет. Указать его в `PUBLIC_ORIGIN`. До готового deployment домен может не отвечать.
5. Gateway → **Variables**: добавить таблицу ниже. Для БД выбрать **Add Reference → Postgres → DATABASE_URL**, значение `${{Postgres.DATABASE_URL}}`. Это **private** URL, не `DATABASE_PUBLIC_URL`, не TCP proxy и не URL, скопированный в Git. Убедиться, что hostname разрешается в приватной сети Railway (`*.railway.internal`). Не выводить URL или password в логи.
6. Gateway → **Settings → Source → Connect Repo**: разрешить Railway GitHub App доступ только к нужному репозиторию, выбрать `themightydanik/trackium`. После объединения обоих PR выбрать `main`. Для отдельной ручной проверки до merge выбрать `feat/railway-gateway-deployment`, содержащую prerequisite #8; отметить это в отчёте теста и затем вернуть source на `main`. Отключить автоматические PR environments: они не должны разделять тестовую БД или owner credentials.
7. **Root Directory** — `/` (корень), **Dockerfile path** — `services/gateway/Dockerfile`. Если UI использует переменную custom Dockerfile, задать `RAILWAY_DOCKERFILE_PATH=services/gateway/Dockerfile`. Не выбирать `services/gateway` как root: COPY frontend/SQL из существующего Dockerfile требует корневого context. В build log должен использоваться Dockerfile, не Railpack/Nixpacks.
8. **Deploy / Start Command** — `node src/server.js` (exec Node, без shell/npm wrapper). **Pre-deploy command** оставить пустым: миграции выполняются тем же процессом перед открытием listener. **Healthcheck Path** — `/readyz`, timeout **120 s**. HTTP domain target port — автоматически предоставленный `PORT`; при ручном target port его значение должно совпадать с `PORT`. Не направлять domain на 9000.
9. **Replicas** — **1**, один регион, **Serverless / App Sleeping** выключить. Restart policy — **On Failure**, максимум **3** retries. Deployment overlap — **0 s**, draining — **15 s**, больше `SHUTDOWN_TIMEOUT_MS=10000`. Не включать autoscaling и отдельный proof/simulator worker.
10. Ни у Gateway, ни у PostgreSQL не создавать **TCP Proxy**. У PostgreSQL отключить автоматически созданный публичный TCP proxy, если он есть. У Gateway оставить только HTTPS HTTP ingress. Доступ к Node HTTP через private network ограничен участниками проекта; не подключать недоверенные сервисы к этому environment.
11. Проверить staged changes, применить их в UI и вручную запустить первый **Deploy**. После неуспешного автоматического build сначала закончить настройки, затем **Redeploy**. Не менять safety flags ради прохождения healthcheck.

Если UI разрешает Generate Domain только после первого deployment, временно задать `PUBLIC_ORIGIN=https://pending.invalid` и оставить web workspace выключенным. Bootstrap deployment нужен только для healthcheck и получения domain: Host guard закрывает его API для реального публичного Host. Затем сгенерировать domain, заменить PUBLIC_ORIGIN на точный HTTPS origin и redeploy. До этой замены не создавать tenant, pairing или session.

### Переменные Gateway

| Имя | Значение первого запуска |
| --- | --- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}`, private reference |
| `PUBLIC_ORIGIN` | `https://<Railway HTTPS domain>` |
| `DEPLOYMENT_PROFILE` | `railway-test` |
| `NODE_ENV` | `production` |
| `ENABLE_TCP_RECEIVER` | `false` |
| `ENABLE_NATIVE_CLIENTS` | `true` |
| `ENABLE_WEB_WORKSPACE` | `false` сначала; `true` только после проверки owner pairing |
| `ENABLE_SERVER_SIMULATOR` | `false` |
| `ENABLE_FIXTURE_ADAPTER` | `false` |
| `PROOF_MODE` | `disabled` |
| `PROOF_ALLOW_LIVE` | `false` |
| `PROOF_ALLOW_MAINNET` | `false` |
| `PROOF_MAX_PUBLICATIONS` | `1` |
| `SHUTDOWN_TIMEOUT_MS` | `10000` |
| `PORT` | предоставляет Railway; не подменять значением TCP_PORT |

Не задавать `MINIMA_RPC_URL`, writer/reader credentials, publisher wallet, job signing key или Mainnet policies. Для чтения в Android signer pin не требуется; он нужен для signed publication jobs, которых в этом профиле нет. Native pairing всё ещё требует owner scopes `read,admin,publish` по контракту #8; наличие scope `publish` **не включает** proof engine. APK live/Mainnet switches оставить выключенными. Подключение BlackBear и ADMIN grant в кошельке для этого read-only теста не требуется.

### Воспроизводимое применение IaC (альтернатива ручным настройкам)

С доверенного рабочего компьютера, Node >=22.18 и установленным официальным Railway CLI >=5.42.1 (при подготовке актуальная версия 5.71.0):

```sh
cd /path/to/trackium/.railway
npm ci
npm run check
npm test
railway login
railway link
railway config plan
# Проверить выбранные project/environment и каждое изменение.
# Только оператор, когда действительно готов применить конфигурацию:
railway config apply
```

Описанные выше сервисы должны называться `Postgres` и `Gateway`, а `PUBLIC_ORIGIN` уже быть задан в Gateway: IaC использует `preserve()`. Проверить, что plan сопоставляет существующие сервисы и не создаёт дубликаты/не заменяет БД. Если видны неожиданные delete, replacement, смена PostgreSQL major или volume — остановиться и согласовать имена/состояние. Не использовать `--confirm-destructive`. Не делать `config pull --include-variables` или `plan --show-values`: они могут вывести секреты.

GitHub source подключается через UI и намеренно не задаётся IaC. Domain также создаётся в UI. При последующих apply файл снова задаёт `ENABLE_WEB_WORKSPACE=false`; после завершённой owner-pairing приёмки изменить эту строку на `true` отдельным просмотренным изменением, если IaC используется как источник конфигурации. Не оставлять UI и файл в молчаливом расхождении.

## 2. Startup, миграции, перезапуск

Startup создаёт raw journal, затем использует существующий `migrate(pool)` для 001–005 в одной транзакции с `pg_advisory_xact_lock(731824901)`. Для каждой SQL-миграции сохраняется SHA-256; уже применённая миграция только сравнивается с записью в `gateway_schema_migrations`. SQL-файлы и механизм миграций в deployment PR не меняются. Несовпадение checksum завершает startup с ошибкой, транзакция откатывается, порт не открывается. Нельзя исправлять такой сбой удалением migration rows, переименованием старых SQL или отключением проверки. Найти правильную версию исходников/БД и проверить backup.

Повторный deploy не удаляет tenant, shipment, event, proof, session или nonce. База и её volume принадлежат `Postgres`, не файловой системе Gateway. Не запускать `DROP`, reset, compose down -v или новое создание БД вместо redeploy. Перед первым обновлением существующей БД сделать backup и проверить восстановление отдельно. После миграции 005 не откатывать Gateway на код без #8; mixed-version workers не поддерживаются.

Railway посылает SIGTERM старому процессу. Gateway прекращает приём, ждёт текущие HTTP-запросы/принятые записи и закрывает pg pool; предел 10 s. Railway должен дать 15 s до принудительного завершения. `overlapSeconds=0` и один replica ограничивают steady state, но платформа всё равно может кратко запускать replacement до выключения старого экземпляра для healthcheck. Для **строго одного процесса**, включая deploy, выполнить maintenance stop старого deployment, дождаться завершения, затем Deploy нового; возможен простой. Для первого теста использовать этот порядок. Не обещать zero-downtime/отсутствие overlap без проверки реального Railway. Параллельные SQL-миграции сериализуются; in-memory HTTP budgets общими между процессами не являются.

`GET /healthz` показывает liveness, `GET /readyz` выполняет `SELECT 1` и показывает доступность БД; оба не раскрывают секреты. Успех readiness означает, что startup/migrations уже завершились. `/readyz` возвращает 503 при потере БД и может восстановиться без рестарта. Railway использует healthcheck при активации deployment, **не для непрерывного мониторинга** — для последнего нужен внешний монитор.

## 3. Первый tenant и owner credential

Используются существующие operator CLI, не публичный provisioning endpoint. Установить Railway CLI, выполнить `railway login`, `railway link`, выбрать правильные project/environment/Gateway. Открыть **authenticated** shell внутри запущенного Gateway:

```sh
railway ssh --service Gateway
```

В shell контейнера (не в build/start command, не в CI):

```sh
cd /app
umask 077
operator_dir="$(mktemp -d /tmp/trackium-owner.XXXXXX)"
node src/telemetry/admin.js create-tenant --name="Trackium Railway Test" --out="$operator_dir/bootstrap.json"
# Вывести только несекретный tenant UUID, не содержимое файла:
TENANT_ID="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1])).tenant_id)' "$operator_dir/bootstrap.json")"
node src/telemetry/admin.js issue-key --tenant="$TENANT_ID" --scopes=read,admin,publish --out="$operator_dir/owner.json"
# Необязательно: отдельный credential для контролируемого создания тестовых записей.
node src/telemetry/admin.js issue-key --tenant="$TENANT_ID" --scopes=read,admin,shipments --out="$operator_dir/data-operator.json"
```

`DATABASE_URL` уже поступает в SSH-процесс из Railway. Native `railway run` на ноутбуке не даёт доступ к private Railway DNS — не заменять URL публичным ради удобства. CLI пишет файл с `0600`, `wx`, вне `/app`; выводит только факт сохранения. При ошибке записи новый credential отзывается. `create-tenant` выдаёт bootstrap key со всеми scopes: после выдачи ограниченного owner отозвать bootstrap, не использовать его в APK.

Постоянный Gateway volume этому CLI **не требуется**: в PostgreSQL остаётся hash, а plaintext хранится на доверенном компьютере оператора. Пока SSH shell открыт, записать несекретный путь `$operator_dir` и tenant UUID. На рабочем компьютере создать приватную папку вне checkout, настроить SSH alias по [Railway SSH](https://docs.railway.com/cli/ssh) и скопировать файлы через зашифрованный SFTP/scp:

```sh
umask 077
mkdir -p "$HOME/.config/trackium/railway-test"
chmod 700 "$HOME/.config/trackium/railway-test"
railway ssh config --service Gateway --alias trackium-railway-test
# Подставить реальный временный путь из текущего контейнера:
scp trackium-railway-test:/tmp/trackium-owner.XXXXXX/owner.json "$HOME/.config/trackium/railway-test/owner.json"
scp trackium-railway-test:/tmp/trackium-owner.XXXXXX/data-operator.json "$HOME/.config/trackium/railway-test/data-operator.json"
chmod 600 "$HOME/.config/trackium/railway-test/"*.json
```

Не игнорировать проверку SSH host key. Если account/CLI не поддерживает SSH/SFTP, остановить provisioning до обеспечения поддержанного защищённого operator channel. Не делать `cat` credential в Railway logs, не добавлять token в argv/curl history, GitHub Secrets, issue, artifact, APK или browser storage. Хранить локальную папку на шифрованном диске с контролем доступа либо импортировать файл в approved secret manager. Проверьте корректность JSON локально, выводя только `id`, `tenant_id`, `scopes`, а не token.

В исходном SSH shell после успешного переноса:

```sh
BOOTSTRAP_ID="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1])).id)' "$operator_dir/bootstrap.json")"
node src/telemetry/admin.js revoke-key --id="$BOOTSTRAP_ID"
# Пока нужен browser approval, сохранить owner.json только в этой временной папке.
# После окончания pairing удалить временные файлы:
# rm "$operator_dir/bootstrap.json" "$operator_dir/owner.json" "$operator_dir/data-operator.json"
# rmdir "$operator_dir"
```

Не redeploy до переноса: временная файловая система эфемерна. Если файл потерян, через authenticated shell отозвать потерянный key по его ID и выпустить новый; не извлекать hash как token и не обходить owner approval. Долгоживущий owner token не нужен процессу Gateway в environment variables. При необходимости постоянного хранения внутри Railway использовать отдельный закрытый volume/secret delivery с владельцем node и `0600`, вне `/app`, с backup/rotation; это отдельная настройка, не обязательная для данного профиля.

## 4. Native Android pairing и чтение

1. Установить APK из проверенного build PR #8 по `docs/ANDROID_MINIMA_CORE.md`. В Settings задать точный HTTPS origin и tenant UUID. Не вводить owner credential в APK. Не включать live/Mainnet switches.
2. Создать native challenge в Android. По доверенному каналу сверить origin, tenant и UUID challenge на обоих устройствах. Не одобрять случайный UUID из сообщения третьего лица. Challenge действует 2 минуты.
3. На доверенном рабочем компьютере из корня этого checkout:

   ```sh
   node services/gateway/src/proofs/admin.js native-approve https://<Railway-domain> "$HOME/.config/trackium/railway-test/owner.json" <CHALLENGE_UUID>
   ```

   CLI передаёт owner credential через HTTPS Bearer, не через query/redirect; печатает только результат approval. Приватная БД этому действию не нужна.
4. Завершить Claim/Pair в APK. До approval claim должен отказываться, чужой tenant owner не может одобрить challenge. Session действует 15 минут, требует PoP каждого запроса, audience с этим HTTPS origin, timestamp ±30 s и уникальный nonce, максимум 900 запросов. Синхронизировать часы телефона. Expiry требует нового pairing; смена домена также меняет audience.
5. Открыть Dashboard, Shipments, Devices, Proofs. На новой БД корректный результат — пустые списки, а не автоматически включённое demo. Для содержательной проверки создать **явно синтетический** device через существующий `POST /v1/devices` с data-operator credential (`{"label":"Railway synthetic fixture","mode":"synthetic"}`), затем shipment через `POST /v1/shipments`, указав его device UUID, две route points и conditions. Контракты — `GATEWAY_SHIPMENTS_SIMULATION.md`; ни simulator, ни fixture adapter включать не требуется. Raw TCP и реальные GL110-GL устройства в тест не входят.
6. В Android убедиться, что shipment/device принадлежат этому tenant, а Proofs показывают engine disabled/отсутствие опубликованных proofs. Не создавать вымышленные TXID или proof для заполнения экрана. Повторить с отдельным tenant B: A не должен читать его device/shipment/proofs по известному UUID (404), а native session не может создавать shipments (403).
7. Выполнить maintenance restart Gateway без удаления PostgreSQL. Уже выданная, неистёкшая native session должна продолжить чтение; повтор прежнего подписанного запроса с тем же nonce остаётся запрещён (409). Перезапуск Android не должен требовать owner token. Реальное поведение APK/Keystore на устройстве фиксируется оператором, не считается проверенным cloud-тестом.

Для запроса с owner/data-operator файлом использовать существующий доверенный tooling или локальный Node script, который читает JSON с диска и передаёт `authorization` только в HTTPS header. Не копировать token в curl command line. Для этого теста не выполнять `policy`, event approval или любую wallet/publication команду.

Например, однократно создать device/shipment существующими API с доверенного компьютера (Node >=22). Это **явно синтетические** записи, без telemetry ingestion и без публикации; повторный запуск создаст новые записи:

```sh
node --input-type=module - "$HOME/.config/trackium/railway-test/data-operator.json" "https://<Railway-domain>" <<'JS'
import { readFile } from 'node:fs/promises';
const [file, configuredOrigin] = process.argv.slice(2);
try {
  const origin = new URL(configuredOrigin);
  if (origin.protocol !== 'https:' || origin.username || origin.password ||
      origin.pathname !== '/' || origin.search || origin.hash) throw Error();
  const { token } = JSON.parse(await readFile(file, 'utf8'));
  const post = async (path, input) => {
    const response = await fetch(new URL(path, origin), {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      body: JSON.stringify(input)
    });
    if (!response.ok) throw Error();
    return response.json();
  };
  const device = await post('/v1/devices', { label: 'Railway synthetic fixture', mode: 'synthetic' });
  const shipment = await post('/v1/shipments', {
    name: 'Railway synthetic cargo', device_id: device.id,
    route: [{ name: 'A', latitude: 50, longitude: 30 }, { name: 'B', latitude: 51, longitude: 31 }],
    conditions: { temperature_min_c: 2, temperature_max_c: 8 }
  });
  console.log(JSON.stringify({ device_id: device.id, shipment_id: shipment.id }));
} catch {
  console.error('Test-data setup failed; inspect Gateway status without printing credentials.');
  process.exitCode = 1;
}
JS
```

## 5. Web workspace: проверка owner pairing перед включением

Cloud integration test проверяет реальный PostgreSQL pairing с HTTPS public origin через внутренний HTTP: Secure/HttpOnly/SameSite cookies, одноразовый claim, отказ foreign owner и foreign Origin. Перед включением публичного workspace повторно проверить, что применён именно этот проверенный commit, точный PUBLIC_ORIGIN, один HTTPS ingress и защищённый операторский канал из раздела 3. Затем включить `ENABLE_WEB_WORKSPACE=true` в **тестовом** environment и redeploy; сразу выполнить ручной acceptance. Если он не проходит — вернуть `false`, не ослаблять origin/CSRF проверки.

1. Открыть `/app/` через публичный HTTPS domain. Без pairing нет доступа к tenant data; demo остаётся явным opt-in и не попадает в Gateway.
2. Создать browser challenge для нужного tenant в Settings. Сверить UUID и approve через существующий CLI внутри authenticated Gateway SSH shell, используя временный owner JSON вне `/app`:

   ```sh
   cd /app
   node src/telemetry/admin.js approve-pairing --credential-file=/tmp/trackium-owner.XXXXXX/owner.json --challenge=<UUID> --scopes=read
   ```

   Если временный файл уже удалён, загрузить owner JSON через SFTP в новую приватную папку, `chmod 600`, после approval удалить. Не добавлять owner key в UI.
3. Claim работает только с исходной pairing cookie и точным same-origin browser request: Host, Origin, `Sec-Fetch-Site: same-origin`, `X-Trackium-Client: cargo-v2`. Cookie должна иметь `Secure`, `HttpOnly`, `SameSite=Strict`; session TTL 5 минут. Для write также нужен CSRF. Не менять cookie flags из-за Railway TLS termination.
4. Проверить отказ claim до approval, чужого owner, повторного claim, неправильного Origin, отсутствующего CSRF при session write. После revoke owner/session доступ прекращается. Read-only browser session не получает admin/fixture/simulate scopes.

`X-Forwarded-Host`, `X-Forwarded-Proto`, `Forwarded` и `X-Forwarded-For` не определяют authentication или origin. Host должен остаться исходным публичным Host; если Railway его переписывает, сначала исследовать реальное поведение proxy. Не принимать любой forwarded host и не расширять CORS. Health exception с `healthcheck.railway.app` действует только на точные GET `/healthz` и `/readyz`, не на `/v1/*`.

## 6. Лимиты и диагностические проверки

Для тестового профиля есть глобальные process-local budgets: 1200 HTTP requests/minute, 60 pairing requests/minute (native challenge/claim/approval и browser pairing вместе), 32 одновременных non-health requests. Все proxy peers разделяют budget, поэтому подстановка X-Forwarded-For его не сбрасывает. Health имеет отдельный budget 120/minute и 2 одновременных запроса. Ответ при превышении — 429; для non-health `Retry-After: 60`. Сохраняются body limits 16 KiB (обычные JSON)/256 KiB (native/proof), HTTP request timeout 10 s, headers timeout 5 s, native tenant challenge capacity и session replay/request limits. Это защита небольшого теста, не распределённый rate limiter или DDoS SLA. При публичном abuse доступ к pairing может временно исчерпаться; для расширения аудитории нужна отдельная edge/WAF политика и оценка лимитов.

Проверка с рабочего компьютера (origin не секрет):

```sh
curl --fail --max-time 15 https://<Railway-domain>/healthz
curl --fail --max-time 15 https://<Railway-domain>/readyz
curl --max-time 15 -i https://<Railway-domain>/v1/devices
curl --max-time 15 -i https://<Railway-domain>/v1/shipments
```

Ожидается 200 на health/readiness, отказ 401/403 на чтение без credentials (403 также возможен из-за отсутствия browser origin headers). Native challenge/claim намеренно доступны без bearer, но не выдают session без отдельного owner approval и device proof. Публичного создания tenant или выдачи owner key нет. Tenant-scoped administrative API требуют owner scopes; это не анонимный provisioning.

В Railway PostgreSQL console/private operator connection выполнить только несекретные read-only запросы:

```sql
SELECT version, checksum, applied_at FROM gateway_schema_migrations ORDER BY version;
-- Ровно версии 1–5; applied_at/checksum не меняются после повторного deploy.
SELECT count(*) AS proofs FROM cargo_proofs;
SELECT count(*) AS submissions FROM cargo_proofs WHERE txpow_id IS NOT NULL;
```

В новой тестовой БД обе proof counts должны оставаться 0 даже после создания shipments/events и restart. Старая БД может содержать исторические proofs: проверить отсутствие **новых** записей/отправок относительно baseline. Не просматривать API token hashes, native PoP keys или секреты при диагностике. В Gateway log не должно быть TCP listener, RPC/publication сообщений или credential values.

| Симптом | Проверка и действие |
| --- | --- |
| Build не находит index.html/SQL | Root Directory `/`, Dockerfile `services/gateway/Dockerfile`, корневой context; не менять COPY на неполный build |
| Startup не видит `DATABASE_URL`/не подключается | Reference на private Postgres, один environment/регион, БД ready; не печатать URL и не включать публичный proxy |
| Invalid `PORT` | Передать штатный Railway PORT, убрать конфликтующие ручные значения; PORT не должен быть 9000 |
| Healthcheck timeout | Target port соответствует PORT; `/readyz` возвращает 200; проверить startup/migration error и DB. Host health probe уже обработан |
| Migration checksum mismatch | Остановить rollout; проверить commit и backup; не редактировать историю миграций и не удалять данные |
| Host/Origin 403 | Сверить exact HTTPS PUBLIC_ORIGIN и публичный Host, custom domain/порт, браузерные headers; не доверять forwarded headers для обхода |
| Native 401/409 | Часы, TTL, audience/domain, повтор nonce, expiry/revocation approving owner; создать новый challenge и одобрить вручную |
| Pairing 429 | Подождать budget/TTL, проверить abuse и число активных challenges; не увеличивать лимиты вслепую |
| Mainnet policy/job 403 | Ожидаемое поведение тестового профиля. Не включать live/Mainnet flags |
| Credential file исчез после redeploy | Использовать внешнее защищённое хранилище; при потере отозвать key через SSH и выпустить новый |
| SIGKILL/exit failure при остановке | Проверить drain >=15 s, startup/текущие DB requests и отсутствие wrapper-процессов; не считать такой restart чистым |

## 7. Автоматические проверки и ручная приёмка

```sh
cd services/gateway
npm ci
npm test
# TEST_DATABASE_URL задаётся защищённо для отдельной disposable локальной БД:
npm run test:integration
cd ../../.railway
npm ci
npm run check
npm test
cd ..
node --test tests/minidapp/core.test.cjs
# При наличии внешнего Playwright/Chromium:
NODE_PATH=/path/to/test-tools/node_modules node --test tests/minidapp/browser.test.cjs tests/minidapp/server.integration.cjs
```

Не запускать интеграционные tests на Railway deployment database: они создают/удаляют изолированные test schemas и предполагают disposable DB. `.github/workflows/gateway.yml` запускает Gateway unit/integration, offline IaC type/authoring checks и MiniDapp core tests с эфемерной PostgreSQL, без Railway credentials/deploy и без настоящего Minima.

Новые tests проверяют upgrade 004→005, concurrent/repeat migrations и checksum failure для всех пяти SQL, сохранность tenant/device/shipment/session/replay nonce после SIGTERM/restart реального Node process, отказ unauth provisioning/read, cross-tenant native/browser pairing и чтение, secure cookies при TLS termination, выключенный simulator/fixture и отказ Mainnet policy/approval. Docker image собирается из корня отдельно. Это не подтверждает реальный Railway.

Оператору после деплоя записать commit, deployment ID, PostgreSQL version, domain и результаты без секретов: TLS с системным trust store; health/readiness; private DB/reference и версии 1–5; один replica/нет TCP proxies; отсутствие анонимного чтения и provisioning; Android native owner pairing и чтение Shipments/Devices/Proofs; cross-tenant отказ; controlled restart и сохранность данных; отсутствие новых Minima submissions. Только после этого считать **реальный тестовый деплой** проверенным. Публикация в Mainnet и production-readiness в эту приёмку не входят.

Источники Railway: [Dockerfiles](https://docs.railway.com/guides/dockerfiles), [Private networking](https://docs.railway.com/guides/private-networking), [Healthchecks](https://docs.railway.com/guides/healthchecks), [Infrastructure as Code](https://docs.railway.com/infrastructure-as-code), [IaC reference](https://docs.railway.com/infrastructure-as-code/reference), [SSH/SFTP](https://docs.railway.com/cli/ssh). Проверены при подготовке 2026-11-08; UI labels могут меняться.
