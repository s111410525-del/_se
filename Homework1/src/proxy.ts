import net from 'node:net';
import { RequestError } from './url.js';

export interface ProxyConfig {
  host: string;
  port: number;
  /** CONNECT 隧道時使用的認證標頭。 */
  authorization?: string;
}

/** 解析 `-x` 的值，支援 `host:port`、`http://host:port`、`user:pass@host:port`。 */
export function parseProxy(spec: string): ProxyConfig {
  let rest = spec.trim();
  if (rest === '') throw new RequestError('proxy 設定為空', 5);

  let authorization: string | undefined;
  const schemeIdx = rest.indexOf('://');
  if (schemeIdx !== -1) {
    const scheme = rest.slice(0, schemeIdx).toLowerCase();
    if (scheme !== 'http' && scheme !== 'https') {
      throw new RequestError(`不支援的 proxy 協定: ${scheme}`, 5);
    }
    rest = rest.slice(schemeIdx + 3);
  }

  const at = rest.lastIndexOf('@');
  if (at !== -1) {
    const creds = rest.slice(0, at);
    rest = rest.slice(at + 1);
    const [user, pass = ''] = creds.includes(':')
      ? [creds.slice(0, creds.indexOf(':')), creds.slice(creds.indexOf(':') + 1)]
      : [creds, ''];
    authorization = `Basic ${Buffer.from(`${decodeURIComponent(user)}:${decodeURIComponent(pass)}`).toString('base64')}`;
  }

  let host = rest;
  let port = 8080;
  if (rest.startsWith('[')) {
    // [IPv6]:port
    const end = rest.indexOf(']');
    if (end === -1) throw new RequestError(`proxy 位址格式錯誤: ${spec}`, 5);
    host = rest.slice(1, end);
    if (rest[end + 1] === ':') port = Number(rest.slice(end + 2));
  } else {
    const colon = rest.lastIndexOf(':');
    if (colon !== -1) {
      host = rest.slice(0, colon);
      port = Number(rest.slice(colon + 1));
    }
  }
  if (host === '' || !Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new RequestError(`proxy 位址格式錯誤: ${spec}`, 5);
  }
  return { host, port, ...(authorization === undefined ? {} : { authorization }) };
}

/**
 * 對 HTTPS 目標建立 CONNECT 隧道。
 * 回傳已與目標伺服器完成 TLS 前置協商的 socket。
 */
export function openTunnel(
  proxy: ProxyConfig,
  targetHost: string,
  targetPort: number,
  timeoutMs: number,
): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: proxy.host, port: proxy.port });
    let settled = false;
    const fail = (err: Error): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(err);
    };
    const timer = setTimeout(() => fail(new RequestError('proxy 連線逾時', 28)), timeoutMs);
    timer.unref?.();

    socket.once('error', (err) => fail(new RequestError(`proxy 連線失敗: ${(err as Error).message}`, 7)));

    socket.once('connect', () => {
      const lines = [`CONNECT ${targetHost}:${targetPort} HTTP/1.1`, `Host: ${targetHost}:${targetPort}`];
      if (proxy.authorization) lines.push(`Proxy-Authorization: ${proxy.authorization}`);
      lines.push('Connection: keep-alive', '', '');
      socket.write(lines.join('\r\n'));
    });

    let buffer = '';
    const onData = (chunk: Buffer): void => {
      buffer += chunk.toString('latin1');
      const end = buffer.indexOf('\r\n\r\n');
      if (end === -1) return;
      socket.removeListener('data', onData);
      clearTimeout(timer);
      const statusLine = buffer.slice(0, buffer.indexOf('\r\n'));
      const code = Number(statusLine.split(' ')[1] ?? '0');
      if (code !== 200) {
        fail(new RequestError(`proxy CONNECT 失敗: ${statusLine}`, 97));
        return;
      }
      settled = true;
      const rest = Buffer.from(buffer.slice(end + 4), 'latin1');
      if (rest.length > 0) socket.unshift(rest);
      resolve(socket);
    };
    socket.on('data', onData);
  });
}
