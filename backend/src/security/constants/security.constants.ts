export const SECURITY_CONSTANTS = {
  RATE_LIMIT: {
    DEFAULT_TTL: 60, // seconds
    DEFAULT_LIMIT: 100,
    STRICT_TTL: 60,
    STRICT_LIMIT: 10,
    LOGIN_TTL: 900, // 15 minutes
    LOGIN_LIMIT: 5,
  },
  DDOS: {
    CONNECTION_LIMIT: 1000,
    REQUEST_THRESHOLD: 500,
    TIME_WINDOW: 60000, // 1 minute
  },
  THREAT_SCORES: {
    SQL_INJECTION: 100,
    XSS_ATTEMPT: 80,
    BRUTE_FORCE: 70,
    UNAUTHORIZED_ACCESS: 60,
    SUSPICIOUS_ACTIVITY: 40,
    RATE_LIMIT_EXCEEDED: 50,
    SUSPICIOUS_PATTERN: 30,
    BLACKLIST_THRESHOLD: 100,
  },
  PATTERNS: {
    SQL_INJECTION: [
      /(\%27)|(\')|(\-\-)|(\%23)|(#)/gi,
      /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/gi,
      /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/gi,
      /union.*select/gi,
      /exec(\s|\+)+(s|x)p\w+/gi,
    ],
    // NOTE: These are threat DETECTION patterns only — never use for sanitization
    XSS: [
      /<script\b[^<]*<\/script>/gi,
      /\bjavascript\s*:/gi,
      /\bon[a-z]{1,20}\s*=/gi,
      /<iframe\b/gi,
      /\beval\s*\(/gi,
      /\bexpression\s*\(/gi,
    ],
    PATH_TRAVERSAL: [/\.\.[\/\\]/g, /\%2e\%2e[\/\\]/gi],
  },
};
