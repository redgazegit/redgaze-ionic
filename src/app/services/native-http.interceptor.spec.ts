import { HttpErrorResponse, HttpRequest, HttpResponse } from '@angular/common/http';
import { firstValueFrom, Observable, of } from 'rxjs';
import { nativeHttpInterceptor } from './native-http.interceptor';

const isNativePlatform = vi.fn();
const capacitorRequest = vi.fn();

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform(),
  },
  CapacitorHttp: {
    request: (...args: unknown[]) => capacitorRequest(...args),
  },
}));

function run(req: HttpRequest<unknown>, next: () => Observable<unknown> = () => of('passthrough')) {
  return firstValueFrom(nativeHttpInterceptor(req, next as never));
}

describe('nativeHttpInterceptor', () => {
  beforeEach(() => {
    isNativePlatform.mockReset();
    capacitorRequest.mockReset();
  });

  it('should pass through on web', async () => {
    isNativePlatform.mockReturnValue(false);
    const req = new HttpRequest('GET', '/api/v2/gifs');
    await expect(run(req)).resolves.toBe('passthrough');
    expect(capacitorRequest).not.toHaveBeenCalled();
  });

  it('should return a successful response with headers and url', async () => {
    isNativePlatform.mockReturnValue(true);
    capacitorRequest.mockResolvedValue({
      status: 200,
      data: { gifs: [] },
      headers: { 'content-type': 'application/json' },
    });
    const req = new HttpRequest('GET', '/api/v2/gifs');

    const event = await run(req) as HttpResponse<unknown>;

    expect(event).toBeInstanceOf(HttpResponse);
    expect(event.status).toBe(200);
    expect(event.body).toEqual({ gifs: [] });
    expect(event.url).toBe('/api/v2/gifs');
    expect(event.headers.get('content-type')).toBe('application/json');
  });

  it('should throw HttpErrorResponse on 401', async () => {
    isNativePlatform.mockReturnValue(true);
    capacitorRequest.mockResolvedValue({
      status: 401,
      data: { error: 'unauthorized' },
      headers: { 'content-type': 'application/json' },
    });
    const req = new HttpRequest('GET', '/api/v2/gifs');

    const error = await run(req).catch(err => err);

    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect(error.status).toBe(401);
    expect(error.error).toEqual({ error: 'unauthorized' });
    expect(error.url).toBe('/api/v2/gifs');
  });

  it('should preserve Retry-After header on 429', async () => {
    isNativePlatform.mockReturnValue(true);
    capacitorRequest.mockResolvedValue({
      status: 429,
      data: 'rate limited',
      headers: { 'Retry-After': '7' },
    });
    const req = new HttpRequest('GET', '/api/v2/gifs');

    const error = await run(req).catch(err => err);

    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect(error.status).toBe(429);
    expect(error.headers.get('Retry-After')).toBe('7');
  });

  it('should throw HttpErrorResponse on 500', async () => {
    isNativePlatform.mockReturnValue(true);
    capacitorRequest.mockResolvedValue({ status: 500, data: 'boom', headers: {} });
    const req = new HttpRequest('POST', '/api/v2/metrics/gifs', { event: 'viewed' });

    const error = await run(req).catch(err => err);

    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect(error.status).toBe(500);
    expect(error.error).toBe('boom');
  });

  it('should decode arraybuffer responses', async () => {
    isNativePlatform.mockReturnValue(true);
    capacitorRequest.mockResolvedValue({ status: 200, data: 'aGVsbG8=', headers: {} });
    const req = new HttpRequest('GET', '/cdn/video.mp4', { responseType: 'arraybuffer' });

    const event = await run(req) as HttpResponse<unknown>;

    expect(capacitorRequest).toHaveBeenCalledWith(expect.objectContaining({ responseType: 'arraybuffer' }));
    expect(event.body).toBeInstanceOf(ArrayBuffer);
    expect(new TextDecoder().decode(event.body as ArrayBuffer)).toBe('hello');
  });
});
