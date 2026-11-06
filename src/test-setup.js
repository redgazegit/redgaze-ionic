// Manual Vitest setup for Angular (based on analogjs patterns)
import 'zone.js';
import 'zone.js/plugins/sync-test';
import 'zone.js/plugins/proxy';
import 'zone.js/testing';

// Zone.js installs a MutationObserver wrapper whose instances do not implement
// observe()/disconnect() under happy-dom, which breaks Ionic web components
// (ion-toggle, ion-input, ...) during render.
try {
  const probe = new globalThis.MutationObserver(() => {});
  if (typeof probe.observe !== 'function' || typeof probe.disconnect !== 'function') {
    throw new Error('incomplete MutationObserver implementation');
  }
} catch {
  globalThis.MutationObserver = class {
    constructor(callback) {
      this.callback = callback;
    }
    observe() {}
    disconnect() {}
    takeRecords() { return []; }
  };
}

/**
 * Patch Vitest's describe/test/beforeEach/afterEach functions so test code
 * always runs in a testZone (ProxyZone).
 */
/* global Zone */
const Zone = globalThis['Zone'];
if (Zone === undefined) {
    throw new Error('Missing: Zone (zone.js)');
}
if (globalThis['__vitest_zone_patch__'] === true) {
    throw new Error("'vitest' has already been patched with 'Zone'.");
}
globalThis['__vitest_zone_patch__'] = true;
const SyncTestZoneSpec = Zone['SyncTestZoneSpec'];
const ProxyZoneSpec = Zone['ProxyZoneSpec'];
if (SyncTestZoneSpec === undefined) {
    throw new Error('Missing: SyncTestZoneSpec (zone.js/plugins/sync-test)');
}
if (ProxyZoneSpec === undefined) {
    throw new Error('Missing: ProxyZoneSpec (zone.js/plugins/proxy.js)');
}
const env = globalThis;
const ambientZone = Zone.current;
// Create a synchronous-only zone in which to run `describe` blocks in order to
// raise an error if any asynchronous operations are attempted
// inside of a `describe` but outside of a `beforeEach` or `it`.
const syncZone = ambientZone.fork(new SyncTestZoneSpec('vitest.describe'));
function wrapDescribeInZone(describeBody) {
    return function (...args) {
        return syncZone.run(describeBody, null, args);
    };
}
// Create a proxy zone in which to run `test` blocks so that the tests function
// can retroactively install different zones.
const testProxyZone = ambientZone.fork(new ProxyZoneSpec());
function wrapTestInZone(testBody) {
    if (testBody === undefined) {
        return;
    }
    const wrappedFunc = function () {
        return testProxyZone.run(testBody, null, arguments);
    };
    try {
        Object.defineProperty(wrappedFunc, 'length', {
            configurable: true,
            writable: true,
            enumerable: false,
        });
        wrappedFunc.length = testBody.length;
    }
    catch (e) {
        return testBody.length === 0
            ? () => testProxyZone.run(testBody, null)
            : (done) => testProxyZone.run(testBody, null, [done]);
    }
    return wrappedFunc;
}
/**
 * bind describe method to wrap describe.each function
 */
const bindDescribe = function(self, originalVitestFn) {
    return function (...eachArgs) {
        return function (...args) {
            args[1] = wrapDescribeInZone(args[1]);
            // @ts-ignore
            return originalVitestFn.apply(self, eachArgs).apply(self, args);
        };
    };
};
/**
 * bind test method to wrap test.each function
 */
const bindTest = function(self, originalVitestFn) {
    return function (...eachArgs) {
        return function (...args) {
            args[1] = wrapTestInZone(args[1]);
            // @ts-ignore
            return originalVitestFn.apply(self, eachArgs).apply(self, args);
        };
    };
};
['describe'].forEach(function(methodName) {
    const originalvitestFn = env[methodName];
    env[methodName] = function (...args) {
        args[1] = wrapDescribeInZone(args[1]);
        return originalvitestFn.apply(this, args);
    };
    env[methodName].each = bindDescribe(this, originalvitestFn)(originalvitestFn.each);
    if (methodName === 'describe') {
        env[methodName].only = bindDescribe(this, originalvitestFn)(originalvitestFn.only);
        env[methodName].skip = bindDescribe(this, originalvitestFn)(originalvitestFn.skip);
    }
});
['test', 'it'].forEach(function(methodName) {
    const originalvitestFn = env[methodName];
    env[methodName] = function (...args) {
        args[1] = wrapTestInZone(args[1]);
        return originalvitestFn.apply(this, args);
    };
    env[methodName].each = bindTest(this, originalvitestFn)(originalvitestFn.each);
    env[methodName].only = bindTest(this, originalvitestFn)(originalvitestFn.only);
    env[methodName].skip = bindTest(this, originalvitestFn)(originalvitestFn.skip);
    if (methodName === 'test' || methodName === 'it') {
        env[methodName].todo = function (...args) {
            return originalvitestFn.todo.apply(this, args);
        };
    }
});
['beforeEach', 'afterEach', 'beforeAll', 'afterAll'].forEach(function(methodName) {
    const originalvitestFn = env[methodName];
    env[methodName] = function (...args) {
        args[0] = wrapTestInZone(args[0]);
        return originalvitestFn.apply(this, args);
    };
});

// Mock localStorage and sessionStorage - create SINGLE instances
var localStorageStore = {};
var sessionStorageStore = {};

var mockLocalStorage = {
    getItem: function(key) {
        return localStorageStore.hasOwnProperty(key) ? localStorageStore[key] : null;
    },
    setItem: function(key, value) {
        localStorageStore[key] = value.toString();
    },
    removeItem: function(key) {
        delete localStorageStore[key];
    },
    clear: function() {
        localStorageStore = {};
    }
};

var mockSessionStorage = {
    getItem: function(key) {
        return sessionStorageStore.hasOwnProperty(key) ? sessionStorageStore[key] : null;
    },
    setItem: function(key, value) {
        sessionStorageStore[key] = value.toString();
    },
    removeItem: function(key) {
        delete sessionStorageStore[key];
    },
    clear: function() {
        sessionStorageStore = {};
    }
};

// Replace global storage objects
try {
    Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true
    });
    Object.defineProperty(window, 'sessionStorage', {
        value: mockSessionStorage,
        writable: true
    });
} catch(e) {
    window.localStorage = mockLocalStorage;
    window.sessionStorage = mockSessionStorage;
}

// TestBed setup
import { getTestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting
} from '@angular/platform-browser-dynamic/testing';

getTestBed().initTestEnvironment(
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting()
);

// Export mocks for test control
export const testStorage = {
    localStorage: mockLocalStorage,
    sessionStorage: mockSessionStorage,
    clearAll: function() {
        mockLocalStorage.clear();
        mockSessionStorage.clear();
    }
};