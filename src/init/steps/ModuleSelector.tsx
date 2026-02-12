import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { type Theme } from '../../utils/preferences.js';
import type { ComposerState, ComposerModule } from '../composer-state.js';
import type { WorkspaceCategory } from '../detector.js';

interface ModuleSelectorProps {
  state: ComposerState;
  theme: Theme;
  onToggleModule: (name: string) => void;
  onToggleScript: (name: string) => void;
  onNext: () => void;
  onBack: () => void;
}

type ItemType = 'module' | 'script';

interface ListItem {
  id: string;
  type: ItemType;
  label: string;
  detail: string;
  category: WorkspaceCategory | 'utility';
  selected: boolean;
  depth: number;
}

const CATEGORY_ORDER: (WorkspaceCategory | 'utility')[] = [
  'app',
  'worker',
  'lib',
  'infra',
  'utility',
];

const CATEGORY_LABELS: Record<WorkspaceCategory | 'utility', string> = {
  app: '📱 Applications',
  worker: '⚙️  Workers',
  lib: '📦 Libraries',
  infra: '🐳 Infrastructure',
  utility: '🔧 Utility Scripts',
};

export function ModuleSelector({
  state,
  theme,
  onToggleModule,
  onToggleScript,
  onNext,
  onBack,
}: ModuleSelectorProps): React.JSX.Element {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const VISIBLE_Items = 12;

  // Flatten items for navigation
  const items = useMemo(() => {
    const list: ListItem[] = [];

    // Modules grouped by category
    const modulesByCategory = state.modules.reduce(
      (acc, mod) => {
        const cat = mod.category;
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(mod);
        return acc;
      },
      {} as Record<WorkspaceCategory, ComposerModule[]>
    );

    // Custom Scripts
    const scriptItems = Object.keys(state.rootScripts).map((name) => ({
      name,
      command: state.rootScripts[name],
      enabled: state.customScripts[name] ?? false,
    }));

    // Build the flat list with headers
    CATEGORY_ORDER.forEach((cat) => {
      let categoryItems: ListItem[] = [];

      if (cat === 'utility') {
        categoryItems = scriptItems.map((s) => ({
          id: s.name,
          type: 'script',
          label: s.name,
          detail:
            (s.command ?? '').length > 30
              ? `${(s.command ?? '').slice(0, 27)}...`
              : (s.command ?? ''),
          category: 'utility',
          selected: s.enabled,
          depth: 1,
        }));
      } else {
        const mods = modulesByCategory[cat] || [];
        categoryItems = mods.map((m) => ({
          id: m.name,
          type: 'module',
          label: m.name,
          detail: m.type === 'docker' ? 'docker compose' : m.path,
          category: cat,
          selected: m.enabled,
          depth: 1,
        }));
      }

      if (categoryItems.length > 0) {
        list.push(...categoryItems);
      }
    });

    return list;
  }, [state]);

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
      if (selectedIndex <= scrollOffset) {
        setScrollOffset(Math.max(0, scrollOffset - 1));
      }
    }

    if (key.downArrow) {
      setSelectedIndex(Math.min(items.length - 1, selectedIndex + 1));
      if (selectedIndex >= scrollOffset + VISIBLE_Items - 1) {
        setScrollOffset(scrollOffset + 1);
      }
    }

    if (input === ' ') {
      const item = items[selectedIndex];
      if (item) {
        if (item.type === 'module') {
          onToggleModule(item.id);
        } else {
          onToggleScript(item.id);
        }
      }
    }

    if (key.return) {
      onNext();
    }

    if (input === 'b' || input === 'B') {
      onBack();
    }

    // Page Up/Down
    if (key.pageUp) {
      const newIndex = Math.max(0, selectedIndex - VISIBLE_Items);
      setSelectedIndex(newIndex);
      setScrollOffset(Math.max(0, newIndex));
    }

    if (key.pageDown) {
      const newIndex = Math.min(items.length - 1, selectedIndex + VISIBLE_Items);
      setSelectedIndex(newIndex);
      setScrollOffset(Math.max(0, scrollOffset + VISIBLE_Items));
      if (newIndex >= scrollOffset + VISIBLE_Items) {
        setScrollOffset(newIndex - VISIBLE_Items + 1);
      }
    }
  });

  // Render logic
  const visibleList = items.slice(scrollOffset, scrollOffset + VISIBLE_Items);

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={theme.colors.muted}>
          Use{' '}
          <Text bold color={theme.colors.primary}>
            ↑/↓
          </Text>{' '}
          to navigate,{' '}
          <Text bold color={theme.colors.primary}>
            Space
          </Text>{' '}
          to toggle,{' '}
          <Text bold color={theme.colors.success}>
            Enter
          </Text>{' '}
          to continue.
        </Text>
      </Box>

      <Box flexDirection="column" borderStyle="round" borderColor={theme.colors.border} padding={1}>
        {visibleList.map((item, index) => {
          const absoluteIndex = scrollOffset + index;
          const isSelected = absoluteIndex === selectedIndex;

          // Determine if we need a header
          const prevItem = items[absoluteIndex - 1];
          const showHeader = prevItem?.category !== item.category;

          return (
            <Box key={`${item.type}-${item.id}`} flexDirection="column">
              {showHeader && (
                <Box marginTop={index === 0 ? 0 : 1} marginBottom={0}>
                  <Text bold underline color={theme.colors.primary}>
                    {CATEGORY_LABELS[item.category as WorkspaceCategory | 'utility']}
                  </Text>
                </Box>
              )}

              <Box flexDirection="row" justifyContent="space-between">
                <Box>
                  <Text color={isSelected ? theme.colors.primary : undefined}>
                    {isSelected ? '> ' : '  '}
                  </Text>
                  <Text color={item.selected ? theme.colors.success : theme.colors.muted}>
                    {item.selected ? '[x] ' : '[ ] '}
                  </Text>
                  <Text color={isSelected ? theme.colors.primary : undefined}>{item.label}</Text>
                </Box>

                <Box marginLeft={2}>
                  <Text color={theme.colors.muted} dimColor>
                    {item.detail}
                  </Text>
                </Box>
              </Box>
            </Box>
          );
        })}

        {items.length === 0 && <Text color={theme.colors.warning}>No modules detected.</Text>}
      </Box>

      <Box marginTop={0} justifyContent="flex-end">
        <Text color={theme.colors.muted} dimColor>
          {items.length > VISIBLE_Items
            ? `${scrollOffset + 1}-${Math.min(items.length, scrollOffset + VISIBLE_Items)} of ${items.length}`
            : ''}
        </Text>
      </Box>
    </Box>
  );
}
