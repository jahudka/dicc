import { Type } from 'ts-morph';
import { ServiceRegistry } from './serviceRegistry';
import { ServiceDefinitionInfo, TypeFlag } from './types';

export class Autowiring {
  private readonly registry: ServiceRegistry;
  private readonly visited: Set<ServiceDefinitionInfo> = new Set();
  private readonly resolving: string[] = [];

  constructor(registry: ServiceRegistry) {
    this.registry = registry;
  }

  checkDependencies(): void {
    for (const definition of this.registry.getDefinitions()) {
      this.checkServiceDependencies(definition);
    }

    // needs to run after all dependencies have been fully resolved
    for (const definition of this.registry.getDefinitions()) {
      this.checkCyclicDependencies(definition);
    }
  }

  getTypeId(type: Type): string | undefined {
    return this.registry.getTypeId(type);
  }

  isAsync(type: Type): boolean {
    return this.registry.getByType(type).some((def) => def.factory?.async);
  }

  private checkServiceDependencies(definition: ServiceDefinitionInfo): void {
    if (!this.visit(definition) || !definition.factory) {
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

  private checkCyclicDependencies(definition: ServiceDefinitionInfo): void {
    if (!definition.factory) {
      return;
    }

    this.checkCyclicDependency(definition.id);

    for (const param of definition.factory.parameters) {
      if (param.flags & (TypeFlag.Async | TypeFlag.Accessor | TypeFlag.Iterable)) {
        continue;
      }

      const candidates = param.type && this.registry.getByType(param.type);

      for (const candidate of candidates ?? []) {
        this.checkCyclicDependencies(candidate);
      }
    }

    this.releaseCyclicDependencyCheck(definition.id);
  }

  private checkCyclicDependency(id: string): void {
    const idx = this.resolving.indexOf(id);

    if (idx > -1) {
      throw new Error(`Cyclic dependency detected: ${this.resolving.join(' → ')} → ${id}`);
    }

    this.resolving.push(id);
  }

  private releaseCyclicDependencyCheck(id: string): void {
    const last = this.resolving.pop();

    if (last !== id) {
      throw new Error(`Dependency chain checker broken`);
    }
  }

  private visit(definition: ServiceDefinitionInfo): boolean {
    if (this.visited.has(definition)) {
      return false;
    }

    this.visited.add(definition);
    return true;
  }
}
