// LocalStorage and SessionStorage mock for testing
class StorageMock {
  private store: Record<string, string> = {};

  constructor() {
    // Initialize with empty store
    this.store = {};
  }

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value.toString();
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] ?? null;
  }

  get length(): number {
    return Object.keys(this.store).length;
  }
}

// Create global mocks before tests run
const localStorageMock = new StorageMock();
const sessionStorageMock = new StorageMock();

// Helper functions to control the mock storage in tests
export const storageMocks = {
  // Get the actual mock instances
  getLocalStorage(): StorageMock {
    return localStorageMock;
  },
  
  getSessionStorage(): StorageMock {
    return sessionStorageMock;
  },
  
  // Clear all storage
  clearAll(): void {
    localStorageMock.clear();
    sessionStorageMock.clear();
  },
  
  // Set specific values
  setLocalStorageItem(key: string, value: string): void {
    localStorageMock.setItem(key, value);
  },
  
  setSessionStorageItem(key: string, value: string): void {
    sessionStorageMock.setItem(key, value);
  },
  
  // Get specific values
  getLocalStorageItem(key: string): string | null {
    return localStorageMock.getItem(key);
  },
  
  getSessionStorageItem(key: string): string | null {
    return sessionStorageMock.getItem(key);
  }
};

// In test setup, we'll replace the global objects
// This file can be imported in test setup to replace global storage