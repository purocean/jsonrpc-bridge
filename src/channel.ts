import { JSONRPCRequest, JSONRPCResponse } from './jsonrpc';

export interface JSONRPCClientChannel {
  send (message: JSONRPCRequest): void;
  setMessageHandler (callback: (message: JSONRPCResponse) => void): void;
}

export interface JSONRPCServerChannel {
  send (message: JSONRPCResponse): void;
  setMessageHandler (callback: (message: JSONRPCRequest) => void): void;
}
