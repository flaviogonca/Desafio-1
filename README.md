# Bulir Bookings API

API RESTful para uma plataforma de reserva de serviços. Os **clientes** reservam serviços oferecidos por **prestadores** e pagam com o saldo que têm na plataforma. Desenvolvida para o desafio de Backend da Bulir.

**Stack:** Node.js 22 · NestJS 11 · TypeScript · PostgreSQL 17 · Prisma 7 · JWT · Docker · Jest

## O que faz

| Área | Comportamento |
|---|---|
| Utilizadores | Cadastro como cliente ou prestador (nome completo, NIF, e-mail, senha). NIF e e-mail são únicos; o e-mail não distingue maiúsculas de minúsculas. |
| Autenticação | Login com e-mail **ou** NIF e senha, que devolve um JWT. Todas as rotas, exceto `register`, `login` e `health`, exigem `Authorization: Bearer <token>`. |
| Serviços | Os prestadores criam, listam, editam e eliminam **os seus próprios** serviços (nome, descrição, preço). Os clientes consultam o catálogo. |
| Saldo | Os clientes carregam saldo (simulado, sem integração de pagamento). |
| Reservas | O cliente reserva um serviço. O preço é debitado ao cliente e creditado ao prestador de forma atómica. |
| Cancelamento | O cliente ou o prestador da reserva podem cancelar. O cliente é reembolsado por inteiro, uma única vez. |
| Histórico | Cada utilizador lista as reservas em que participou (como cliente ou como prestador), paginadas e filtráveis por estado. |

## Início rápido

```bash
cp .env.example .env            # depois defina JWT_SECRET (openssl rand -hex 32) e POSTGRES_PASSWORD
```

### Opção A: tudo em Docker

```bash
docker compose --profile app up --build
# API:      http://localhost:3000
# Swagger:  http://localhost:3000/docs
# Health:   http://localhost:3000/health
```

O contentor aplica as migrações da base de dados pendentes antes de arrancar.

### Opção B: base de dados em Docker, API na sua máquina (desenvolvimento)

```bash
docker compose up -d db         # altere DB_PORT no .env se a 5432 estiver ocupada, e atualize DATABASE_URL
npm install
npx prisma migrate deploy       # cria as tabelas
npm run start:dev               # modo watch
```

### Stack semelhante à produção

```bash
cp .env.example .env.production # defina valores fortes para todos os segredos e para CORS_ORIGIN
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Diferenças face ao desenvolvimento: a base de dados **não** é publicada no host, o stack recusa arrancar sem `JWT_SECRET`, `POSTGRES_PASSWORD` e `CORS_ORIGIN`, os contentores reiniciam automaticamente, e a API corre como utilizador não-root, com o sistema de ficheiros só de leitura e um limite de memória.

## Testes

```bash
npm test            # 43 testes unitários: regras de negócio, sem base de dados
npm run test:e2e    # 7 testes ponta a ponta contra a base de dados real (requer `docker compose up -d db` e as migrações aplicadas)
```

É na suite e2e que as regras do dinheiro são provadas: por exemplo, 25 reservas simultâneas de um cliente com saldo para apenas 10 terminam com **exatamente 10** reservas, e 6 cancelamentos simultâneos reembolsam **exatamente uma vez**. Cada execução cria os seus próprios utilizadores e apaga-os no fim.

## API

Documentação interativa e esquemas de pedido e resposta: **`/docs`** (Swagger). Todos os valores monetários são **inteiros em cêntimos** (`5000` significa 50,00). Todos os erros têm o mesmo formato: `{ statusCode, error, message, path, timestamp }`.

| Método | Caminho | Quem | Finalidade |
|---|---|---|---|
| POST | `/auth/register` | público | Criar um utilizador |
| POST | `/auth/login` | público | Autenticar com `identifier` (e-mail ou NIF) e `password` |
| GET | `/users/me` | qualquer utilizador | Perfil com o saldo atual |
| POST | `/services` | prestador | Criar um serviço |
| GET | `/services` | cliente | Catálogo (paginado) |
| GET | `/services/mine` | prestador | Os meus serviços (paginado) |
| PATCH | `/services/:id` | prestador dono | Editar um serviço |
| DELETE | `/services/:id` | prestador dono | Eliminar um serviço (eliminação lógica) |
| POST | `/wallet/top-up` | cliente | Carregar saldo |
| POST | `/bookings` | cliente | Reservar um serviço |
| GET | `/bookings` | qualquer utilizador | O meu histórico (`?page`, `?limit`, `?status`) |
| GET | `/bookings/:id` | participante | Uma reserva |
| POST | `/bookings/:id/cancel` | participante | Cancelar com reembolso total |
| GET | `/health` | público | Verificação de disponibilidade e da base de dados |

Códigos de estado: `400` dados inválidos, `401` token em falta ou inválido, `403` sem permissão, `404` não encontrado, `409` conflito (utilizador duplicado, saldo insuficiente, reserva já cancelada), `429` limite de pedidos excedido.

## Arquitetura

Clean Architecture por módulo. As dependências apontam para dentro: os casos de uso não sabem nada de NestJS, HTTP ou Prisma.

```
src/modules/<módulo>/
  domain/           entidades e portas (interfaces de repositório)
  application/      casos de uso = as regras de negócio
  infrastructure/   adaptadores Prisma e bcrypt/JWT (implementam as portas)
  presentation/     controllers, DTOs, guards
src/shared/         erros de domínio, filtro global de erros, serviço Prisma, health check
```

Módulos: `auth`, `users`, `services`, `wallet`, `bookings`.

Porque importa: as regras vivem em classes simples que os testes unitários executam em milissegundos com dublês em memória, enquanto o Prisma é apenas um adaptador substituível (Repository Pattern).

## Decisões de design

**PostgreSQL, e não MongoDB.** O núcleo deste produto é dinheiro a mover-se entre contas. Isso exige transações ACID, bloqueios de linha e constraints, que o PostgreSQL oferece nativamente. O esquema tem ainda constraints `CHECK` (`balance >= 0`, `price > 0`, `amount > 0`), pelo que mesmo um erro no código não consegue criar um saldo negativo.

**Dinheiro em cêntimos inteiros.** Sem vírgula flutuante, logo sem erros de arredondamento.

**Alterações de saldo atómicas.** Um saldo nunca é lido em Node, alterado e gravado de volta (dois pedidos poderiam sobrepor-se). Cada alteração é, em vez disso, uma instrução SQL condicional executada pelo PostgreSQL:

```sql
UPDATE users SET balance = balance - :price WHERE id = :client AND balance >= :price
```

Os pedidos concorrentes esperam pelo bloqueio da linha; quem chega quando o dinheiro já acabou atualiza zero linhas e recebe `409`.

**Uma transação por reserva.** O débito, o crédito e o registo da reserva são confirmados em conjunto ou não são de todo (porta `UnitOfWork`, adaptador Prisma).

**Cancelar exatamente uma vez.** O cancelamento "reclama" primeiro a reserva com `WHERE status = 'CONFIRMED'`. Se vários cancelamentos disputarem, só um a reclama e só esse reembolsa.

**Sem deadlocks.** As operações bloqueiam sempre primeiro o saldo do cliente e depois o do prestador.

**Preço congelado.** Uma reserva guarda o preço a que foi feita, por isso alterações posteriores ao preço nunca mudam o histórico nem os reembolsos.

**Eliminação lógica dos serviços.** Eliminar esconde o serviço das listas, mas as reservas passadas continuam a apontar para ele.

**Guard JWT escrito à mão** em vez de Passport, para que todo o fluxo de autenticação seja visível num único ficheiro. O algoritmo está fixado em HS256.

**Paginação em todo o lado**, limitada a 100 itens, para que nenhum endpoint devolva uma lista sem limite.

## Segurança

| Risco | Medida |
|---|---|
| SQL injection | O Prisma envia consultas parametrizadas; não há SQL construído por concatenação |
| XSS | API só JSON, entrada validada e campos desconhecidos rejeitados, cabeçalhos de segurança `helmet` |
| CSRF | O token viaja no cabeçalho `Authorization`, e não num cookie, por isso o browser nunca o anexa sozinho |
| Força bruta | Limite global de pedidos e outro mais apertado em `/auth/login` (10 por minuto) |
| Mass assignment | `whitelist` e `forbidNonWhitelisted` em todos os DTOs (truques com `balance` ou `role` são rejeitados) |
| Senhas | bcrypt (12 rondas); o hash nunca é devolvido |
| Enumeração de utilizadores | Mesmo `401` para utilizador desconhecido e senha errada, com o mesmo tempo de resposta; mesmo `409` para e-mail ou NIF duplicado |
| Autorização | Guard de papéis nas rotas, mais verificações de propriedade e de participação dentro dos casos de uso |
| Segredos | Obrigatórios no arranque; `JWT_SECRET` tem de ter pelo menos 32 caracteres |
| Contentor | Imagem multi-stage, utilizador não-root, sistema de ficheiros só de leitura em produção |

## Variáveis de ambiente

Ver `.env.example`. As principais:

| Variável | Finalidade |
|---|---|
| `DATABASE_URL` | String de ligação ao PostgreSQL |
| `JWT_SECRET` | Chave de assinatura, com pelo menos 32 caracteres |
| `JWT_EXPIRES_IN` | Validade do token (por defeito `1h`) |
| `CORS_ORIGIN` | Origens de browser permitidas, separadas por vírgulas. Vazio permite qualquer uma (só em desenvolvimento) |
| `THROTTLE_LIMIT`, `THROTTLE_TTL_MS` | Limite global de pedidos (por defeito 60 por minuto por IP) |
| `THROTTLE_DISABLED` | Só para testes. Nunca definir em produção |
| `DB_PORT`, `API_PORT` | Portas do host publicadas pelo Docker Compose |

## Requisitos cobertos

| Requisito do desafio | Onde |
|---|---|
| Cadastro com NIF e e-mail únicos, dois tipos de utilizador | `auth`, `users` |
| Autenticação JWT | `auth` (guard em `jwt-auth.guard.ts`) |
| Prestadores gerem serviços | `services` |
| Clientes reservam, com verificação de saldo e atualização do saldo de ambos | `bookings`, `wallet` |
| Histórico de reservas | `GET /bookings` |
| Verificação de permissões ao criar e cancelar | guard de papéis e casos de uso |
| Atualizações de saldo atómicas | SQL condicional dentro de uma transação |
| Livre escolha de base de dados e ORM | PostgreSQL e Prisma, justificados acima |

## Pressupostos e limites

- O desafio não diz como um cliente obtém saldo, por isso foi acrescentado um endpoint de carregamento simulado.
- "Atualizar uma reserva" limita-se à única alteração com sentido: cancelá-la.
- Saldo insuficiente responde `409` (o pedido é válido, mas conflita com o estado da conta).
- O formato do NIF não está especificado; aceita-se qualquer sequência de 9 a 14 letras ou dígitos.
- As migrações correm quando o contentor arranca, o que é seguro com uma só instância da API. Com várias instâncias, execute `prisma migrate deploy` como passo de release separado.
- Não implementado: refresh tokens, verificação de e-mail, um fornecedor de pagamento real.
