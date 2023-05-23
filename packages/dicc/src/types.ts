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

export type CompiledServiceHook<T, Services extends Record<string, any> = {}> = {
  (service: T, container: Container<Services>): void;
};

export type CompiledAsyncServiceHook<T, Services extends Record<string, any> = {}> = {
  (service: T, container: Container<Services>): Promise<void> | void;
};

export type CompiledServiceForkHook<T, Services extends Record<string, any> = {}> = {
  (service: T, container: Container<Services>): Promise<T | undefined> | T | undefined;
};

export type CompiledServiceDefinitionOptions<T = any, Services extends Record<string, any> = {}> = {
  aliases: string[];
  scope?: ServiceScope;
  onFork?: CompiledServiceForkHook<T, Services>;
  onDestroy?: CompiledAsyncServiceHook<T, Services>;
};

export type CompiledFactory<T, Services extends Record<string, any> = {}> = {
  (container: Container<Services>): T;
};

export type CompiledAsyncServiceDefinition<T = any, Services extends Record<string, any> = {}>
  = CompiledServiceDefinitionOptions<T, Services> & {
    factory: CompiledFactory<Promise<T>, Services>;
    async: true;
    onCreate?: CompiledAsyncServiceHook<T, Services>;
  };

export type CompiledSyncServiceDefinition<T = any, Services extends Record<string, any> = {}>
  = CompiledServiceDefinitionOptions<T, Services> & {
    factory: CompiledFactory<T, Services>;
    async?: false;
    onCreate?: CompiledServiceHook<T, Services>;
  };

export type CompiledDynamicServiceDefinition<T = any, Services extends Record<string, any> = {}>
  = CompiledServiceDefinitionOptions<T, Services> & {
    factory: null;
    async?: false;
    onCreate?: CompiledAsyncServiceHook<T, Services>;
  };

export type CompiledServiceDefinition<T = any, Services extends Record<string, any> = {}> =
  | CompiledAsyncServiceDefinition<T, Services>
  | CompiledSyncServiceDefinition<T, Services>
  | CompiledDynamicServiceDefinition<T, Services>;

export type CompiledServiceDefinitionMap<Services extends Record<string, any> = {}> = {
  [Id in keyof Services]: CompiledServiceDefinition<Services[Id]>;
};
