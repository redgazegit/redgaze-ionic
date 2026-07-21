export const config = { runtime: 'edge' }

const UPSTREAMS: Record<string, string> = {
  cdn: 'https://media.redgifs.com',
  userpic: 'https://userpic.redgifs.com',
}
const REFERER = 'https://www.redgifs.com'

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const segments = url.pathname.replace('/api/proxy/', '').split('/')
  const upstream = UPSTREAMS[segments[0]]
  if (!upstream) {
    return new Response('Unknown proxy target', { status: 400 })
  }

  const targetPath = '/' + segments.slice(1).join('/')
  const targetUrl = upstream + targetPath + url.search

  const headers = new Headers(request.headers)
  headers.set('Referer', REFERER)
  headers.set('Origin', 'https://www.redgifs.com')
  headers.delete('host')

  const res = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
  })

  const resHeaders = new Headers(res.headers)
  resHeaders.delete('access-control-allow-origin')

  return new Response(res.body, {
    status: res.status,
    headers: resHeaders,
  })
}
