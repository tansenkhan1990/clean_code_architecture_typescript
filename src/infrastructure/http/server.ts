import type { Server } from "node:http";
import type { Express } from "express";

export interface HttpServerOptions {
  port: number;
  host?: string;
}

export interface HttpServer {
  readonly port: number;
  close(): Promise<void>;
}

/** Starts the Express app and resolves once the socket is actually bound. */
export async function startHttpServer(
  app: Express,
  options: HttpServerOptions,
): Promise<HttpServer> {
  const server = await listen(app, options);
  return { port: readBoundPort(server), close: () => closeServer(server) };
}

function listen(app: Express, options: HttpServerOptions): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server =
      options.host === undefined
        ? app.listen(options.port)
        : app.listen(options.port, options.host);

    const onError = (error: Error): void => {
      server.off("listening", onListening);
      reject(error);
    };

    const onListening = (): void => {
      server.off("error", onError);
      resolve(server);
    };

    server.once("error", onError);
    server.once("listening", onListening);
  });
}

function readBoundPort(server: Server): number {
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("HTTP server did not bind to a TCP port.");
  }
  return address.port;
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
