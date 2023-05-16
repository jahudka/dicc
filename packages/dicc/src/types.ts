import { Container } from './container';

export type Constructor<T = any> = { new (...args: any[]): T };
export type Factory<T = any> = { (...args: any[]): T };

export type Intersect<Types> = Types extends [...any]
  ? Types extends [infer I, ...infer R] ? I & Intersect<R> : {}
  : Types;

export type ServiceScope = 'global' | 'local' | 'private';
export type ServiceHook<T> = (service: T, container: Container) => void;
export type ServiceForkHook<T> = (service: T, container: Container) => T | undefined;

export type ServiceDefinitionOptions<T = any> = {
  scope?: ServiceScope;
  onCreate?: ServiceHook<T>;
  onFork?: ServiceForkHook<T>;
  onDestroy?: ServiceHook<T>;
};

export type ServiceType<F extends Constructor | Factory> =
  F extends Constructor<infer T> ? T
    : F extends Factory<infer T> ? T
    : never;

export type DynamicServiceDefinition<T> = ServiceDefinitionOptions<T> & {
  factory: null;
};

export type StaticServiceDefinition<F extends Constructor | Factory>
  = ServiceDefinitionOptions<ServiceType<F>> & { factory: F };

export type AnyServiceDefinition<T = any> = ServiceDefinitionOptions<T> & {
  factory: any;
};

export type ServiceTypes<T extends Intersect<A>, A> = AnyServiceDefinition<T>;

export type CompiledServiceDefinitionOptions<T = any> = ServiceDefinitionOptions<T> & {
  aliases: string[];
};

export type CompiledFactory<T> = (container: Container) => T;

export type CompiledAsyncServiceDefinition<T = any> = CompiledServiceDefinitionOptions<T> & {
  factory: CompiledFactory<Promise<T>>;
  async: true;
};

export type CompiledSyncServiceDefinition<T = any> = CompiledServiceDefinitionOptions<T> & {
  factory: CompiledFactory<T> | null;
  async?: false;
};

export type CompiledServiceDefinition<T = any> =
  | CompiledAsyncServiceDefinition<T>
  | CompiledSyncServiceDefinition<T>;

export type CompiledServiceDefinitionMap = {
  [id: string]: CompiledServiceDefinition;
};

export type GetService<M extends CompiledServiceDefinitionMap, K extends keyof M>
  = M[K] extends { factory: (...args: any[]) => infer S } ? S : never;
