import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import zh from './locales/zh.json';
import ar from './locales/ar.json';
import hi from './locales/hi.json';
import pt from './locales/pt.json';
import ru from './locales/ru.json';
import ja from './locales/ja.json';

// Supported languages configuration
export const supportedLanguages = [
  { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', dir: 'ltr', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', dir: 'ltr', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', dir: 'ltr', flag: '🇩🇪' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', dir: 'ltr', flag: '🇨🇳' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', dir: 'rtl', flag: '🇸🇦' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', dir: 'ltr', flag: '🇮🇳' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', dir: 'ltr', flag: '🇧🇷' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', dir: 'ltr', flag: '🇷🇺' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', dir: 'ltr', flag: '🇯🇵' }
] as const;

// Resources object with all translations
const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  de: { translation: de },
  zh: { translation: zh },
  ar: { translation: ar },
  hi: { translation: hi },
  pt: { translation: pt },
  ru: { translation: ru },
  ja: { translation: ja }
};

// Default language
const defaultLanguage = 'en';

// Initialize i18n
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: defaultLanguage,
    debug: process.env.NODE_ENV === 'development',
    
    // Language detection configuration
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag', 'path', 'subdomain'],
      caches: ['localStorage'],
      lookupLocalStorage: 'wata-board-language',
      checkWhitelist: true
    },
    
    // Interpolation configuration
    interpolation: {
      escapeValue: false,
      formatSeparator: ',',
      format: function(value, format, lng) {
        if (format === 'uppercase') return value.toUpperCase();
        if (format === 'lowercase') return value.toLowerCase();
        if (format === 'capitalize') return value.charAt(0).toUpperCase() + value.slice(1);
        return value;
      }
    },
    
    // React configuration
    react: {
      useSuspense: false,
      bindI18n: 'languageChanged',
      bindI18nStore: 'added removed',
      transEmptyNodeValue: '',
      transSupportBasicHtmlNodes: true,
      transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'em', 'span']
    },
    
    // Whitelist of supported languages
    supportedLngs: supportedLanguages.map(lang => lang.code),
    
    // Load configuration
    load: 'languageOnly',
    
    // Preload languages for better performance
    preload: ['en', 'es', 'fr', 'de', 'zh']
  });

// Export i18n instance and utilities
export default i18n;

// Helper function to get current language info
export const getCurrentLanguage = () => {
  const currentCode = i18n.language;
  return supportedLanguages.find(lang => lang.code === currentCode) || supportedLanguages[0];
};

// Helper function to change language
export const changeLanguage = async (languageCode: string) => {
  try {
    await i18n.changeLanguage(languageCode);
    
    // Update document direction for RTL languages
    const langInfo = supportedLanguages.find(lang => lang.code === languageCode);
    if (langInfo) {
      document.documentElement.dir = langInfo.dir;
      document.documentElement.lang = languageCode;
    }
    
    // Store preference
    localStorage.setItem('wata-board-language', languageCode);
    
    return true;
  } catch (error) {
    console.error('Failed to change language:', error);
    return false;
  }
};

// Helper function to get text direction for a language
export const getTextDirection = (languageCode: string) => {
  const langInfo = supportedLanguages.find(lang => lang.code === languageCode);
  return langInfo?.dir || 'ltr';
};

// Helper function to check if language is RTL
export const isRTL = (languageCode?: string) => {
  const langCode = languageCode || i18n.language;
  return getTextDirection(langCode) === 'rtl';
};

// Helper function to format numbers with locale
export const formatNumber = (number: number, options?: Intl.NumberFormatOptions) => {
  const locale = i18n.language === 'zh' ? 'zh-CN' : i18n.language;
  return new Intl.NumberFormat(locale, options).format(number);
};

// Helper function to format currency
export const formatCurrency = (amount: number, currency = 'XLM') => {
  const locale = i18n.language === 'zh' ? 'zh-CN' : i18n.language;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 7,
    maximumFractionDigits: 7
  }).format(amount);
};

// Helper function to format dates
export const formatDate = (date: Date, options?: Intl.DateTimeFormatOptions) => {
  const locale = i18n.language === 'zh' ? 'zh-CN' : i18n.language;
  return new Intl.DateTimeFormat(locale, options).format(date);
};

// Helper function to get plural form
export const getPluralForm = (count: number) => {
  const locale = i18n.language;
  const pluralRules = new Intl.PluralRules(locale);
  return pluralRules.select(count);
};
