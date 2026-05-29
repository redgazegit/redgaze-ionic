declare module 'plyr' {
  interface PlyrOptions {
    controls?: string[];
    ratio?: string;
    resetOnEnd?: boolean;
    hideControls?: boolean;
    clickToPlay?: boolean;
    [key: string]: any;
  }
  interface PlyrEvent {
    detail: any;
    preventDefault(): void;
  }
  class Plyr {
    constructor(element: HTMLElement | string, options?: PlyrOptions);
    play(): Promise<void>;
    pause(): void;
    destroy(): void;
    on(event: string, callback: (event: any) => void): void;
    off(event: string, callback: (event: any) => void): void;
    readonly element: HTMLElement;
    readonly fullscreen: boolean;
    readonly paused: boolean;
    readonly currentTime: number;
    readonly duration: number;
  }
  export default Plyr;
}
