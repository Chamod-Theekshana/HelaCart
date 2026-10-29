import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? '.artifacts/preview-web');
const port = Number(process.argv[3] ?? 4317);
const types = {'.html':'text/html','.js':'application/javascript','.json':'application/json','.wasm':'application/wasm','.png':'image/png','.jpg':'image/jpeg','.ttf':'font/ttf','.woff2':'font/woff2','.css':'text/css'};
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://localhost:${port}`);
    if (url.pathname.startsWith('/api/v1/')) {
      // Local QA only: proxy public GETs to avoid changing the API CORS settings.
      if (request.method !== 'GET' || /\/(me|auth|admin|sellers|workspace)(\/|$)/.test(url.pathname)) {response.writeHead(405).end();return;}
      const upstream = await fetch(`http://localhost:4000${url.pathname}${url.search}`, {signal:AbortSignal.timeout(45000)});
      response.writeHead(upstream.status, {'content-type':upstream.headers.get('content-type') ?? 'application/json','cache-control':'no-store'});
      response.end(Buffer.from(await upstream.arrayBuffer()));return;
    }
    let file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (file !== root && !file.startsWith(root + path.sep)) {response.writeHead(403).end();return;}
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
    response.writeHead(200, {'content-type':types[path.extname(file)] ?? 'application/octet-stream','cache-control':'no-store'});
    fs.createReadStream(file).pipe(response);
  } catch {response.writeHead(502).end('Local preview request failed.');}
});
server.listen(port,'127.0.0.1',()=>process.stdout.write(`HelaCart local preview: http://localhost:${port}\n`));
