# Canto CLI - UI/UX Design Document

## Filosofia de Design

### Princípios Core
1. **Clareza Visual**: Status imediato, sem confusão
2. **Feedback Instantâneo**: Usuário sempre sabe o que está acontecendo
3. **Mínimo de Fricção**: Poucos comandos, uso intuitivo
4. **Informação Hierarquizada**: Mais importante em destaque
5. **Cores Semânticas**: Verde = sucesso, Vermelho = erro, Amarelo = atenção, Azul = info

---

## 1. Comando Principal: `canto` (Menu Interativo)

### Tela Inicial - Lista de Módulos
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 🚀 Canto Dev Launcher                                    v0.1.0 ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                                   ┃
┃  Select modules to start:                                        ┃
┃                                                                   ┃
┃  ◉ infra          🐳 Docker    ━  STOPPED                       ┃
┃  ◉ backend        📦 Workspace ━  STOPPED   (depends: infra)    ┃
┃  ◉ frontend       📦 Workspace ━  STOPPED   (depends: backend)  ┃
┃  ○ worker         ⚙️  Custom    ━  STOPPED   (depends: infra)    ┃
┃  ○ ml-service     ⚙️  Custom    ━  DISABLED                      ┃
┃                                                                   ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ↑/↓ Navigate  │  Space Select  │  Enter Start  │  A All  │  Q Quit ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### Durante o Startup - Indicadores de Progresso
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 🚀 Canto Dev Launcher                                    v0.1.0 ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                                   ┃
┃  Starting modules...                                             ┃
┃                                                                   ┃
┃  ✓ infra          🐳 Docker    ━  RUNNING   (PID 12453)         ┃
┃  ⏳ backend        📦 Workspace ━  STARTING...                    ┃
┃  ⏸  frontend       📦 Workspace ━  PENDING   (waiting: backend)  ┃
┃                                                                   ┃
┃  [████████████░░░░░░░░] 2/3 modules started                      ┃
┃                                                                   ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ Ctrl+C Stop All  │  L Logs  │  R Restart  │  S Status            ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### Tela Principal - Tudo Rodando (Dashboard)
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 🚀 Canto Dev Launcher                           v0.1.0  │  Uptime: 5m ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                                          ┃
┃  ✓ infra       🐳 RUNNING  │  PID 12453  │  ↑ 5m ago  │  📄 View Logs  ┃
┃  ✓ backend     📦 RUNNING  │  PID 12461  │  ↑ 4m ago  │  📄 View Logs  ┃
┃  ✓ frontend    📦 RUNNING  │  PID 12469  │  ↑ 3m ago  │  📄 View Logs  ┃
┃                                                                          ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 📊 Recent Activity                                                      ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃  [backend]   Server listening on port 3000                              ┃
┃  [frontend]  Local: http://localhost:5173                               ┃
┃  [infra]     PostgreSQL started on port 5432                            ┃
┃                                                                          ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ↑/↓ Select  │  L Logs  │  R Restart  │  X Stop  │  Ctrl+C Stop All     ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### Visualização de Logs (Modo Fullscreen)
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 📄 Logs: backend                                        Ctrl+C to Exit  ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                                          ┃
┃  [12:34:56] [INFO]  Starting server...                                  ┃
┃  [12:34:57] [INFO]  Database connected                                  ┃
┃  [12:34:58] [INFO]  Server listening on http://localhost:3000           ┃
┃  [12:35:12] [DEBUG] GET /api/users 200 45ms                             ┃
┃  [12:35:15] [DEBUG] GET /api/posts 200 23ms                             ┃
┃  [12:35:42] [WARN]  Rate limit approaching for IP 192.168.1.100        ┃
┃  [12:36:01] [ERROR] Failed to connect to Redis: ECONNREFUSED            ┃
┃  [12:36:01] [INFO]  Retrying connection in 5s...                        ┃
┃                                                                          ┃
┃                                                                          ┃
┃                                                                          ┃
┃                                                                          ┃
┃                                                                          ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ ↑/↓ Scroll  │  / Search  │  F Filter Level  │  Esc Back  │  Q Quit     ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## 2. Comandos Diretos (CLI Tradicional)

### `canto start [modules...]`
```bash
$ canto start backend frontend

🚀 Canto Dev Launcher

Starting modules in dependency order...

┌─────────────────────────────────────────┐
│ 1/3 Starting infra (dependency)...      │
└─────────────────────────────────────────┘
✓ infra started (PID 12453) - 2.3s

┌─────────────────────────────────────────┐
│ 2/3 Starting backend...                 │
└─────────────────────────────────────────┘
✓ backend started (PID 12461) - 3.1s

┌─────────────────────────────────────────┐
│ 3/3 Starting frontend...                │
└─────────────────────────────────────────┘
✓ frontend started (PID 12469) - 1.8s

✓ All modules started successfully!

📄 View logs:
  canto logs backend
  canto logs frontend
  canto logs --all

⏹  Stop modules:
  canto stop
```

### `canto status`
```bash
$ canto status

🚀 Canto Dev Launcher - Status

RUNNING (3 modules)
  ✓ infra       🐳 Docker    │ PID 12453 │ ↑ 15m ago │ ./tmp/infra.log
  ✓ backend     📦 Workspace │ PID 12461 │ ↑ 14m ago │ ./tmp/backend.log
  ✓ frontend    📦 Workspace │ PID 12469 │ ↑ 13m ago │ ./tmp/frontend.log

STOPPED (1 module)
  ○ worker      ⚙️  Custom    │ Not running

DISABLED (1 module)
  ✗ ml-service  ⚙️  Custom    │ Disabled in config
```

### `canto logs <module>` (Follow Mode)
```bash
$ canto logs backend

📄 Following logs: backend (Ctrl+C to stop)
───────────────────────────────────────────────────────

[12:34:56] [INFO]  Starting server...
[12:34:57] [INFO]  Database connected
[12:34:58] [INFO]  Server listening on http://localhost:3000
[12:35:12] [DEBUG] GET /api/users 200 45ms
[12:35:15] [DEBUG] GET /api/posts 200 23ms
...
```

### `canto stop [modules...]`
```bash
$ canto stop backend

⏹  Stopping modules...

✓ backend stopped gracefully (2.1s)

ℹ  Dependent modules still running:
  • frontend (depends on backend)

❓ Stop dependent modules? (y/n): _
```

### `canto restart <module>`
```bash
$ canto restart backend

🔄 Restarting backend...

⏹  Stopping backend... ✓ (1.2s)
🚀 Starting backend... ✓ (3.5s)

✓ backend restarted successfully!
```

---

## 3. Mensagens de Erro (User-Friendly)

### Config não encontrado
```bash
$ canto

❌ Configuration file not found

We looked for:
  ✗ dev.config.yaml
  ✗ dev.config.yml
  ✗ dev.config.json
  ✗ dev.config.ts
  ✗ dev.config.js

💡 Create a configuration file:
  canto init

📚 Documentation: https://canto.dev/docs/config
```

### Erro de validação no config
```bash
$ canto

❌ Configuration validation failed

File: dev.config.yaml

Errors found:
  • modules[0].name: Required field missing
  • modules[1].type: Invalid value "invalid". Must be: workspace, docker, or custom
  • modules[2].path: Directory does not exist: ./apps/nonexistent

💡 Fix these errors and try again.

📚 Schema documentation: https://canto.dev/docs/schema
```

### Módulo já está rodando
```bash
$ canto start backend

⚠️  Module already running

Module:  backend
PID:     12461
Uptime:  5 minutes

Options:
  • View logs:    canto logs backend
  • Restart:      canto restart backend
  • Stop first:   canto stop backend
```

### Falha ao iniciar processo
```bash
$ canto start backend

🚀 Starting backend...

❌ Failed to start backend

Reason: Command not found: "npm run dev"

💡 Possible solutions:
  • Install dependencies: cd ./apps/backend && npm install
  • Check if package.json has "dev" script
  • Verify path in config: ./apps/backend

📄 Full error log: ./tmp/backend.log
```

### Dependência não atendida
```bash
$ canto start frontend

⚠️  Unmet dependencies

Module "frontend" depends on:
  ✗ backend (not running)

💡 Start all dependencies first:
  canto start backend frontend

Or start all modules:
  canto start --all
```

---

## 4. Feedback de Progresso

### Spinners & Indicadores
```bash
⏳ Starting...       # Em progresso
✓ Started           # Sucesso
✗ Failed            # Erro
⏸  Pending          # Aguardando
⚠️  Warning          # Atenção
ℹ  Info             # Informação
🔄 Restarting...    # Restart em progresso
⏹  Stopping...      # Parando
```

### Barra de Progresso
```bash
[████████████░░░░░░░░] 2/3 modules started (66%)

[████████████████████] 3/3 modules started (100%)
```

### Tempo Decorrido
```bash
✓ backend started (PID 12461) - 3.1s

✓ All modules started in 7.2s
```

---

## 5. Cores Semânticas

### Paleta
```
✓ Verde    #00C853  Success, Running
✗ Vermelho #FF1744  Error, Failed, Stopped
⏸  Cinza    #9E9E9E  Pending, Disabled
⏳ Amarelo  #FFD600  Warning, Starting
ℹ  Azul    #2196F3  Info
🔄 Ciano   #00E5FF  Action (restart)
```

### Aplicação
- **Verde**: Status RUNNING, comandos bem-sucedidos
- **Vermelho**: Status FAILED/STOPPED, erros
- **Amarelo**: Status STARTING, avisos
- **Cinza**: Status PENDING/DISABLED, texto secundário
- **Azul**: Mensagens informativas, dicas
- **Ciano**: Ações em progresso (restart)

---

## 6. Ícones & Símbolos

### Por Tipo de Módulo
```
🐳 Docker Compose
📦 Workspace (npm/pnpm/yarn/bun)
⚙️  Custom command
```

### Por Status
```
✓ Running
✗ Stopped/Failed
⏳ Starting
⏸  Pending
🔄 Restarting
⏹  Stopping
```

### Informação
```
📄 Logs
🚀 Start/Launch
📊 Status/Stats
💡 Dicas
❌ Erro
⚠️  Warning
ℹ  Info
❓ Pergunta
⏱  Tempo
↑ Uptime
```

---

## 7. Atalhos de Teclado (Modo Interativo)

### Navegação
- `↑/↓` ou `j/k` - Navegar entre módulos
- `Enter` - Confirmar/Ação principal
- `Esc` - Voltar/Cancelar
- `q` ou `Ctrl+C` - Sair

### Ações
- `Space` - Selecionar/Desselecionar
- `a` - Selecionar todos
- `n` - Desselecionar todos
- `l` - Ver logs do módulo selecionado
- `r` - Restart módulo selecionado
- `x` - Stop módulo selecionado
- `s` - Ver status detalhado
- `/` - Buscar/Filtrar
- `?` - Mostrar ajuda

---

## 8. Fluxos de Uso Comuns

### Fluxo 1: First Run (Novo Usuário)
```
1. usuário: canto
   → ❌ No config found
   → 💡 Run: canto init

2. usuário: canto init
   → ✓ Created dev.config.yaml
   → 💡 Edit config, then run: canto

3. usuário: (edita config)

4. usuário: canto
   → Menu interativo
   → Seleciona módulos
   → Enter
   → Dashboard rodando
```

### Fluxo 2: Start Rápido (Usuário Experiente)
```
1. usuário: canto start --all
   → Inicia tudo automaticamente
   → Mostra progresso
   → ✓ Tudo rodando
   → Volta pro terminal
```

### Fluxo 3: Debug de Erro
```
1. usuário: canto
   → Módulo "backend" falha ao iniciar
   → ❌ Mostra erro claro
   → 💡 Sugere verificar log

2. usuário: canto logs backend
   → Vê erro detalhado no log
   → Identifica problema

3. usuário: (corrige problema)

4. usuário: canto restart backend
   → ✓ Backend reiniciado com sucesso
```

### Fluxo 4: Desenvolvimento Normal
```
1. usuário: canto        (ou canto start --all de manhã)
   → Tudo inicia
   → Dashboard rodando

2. Durante o dia:
   - Código atualiza (hot reload automático dos módulos)
   - Se precisar ver log: Ctrl+C, canto logs <module>
   - Se precisar restart: canto restart <module>

3. Fim do dia:
   usuário: canto stop --all
   → ✓ Tudo parado
```

---

## 9. Responsividade (Tamanho do Terminal)

### Terminal Pequeno (< 80 cols)
- Layout compacto
- Uma coluna
- Menos informação secundária

### Terminal Médio (80-120 cols)
- Layout padrão conforme mockups
- Duas colunas quando relevante

### Terminal Grande (> 120 cols)
- Mais informação visível
- Logs em painel lateral (split view)
- Mais módulos visíveis por tela

---

## 10. Acessibilidade

### Screen Readers
- Usar símbolos Unicode + texto descritivo
- Ex: "✓ Running" não só "✓"

### Daltonismo
- Não depender APENAS de cor
- Usar ícones + texto + cor
- Ex: "✓ RUNNING" (ícone + texto + verde)

### Baixa Visão
- Bom contraste
- Texto legível (não muito fino)
- Caixas com bordas claras

---

## 11. Animações & Transições

### Spinners
```bash
⠋ Loading...
⠙ Loading...
⠹ Loading...
⠸ Loading...
⠼ Loading...
⠴ Loading...
⠦ Loading...
⠧ Loading...
⠇ Loading...
⠏ Loading...
```

### Dots
```bash
Starting.
Starting..
Starting...
Starting.
```

### Progress
```bash
[░░░░░░░░░░░░░░░░░░░░] 0%
[████░░░░░░░░░░░░░░░░] 20%
[████████░░░░░░░░░░░░] 40%
[████████████░░░░░░░░] 60%
[████████████████░░░░] 80%
[████████████████████] 100%
```

### Transições de Estado
- Fade in/out suave ao trocar telas
- Smooth scroll ao navegar lista
- Destacar linha selecionada com cor de fundo

---

## 12. Mensagens de Sucesso

### Startup Completo
```bash
✨ All systems go! ✨

Your development environment is ready:

  🐳 infra       http://localhost (Traefik dashboard)
  📦 backend     http://localhost:3000
  📦 frontend    http://localhost:5173

  📄 Logs:  canto logs <module>
  🔄 Restart: canto restart <module>
  ⏹  Stop:   canto stop --all

Happy coding! 🚀
```

---

## 13. Priorização de Informação

### Dashboard - O que Mostrar?

**Primário** (sempre visível):
- Status do módulo (RUNNING/STOPPED)
- Nome do módulo
- Ícone de tipo

**Secundário** (se couber):
- PID
- Uptime
- Path do log

**Terciário** (em tela de detalhes):
- Environment variables
- Working directory
- Command sendo executado
- Dependências
- Recursos (CPU/RAM se implementar)

---

## 14. Inspirações

### Ferramentas similares (referência de UX):
- **PM2**: Dashboard compacto e claro
- **Turborepo**: Output de build elegante
- **Docker Compose**: Logs coloridos por serviço
- **npm/pnpm**: Progress bars claros
- **Vercel CLI**: Deploy feedback excelente
- **Nx**: Task execution visual
- **K9s** (Kubernetes): TUI navigation excelente

---

## Resumo de Implementação

### Fase 1: MVP (Sprint 4)
- ✅ Comando `canto` menu interativo básico
- ✅ Comandos diretos: start, stop, status, logs
- ✅ Cores e ícones
- ✅ Feedback de progresso básico
- ✅ Tratamento de erros com mensagens claras

### Fase 2: Polish (Sprint 7)
- ⏳ Dashboard completo com uptime
- ⏳ Logs em tempo real no TUI
- ⏳ Scroll e busca em logs
- ⏳ Animações suaves
- ⏳ Responsividade a tamanho de terminal
- ⏳ Atalhos de teclado avançados

### Fase 3: Advanced (Futuro)
- ⏳ Split view (logs lado a lado)
- ⏳ Graph de dependências visual
- ⏳ Métricas de recursos (CPU/RAM)
- ⏳ Themes (light/dark)
- ⏳ Custom colors no config

---

**Próximo Passo**: Implementar Sprint 4 com base neste design! 🚀
