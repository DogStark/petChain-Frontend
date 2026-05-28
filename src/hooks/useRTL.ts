import { useEffect, useState } from 'react';
import { useTranslation } from '@/i18n';
import { isRTL, getTextDirection } from '@/i18n';

export function useRTL() {
  const { language } = useTranslation();
  const [isRTLDirection, setIsRTLDirection] = useState(isRTL(language));
  const [textDirection, setTextDirection] = useState(getTextDirection(language));

  useEffect(() => {
    const dir = getTextDirection(language);
    setIsRTLDirection(dir === 'rtl');
    setTextDirection(dir);
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
  }, [language]);

  const getDirectionalClass = (left: string, right: string) =>
    isRTLDirection ? right : left;

  const getTextAlignClass = () =>
    isRTLDirection ? 'text-right' : 'text-left';

  const getFlexDirection = () =>
    isRTLDirection ? 'flex-row-reverse' : 'flex-row';

  const getFloatClass = (left: string, right: string) =>
    isRTLDirection ? right : left;

  const getBorderRadiusClass = (left: string, right: string) =>
    isRTLDirection ? right : left;

  const getTransformClass = (transform: string) => {
    if (isRTLDirection && transform.includes('translateX')) {
      return transform.replace(/translateX\(([^)]+)\)/, (_, p1: string) => {
        const value = p1.replace('-', '');
        return `translateX(-${value})`;
      });
    }
    return transform;
  };

  return {
    isRTL: isRTLDirection,
    textDirection,
    getDirectionalClass,
    getTextAlignClass,
    getFlexDirection,
    getFloatClass,
    getBorderRadiusClass,
    getTransformClass,
  };
}
