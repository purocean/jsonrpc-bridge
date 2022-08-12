export function getLogger (topic: string, debug = false) {
  topic = `** jsonrpc-bridge: ${topic} **`;

  return {
    debug: (...args: any[]) => debug && console.debug(topic, ...args),
    warn: (...args: any[]) => console.warn(topic, ...args),
    error: (...args: any[]) => console.error(topic, ...args),
  };
}
