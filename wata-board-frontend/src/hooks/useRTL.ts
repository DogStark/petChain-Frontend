import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isRTL, getTextDirection } from '../i18n';

export const useRTL = () => {
  const { i18n } = useTranslation();
  const [isRTLDirection, setIsRTLDirection] = useState(isRTL(i18n.language));
  const [textDirection, setTextDirection] = useState(getTextDirection(i18n.language));

  useEffect(() => {
    // Compute new direction from the current language first
    const newDir = getTextDirection(i18n.language);

    // Update RTL state
    setIsRTLDirection(newDir === 'rtl');
    setTextDirection(newDir);

    // Update document direction using the freshly computed value,
    // not the stale state variable from the previous render
    document.documentElement.dir = newDir;
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  // Helper function to get appropriate margin/padding classes for RTL
  const getDirectionalClass = (left: string, right: string) => {
    return isRTLDirection ? right : left;
  };

  // Helper function to get appropriate text alignment
  const getTextAlignClass = () => {
    return isRTLDirection ? 'text-right' : 'text-left';
  };

  // Helper function to get appropriate flex direction
  const getFlexDirection = () => {
    return isRTLDirection ? 'flex-row-reverse' : 'flex-row';
  };

  // Helper function to get appropriate float classes
  const getFloatClass = (left: string, right: string) => {
    return isRTLDirection ? right : left;
  };

  // Helper function to get appropriate border radius for RTL
  const getBorderRadiusClass = (left: string, right: string) => {
    return isRTLDirection ? right : left;
  };

  // Helper function to get appropriate transform for RTL
  const getTransformClass = (transform: string) => {
    if (isRTLDirection && transform.includes('translateX')) {
      return transform.replace(/translateX\(([^)]+)\)/, (match, p1) => {
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
    getTransformClass
  };
};
