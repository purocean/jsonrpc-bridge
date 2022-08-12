let rpcId = 1;

export const ERROR_CODE = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  INVALID_METHOD: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603
};

export interface JSONRPCMessage {
  id?: number;
  jsonrpc: '2.0';
}

export interface JSONRPCRequest<T extends Array<any> = any[]> extends JSONRPCMessage {
  method: string;
  params: T;
}

export interface JSONRPCResult<T = any> extends JSONRPCMessage {
  result: T;
}

export interface JSONRPCError extends JSONRPCMessage {
  error: {
    code: number;
    message: string;
    data?: any;
  };
}

export type JSONRPCResponse = Partial<JSONRPCResult & JSONRPCError>;

export function getRpcId () {
  return rpcId++;
}

export function buildRequest<T extends Array<any> = any[]> (method: string, params: T): JSONRPCRequest<T> & { id: number } {
  return {
    jsonrpc: '2.0',
    id: getRpcId(),
    method,
    params
  };
}

export function buildResult<T> (id: number, result: T): JSONRPCResult<T> {
  return {
    jsonrpc: '2.0',
    id,
    result
  };
}

export function buildError (id: number, code: number, message: string, data?: any): JSONRPCError {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      data
    }
  };
}
