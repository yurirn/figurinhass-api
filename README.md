# Figurinhass API

Backend REST do tracker de figurinhas Panini — multi-álbum, multi-usuário.

## Stack
- Node 20 (ESM) + Express 5
- Prisma ORM + MySQL 8
- Auth: bcrypt + JWT (cookie httpOnly + Bearer)
- Validação: Zod

## Rodando localmente (em 4 passos)

### 1. Pré-requisitos
- Node 20+ (`node -v`)
- Docker (para subir MySQL) — alternativamente, MySQL local

### 2. Subir o MySQL
```bash
cd api
docker-compose up -d
```
Espera ~10s pro MySQL ficar saudável.

### 3. Instalar dependências e configurar
```bash
npm install
cp .env.example .env
# edite .env se quiser. O default já funciona com o docker-compose
```

### 4. Migrations + seed
```bash
npx prisma migrate dev --name init
npm run seed
```
O seed cria um usuário demo: **demo@figurinhass.app / demo1234** com o álbum Copa do Mundo 2026 pronto.

### 5. Subir a API
```bash
npm run dev
```
API em `http://localhost:4000`. Teste: `curl http://localhost:4000/health`

---

## Endpoints

### Auth
- `POST /auth/register` — `{ email, password, name? }` → cria usuário, setta cookie
- `POST /auth/login` — `{ email, password }` → setta cookie e retorna token
- `POST /auth/logout` — limpa cookie
- `GET  /auth/me` — usuário atual (requer auth)

### Álbuns
- `GET    /albums` — lista resumida (com % completo)
- `POST   /albums` — `{ name, template: "empty"|"copa-2026" }` cria álbum
- `GET    /albums/:id` — álbum completo (catálogo + progresso, formato compatível com o frontend)
- `PATCH  /albums/:id` — `{ name }` renomeia
- `DELETE /albums/:id` — exclui

### Catálogo (CRUD)
- `POST   /sections` `PATCH /sections/:id` `DELETE /sections/:id`
- `POST   /groups`   `DELETE /groups/:id`
- `POST   /teams`    `PATCH /teams/:id`   `DELETE /teams/:id`

### Progresso
- `POST /progress/toggle` — `{ sectionId|teamId, num, action: "toggle"|"set"|"clear", owned?, duplicates? }`
  - `toggle` (padrão): 1º clique = `owned=true`; 2º+ = `duplicates++`
  - `set`: define explicitamente `{ owned, duplicates }`
  - `clear`: remove o registro
- `GET  /progress/album/:albumId` — todo o progresso (para reload)

### Estatísticas
- `GET /stats/:albumId` — resumo + por seção + por grupo
- `GET /stats/:albumId/missing` — lista de faltantes (para PDF)
- `GET /stats/:albumId/duplicates` — lista de repetidas (para troca)

### Import/Export
- `GET  /io/export/:albumId` — exporta JSON (mesmo formato do frontend antigo)
- `POST /io/import` — importa um álbum a partir de JSON

---

## Schema (Prisma)

```
User ─< Album ─< Section ─< StickerProgress
                ─< Group  ─< Team ─< StickerProgress
```

**Catálogo:** `Section`, `Group`, `Team` (estrutura do álbum)
**Progresso:** `StickerProgress` (esparso — só linhas para figurinhas marcadas)

Cada `StickerProgress` pertence a UMA section OU UM team (nunca os dois). `num` é o índice interno (1..count); o número exibido = `start + num - 1`.

---

## Deploy

### Railway (recomendado)
1. `railway login`
2. Na pasta `api/`: `railway init` → "Empty Project"
3. `railway add` → MySQL plugin (Railway gera `DATABASE_URL`)
4. `railway up` (deploy do código)
5. Variáveis necessárias (Settings → Variables):
   - `JWT_SECRET` (gere com `openssl rand -hex 64`)
   - `CORS_ORIGINS=https://figurinhass.app,https://www.figurinhass.app`
   - `NODE_ENV=production`
   - `COOKIE_SECURE=true`
   - `COOKIE_DOMAIN=.figurinhass.app`
6. Rodar migrations: `railway run npx prisma migrate deploy`

### Render
1. Crie um Web Service apontando pro repo
2. Adicione um MySQL externo (Aiven/PlanetScale/etc)
3. Mesmas variáveis acima

### VPS (DigitalOcean / Hetzner)
- Use o `docker-compose.yml` como base. Adicione um serviço Node, nginx reverse proxy, e Let's Encrypt.

---

## Scripts úteis
```bash
npm run dev          # dev server com --watch
npm run start        # produção
npm run prisma:migrate   # migration nova
npm run prisma:studio    # GUI do banco (porta 5555)
npm run seed             # popula demo + Copa 2026
```

---

## Próximos passos sugeridos
- Rate limiting (`express-rate-limit`)
- Tests (vitest + supertest)
- Logging estruturado (pino)
- Refresh tokens
- Compartilhar álbum entre usuários (somente leitura)
