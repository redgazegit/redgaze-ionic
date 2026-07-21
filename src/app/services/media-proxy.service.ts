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
    if (!Capacitor.isNativePlatform()) return url;
    try {
      const res: HttpResponse = await CapacitorHttp.request({
        url,
        method: 'GET',
        headers: { Authorization: `Bearer ${authToken}` },
        responseType: 'text',
      });
      let m3u8 = res.data as string;
      m3u8 = m3u8.replace(/https:\/\/media\.redgifs\.com\//g, 'https://media.redgifs.com/');
      const blob = new Blob([m3u8], { type: 'application/vnd.apple.mpegurl' });
      return URL.createObjectURL(blob);
    } catch (err) {
      console.error('[MediaProxy] m3u8 fetch failed:', url, err);
      throw err;
    }
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
