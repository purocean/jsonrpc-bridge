import { getLogger } from '@/logger';
import { JSONRPCServerChannel } from '@/channel';
import { buildError, buildResult, ERROR_CODE } from '@/jsonrpc';

export interface Options {
  debug?: boolean;
}

export class JSONRPCServer {
  private opts: Options;
  private logger: ReturnType<typeof getLogger>;
  private channel: JSONRPCServerChannel;
  private modules: { [name: string]: any } = {};

  constructor (channel: JSONRPCServerChannel, opts?: Options) {
    this.opts = { debug: false, ...opts };
    this.logger = getLogger('JSONRPCServer', this.opts.debug);
    this.channel = channel;

    this.channel.onMessage(async (message) => {
      this.logger.debug('Received message', message);

      const res = this._getMethod(message.method);
      if (!res) {
        this.logger.error('Invalid method', message);
        message.id && this.channel.send(buildError(message.id, ERROR_CODE.INVALID_METHOD, 'Invalid method'));
        return;
      }

      try {
        const { obj, name } = res;
        const result = await obj[name](...message.params);
        message.id && this.channel.send(buildResult(message.id, result));
      } catch (error) {
        message.id && this.channel.send(buildError(message.id, ERROR_CODE.INTERNAL_ERROR, error.message || String(error)));
      }
    });
  }

  private _getMethod (path: string) {
    const parts = path.split('.');

    let obj: any = this.modules;

    while (true) {
      const name = parts.shift();
      if (!name) {
        return null;
      }

      const part = obj[name];
      if (!part) {
        return null;
      }

      if (parts.length) {
        obj = part;
      } else {
        return { obj, name };
      }
    }
  }

  public register (modules: { [name: string]: any }): void {
    this.modules = { ...this.modules, ...modules };
  }
}
