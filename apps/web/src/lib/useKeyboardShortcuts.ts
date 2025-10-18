import { useEffect } from 'react';

interface KeyboardShortcut {
  key: string;
  action: () => void;
  description: string;
  modifier?: 'ctrl' | 'alt' | 'shift';
}

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
}

export function useKeyboardShortcuts({ shortcuts, enabled = true }: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when user is typing in inputs, textareas, or content-editable elements
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
         activeElement.tagName === 'TEXTAREA' ||
         (activeElement as HTMLElement).contentEditable === 'true')
      ) {
        return;
      }

      for (const shortcut of shortcuts) {
        const modifierPressed = shortcut.modifier
          ? (shortcut.modifier === 'ctrl' && (event.ctrlKey || event.metaKey)) ||
            (shortcut.modifier === 'alt' && event.altKey) ||
            (shortcut.modifier === 'shift' && event.shiftKey)
          : !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;

        if (event.key.toLowerCase() === shortcut.key.toLowerCase() && modifierPressed) {
          event.preventDefault();
          shortcut.action();
          break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled]);
}

export default useKeyboardShortcuts;