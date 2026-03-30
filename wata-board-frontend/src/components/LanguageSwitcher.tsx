import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supportedLanguages, getCurrentLanguage, changeLanguage, isRTL } from '../i18n';

interface LanguageSwitcherProps {
  className?: string;
  variant?: 'dropdown' | 'compact' | 'full';
  showFlag?: boolean;
  showNativeName?: boolean;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  className = '',
  variant = 'dropdown',
  showFlag = true,
  showNativeName = true
}) => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const currentLang = getCurrentLanguage();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle language change
  const handleLanguageChange = async (languageCode: string) => {
    const success = await changeLanguage(languageCode);
    if (success) {
      setIsOpen(false);
    }
  };

  // Compact variant - just shows current language flag and name
  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500/50"
          aria-label={`Current language: ${currentLang.nativeName}. Click to change language.`}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          {showFlag && <span className="text-lg" role="img" aria-label={currentLang.name}>{currentLang.flag}</span>}
          <span className="text-sm text-slate-200">{showNativeName ? currentLang.nativeName : currentLang.name}</span>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div
            ref={dropdownRef}
            className={`absolute top-full mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-lg z-50 ${isRTL() ? 'right-0' : 'left-0'}`}
            role="listbox"
            aria-label="Language selection"
          >
            <div className="py-1">
              {supportedLanguages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-slate-800 transition-colors focus:outline-none focus:bg-slate-800 ${
                    lang.code === currentLang.code ? 'bg-slate-800 text-sky-400' : 'text-slate-200'
                  }`}
                  role="option"
                  aria-selected={lang.code === currentLang.code}
                  dir={lang.dir}
                >
                  {showFlag && <span className="text-lg" role="img" aria-label={lang.name}>{lang.flag}</span>}
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{showNativeName ? lang.nativeName : lang.name}</span>
                    <span className="text-xs text-slate-400">{lang.name}</span>
                  </div>
                  {lang.code === currentLang.code && (
                    <svg className="w-4 h-4 text-sky-400 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full variant - shows all languages as buttons
  if (variant === 'full') {
    return (
      <div className={`flex flex-wrap gap-2 ${className}`} role="group" aria-label="Language selection">
        {supportedLanguages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-sky-500/50 ${
              lang.code === currentLang.code
                ? 'bg-sky-600/20 text-sky-400 border border-sky-500/30'
                : 'bg-slate-800/50 text-slate-200 border border-slate-700 hover:bg-slate-700/50'
            }`}
            aria-pressed={lang.code === currentLang.code}
            aria-label={`Switch to ${lang.nativeName}`}
            dir={lang.dir}
          >
            {showFlag && <span className="text-base" role="img" aria-label={lang.name}>{lang.flag}</span>}
            <span className="text-sm font-medium">
              {showNativeName ? lang.nativeName : lang.name}
            </span>
          </button>
        ))}
      </div>
    );
  }

  // Default dropdown variant
  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500/50"
        aria-label={`Current language: ${currentLang.nativeName}. Click to change language.`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {showFlag && <span className="text-lg" role="img" aria-label={currentLang.name}>{currentLang.flag}</span>}
        <span className="text-sm text-slate-200 font-medium">
          {showNativeName ? currentLang.nativeName : currentLang.name}
        </span>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          className={`absolute top-full mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-lg z-50 min-w-[200px] ${isRTL() ? 'right-0' : 'left-0'}`}
          role="listbox"
          aria-label="Language selection"
        >
          <div className="py-1">
            {supportedLanguages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-800 transition-colors focus:outline-none focus:bg-slate-800 ${
                  lang.code === currentLang.code ? 'bg-slate-800 text-sky-400' : 'text-slate-200'
                }`}
                role="option"
                aria-selected={lang.code === currentLang.code}
                dir={lang.dir}
              >
                {showFlag && <span className="text-lg" role="img" aria-label={lang.name}>{lang.flag}</span>}
                <div className="flex flex-col flex-1">
                  <span className="text-sm font-medium">{showNativeName ? lang.nativeName : lang.name}</span>
                  <span className="text-xs text-slate-400">{lang.name}</span>
                </div>
                {lang.code === currentLang.code && (
                  <svg className="w-4 h-4 text-sky-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
