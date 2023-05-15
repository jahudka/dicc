import { Type } from 'ts-morph';
import { ServiceRegistry } from './serviceRegistry';
import { ServiceDefinitionInfo, TypeFlag } from './types';

export class Autowiring {
  private readonly registry: ServiceRegistry;
  private readonly visited: Set<ServiceDefinitionInfo> = new Set();

  constructor(registry: ServiceRegistry) {
    this.registry = registry;
  }

  checkDependencies(): void {
    for (const definition of this.registry.getDefinitions()) {
      this.checkServiceDependencies(definition);
    }
  }

  getTypeId(type: Type): string | undefined {
    return this.registry.getTypeId(type);
  }

  isAsync(type: Type): boolean {
    return this.registry.getByType(type).some((def) => def.factory?.async);
  }

  private checkServiceDependencies(definition: ServiceDefinitionInfo): void {
    if (this.visited.has(definition)) {
      return;
    }

    this.visited.add(definition);

    if (!definition.factory) {
      return;
    }

    for (const parameter of definition.factory.parameters) {
      const candidates = parameter.type && this.registry.getByType(parameter.type);

      if (!candidates || !candidates.length) {
        if (parameter.flags & TypeFlag.Optional) {
          continue;
        }

        throw new Error(`Unable to autowire non-optional parameter '${parameter.name}' of service '${definition.id}'`);
      } else if (candidates.length > 1 && !(parameter.flags & (TypeFlag.Array | TypeFlag.Iterable))) {
        throw new Error(`Multiple services for parameter '${parameter.name}' of service '${definition.id}' found`);
      }

      for (const candidate of candidates) {
        this.checkServiceDependencies(candidate);

        if (candidate.factory?.async && !(parameter.flags & TypeFlag.Async)) {
          if (parameter.flags & (TypeFlag.Accessor | TypeFlag.Iterable)) {
            throw new Error(`Cannot inject async service '${candidate.id}' into synchronous accessor or iterable parameter '${parameter.name}' of service '${definition.id}'`);
          }

          definition.factory.async = true;
        }
      }
    }
  }
}
