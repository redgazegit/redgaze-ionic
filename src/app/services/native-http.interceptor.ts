import { HttpEvent, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
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

  console.log('[NativeHttp] sending via CapacitorHttp:', req.method, req.url);

  let res;
  try {
    res = await CapacitorHttp.request({
      url: req.url,
      method: req.method,
      headers,
      data: req.body ?? undefined,
    });
    console.log('[NativeHttp] response:', res.status, typeof res.data);
  } catch (err) {
    console.error('[NativeHttp] CapacitorHttp.request threw:', err);
    throw err;
  }

  return new HttpResponse({
    body: res.data,
    status: res.status,
    statusText: '',
  });
}
