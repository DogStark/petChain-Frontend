import { useState } from 'react';
import { useNotifications } from '@/contexts/NotificationContext';
import { NotificationCategory, CATEGORY_LABELS, CATEGORY_ICONS } from '@/types/notification';

function Toggle({
  checked, onChange, label, description, disabled,
}: {
  checked: boolean; onChange: (v: boolean) => void;
  label: string; description?: string; disabled?: boolean;
}) {
  const id = `toggle-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex-1 min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-gray-800 cursor-pointer">{label}</label>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`
          relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
          disabled:opacity-40 disabled:cursor-not-allowed
          ${checked ? 'bg-blue-600' : 'bg-gray-200'}
        `}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

const CATEGORIES = Object.keys(CATEGORY_LABELS) as NotificationCategory[];

export default function NotificationPreferencesPanel() {
  const { preferences, updatePreferences, requestBrowserPermission } = useNotifications();
  const [saved, setSaved] = useState(false);

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Channels */}
      <section>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 px-1">Channels</h3>
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100 px-4">
          <Toggle
            label="Sound"
            description="Play a sound for new notifications"
            checked={preferences.sound}
            onChange={v => updatePreferences({ sound: v })}
          />
          <Toggle
            label="Vibration"
            description="Vibrate on mobile for new notifications"
            checked={preferences.vibration}
            onChange={v => updatePreferences({ vibration: v })}
          />
          <div className="py-3 flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800">Browser push</p>
              <p className="text-xs text-gray-500 mt-0.5">Receive notifications even when the app is closed</p>
            </div>
            {preferences.browserPush ? (
              <span className="text-xs text-green-600 font-semibold bg-green-50 px-2 py-1 rounded-full shrink-0">Enabled</span>
            ) : (
              <button
                onClick={requestBrowserPermission}
                className="text-xs text-blue-600 font-semibold bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors shrink-0 min-h-[36px]"
              >
                Enable
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Do Not Disturb */}
      <section>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 px-1">Do Not Disturb</h3>
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100 px-4">
          <Toggle
            label="Do Not Disturb"
            description="Silence non-urgent notifications during set hours"
            checked={preferences.doNotDisturb}
            onChange={v => updatePreferences({ doNotDisturb: v })}
          />
          {preferences.doNotDisturb && (
            <div className="py-3 flex items-center gap-3">
              <div className="flex-1">
                <label className="text-xs text-gray-500 block mb-1">From</label>
                <input
                  type="time"
                  value={preferences.dndStart}
                  onChange={e => updatePreferences({ dndStart: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 block mb-1">Until</label>
                <input
                  type="time"
                  value={preferences.dndEnd}
                  onChange={e => updatePreferences({ dndEnd: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Category toggles */}
      <section>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 px-1">Categories</h3>
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100 px-4">
          {CATEGORIES.map(cat => (
            <div key={cat} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2">
                <span className="text-lg" aria-hidden="true">{CATEGORY_ICONS[cat]}</span>
                <span className="text-sm font-medium text-gray-800">{CATEGORY_LABELS[cat]}</span>
              </div>
              <button
                role="switch"
                aria-checked={preferences.categories[cat]}
                aria-label={`Toggle ${CATEGORY_LABELS[cat]} notifications`}
                onClick={() => updatePreferences({
                  categories: { ...preferences.categories, [cat]: !preferences.categories[cat] },
                })}
                className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
                  ${preferences.categories[cat] ? 'bg-blue-600' : 'bg-gray-200'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200
                  ${preferences.categories[cat] ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          ))}
        </div>
      </section>

      <button
        onClick={save}
        className="w-full py-3 bg-blue-600 text-white font-semibold rounded-2xl hover:bg-blue-700 transition-colors min-h-[44px]"
      >
        {saved ? '✓ Saved' : 'Save preferences'}
      </button>
    </div>
  );
}
