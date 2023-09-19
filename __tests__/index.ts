import { JSONRPCServer } from '@/server';
import { JSONRPCClient } from '@/client';
import { JSONRPCClientChannel, JSONRPCServerChannel } from '@/channel';
import { buildRequest, ERROR_CODE, JSONRPCRequest, JSONRPCResponse } from '@/jsonrpc';

function sleep (ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function newInstance () {
  const moduleA = {
    foo: {
      bar: {
        add (a: number, b: number): number {
          return a + b;
        },
        async addAsync (a: number, b: number) {
          await sleep(100);
          return a + b;
        }
      },
      error () {
        throw new Error('Error');
      },
      async errorAsync () {
        await sleep(100);
        throw new Error('ErrorAsync');
      }
    }
  };

  const moduleB = {
    async timeout () {
      await sleep(600);
      return 'Timeout';
    },
    async timeoutError () {
      await sleep(600);
      throw new Error('Timeout');
    }
  };

  const modules = { moduleA, moduleB };

  const serverHandlers: Array<(msg: JSONRPCRequest) => void> = [];
  const clientHandlers: Array<(msg: JSONRPCResponse) => void> = [];

  const serverChannel: JSONRPCServerChannel = {
    send (message) {
      setTimeout(() => {
        clientHandlers.forEach(handler => handler(message));
      }, 100);
    },
    setMessageHandler (callback) {
      serverHandlers.push(callback);
    }
  };

  const clientChannel: JSONRPCClientChannel = {
    send (message) {
      setTimeout(() => {
        serverHandlers.forEach(handler => handler(message));
      }, 100);
    },
    setMessageHandler (callback) {
      clientHandlers.push(callback);
    }
  };

  const client = new JSONRPCClient<typeof modules>(clientChannel, { debug: true, timeout: 500 });
  const server = new JSONRPCServer(serverChannel, { debug: true });

  Object.entries(modules).forEach(([key, entry]) => {
    server.addModule(key, entry);
  });

  return { client, server, clientChannel, serverChannel, modules, serverHandlers, clientHandlers };
}

test('server: invalid method', async () => {
  const { clientChannel } = newInstance();

  await new Promise(resolve => {
    clientChannel.setMessageHandler(async (message) => {
      expect(message.error).toBeDefined();
      expect(message.error!.code).toBe(ERROR_CODE.INVALID_METHOD);
      expect(message.error!.message).toBe('Invalid method');
      resolve(undefined);
    });
    clientChannel.send(buildRequest('', [1, 2]));
  });
});

test('call', async () => {
  const { client } = newInstance();

  expect(await client.call.moduleA.foo.bar.add(1, 2)).toBe(3);
  expect(await client.call.moduleA['foo.bar'].add(1, 2)).toBe(3);
  expect(await client.call('moduleA.foo.bar.addAsync', [1, 2])).toBe(3);
  expect(await client.call['moduleA.foo.bar.addAsync'](1, 2)).toBe(3);
  expect(await client.call.moduleA.foo.bar.addAsync(1, 2)).toBe(3);

  try {
    await client.call.moduleA.foo.error();
  } catch (error) {
    expect(error.message).toBe('Error');
  }

  try {
    await client.call.moduleA.foo.errorAsync();
  } catch (error) {
    expect(error.message).toBe('ErrorAsync');
  }

  try {
    await client.call.moduleA['not-exist-mothod'](1, 2);
  } catch (error) {
    expect(error.message).toBe('Invalid method');
  }

  try {
    await client.call.moduleB.timeout();
  } catch (error) {
    expect(error.message.includes('Timeout [')).toBe(true);
  }

  try {
    await client.call.moduleB.timeoutError();
  } catch (error) {
    expect(error.message.includes('Timeout [')).toBe(true);
  }
});

test('notify', async () => {
  const { client, modules } = newInstance();
  jest.spyOn(modules.moduleA.foo.bar, 'add');
  client.notify.moduleA.foo.bar.add(1, 2);
  await sleep(101);
  expect(modules.moduleA.foo.bar.add).toHaveBeenCalledWith(1, 2);
});
