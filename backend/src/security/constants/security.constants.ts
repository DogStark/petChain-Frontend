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
    XSS: [
      /<script[^>]*>[\s\S]*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe/gi,
      /eval\(/gi,
      /expression\(/gi,
    ],
    PATH_TRAVERSAL: [/\.\.[\/\\]/g, /\%2e\%2e[\/\\]/gi],
  },
};
