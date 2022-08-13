import { getLogger } from '@/logger';
import { JSONRPCClientChannel } from '@/channel';
import { buildNotify, buildRequest } from '@/jsonrpc';

export interface Options {
  debug?: boolean;
  timeout?: number;
}

type ModulesPromisify<M, NoReturn = false> = {
  [K in keyof M]: M[K] extends (...args: infer P) => infer R
    ? NoReturn extends false ? (...args: P) => Promise<R> : (...args: P) => void
    : ModulesPromisify<M[K], NoReturn>;
}

type Handler = {
  resolve (value: any): void,
  reject (reason: any): void,
}

export type Flat<T extends Record<string, any>, M extends string = ''> =(
  {
    [K in keyof T as (
      T[K] extends (...args: any) => any
      ? (K extends string ? (M extends '' ? K : `${M}.${K}`) : never)
      : (K extends string ? keyof Flat<T[K], M extends '' ? K : `${M}.${K}`> : never)
    )]: never
  }
)

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

  private _proxy (processor: (method: string, args: any[]) => any) {
    const path: string[] = [];

    const _proxy = () => {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      return new Proxy((function () {}) as any, {
        get: (_, prop) => {
          path.push(prop.toString());
          return _proxy();
        },
        apply: (_, __, args) => {
          const method = path.join('.');
          return processor.call(this, method, args);
        },
      });
    };

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return new Proxy((function () {}) as any, {
      get: (_, name) => {
        name = name.toString();
        this.logger.debug(`Getting remote module [${name}]`);
        path.push(name);
        return _proxy();
      },
      apply: (_, __, [method, args]: [ string, any[] ]) => {
        return processor.call(this, method, args);
      },
    });
  }

  public get call () : ModulesPromisify<Modules> & ((method: keyof Flat<Modules>, args: any[]) => Promise<any>) {
    return this._proxy((method: string, args: any[]) => {
      this.logger.debug(`Calling [${method}]`, args);

      return new Promise((resolve, reject) => {
        const message = buildRequest(method, args);

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
    });
  }

  public get notify (): ModulesPromisify<Modules, true> & ((method: keyof Flat<Modules>, args: any[]) => void) {
    return this._proxy((method: string, args: any[]) => {
      this.logger.debug(`Notify [${method}]`, args);
      const message = buildNotify(method, args);
      this.channel.send(message);
    });
  }
}
