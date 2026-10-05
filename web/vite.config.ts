import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Firebase authorizes localhost for development, but not its numeric aliases.
// Keep page navigations on that origin so Google sign-in works from preview links.
function localAuthHost(): Plugin {
  return {
    name: 'local-auth-host',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const loopback = req.headers.host?.match(/^127\.0\.0\.1(?::(\d+))?$/);
        const navigation = req.headers['sec-fetch-dest'] === 'document' || req.headers.accept?.includes('text/html');
        if (!loopback || !navigation || (req.method !== 'GET' && req.method !== 'HEAD')) return next();
        res.statusCode = 302;
        res.setHeader('Location', `http://localhost${loopback[1] ? `:${loopback[1]}` : ''}${req.url ?? '/'}`);
        res.setHeader('Cache-Control', 'no-store');
        res.end();
      });
    },
  };
}

// https://vite.dev/config/
function bggApi(): Plugin {
  return {
    name: 'bgg-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split('?')[0];
        if (pathname !== '/api/bgg' && pathname !== '/api/bgg-cover') return next();
        if (req.method !== 'GET') { res.statusCode = 405; res.end(); return; }
        try {
          const handler = pathname === '/api/bgg' ? await import('./api/bgg') : await import('./api/bgg-cover');
          const response = await handler.GET(new Request(`http://localhost${req.url}`));
          res.statusCode = response.status;
          response.headers.forEach((value, name) => res.setHeader(name, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Could not load BoardGameGeek. Try again.' }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Server-only token: never put it in Vite's client define/env namespace.
  const env = loadEnv(mode, process.cwd(), 'BGG_');
  if (env.BGG_TOKEN) process.env.BGG_TOKEN = env.BGG_TOKEN;
  return {
  plugins: [react(), localAuthHost(), bggApi()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['vaul'],
  },
  };
})
