# 🎯 Plano de Implementação - Dashboard UI/UX & Performance Improvements

## Visão Geral

**Objetivo**: Implementar 15 melhorias de UI/UX e performance no Dashboard Canto  
**Tempo Total Estimado**: 25-35 horas  
**Abordagem**: Iterativa e incremental (sprints curtos)  
**Estratégia**: Quick wins primeiro, depois features core, finalmente polish

---

## 📅 Cronograma de Implementação

### **FASE 1: QUICK WINS** ⚡ (5 horas - DIA 1) ✅ **COMPLETED**

**Objetivo**: Ganhos rápidos com alto impacto

#### Task 1.1: Otimizar forceUpdate Delay [5 min] ✅ **DONE**

- **Arquivo**: `src/cli/commands/dashboard.tsx` (linha 112)
- **Mudança**: Remover `setTimeout(..., 500)` ou reduzir para 100ms
- **Teste**: Verificar que updates acontecem mais rápido após ações
- **Branch**: `feat/optimize-force-update`
- **Status**: Completed - setTimeout removed, updates now instantaneous

```tsx
// ANTES
setTimeout(() => dataManager.forceUpdate(), 500);

// DEPOIS
dataManager.forceUpdate(); // Imediato e assíncrono
```

#### Task 1.2: Debounce na Busca [15 min] ✅ **DONE**

- **Arquivo**: `src/cli/commands/dashboard.tsx`
- **Mudança**: Adicionar debounce de 300ms no searchQuery
- **Dependência**: Nenhuma
- **Teste**: Buscar com muitas teclas rapidamente
- **Branch**: `feat/debounced-search`
- **Status**: Completed - 300ms debounce implemented, reduces re-renders during typing

```tsx
const [searchQuery, setSearchQuery] = useState('');
const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

useEffect(() => {
  const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
  return () => clearTimeout(timer);
}, [searchQuery]);
```

#### Task 1.3: Atalhos Vim-style [30 min] ✅ **DONE**

- **Arquivo**: `src/cli/commands/dashboard.tsx` (handleInput)
- **Mudança**: Adicionar j/k/gg/G para navegação
- **Dependência**: Nenhuma
- **Teste**: Testar todos os novos atalhos
- **Branch**: `feat/vim-keybindings`
- **Status**: Completed - j/k for up/down, gg for top, G for bottom implemented

```tsx
// j = down, k = up, gg = top, G = bottom
// Added lastKey state to track 'gg' double-press
```

#### Task 1.4: Ordenação Inteligente [1-2h] ✅ **DONE**

- **Arquivo**: `src/cli/commands/dashboard.tsx`
- **Mudança**: Ordenar por: favoritos > running > alfabético
- **Dependência**: PreferencesManager (já implementado)
- **Teste**: Favoritar módulos e verificar ordem
- **Branch**: `feat/smart-sorting`
- **Status**: Completed - sortedModules useMemo added with 3-tier sorting

```tsx
const sortedModules = useMemo(() => {
  return [...filteredModules].sort((a, b) => {
    // 1. Favorites first
    const aFav = prefsManager.isFavorite(a.name);
    const bFav = prefsManager.isFavorite(b.name);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;

    // 2. Status priority (RUNNING > STARTING/STOPPING > STOPPED)
    const statusPriority = { RUNNING: 3, STARTING: 2, STOPPING: 2, STOPPED: 1 };
    const aPriority = statusPriority[a.status] || 0;
    const bPriority = statusPriority[b.status] || 0;
    if (aPriority !== bPriority) return bPriority - aPriority;

    // 3. Alphabetically by name
    return a.name.localeCompare(b.name);
  });
}, [filteredModules, prefsManager]);
```

#### Task 1.5: Sistema de Favoritos Visual [2-3h] ✅ **DONE**

- **Arquivos**:
  - `src/cli/commands/dashboard.tsx` (adicionar tecla 'f')
  - `src/cli/components/dashboard/ModuleRow.tsx` (adicionar estrela)
- **Mudança**: Mostrar ★/☆ e toggle com 'f'
- **Dependência**: PreferencesManager
- **Teste**: Favoritar/desfavoritar módulos
- **Branch**: `feat/visual-favorites`
- **Status**: Completed - ★/☆ icons displayed, 'F' key toggles favorites

```tsx
// ModuleRow - added isFavorite prop and star display
<Text color={isFavorite ? "yellow" : "gray"}>
  {isFavorite ? "★" : "☆"}
</Text>

// Dashboard - 'f' key handler added
else if (input === 'f' || input === 'F') {
  const module = sortedModules[selectedModule];
  if (module) {
    if (prefsManager.isFavorite(module.name)) {
      prefsManager.removeFavorite(module.name);
    } else {
      prefsManager.addFavorite(module.name);
    }
    dataManager.forceUpdate();
  }
}
```

**Checkpoint 1**: Testar todas as melhorias juntas antes de continuar

---

### **FASE 2: UX CORE** 🎨 (12-15 horas - DIAS 2-3) ✅ **COMPLETED**

**Objetivo**: Melhorar feedback e clareza visual

#### Task 2.1: Sistema de Notificações/Toasts [3-4h] ✅ **DONE**

- **Arquivos**:
  - `src/cli/components/dashboard/Toast.tsx` (NOVO)
  - `src/cli/commands/dashboard.tsx`
- **Mudança**: Adicionar sistema de toasts para feedback
- **Dependência**: Nenhuma
- **Teste**: Executar ações e verificar toasts
- **Branch**: `feat/toast-notifications`
- **Status**: Completed - Toast component created, integrated with all actions

**Subtasks Completos**:

- ✅ Criar componente `Toast.tsx` com 4 tipos (success, error, warning, info)
- ✅ Adicionar estado de toast no Dashboard
- ✅ Integrar com ações (start/stop/restart)
- ✅ Integrar com favoritos (add/remove)
- ✅ Auto-dismiss após 3s
- ✅ Suporte para success/error/warning/info

```tsx
interface ToastData {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}
// showToast('✓ Started module-name', 'success');
```

#### Task 2.2: Indicadores de Performance por Módulo [2-3h] ✅ **DONE**

- **Arquivo**: `src/cli/components/dashboard/ModuleRow.tsx`
- **Mudança**: Mostrar CPU/RAM com barras de progresso quando módulo selecionado
- **Dependência**: ModuleStatus já tem cpu/memory
- **Teste**: Verificar valores corretos e barras
- **Branch**: `feat/module-performance-indicators`
- **Status**: Completed - Progress bars show CPU/RAM when module selected

```tsx
// Quando módulo está selecionado:
{isSelected && module.pid && (
  <Box>
    CPU: {createBar(module.cpu, 100, 10)} {module.cpu.toFixed(1)}%
    RAM: {createBar(module.memory, 1GB, 10)} {formatMemory(module.memory)}
  </Box>
)}
```

#### Task 2.3: Confirmação para Ações Destrutivas [2-3h] ✅ **DONE**

- **Arquivo**: `src/cli/commands/dashboard.tsx`
- **Mudança**: Adicionar modal de confirmação para stop/restart
- **Dependência**: Nenhuma
- **Teste**: Tentar parar/reiniciar e confirmar/cancelar
- **Branch**: `feat/action-confirmations`
- **Status**: Completed - Confirmation modal for stop/restart actions

**Subtasks Completos**:

- ✅ Criar estado de confirmação
- ✅ UI de confirmação (modal/overlay) com border amarelo
- ✅ Lógica de y/n/ESC
- ✅ Integrar com ações destrutivas (stop/restart)
- ✅ Start não requer confirmação

```tsx
// Modal aparece ao pressionar 'X' ou 'R'
// Usuário deve confirmar com Y ou cancelar com N/ESC
```

#### Task 2.4: Status Badges Melhorados [1h] ✅ **DONE**

- **Arquivo**: `src/cli/components/dashboard/ModuleRow.tsx`
- **Mudança**: Badges coloridos com ícones diferenciados
- **Dependência**: Nenhuma
- **Teste**: Ver diferentes status (RUNNING, STOPPED, STARTING, STOPPING, ERROR)
- **Branch**: `feat/improved-status-badges`
- **Status**: Completed - Color-coded status icons with proper symbols

```tsx
const statusConfig = {
  RUNNING: { icon: '●', color: 'green' },
  STOPPED: { icon: '○', color: 'gray' },
  STARTING: { icon: '◐', color: 'yellow' },
  STOPPING: { icon: '◑', color: 'yellow' },
  ERROR: { icon: '✗', color: 'red' },
};
```

#### Task 2.5: Logs com Syntax Highlighting [3-4h] ✅ **DONE**

- **Arquivo**: `src/cli/components/dashboard/LogsScreen.tsx`
- **Mudança**: Colorir logs por tipo (error/warn/info/success)
- **Dependência**: Nenhuma
- **Teste**: Ver logs com diferentes níveis
- **Branch**: `feat/log-syntax-highlighting`
- **Status**: Completed - Regex-based log colorization with 5 patterns

**Subtasks Completos**:

- ✅ Criar função `colorizeLogLine(line)`
- ✅ Regex patterns para errors (vermelho)
- ✅ Regex patterns para warnings (amarelo)
- ✅ Regex patterns para success (verde)
- ✅ Regex patterns para info/debug (cyan)
- ✅ Destacar timestamps (dim)

```tsx
// Patterns detectados:
// ERROR: error, exception, fatal, fail, crash, [ERROR], ERROR:
// WARN: warn, warning, caution, alert, [WARN], WARN:
// SUCCESS: success, complete, done, ready, listening, started
// INFO: info, debug, trace, [INFO], [DEBUG]
// TIMESTAMP: ISO 8601, HH:MM:SS formats
```

**Checkpoint 2**: ✅ UX melhorado testado e funcionando

---

### **FASE 3: POLISH & OPTIMIZATION** ✨ (8-12 horas - DIAS 4-5) ✅ **PARTIALLY COMPLETED**

**Objetivo**: Refinamento e otimizações finais

#### Task 3.1: Lazy Loading de Screens [30 min] ⏭️ **SKIPPED**

- **Motivo**: React.lazy não funciona bem em ambientes Node.js/Ink
- **Status**: Skipped - Not applicable for Ink-based CLI apps

#### Task 3.2: Fuzzy Search [1h] ✅ **DONE**

- **Arquivo**: `src/cli/commands/dashboard.tsx`
- **Mudança**: Usar fuse.js para busca fuzzy tolerante a typos
- **Dependência**: `npm install fuse.js`
- **Teste**: Buscar com typos e ver matches relevantes
- **Branch**: `feat/fuzzy-search`
- **Status**: Completed - Fuse.js integrated with 0.4 threshold

```tsx
const fuse = new Fuse(modules, {
  keys: ['name', 'type'],
  threshold: 0.4, // Tolerância a typos
  ignoreLocation: true,
});
// Agora busca funciona com: "dker" encontra "docker"
```

#### Task 3.3: Cachear Module List Rendering [1h] ✅ **DONE**

- **Arquivo**: `src/cli/components/dashboard/ModuleRow.tsx`
- **Mudança**: Melhorar React.memo com custom comparison
- **Dependência**: Nenhuma
- **Teste**: Verificar menos re-renders (React DevTools ou console.log)
- **Branch**: `perf/optimize-module-row-memo`
- **Status**: Completed - Custom memo comparison prevents unnecessary re-renders

```tsx
export const ModuleRow = React.memo<ModuleRowProps>(
  ({ ... }) => { ... },
  (prev, next) => {
    // Compara todos os campos relevantes
    return (
      prev.module.name === next.module.name &&
      prev.module.status === next.module.status &&
      prev.isSelected === next.isSelected &&
      // ... outros campos
    );
  }
);
```

#### Task 3.4: Virtual Scrolling (se necessário) [4-6h] ⏭️ **NOT NEEDED**

- **Status**: Not implemented - não é necessário para quantidade típica de módulos
- **Condição**: Só implementar se houver 100+ módulos e performance ruim

**Checkpoint 3**: ✅ Performance otimizada, UX polido

---

### **FASE 4: ADVANCED FEATURES** 🚀 (Opcional - 6-8 horas) ✅ **COMPLETED**

**Objetivo**: Features avançadas (nice to have)

#### Task 4.1: Gráficos de Histórico CPU/RAM [3-4h] ✅ **DONE**

- **Arquivos**:
  - `src/cli/lib/resource-history.ts` (NOVO)
  - `src/cli/commands/dashboard.tsx`
- **Mudança**: Sparklines ASCII para recursos em tempo real
- **Dependência**: AsyncResourceMonitor
- **Teste**: Ver gráficos em tempo real no header
- **Branch**: `feat/resource-history-graphs`
- **Status**: Completed - Sparklines show 30-point history for CPU/RAM

**Implementação**:

- ✅ Classe ResourceHistory para rastrear histórico
- ✅ Método generateSparkline com 8 caracteres ASCII (▁▂▃▄▅▆▇█)
- ✅ Integrado no header do dashboard
- ✅ CPU sparkline em cyan, RAM sparkline em magenta
- ✅ 20 caracteres de largura, 30 pontos de dados

```tsx
// Sparklines aparecem no header ao lado das barras de progresso
CPU: ████████░░░░░░░ 45.2% ▃▄▅▆▅▄▃▃▄▅▇▆▅▄▃▃▂▂▃
RAM: ██████░░░░░░░░░ 2.1GB/8GB ▄▅▅▄▄▅▆▆▅▄▄▃▃▄▅▆▆▅▄▃
```

#### Task 4.2: Temas Customizáveis [2-3h] ✅ **DONE**

- **Arquivos**:
  - `src/utils/preferences.ts` (já existia com temas)
  - `src/cli/commands/dashboard.tsx`
  - `src/cli/components/dashboard/HelpScreen.tsx`
- **Mudança**: Suporte para 5 temas com alternância via teclado
- **Dependência**: PreferencesManager
- **Teste**: Pressionar 'T' para alternar entre temas
- **Branch**: `feat/custom-themes`
- **Status**: Completed - 5 themes with keyboard cycling

**Temas Disponíveis**:

1. **Default** (Cyan) - Tema padrão azul ciano
2. **Ocean** (Blue) - Tema azul oceano
3. **Sunset** (Magenta) - Tema magenta/roxo
4. **Forest** (Green) - Tema verde floresta
5. **Monochrome** (Gray) - Tema monocromático

**Features**:

- ✅ Tecla 'T' alterna entre temas (ciclo)
- ✅ Toast notification ao trocar tema
- ✅ Persistência no preferences.json
- ✅ Cores aplicadas em header, borders, ações
- ✅ Atualização em tempo real

```tsx
// Pressione 'T' para alternar entre temas
// Tema salvo automaticamente em ~/.canto/preferences.json
```

#### Task 4.3: Plugins/Extensões [Futuro] ⏸️ **NOT IMPLEMENTED**

- **Status**: Não implementado - requer arquitetura mais complexa
- **Sugestão**: Implementar futuramente se houver demanda

---

## 🔄 Workflow de Implementação

### Para Cada Task:

1. **Criar Branch**

```bash
git checkout main
git pull origin main
git checkout -b [branch-name]
```

2. **Implementar**

- Escrever código
- Adicionar comentários
- Manter código limpo

3. **Testar Localmente**

```bash
npm run build
npm run dashboard
# Testar funcionalidade
```

4. **Commit**

```bash
git add .
git commit -m "feat: [description]"
```

5. **Push & PR**

```bash
git push -u origin [branch-name]
# Criar PR no GitHub
```

6. **Code Review & Merge**

- Review próprio ou de equipe
- Merge para main
- Delete branch

---

## ✅ Checklist de Qualidade

### Para Cada Feature:

- [ ] Código limpo e bem comentado
- [ ] TypeScript sem erros
- [ ] ESLint passing
- [ ] Build successful (`npm run build`)
- [ ] Testado manualmente no dashboard
- [ ] Performance não degradou
- [ ] Funciona com keyboard shortcuts existentes
- [ ] Não quebra features existentes
- [ ] README atualizado (se necessário)

---

## 🧪 Plano de Testes

### Testes Manuais por Fase:

#### Fase 1 - Quick Wins

```bash
# Checklist de testes
□ Updates são instantâneos após ações
□ Busca não causa lag com muitas teclas
□ j/k funcionam para navegação
□ gg vai para o topo, G para o fim
□ Favoritos aparecem no topo
□ Estrela ★ aparece ao lado de favoritos
□ 'f' toggle favorito do módulo selecionado
```

#### Fase 2 - UX Core

```bash
□ Toast aparece após start/stop/restart
□ Toast desaparece após 3s
□ CPU/RAM aparecem por módulo
□ Confirmação aparece antes de stop
□ y confirma, n/ESC cancela
□ Status badges coloridos e com ícones
□ Logs coloridos (red=error, yellow=warn, etc)
```

#### Fase 3 - Polish

```bash
□ Screens carregam sob demanda
□ Busca aceita typos (fuzzy)
□ Menos re-renders (verificar com React DevTools)
□ Scroll suave com muitos módulos (se implementado)
```

### Testes de Performance:

```bash
# Métricas para validar
□ Startup time < 2s
□ Busca response < 300ms
□ Action feedback < 200ms
□ Module list render < 100ms
□ Memory stable (< 200MB)
□ No memory leaks após 10min de uso
```

---

## 📦 Estrutura de Arquivos

### Novos Arquivos a Criar:

```
src/cli/components/dashboard/
├── Toast.tsx                 # Task 2.1
├── ConfirmModal.tsx         # Task 2.3
└── StatusBadge.tsx          # Task 2.4

src/cli/lib/
└── sparkline.ts             # Task 4.1 (utils para gráficos)

src/cli/utils/
└── fuzzySearch.ts           # Task 3.2 (wrapper para fuse.js)
```

### Arquivos Principais a Modificar:

```
src/cli/commands/dashboard.tsx           # Múltiplas tasks
src/cli/components/dashboard/ModuleRow.tsx    # Tasks 1.5, 2.2, 2.4
src/cli/components/dashboard/LogsScreen.tsx   # Task 2.5
```

---

## 🎯 Priorização Final

### Must Have (Implementar Primeiro) ⭐⭐⭐⭐⭐

1. Task 1.1 - Otimizar forceUpdate (5 min)
2. Task 1.2 - Debounce search (15 min)
3. Task 1.3 - Vim keybindings (30 min)
4. Task 1.4 - Ordenação inteligente (1-2h)
5. Task 1.5 - Favoritos visuais (2-3h)
6. Task 2.1 - Toasts (3-4h)
7. Task 2.2 - Performance por módulo (2-3h)

### Should Have (Implementar em Seguida) ⭐⭐⭐⭐

8. Task 2.3 - Confirmações (2-3h)
9. Task 2.4 - Status badges (1h)
10. Task 2.5 - Syntax highlighting (3-4h)

### Nice to Have (Se Houver Tempo) ⭐⭐⭐

11. Task 3.1 - Lazy loading (30 min)
12. Task 3.2 - Fuzzy search (1h)
13. Task 3.3 - Cache rendering (1h)

### Future (Roadmap Futuro) ⭐⭐

14. Task 3.4 - Virtual scrolling (4-6h)
15. Task 4.1 - Resource graphs (3-4h)
16. Task 4.2 - Custom themes (2-3h)

---

## 📊 Progress Tracking

### Sprint 1 - Quick Wins (DIA 1)

- [ ] Task 1.1: Otimizar forceUpdate [5 min]
- [ ] Task 1.2: Debounce search [15 min]
- [ ] Task 1.3: Vim keybindings [30 min]
- [ ] Task 1.4: Ordenação inteligente [1-2h]
- [ ] Task 1.5: Favoritos visuais [2-3h]
- [ ] **Checkpoint 1**: Testes integrados

### Sprint 2 - UX Core (DIAS 2-3)

- [ ] Task 2.1: Toasts [3-4h]
- [ ] Task 2.2: Performance indicadores [2-3h]
- [ ] Task 2.3: Confirmações [2-3h]
- [ ] Task 2.4: Status badges [1h]
- [ ] Task 2.5: Syntax highlighting [3-4h]
- [ ] **Checkpoint 2**: UX review

### Sprint 3 - Polish (DIAS 4-5)

- [ ] Task 3.1: Lazy loading [30 min]
- [ ] Task 3.2: Fuzzy search [1h]
- [ ] Task 3.3: Cache rendering [1h]
- [ ] Task 3.4: Virtual scrolling [4-6h] (opcional)
- [ ] **Checkpoint 3**: Performance tests

### Sprint 4 - Advanced (Futuro)

- [ ] Task 4.1: Resource graphs
- [ ] Task 4.2: Custom themes
- [ ] Task 4.3: Plugins

---

## 🚀 Getting Started

### Passo 1: Setup

```bash
cd canto
git checkout main
git pull origin main
npm install
```

### Passo 2: Começar Sprint 1

```bash
git checkout -b feat/optimize-force-update
# Implementar Task 1.1
```

### Passo 3: Testar

```bash
npm run build
npm run dashboard
# Testar feature
```

### Passo 4: Commit & Continue

```bash
git add .
git commit -m "feat: optimize forceUpdate delay"
git push -u origin feat/optimize-force-update
# Próxima task
```

---

## 📝 Notas de Implementação

### Convenções de Código:

- Use TypeScript strict mode
- Siga ESLint rules
- Componentes em PascalCase
- Funções/variáveis em camelCase
- Constantes em UPPER_CASE

### Git Commit Messages:

```
feat: add new feature
fix: bug fix
perf: performance improvement
refactor: code refactoring
docs: documentation
test: add tests
chore: maintenance
```

### Branch Naming:

```
feat/feature-name
fix/bug-name
perf/optimization-name
refactor/refactor-name
```

---

## 🎉 Sucesso Esperado

Após completar todas as fases:

✅ **Performance**

- Updates instantâneos (0ms wait)
- Busca super rápida com debounce
- Rendering otimizado
- Menos re-renders desnecessários

✅ **UX/UI**

- Sistema de favoritos intuitivo
- Feedback visual claro (toasts)
- Logs coloridos e legíveis
- Confirmações previnem erros
- Navegação vim-style

✅ **Developer Experience**

- Código limpo e organizado
- Componentes reutilizáveis
- Fácil de estender
- Bem testado

**Resultado Final**: Dashboard profissional e super performático! 🚀

---

_Plano criado em: 2026-02-08_  
_Versão: 1.0_  
_Status: Pronto para implementação_
