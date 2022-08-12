import { JSONRPCRequest, JSONRPCResponse } from './jsonrpc';

export interface JSONRPCClientChannel {
  send (message: JSONRPCRequest): void;
  onMessage (callback: (message: JSONRPCResponse) => void): void;
}

export interface JSONRPCServerChannel {
  send (message: JSONRPCResponse): void;
  onMessage (callback: (message: JSONRPCRequest) => void): void;
}
