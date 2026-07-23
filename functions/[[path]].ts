const UPSTREAMS = [
  { prefix: '/api', upstream: 'https://api.redgifs.com' },
  { prefix: '/cdn', upstream: 'https://media.redgifs.com' },
  { prefix: '/userpic', upstream: 'https://userpic.redgifs.com' },
]

export async function onRequest(context) {
  const { request, next } = context
  const url = new URL(request.url)
  const path = url.pathname

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 })
  }

  for (const cfg of UPSTREAMS) {
    if (path.startsWith(cfg.prefix + '/') || path === cfg.prefix) {
      const upstreamUrl = new URL(cfg.upstream)
      upstreamUrl.pathname = path.replace(cfg.prefix, '')
      upstreamUrl.search = url.search

      const headers = new Headers(request.headers)
      headers.set('Referer', 'https://www.redgifs.com')
      headers.set('Origin', 'https://www.redgifs.com')
      headers.delete('host')

      const body = request.method === 'GET' || request.method === 'HEAD'
        ? undefined
        : await request.blob()

      const res = await fetch(upstreamUrl.toString(), {
        method: request.method,
        headers,
        body,
      })

      const resHeaders = new Headers(res.headers)
      resHeaders.delete('access-control-allow-origin')
      resHeaders.delete('content-encoding')

      return new Response(res.body, { status: res.status, headers: resHeaders })
    }
  }

  return next()
}
