# Предложение: gateway для www.mes.bet

**Дата:** 14 августа 2026
**Статус:** только предложение. Vercel-проект не создавался, домен не переносился, production-деплой не выполнялся.

Каноническая копия также лежит в `C:\Users\91085\solar-monitor\DOMAIN_GATEWAY_PROPOSAL.md`.

Сейчас `www.mes.bet` принадлежит Vercel-проекту `solar-mes-bet` (калькулятор КП). Маршруты `/APP/*` и `/crm/*` проксируются из `solar-mes-bet/vercel.json` на `solar-up.vercel.app` и `mes-crm-ten.vercel.app`.

После текущих правок эта конфигурация стала явнее и покрыта тестами. Ниже — сравнение двух долгосрочных моделей.

---

## Вариант A — оставить routing в `solar-mes-bet`

Домен остаётся на проекте коммерческих предложений. Файл `vercel.json` в репозитории `9108580/solar` остаётся единственным маршрутизатором.

### Преимущества

- Уже работает; не нужно переносить DNS/домен.
- Один файл, который ревьюят при деплое КП.
- Preview-деплой КП сразу проверяет proxy на preview-URL (если задать destination на preview APP/CRM — отдельно, сейчас destinations захардкожены на production `*.vercel.app`).
- Нет четвёртого Vercel-проекта и отдельного биллинга/прав доступа.

### Риски

- Деплой калькулятора может сломать Solar UP и CRM, если испортить `vercel.json`.
- Destinations указывают на **production** APP/CRM (`solar-up.vercel.app`, `mes-crm-ten.vercel.app`). Preview КП всё равно проксирует прод-приложения, а не preview APP/CRM.
- Репозиторий продукта (расчёты КП) смешан с инфраструктурой домена.
- Случайное удаление rewrite `/APP/` снова отдаст корень или 404 вместо мониторинга.
- `framework: null` отключает CRA SPA-fallback; регресс «вернуть catch-all на index.html» снова смешает программы.

### Обязательные тесты перед каждым деплоем КП

```bash
npm run test:routing
```

При наличии preview-URL:

```bash
$env:ROUTING_SMOKE_BASE_URL='https://<preview>.vercel.app'
npm run test:routing:smoke
```

Минимум вручную:

| URL | Ожидание |
|---|---|
| `/APP` | 308 → `/APP/` |
| `/APP/` | HTML Solar UP, не הצעת מחיר |
| `/APP/login/` | Solar UP |
| `/crm` | 308 → `/crm/` |
| `/crm/` | MES CRM |
| `/` | калькулятор |
| `/foo`, `/app`, `/sw.js` | 404, не SPA калькулятора |

### Процесс безопасного деплоя (вариант A)

1. Не деплоить КП, если в diff есть `vercel.json`, пока `test:routing` не зелёный.
2. Ревью `vercel.json` как критический файл (как миграцию БД).
3. Сначала preview, затем smoke, затем production.
4. Деплой APP (`solar-up`) и CRM (`mes-crm`) независим и **не** требует деплоя КП, если менялся только их код.
5. Откат КП: предыдущий successful deployment в Vercel → Instant Rollback.

### Как не удалить proxy-правила случайно

- Держать `test:routing`: падает, если нет `/APP/` и `/crm/` rewrites и 308.
- Не возвращать CRA `framework` без явного решения: это снова включит SPA catch-all.
- Не добавлять rewrite `/(.*) → /index.html`.
- Не привязывать `www.mes.bet` к проекту `solar-up` (у него catch-all на `/APP/`).

---

## Вариант B — отдельный gateway-проект

Инфраструктурный проект (не четвёртая пользовательская программа): только `vercel.json` / redirects / rewrites, без UI калькулятора.

### Как он владеет `www.mes.bet`

1. Создать Vercel-проект, например `mes-bet-gateway`, репозиторий только с routing-конфигом.
2. В Vercel: Domains → снять `www.mes.bet` и `mes.bet` с `solar-mes-bet` и назначить gateway.
3. `solar-mes-bet` остаётся на `*.vercel.app` (или отдельном поддомене вроде `quotes.mes.bet`, если решите позже).

### Как направить трафик

| Путь | Destination |
|---|---|
| `/`, `/q/:path*`, `/api/quote-og`, статика КП | production/preview URL проекта `solar-mes-bet` |
| `/APP`, `/APP/` | 308 `/APP/` затем `https://solar-up.vercel.app/APP/:path*` |
| `/crm`, `/crm/` | 308 `/crm/` затем `https://mes-crm-ten.vercel.app/crm/:path*` |
| legal `/privacy-policy` и др. | как сейчас, на CRM |

Query, cookies и заголовки: Vercel reverse-proxy rewrite сохраняет method, query, `Cookie`, `Host` (как `x-forwarded-host`). Не включать `trailingSlash` циклы: APP не канонизирует `/APP/` обратно, а CRM использует `trailingSlash: true`.

### Циклы

Запрещено:

- gateway `/APP/` → solar-up `/APP/` → 308 `/APP` → gateway `/APP` → 308 `/APP/`.

Сейчас это снято раздельной канонизацией APP и CRM. Gateway должен 308 только точные `/APP` и `/crm`, не вложенные пути.

### Откат

Instant Rollback gateway-проекта. Домен остаётся на gateway. Откат одной программы — rollback её Vercel-проекта, без DNS.

### Перенос домена с минимальным простоем

1. Задеплоить gateway на свой `*.vercel.app`, прогнать smoke против этого URL (подставив те же destinations).
2. Назначить `www.mes.bet` на gateway **без удаления** старых проектов.
3. Проверить `/`, `/APP/`, `/crm/` в течение 1–2 минут.
4. Если плохо — вернуть домен на `solar-mes-bet` (вариант A). TTL у Vercel обычно короткий.

Изменения в Vercel (не выполнять сейчас):

- новый проект;
- перенос Domain с `solar-mes-bet` на gateway;
- права команды на gateway-репозиторий;
- env на gateway почти не нужны (нет секретов, только public destinations).

### Preview до переноса домена

Smoke: `ROUTING_SMOKE_BASE_URL=https://mes-bet-gateway-xxx.vercel.app`.
Preview КП/APP/CRM проверяются на своих `*.vercel.app`. Gateway preview должен либо продолжать указывать на production destinations (как сейчас), либо иметь env `APP_ORIGIN` / `CRM_ORIGIN` / `QUOTES_ORIGIN` для preview-to-preview — это усложнение, его стоит делать только после стабилизации варианта A.

---

## Рекомендация на сейчас

Оставить **вариант A**. Сначала прогнать preview+smoke текущих правок `vercel.json`. Вариант B имеет смысл, когда деплои КП станут частыми и риск сломать proxy неприемлем, или когда понадобится preview-to-preview всех трёх программ.

Не создавать gateway и не переносить домен, пока вариант A не проверен на preview.
