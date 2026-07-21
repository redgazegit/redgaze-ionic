import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { CapacitorHttp, HttpResponse } from '@capacitor/core';

@Injectable({ providedIn: 'root' })
export class MediaProxyService {
  private cache = new Map<string, string>();
  private progressiveStreams = new Map<string, { abortController: AbortController }>();

  async proxyImage(url: string): Promise<string> {
    if (Capacitor.isNativePlatform()) return url;
    return url;
  }

  async proxyVideo(url: string): Promise<string> {
    if (!Capacitor.isNativePlatform()) return url;
    return url;
  }

  async proxyVideoProgressive(url: string): Promise<string> {
    if (Capacitor.isNativePlatform()) return url;

    const cached = this.cache.get(url);
    if (cached) return cached;

    const chunkSize = 1024 * 1024;
    const abortController = new AbortController();

    try {
      const first = await this.rangeRequest(url, 0, chunkSize - 1, abortController.signal);
      const totalSize = first.totalSize;
      if (!totalSize) throw new Error('Range requests not supported');

      const mediaSource = new MediaSource();
      const blobUrl = URL.createObjectURL(mediaSource);
      this.cache.set(url, blobUrl);
      this.progressiveStreams.set(blobUrl, { abortController });

      const streamNext = async (sb: SourceBuffer): Promise<void> => {
        let remainingStart = 0;
        let firstAppended = false;

        while (remainingStart < totalSize) {
          if (abortController.signal.aborted) break;

          const end = Math.min(remainingStart + chunkSize, totalSize) - 1;
          const chunk = remainingStart === 0
            ? first
            : await this.rangeRequest(url, remainingStart, end, abortController.signal);

          if (abortController.signal.aborted) break;

          await new Promise<void>((resolve, reject) => {
            const onUpdate = () => {
              sb.removeEventListener('updateend', onUpdate);
              sb.removeEventListener('error', onError);
              resolve();
            };
            const onError = () => {
              sb.removeEventListener('updateend', onUpdate);
              sb.removeEventListener('error', onError);
              reject(new Error('SourceBuffer error'));
            };
            sb.addEventListener('updateend', onUpdate);
            sb.addEventListener('error', onError);
            try {
              sb.appendBuffer(chunk.data);
            } catch (e) {
              sb.removeEventListener('updateend', onUpdate);
              sb.removeEventListener('error', onError);
              reject(e);
            }
          });

          if (!firstAppended) {
            firstAppended = true;
          }

          remainingStart += chunkSize;
        }

        if (!abortController.signal.aborted && mediaSource.readyState === 'open') {
          mediaSource.endOfStream();
        }
      };

      mediaSource.addEventListener('sourceopen', async () => {
        if (abortController.signal.aborted) return;

        try {
          const sb = this.createSourceBuffer(mediaSource);
          if (!sb) {
            console.error('[MediaProxy] no compatible SourceBuffer, falling back');
            mediaSource.endOfStream();
            return;
          }
          await streamNext(sb);
        } catch (err) {
          console.error('[MediaProxy] streaming error:', err);
        }
      }, { once: true });

      return blobUrl;
    } catch (err) {
      abortController.abort();
      console.error('[MediaProxy] progressive failed, falling back:', url, err);
      return this.proxyVideo(url);
    }
  }

  abortProgressiveStream(blobUrl: string): void {
    const stream = this.progressiveStreams.get(blobUrl);
    if (stream) {
      stream.abortController.abort();
      this.progressiveStreams.delete(blobUrl);
    }
    URL.revokeObjectURL(blobUrl);
  }

  async proxyM3u8(url: string, authToken: string): Promise<string> {
    let m3u8: string;

    if (!Capacitor.isNativePlatform()) {
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      m3u8 = await resp.text();
      m3u8 = m3u8.replace(/https:\/\/media\.redgifs\.com\//g, `${location.origin}/cdn/`);
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

    return this.base64ToArrayBuffer(res.data as string);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const byteChars = atob(base64);
    const bytes = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      bytes[i] = byteChars.charCodeAt(i);
    }
    return bytes.buffer as ArrayBuffer;
  }

  private async rangeRequest(url: string, start: number, end: number, signal: AbortSignal): Promise<{ data: ArrayBuffer; totalSize: number | null }> {
    if (!Capacitor.isNativePlatform()) {
      try {
        const response = await fetch(url, {
          headers: { Range: `bytes=${start}-${end}` },
          signal,
        });
        if (response.status !== 206) throw new Error(`HTTP ${response.status}`);
        const data = await response.arrayBuffer();
        const totalSize = this.parseTotalSize(response.headers.get('content-range'));
        return { data, totalSize };
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') throw err;
        throw err;
      }
    }

    const res: HttpResponse = await CapacitorHttp.request({
      url,
      method: 'GET',
      headers: { Range: `bytes=${start}-${end}` },
      responseType: 'arraybuffer',
    });

    if (res.status !== 206) throw new Error(`HTTP ${res.status}`);

    const data = this.base64ToArrayBuffer(res.data as string);
    const h = (res.headers ?? {}) as Record<string, string>;
    const contentRange = h['content-range'] || h['Content-Range'] || h['CONTENT-RANGE'] || null;
    const totalSize = this.parseTotalSize(contentRange);
    return { data, totalSize };
  }

  private parseTotalSize(contentRange: string | null): number | null {
    if (!contentRange) return null;
    const match = contentRange.match(/bytes \d+-\d+\/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  private createSourceBuffer(mediaSource: MediaSource): SourceBuffer | null {
    const mimeTypes = [
      'video/mp4; codecs="avc1.42E01E,mp4a.40.2"',
      'video/mp4',
    ];
    for (const mimeType of mimeTypes) {
      try {
        return mediaSource.addSourceBuffer(mimeType);
      } catch {
        continue;
      }
    }
    return null;
  }
}
