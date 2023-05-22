import { Container } from './container';

export type Constructor<T = any> = { new (...args: any[]): T };
export type Factory<T = any> = { (...args: any[]): T };

export type Intersect<Types> =
  Types extends undefined ? any
  : Types extends [...any]
  ? Types extends [infer I, ...infer R] ? I & Intersect<R> : {}
  : Types;

export type ServiceScope = 'global' | 'local' | 'private';
export type ServiceHook<T> = (service: T, ...args: any[]) => Promise<void> | void;
export type ServiceForkHook<T> = (service: T, ...args: any[]) => Promise<T | undefined> | T | undefined;

export type ServiceDefinitionOptions<T = any> = {
  factory: Constructor<T> | Factory<Promise<T> | T> | null;
  scope?: ServiceScope;
  onCreate?: ServiceHook<T>;
  onFork?: ServiceForkHook<T>;
  onDestroy?: ServiceHook<T>;
};

export type ServiceDefinition<T extends Intersect<A>, A = undefined> =
  | Constructor<T>
  | Factory<Promise<T> | T>
  | null
  | ServiceDefinitionOptions<T>;

export type ServiceType<D> = D extends ServiceDefinition<infer T> ? T : never;

export type CompiledServiceHook<T> = (service: T, container: Container) => void;
export type CompiledAsyncServiceHook<T> = (service: T, container: Container) => Promise<void> | void;
export type CompiledServiceForkHook<T> = (service: T, container: Container) => T | undefined;

export type CompiledServiceDefinitionOptions<T = any> = {
  aliases: string[];
  scope?: ServiceScope;
  onFork?: CompiledServiceForkHook<T>
  onDestroy?: CompiledServiceHook<T> | CompiledAsyncServiceHook<T>;
};

export type CompiledFactory<T> = (container: Container) => T;

export type CompiledAsyncServiceDefinition<T = any> = CompiledServiceDefinitionOptions<T> & {
  factory: CompiledFactory<Promise<T>>;
  async: true;
  onCreate?: CompiledServiceHook<T>;
};

export type CompiledSyncServiceDefinition<T = any> = CompiledServiceDefinitionOptions<T> & {
  factory: CompiledFactory<T>;
  async?: false;
  onCreate?: CompiledAsyncServiceHook<T>;
};

export type CompiledDynamicServiceDefinition<T = any> = CompiledServiceDefinitionOptions<T> & {
  factory: null;
  async?: false;
  onCreate?: CompiledAsyncServiceHook<T>;
};

export type CompiledServiceDefinition<T = any> =
  | CompiledAsyncServiceDefinition<T>
  | CompiledSyncServiceDefinition<T>
  | CompiledDynamicServiceDefinition<T>;

export type CompiledServiceDefinitionMap = {
  [id: string]: CompiledServiceDefinition;
};

export type GetService<M extends CompiledServiceDefinitionMap, K extends keyof M>
  = M[K] extends { factory: (...args: any[]) => infer S } ? S : never;
