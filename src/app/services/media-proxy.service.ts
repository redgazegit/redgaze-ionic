import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { CapacitorHttp, HttpResponse } from '@capacitor/core';

@Injectable({ providedIn: 'root' })
export class MediaProxyService {
  private cache = new Map<string, string>();

  async proxyImage(url: string): Promise<string> {
    console.log('[MediaProxy] proxyImage called:', url?.substring(0, 80));
    if (!Capacitor.isNativePlatform()) {
      console.log('[MediaProxy] not native, returning raw url');
      return url;
    }
    const cached = this.cache.get(url);
    if (cached) {
      console.log('[MediaProxy] cached hit');
      return cached;
    }

    try {
      console.log('[MediaProxy] fetching via CapacitorHttp arraybuffer');
      const res: HttpResponse = await CapacitorHttp.request({
        url,
        method: 'GET',
        responseType: 'arraybuffer',
      });
      console.log('[MediaProxy] response status:', res.status, 'type:', typeof res.data);
      const base64 = res.data as string;
      const contentType = typeof res.headers === 'object' && res.headers ? (res.headers as Record<string, string>)['content-type'] || 'image/jpeg' : 'image/jpeg';
      const blob = this.base64ToBlob(base64, contentType);
      const blobUrl = URL.createObjectURL(blob);
      this.cache.set(url, blobUrl);
      console.log('[MediaProxy] blob url created:', blobUrl?.substring(0, 40));
      return blobUrl;
    } catch (err) {
      console.error('[MediaProxy] fetch failed, falling back:', url, err);
      return url;
    }
  }

  async proxyVideo(url: string): Promise<string> {
    if (!Capacitor.isNativePlatform()) return url;
    const cached = this.cache.get(url);
    if (cached) return cached;

    try {
      const res: HttpResponse = await CapacitorHttp.request({
        url,
        method: 'GET',
        responseType: 'arraybuffer',
      });
      const base64 = res.data as string;
      const contentType = res.headers['content-type'] || 'video/mp4';
      const blob = this.base64ToBlob(base64, contentType);
      const blobUrl = URL.createObjectURL(blob);
      this.cache.set(url, blobUrl);
      return blobUrl;
    } catch (err) {
      console.error('[MediaProxy] video fetch failed:', url, err);
      return url;
    }
  }

  async proxyM3u8(url: string, authToken: string): Promise<string> {
    let m3u8: string;

    if (!Capacitor.isNativePlatform()) {
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      m3u8 = await resp.text();
    } else {
      try {
        const res: HttpResponse = await CapacitorHttp.request({
          url,
          method: 'GET',
          headers: { Authorization: `Bearer ${authToken}` },
          responseType: 'text',
        });
        m3u8 = res.data as string;
      } catch (err) {
        console.error('[MediaProxy] m3u8 fetch failed:', url, err);
        throw err;
      }
    }

    const blob = new Blob([m3u8], { type: 'application/vnd.apple.mpegurl' });
    return URL.createObjectURL(blob);
  }

  async proxyTsSegment(url: string, rangeStart?: number, rangeEnd?: number): Promise<ArrayBuffer> {
    if (!Capacitor.isNativePlatform()) {
      const init: RequestInit = {};
      if (rangeEnd != null) {
        init.headers = {
          Range: `bytes=${rangeStart ?? 0}-${rangeEnd - 1}`,
        };
      }
      const response = await fetch(url, init);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.arrayBuffer();
    }

    const headers: Record<string, string> = {};
    if (rangeEnd != null) {
      headers['Range'] = `bytes=${rangeStart ?? 0}-${rangeEnd - 1}`;
    }

    const res: HttpResponse = await CapacitorHttp.request({
      url,
      method: 'GET',
      headers,
      responseType: 'arraybuffer',
    });

    if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);

    const base64 = res.data as string;
    const byteChars = atob(base64);
    const bytes = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      bytes[i] = byteChars.charCodeAt(i);
    }
    return bytes.buffer as ArrayBuffer;
  }

  private base64ToBlob(base64: string, contentType: string): Blob {
    const byteChars = atob(base64);
    const len = byteChars.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = byteChars.charCodeAt(i);
    }
    return new Blob([bytes], { type: contentType });
  }
}
