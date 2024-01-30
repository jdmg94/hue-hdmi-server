import type { ServerState } from './App'
declare module 'hono' {
  interface ContextVariableMap extends ServerState {}
}
