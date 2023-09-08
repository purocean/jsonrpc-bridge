# jsonrpc-bridge

Remote procedure call (RPC) library for JavaScript. It is based on JSON-RPC 2.0 specification.

## Installation

```bash
npm install --save jsonrpc-bridge
```

## Usage

### Server side

```typescript
import * as testModule from './testModule';

const serverChannel: JSONRPCServerChannel = ...;
const server = new JSONRPCServer(serverChannel, { debug: true });
server.setModules(modules);
```

### Client side

```typescript
const clientChannel: JSONRPCClientChannel = ...;
const client = new JSONRPCClient<typeof modules>(clientChannel, { debug: true });

const res = await client.call.testModule.testMethod('test', 123) // call remote method
client.notify.testModule.testMethod('test', 123) // call remote method without response
```
