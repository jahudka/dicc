import {
  Constructor,
  DynamicServiceDefinition,
  Factory,
  StaticServiceDefinition,
  ServiceDefinitionOptions,
  AnyServiceDefinition,
} from './types';

export function createDefinition<T>(
  factory: null,
  options?: ServiceDefinitionOptions<T>,
): DynamicServiceDefinition<T>
export function createDefinition<F extends Constructor<T> | Factory<T | Promise<T>>, T>(
  factory: F,
  options?: ServiceDefinitionOptions<T>,
): StaticServiceDefinition<F>;
export function createDefinition<T>(
  factory: Constructor<T> | Factory<T | Promise<T>> | null,
  options?: ServiceDefinitionOptions<T>,
): AnyServiceDefinition<T> {
  return { factory, ...options };
}
