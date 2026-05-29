// Must run BEFORE Zone.js to avoid Zone wrapping issues
if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = class {
    constructor(callback, options) {
      this.callback = callback;
      this.options = options;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  };
}
