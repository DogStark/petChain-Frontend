/**
 * Jest replacement for CSS Module imports.
 *
 * Class names resolve to themselves so component tests can render styled
 * components without a CSS build step.
 */
module.exports = new Proxy(
  {},
  {
    get: (_target, property) => {
      // Keep CommonJS interop from treating the stub as an ES module.
      if (property === '__esModule') return false;
      return typeof property === 'string' ? property : undefined;
    },
  },
);
