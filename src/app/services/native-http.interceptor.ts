import { HttpErrorResponse, HttpEvent, HttpHeaders, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { CapacitorHttp } from '@capacitor/core';
import { from, Observable } from 'rxjs';

export const nativeHttpInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next
): Observable<HttpEvent<unknown>> => {
  if (!Capacitor.isNativePlatform()) {
    return next(req);
  }

  return from(handleNative(req));
};

async function handleNative(req: HttpRequest<unknown>): Promise<HttpEvent<unknown>> {
  const headers: Record<string, string> = {};
  req.headers.keys().forEach(k => { headers[k] = req.headers.get(k) ?? ''; });

  let data = req.body ?? undefined;
  if (data != null && typeof data === 'object' && !(data instanceof FormData) && !(data instanceof ArrayBuffer) && !(data instanceof Blob) && !(data instanceof URLSearchParams)) {
    data = JSON.stringify(data);
    if (headers['Content-Type'] === undefined) {
      headers['Content-Type'] = 'application/json';
    }
  }

  const arrayBufferResponse = req.responseType === 'arraybuffer';

  console.log('[NativeHttp] sending via CapacitorHttp:', req.method, req.url);

  let res;
  try {
    res = await CapacitorHttp.request({
      url: req.url,
      method: req.method,
      headers,
      data,
      ...(arrayBufferResponse ? { responseType: 'arraybuffer' as const } : {}),
    });
    console.log('[NativeHttp] response:', res.status, typeof res.data);
  } catch (err) {
    console.error('[NativeHttp] CapacitorHttp.request threw:', err);
    throw err;
  }

  const resHeaders = new HttpHeaders((res.headers ?? {}) as Record<string, string>);

  if (res.status < 200 || res.status >= 300) {
    throw new HttpErrorResponse({
      error: res.data,
      status: res.status,
      statusText: '',
      url: req.url,
      headers: resHeaders,
    });
  }

  return new HttpResponse({
    body: arrayBufferResponse && typeof res.data === 'string' ? base64ToArrayBuffer(res.data as string) : res.data,
    status: res.status,
    statusText: '',
    url: req.url,
    headers: resHeaders,
  });
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const byteChars = atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    bytes[i] = byteChars.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
}
