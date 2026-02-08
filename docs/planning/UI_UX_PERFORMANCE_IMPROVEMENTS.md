# Dashboard UI/UX & Performance - Análise e Sugestões de Melhoria 🎨⚡

## Análise Completa - Áreas de Melhoria

Após análise profunda do dashboard Canto, identifiquei **15 oportunidades de melhoria** em UI/UX e performance.

---

## 🎨 Melhorias de UI/UX

### 1. ⭐ **Sistema de Favoritos Visuais**

**Status**: Parcialmente implementado (backend pronto, UI faltando)

**Problema**:

- PreferencesManager já suporta favoritos
- Mas não há indicação visual no dashboard
- Usuário não pode favoritar módulos pela UI

**Solução**:

```tsx
// ModuleRow.tsx - Adicionar estrela para favoritos
<Text color={isFavorite ? "yellow" : "gray"}>
  {isFavorite ? "★" : "☆"}
</Text>

// Dashboard - Adicionar tecla de atalho
else if (input === 'f' || input === 'F') {
  const module = filteredModules[selectedModule];
  if (prefsManager.isFavorite(module.name)) {
    prefsManager.removeFavorite(module.name);
  } else {
    prefsManager.addFavorite(module.name);
  }
}
```

**Impacto**: ⭐⭐⭐⭐⭐ (Alta prioridade)  
**Esforço**: 🔨 Baixo (2-3 horas)

---

### 2. 🎯 **Ordenação Inteligente de Módulos**

**Status**: Não implementado

**Problema**:

- Módulos sempre na mesma ordem (config file)
- Favoritos não aparecem no topo
- Módulos em execução não são destacados

**Solução**:

```tsx
const sortedModules = useMemo(() => {
  return [...filteredModules].sort((a, b) => {
    // 1. Favoritos primeiro
    const aFav = prefsManager.isFavorite(a.name);
    const bFav = prefsManager.isFavorite(b.name);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;

    // 2. Running antes de stopped
    if (a.status === 'RUNNING' && b.status !== 'RUNNING') return -1;
    if (a.status !== 'RUNNING' && b.status === 'RUNNING') return 1;

    // 3. Alfabético
    return a.name.localeCompare(b.name);
  });
}, [filteredModules, prefsManager]);
```

**Impacto**: ⭐⭐⭐⭐ (Melhora muito a usabilidade)  
**Esforço**: 🔨 Baixo (1-2 horas)

---

### 3. 📊 **Indicadores de Performance por Módulo**

**Status**: Parcialmente implementado

**Problema**:

- CPU/RAM mostrados apenas no global
- Não há indicação de quais módulos consomem mais recursos
- Difícil identificar módulos problemáticos

**Solução**:

```tsx
// ModuleRow.tsx - Adicionar mini-bars de recursos
{
  module.cpu && (
    <Text dimColor>
      CPU: {createBar(module.cpu, 100, 5)} {formatCPU(module.cpu)}
    </Text>
  );
}
{
  module.memory && <Text dimColor>RAM: {formatMemory(module.memory)}</Text>;
}
```

**Impacto**: ⭐⭐⭐⭐ (Muito útil para debugging)  
**Esforço**: 🔨 Baixo (já tem os dados, só falta UI)

---

### 4. 🔔 **Notificações e Toasts**

**Status**: Não implementado

**Problema**:

- Ações (start/stop) não têm feedback visual claro
- Erros aparecem só no estado global
- Usuário não sabe se ação foi bem-sucedida

**Solução**:

```tsx
const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

// Após ação
setToast({ msg: `✓ ${module.name} started successfully`, type: 'success' });
setTimeout(() => setToast(null), 3000);

// UI
{
  toast && (
    <Box position="absolute" top={1} right={1}>
      <Box borderStyle="round" borderColor={toast.type === 'success' ? 'green' : 'red'} padding={1}>
        <Text color={toast.type === 'success' ? 'green' : 'red'}>{toast.msg}</Text>
      </Box>
    </Box>
  );
}
```

**Impacto**: ⭐⭐⭐⭐⭐ (Essencial para boa UX)  
**Esforço**: 🔨🔨 Médio (3-4 horas)

---

### 5. 🔍 **Busca Melhorada com Fuzzy Search**

**Status**: Básico implementado (string.includes)

**Problema**:

- Busca atual é muito literal
- Não aceita typos ou aproximações
- Não destaca matches

**Solução**:

```bash
npm install fuse.js
```

```tsx
import Fuse from 'fuse.js';

const fuse = new Fuse(modules, {
  keys: ['name', 'type'],
  threshold: 0.3, // Aceita typos
  includeScore: true,
});

const filteredModules = useMemo(() => {
  if (!searchQuery) return modules;
  const results = fuse.search(searchQuery);
  return results.map((r) => r.item);
}, [modules, searchQuery]);
```

**Impacto**: ⭐⭐⭐ (Nice to have)  
**Esforço**: 🔨 Baixo (1 hora com lib)

---

### 6. ⌨️ **Atalhos de Teclado Vim-style**

**Status**: Básico implementado

**Problema**:

- Apenas arrow keys para navegação
- Usuários vim precisam usar setas

**Solução**:

```tsx
// Adicionar suporte j/k para navegação
else if (input === 'j' && selectedModule < filteredModules.length - 1) {
  setSelectedModule(selectedModule + 1);
} else if (input === 'k' && selectedModule > 0) {
  setSelectedModule(selectedModule - 1);
} else if (input === 'g' && key.shift) {
  // G = ir para o fim
  setSelectedModule(filteredModules.length - 1);
} else if (input === 'g') {
  // gg = ir para o início
  setSelectedModule(0);
}
```

**Impacto**: ⭐⭐⭐ (Desenvolvedores vão adorar)  
**Esforço**: 🔨 Muito baixo (30 min)

---

### 7. 📝 **Logs com Syntax Highlighting**

**Status**: Básico (texto plano)

**Problema**:

- Logs são texto puro sem cores
- Difícil identificar erros/warnings
- Sem destaque para timestamps

**Solução**:

```tsx
const colorizeLog = (line: string): JSX.Element => {
  // Error patterns
  if (/error|fail|exception/i.test(line)) {
    return <Text color="red">{line}</Text>;
  }
  // Warning patterns
  if (/warn|warning/i.test(line)) {
    return <Text color="yellow">{line}</Text>;
  }
  // Success patterns
  if (/success|ok|✓|✔/i.test(line)) {
    return <Text color="green">{line}</Text>;
  }
  // Info
  if (/info|log/i.test(line)) {
    return <Text color="blue">{line}</Text>;
  }
  // Timestamp pattern
  const parts = line.match(/^(\d{4}-\d{2}-\d{2}.*?)\s(.*)$/);
  if (parts) {
    return (
      <>
        <Text dimColor>{parts[1]}</Text>
        <Text> {parts[2]}</Text>
      </>
    );
  }
  return <Text>{line}</Text>;
};
```

**Impacto**: ⭐⭐⭐⭐ (Muito mais legível)  
**Esforço**: 🔨🔨 Médio (2-3 horas)

---

### 8. 🎛️ **Status Badge Melhorado**

**Status**: Básico

**Problema**:

- Status é só texto
- Não há diferenciação visual clara
- Falta estados intermediários (STARTING, STOPPING)

**Solução**:

```tsx
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const colors = {
    RUNNING: 'green',
    STOPPED: 'gray',
    STARTING: 'yellow',
    STOPPING: 'yellow',
    ERROR: 'red',
    UNKNOWN: 'gray',
  };

  const icons = {
    RUNNING: '●',
    STOPPED: '○',
    STARTING: '◐',
    STOPPING: '◐',
    ERROR: '✗',
    UNKNOWN: '?',
  };

  return (
    <Box borderStyle="round" borderColor={colors[status]} paddingX={1}>
      <Text color={colors[status]}>
        {icons[status]} {status}
      </Text>
    </Box>
  );
};
```

**Impacto**: ⭐⭐⭐ (Clareza visual)  
**Esforço**: 🔨 Baixo (1 hora)

---

## ⚡ Melhorias de Performance

### 9. 🚀 **Lazy Loading de Screens**

**Status**: Todas carregadas upfront

**Problema**:

- Todas as screens são importadas no início
- Bundle maior do que necessário
- Delay inicial de carregamento

**Solução**:

```tsx
const HelpScreen = React.lazy(() => import('../components/dashboard/HelpScreen'));
const EnvScreen = React.lazy(() => import('../components/dashboard/EnvScreen'));
const LogsScreen = React.lazy(() => import('../components/dashboard/LogsScreen'));
const HistoryScreen = React.lazy(() => import('../components/dashboard/HistoryScreen'));

// No render
<React.Suspense fallback={<Spinner />}>
  {screen === 'help' && <HelpScreen />}
  {screen === 'env' && <EnvScreen />}
  ...
</React.Suspense>;
```

**Impacto**: ⭐⭐⭐ (Startup mais rápido)  
**Esforço**: 🔨 Baixo (30 min)

---

### 10. 🎯 **Debounce na Busca**

**Status**: Não tem debounce

**Problema**:

- Busca executa a cada tecla
- Re-renders desnecessários
- Pode laggear com muitos módulos

**Solução**:

```tsx
const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedSearchQuery(searchQuery);
  }, 300); // 300ms debounce

  return () => clearTimeout(timer);
}, [searchQuery]);

// Usar debouncedSearchQuery no filter
const filteredModules = useMemo(() => {
  if (!debouncedSearchQuery) return modules;
  return modules.filter((m) => m.name.includes(debouncedSearchQuery));
}, [modules, debouncedSearchQuery]);
```

**Impacto**: ⭐⭐⭐ (Menos re-renders)  
**Esforço**: 🔨 Muito baixo (15 min)

---

### 11. 📦 **Virtual Scrolling para Muitos Módulos**

**Status**: Renderiza tudo

**Problema**:

- Com 100+ módulos, todos são renderizados
- Performance degrada com muitos módulos
- Scroll pode ficar lento

**Solução**:

```tsx
// Usando ink-virtual-list ou implementação custom
const VISIBLE_ITEMS = 10;
const [scrollOffset, setScrollOffset] = useState(0);

const visibleModules = useMemo(() => {
  const start = scrollOffset;
  const end = Math.min(start + VISIBLE_ITEMS, filteredModules.length);
  return filteredModules.slice(start, end);
}, [filteredModules, scrollOffset]);

// Atualizar scroll no handleInput
if (key.downArrow) {
  if (selectedModule >= scrollOffset + VISIBLE_ITEMS - 1) {
    setScrollOffset(scrollOffset + 1);
  }
  setSelectedModule(Math.min(selectedModule + 1, filteredModules.length - 1));
}
```

**Impacto**: ⭐⭐⭐⭐ (Essencial para muitos módulos)  
**Esforço**: 🔨🔨🔨 Alto (4-6 horas)

---

### 12. 🔄 **Otimizar forceUpdate Delay**

**Status**: Hardcoded 500ms

**Problema**:

```tsx
setTimeout(() => dataManager.forceUpdate(), 500);
```

- Delay arbitrário de 500ms
- Usuário espera desnecessariamente
- Poderia ser instantâneo

**Solução**:

```tsx
// Remover setTimeout, update já é assíncrono
dataManager.markDirty(module.name);
await dataManager.forceUpdate(); // Await imediato

// Ou usar um delay menor
setTimeout(() => dataManager.forceUpdate(), 100); // 100ms é suficiente
```

**Impacto**: ⭐⭐⭐⭐ (Feedback mais rápido)  
**Esforço**: 🔨 Muito baixo (5 min)

---

### 13. 💾 **Cachear Module List Rendering**

**Status**: Re-renderiza toda a lista

**Problema**:

- Cada update de módulo re-renderiza toda a lista
- Mesmo módulos que não mudaram

**Solução**:

```tsx
// ModuleRow já tem React.memo, mas precisa de key estável
{visibleModules.map((module, index) => (
  <ModuleRow
    key={`${module.name}-${module.status}`} // Key composta
    module={module}
    isSelected={index + scrollOffset === selectedModule}
    searchQuery={searchQuery}
    isFavorite={prefsManager.isFavorite(module.name)}
  />
))}

// Garantir que ModuleRow seja realmente memo
export const ModuleRow = React.memo<ModuleRowProps>(({ ... }) => {
  ...
}, (prevProps, nextProps) => {
  // Custom comparison
  return (
    prevProps.module.name === nextProps.module.name &&
    prevProps.module.status === nextProps.module.status &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.searchQuery === nextProps.searchQuery
  );
});
```

**Impacto**: ⭐⭐⭐ (Menos re-renders)  
**Esforço**: 🔨 Baixo (1 hora)

---

## 🎭 Melhorias de Experiência do Usuário

### 14. ❓ **Confirmação para Ações Destrutivas**

**Status**: Não tem confirmação

**Problema**:

- `stop all` ou `restart` executam imediatamente
- Sem chance de cancelar
- Risco de parar módulos críticos acidentalmente

**Solução**:

```tsx
const [confirmAction, setConfirmAction] = useState<{
  action: string;
  module: string;
} | null>(null);

// No handleInput
else if (input === 'x' || input === 'X') {
  setConfirmAction({ action: 'stop', module: currentModule.name });
}

// UI
{confirmAction && (
  <Box borderStyle="round" borderColor="yellow" padding={1}>
    <Text color="yellow">
      ⚠️  Confirm {confirmAction.action} {confirmAction.module}?
    </Text>
    <Text dimColor> [y/N]</Text>
  </Box>
)}

// Lógica de confirmação
if (confirmAction && input === 'y') {
  await executeAction(confirmAction);
  setConfirmAction(null);
} else if (confirmAction && (input === 'n' || key.escape)) {
  setConfirmAction(null);
}
```

**Impacto**: ⭐⭐⭐⭐ (Previne erros)  
**Esforço**: 🔨🔨 Médio (2-3 horas)

---

### 15. 📈 **Gráfico de Histórico de CPU/RAM**

**Status**: Apenas valores atuais

**Problema**:

- Mostra apenas CPU/RAM do momento
- Não há histórico visual
- Difícil ver tendências

**Solução**:

```tsx
const [resourceHistory, setResourceHistory] = useState<{
  cpu: number[];
  memory: number[];
}>({ cpu: [], memory: [] });

useEffect(() => {
  const unsubscribe = resourceMonitor.subscribe((resources) => {
    setResourceHistory((prev) => ({
      cpu: [...prev.cpu, resources.cpuUsage].slice(-30), // Últimos 30 pontos
      memory: [...prev.memory, resources.usedMemory].slice(-30),
    }));
  });
  return unsubscribe;
}, []);

// Mini sparkline ASCII
const createSparkline = (values: number[], max: number, width: number) => {
  const chars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  return values.map((v) => chars[Math.floor((v / max) * (chars.length - 1))]).join('');
};

// UI
<Text>
  CPU: {createSparkline(resourceHistory.cpu, 100, 30)} {formatCPU(currentCPU)}
</Text>;
```

**Impacto**: ⭐⭐⭐⭐ (Muito visual, útil)  
**Esforço**: 🔨🔨 Médio (3-4 horas)

---

## 📊 Resumo de Prioridades

### 🔥 Alta Prioridade (Implementar Primeiro)

1. ⭐⭐⭐⭐⭐ Sistema de Favoritos Visuais
2. ⭐⭐⭐⭐⭐ Notificações e Toasts
3. ⭐⭐⭐⭐ Ordenação Inteligente de Módulos
4. ⭐⭐⭐⭐ Indicadores de Performance por Módulo
5. ⭐⭐⭐⭐ Logs com Syntax Highlighting
6. ⭐⭐⭐⭐ Otimizar forceUpdate Delay
7. ⭐⭐⭐⭐ Confirmação para Ações Destrutivas

### 🎯 Média Prioridade (Implementar em Seguida)

8. ⭐⭐⭐ Busca Melhorada com Fuzzy Search
9. ⭐⭐⭐ Atalhos Vim-style
10. ⭐⭐⭐ Status Badge Melhorado
11. ⭐⭐⭐ Lazy Loading de Screens
12. ⭐⭐⭐ Debounce na Busca
13. ⭐⭐⭐ Cachear Module List Rendering

### 📈 Baixa Prioridade (Nice to Have)

14. ⭐⭐⭐⭐ Virtual Scrolling (só necessário com 50+ módulos)
15. ⭐⭐⭐⭐ Gráfico de Histórico de CPU/RAM

---

## 💡 Quick Wins (Implementar Hoje!)

Estas melhorias têm **alto impacto** e **baixo esforço**:

### 1. Favoritos Visuais (2-3h)

### 2. Ordenação Inteligente (1-2h)

### 3. Atalhos Vim-style (30min)

### 4. Otimizar forceUpdate (5min)

### 5. Debounce na Busca (15min)

**Total: ~4-5 horas para melhorias significativas!**

---

## 🚀 Roadmap Sugerido

### Sprint 1 (1-2 dias) - Quick Wins

- [ ] Favoritos visuais + ordenação
- [ ] Atalhos vim-style
- [ ] Otimizar forceUpdate delay
- [ ] Debounce na busca

### Sprint 2 (2-3 dias) - UX Core

- [ ] Sistema de notificações/toasts
- [ ] Indicadores de performance por módulo
- [ ] Confirmação para ações destrutivas
- [ ] Status badges melhorados

### Sprint 3 (3-4 dias) - Polish

- [ ] Logs com syntax highlighting
- [ ] Fuzzy search
- [ ] Lazy loading
- [ ] Cachear rendering

### Sprint 4 (Opcional) - Advanced

- [ ] Virtual scrolling (se necessário)
- [ ] Gráficos de histórico
- [ ] Temas customizáveis
- [ ] Plugins/extensões

---

## 📝 Conclusão

Identificamos **15 melhorias** concretas com estimativas realistas:

- **7 de alta prioridade** (essenciais para melhor UX)
- **6 de média prioridade** (polish e otimização)
- **2 de baixa prioridade** (advanced features)

**Esforço total estimado**: ~25-35 horas para todas as melhorias

**Quick wins (4-5h)** podem trazer ganhos imediatos!

---

_Análise realizada em: 2026-02-08_  
_Baseado em: Dashboard atual otimizado com performance improvements_
