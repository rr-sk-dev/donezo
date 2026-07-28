import { networkInterfaces } from 'node:os';
import index from './src/index.html';

const port = Number(process.env.PORT ?? 3000);
const isProduction = process.env.NODE_ENV === 'production';

const server = Bun.serve({
  port,
  hostname: '0.0.0.0',
  development: isProduction
    ? false
    : {
        hmr: true,
        console: true,
      },
  routes: {
    '/': index,
    '/health': new Response('ok'),
  },
  fetch() {
    return new Response('Not found', { status: 404 });
  },
  error(error) {
    console.error(error);
    return new Response('Internal server error', { status: 500 });
  },
});

function lanAddress(): string | undefined {
  return Object.values(networkInterfaces())
    .flat()
    .find((iface) => iface?.family === 'IPv4' && !iface.internal)?.address;
}

console.log(`Local: http://localhost:${server.port}`);

const lan = lanAddress();
if (lan && !isProduction) {
  console.log(`Network: http://${lan}:${server.port}`);
}
