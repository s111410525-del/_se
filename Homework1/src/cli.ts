#!/usr/bin/env node
import fs from 'node:fs';
import { parseArgs, UsageError, HELP_TEXT } from './args.js';
import { transfer } from './request.js';
import { Tracer, type Sink, type TraceLevel } from './trace.js';
import { ProgressBar, writeBody, writeCookieJar, writeDumpHeader, formatWriteOut, type Streams } from './output.js';
import { RequestError } from './url.js';
import type { Options } from './types.js';

export const VERSION = '1.0.0';

/** 對應 curl 的離開代碼。 */
export const EXIT = {
  OK: 0,
  UNSUPPORTED_PROTOCOL: 1,
  INIT_FAILED: 2,
  URL_MALFORMAT: 3,
  COULDNT_RESOLVE_HOST: 6,
  COULDNT_CONNECT: 7,
  HTTP_RETURNED_ERROR: 22,
  WRITE_ERROR: 23,
  OPERATION_TIMEDOUT: 28,
  TOO_MANY_REDIRECTS: 47,
  USAGE: 2,
} as const;

/** 決定診斷輸出的詳細程度。 */
function decideTraceLevel(options: Options): TraceLevel {
  const toFile = options.traceAscii !== undefined;
  const wantsDetail = options.verbose || toFile;
  if (options.silent && !options.showError && !wantsDetail) return 'none';
  return wantsDetail ? 'verbose' : 'normal';
}

interface TraceHandle {
  tracer: Tracer;
  close: () => void;
}

function openTracer(options: Options, err: NodeJS.WritableStream): TraceHandle {
  const level = decideTraceLevel(options);
  const file = options.traceAscii;

  if (level === 'none') return { tracer: Tracer.none(), close: () => undefined };

  if (file !== undefined) {
    let stream: fs.WriteStream | undefined;
    const sink: Sink = {
      write: (text: string) => {
        stream ??= fs.createWriteStream(file);
        stream.write(text);
      },
    };
    return {
      tracer: new Tracer(level, sink),
      close: () => stream?.end(),
    };
  }

  return {
    tracer: new Tracer(level, { write: (text) => err.write(text) }),
    close: () => undefined,
  };
}

/** 把一次回應的標頭組成 curl 風格文字。 */
function headerBlock(statusLine: string, headers: [string, string][]): string {
  return `${[statusLine, ...headers.map(([k, v]) => `${k}: ${v}`), '', ''].join('\r\n')}`;
}

/** 執行 minicurl，回傳 process exit code。 */
export async function run(argv: string[], streams: Streams): Promise<number> {
  let options: Options;
  try {
    options = parseArgs(argv);
  } catch (err) {
    if (err instanceof UsageError) {
      streams.err.write(`minicurl: ${err.message}\n`);
      streams.err.write("試用 'minicurl --help' 查看更多資訊。\n");
      return EXIT.USAGE;
    }
    throw err;
  }

  if (options.help) {
    streams.out.write(HELP_TEXT);
    return EXIT.OK;
  }
  if (options.version) {
    streams.out.write(`minicurl ${VERSION} (Node ${process.version})\n`);
    return EXIT.OK;
  }

  const { tracer, close: closeTracer } = openTracer(options, streams.err);
  const showProgress = !options.silent && (options.progress || streams.isTty);
  const progress = new ProgressBar(streams.err, showProgress);
  const chainHeaders: string[] = [];

  try {
    tracer.info(`minicurl ${VERSION}`);

    const result = await transfer(options, tracer, {
      onChunk: (received, total) => progress.update(received, total),
      onResponse: (statusLine, headers) => {
        chainHeaders.push(headerBlock(statusLine, headers));
      },
    });

    progress.stop();

    await writeDumpHeader(options, result, chainHeaders);
    await writeCookieJar(options, result.cookies, result);
    const written = await writeBody(options, result, streams);

    if (options.writeOut !== undefined) {
      streams.out.write(formatWriteOut(options.writeOut, result));
    }
    if (written.file !== undefined) {
      tracer.info(`檔案已儲存: ${written.file} (${written.bytesWritten} bytes)`);
    }

    closeTracer();
    tracer.close();

    if (result.status >= 400) {
      tracer.info(`HTTP ${result.status} ${result.statusText}`.trimEnd());
      return EXIT.HTTP_RETURNED_ERROR;
    }
    return EXIT.OK;
  } catch (err) {
    progress.stop();
    if (err instanceof RequestError || err instanceof UsageError) {
      closeTracer();
      tracer.warn(err.message);
      tracer.close();
      return err.exitCode;
    }
    closeTracer();
    tracer.warn(`minicurl: ${(err as Error).message}`);
    tracer.close();
    return EXIT.INIT_FAILED;
  }
}

/** 命令列進入點。 */
export async function main(argv: string[] = process.argv.slice(2)): Promise<never> {
  const streams: Streams = {
    out: process.stdout,
    err: process.stderr,
    isTty: process.stderr.isTTY === true,
  };
  let code: number = EXIT.INIT_FAILED;
  try {
    code = await run(argv, streams);
  } catch (err) {
    streams.err.write(`minicurl: ${(err as Error).message}\n`);
    code = EXIT.INIT_FAILED;
  } finally {
    await new Promise<void>((resolve) => {
      if (process.stdout.writableLength === 0) resolve();
      else process.stdout.write('', () => resolve());
    });
  }
  process.exit(code);
}

const invokedDirectly = process.argv[1] !== undefined
  && /(?:^|[\\/])(?:cli|index)\.(?:js|ts|mjs|cjs)$/.test(process.argv[1]);

if (invokedDirectly) void main();
