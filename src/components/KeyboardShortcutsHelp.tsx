import { useEffect, useState } from 'react';
import { HelpCircle, X } from 'lucide-react';

import Dialog from '@/components/ui/Dialog';

const TITLE_ID = 'keyboard-shortcuts-title';

export default function KeyboardShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== '?' ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.defaultPrevented
      ) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.closest('input, textarea, select, [contenteditable="true"]'))
      ) {
        return;
      }

      event.preventDefault();
      setIsOpen(true);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Show keyboard shortcuts"
        aria-keyshortcuts="?"
        className="fixed bottom-4 right-4 z-40 flex min-h-11 items-center gap-2 rounded-full bg-blue-900 px-4 text-sm font-semibold text-white shadow-lg hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        <HelpCircle size={18} aria-hidden="true" />
        Help
      </button>

      <Dialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        titleId={TITLE_ID}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 id={TITLE_ID} className="text-xl font-bold text-gray-900">
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close keyboard shortcuts"
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <dl className="mt-5 divide-y divide-gray-100">
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-sm text-gray-700">Open this shortcut guide</dt>
            <dd><kbd className="rounded border border-gray-300 bg-gray-50 px-2 py-1 text-sm">?</kbd></dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-sm text-gray-700">Close an open dialog</dt>
            <dd><kbd className="rounded border border-gray-300 bg-gray-50 px-2 py-1 text-sm">Esc</kbd></dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-sm text-gray-700">Move between controls</dt>
            <dd>
              <kbd className="rounded border border-gray-300 bg-gray-50 px-2 py-1 text-sm">Tab</kbd>
              <span className="mx-1 text-gray-500">/</span>
              <kbd className="rounded border border-gray-300 bg-gray-50 px-2 py-1 text-sm">Shift+Tab</kbd>
            </dd>
          </div>
        </dl>
      </Dialog>
    </>
  );
}
