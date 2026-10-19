import '@testing-library/jest-dom';
import { toHaveNoViolations } from 'jest-axe';

require('@testing-library/jest-dom');

expect.extend(toHaveNoViolations);

// ─── Blob / File polyfills ────────────────────────────────────────────────────
// jsdom 20 ships a Blob that lacks arrayBuffer() and text(). Polyfill both so
// services that call file.arrayBuffer() / blob.arrayBuffer() work in Jest.
if (typeof Blob !== 'undefined' && !Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = function () {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}

if (typeof Blob !== 'undefined' && !Blob.prototype.text) {
  Blob.prototype.text = function () {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}

// ─── Response polyfill ────────────────────────────────────────────────────────
// jsdom does not expose the Fetch API Response class. Use Node's built-in
// undici Response when available (Node 18+), or provide a minimal mock that
// covers the surface used in secureDownload tests.
if (typeof Response === 'undefined') {
  try {
    // Node 18+ ships undici as the Fetch implementation
    const { Response: NodeResponse } = require('node-fetch') || {};
    if (NodeResponse) {
      global.Response = NodeResponse;
    }
  } catch {
    // node-fetch not installed — provide a minimal stub
    class ResponseStub {
      constructor(body, init = {}) {
        this.ok = (init.status || 200) >= 200 && (init.status || 200) < 300;
        this.status = init.status || 200;
        this.headers = new Map(Object.entries(init.headers || {}));
        this.headers.get = (k) => (init.headers || {})[k] || null;
        this._body = body;
        this.body = null; // streaming not needed for tests
      }
      async blob() {
        if (this._body instanceof Blob) return this._body;
        if (this._body === null || this._body === undefined) return new Blob([]);
        return new Blob([this._body]);
      }
      async json() {
        const text = typeof this._body === 'string' ? this._body : JSON.stringify(this._body);
        return JSON.parse(text);
      }
      async text() {
        if (typeof this._body === 'string') return this._body;
        return '';
      }
    }
    global.Response = ResponseStub;
  }
}

// Mock localStorage for tests
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Suppress console errors in tests (optional)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Not implemented: HTMLFormElement.prototype.submit')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
