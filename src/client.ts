import { getLogger } from '@/logger';
import { JSONRPCClientChannel } from '@/channel';
import { buildRequest } from '@/jsonrpc';

export interface Options {
  debug?: boolean;
  timeout?: number;
}

type ModulesPromisify<M> = {
  [K in keyof M]: M[K] extends (...args: infer P) => infer R
    ? (...args: P) => Promise<R>
    : ModulesPromisify<M[K]>;
}

type Handler = {
  resolve (value: any): void,
  reject (reason: any): void,
}

export class JSONRPCClient<Modules = any> {
  private opts: Options;
  private logger: ReturnType<typeof getLogger>;
  private channel: JSONRPCClientChannel;
  private handlers = new Map<number, Handler>();

  constructor (channel: JSONRPCClientChannel, opts?: Options) {
    this.opts = { debug: false, timeout: 30000, ...opts };
    this.logger = getLogger('JSONRPCClient', this.opts.debug);
    this.channel = channel;

    this.channel.onMessage((message) => {
      this.logger.debug('Received message', message);

      if (!message.id) {
        this.logger.error('Invalid response', message);
        return;
      }

      const handler = this.handlers.get(message.id);
      if (handler) {
        if (message.error) {
          handler.reject(message.error);
        } else {
          handler.resolve(message.result);
        }
      } else {
        this.logger.warn(`No handler for response [${message.id}]`);
      }
    });
  }

  public get remote (): ModulesPromisify<Modules> {
    const path: string[] = [];

    const _proxy = () => {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      return new Proxy((function () {}) as any, {
        get: (_, prop) => {
          path.push(prop.toString());
          return _proxy();
        },
        apply: (_, __, argArray) => {
          const method = path.join('.');
          this.logger.debug(`Calling [${method}]`, argArray);

          return new Promise((resolve, reject) => {
            const message = buildRequest(method, argArray);

            this.channel.send(message);

            const timer = setTimeout(() => {
              const handler = this.handlers.get(id);
              if (handler) {
                this.handlers.delete(id);
                reject(new Error(`Timeout [${id}]`));
              }
            }, this.opts.timeout);

            const id = message.id;
            this.handlers.set(id, {
              resolve: (value) => {
                clearTimeout(timer);
                this.handlers.delete(id);
                resolve(value);
              },
              reject: (reason) => {
                clearTimeout(timer);
                this.handlers.delete(id);
                reject(reason);
              }
            });
          });
        },
      });
    };

    return new Proxy({} as any, {
      get: (_, name) => {
        name = name.toString();
        this.logger.debug(`Getting remote module [${name}]`);
        path.push(name);
        return _proxy();
      }
    });
  }
}
