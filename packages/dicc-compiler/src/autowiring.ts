import { ServiceScope } from 'dicc';
import { Type } from 'ts-morph';
import { ServiceRegistry } from './serviceRegistry';
import { ParameterInfo, ServiceDefinitionInfo, TypeFlag } from './types';

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
    if (!this.visit(definition)) {
      return;
    }

    if (definition.factory) {
      for (const parameter of definition.factory.parameters) {
        if (this.checkParameter(parameter, `service '${definition.id}'`, definition.scope)) {
          definition.factory.async = true;
        }
      }
    }

    for (const hook of ['onCreate', 'onFork', 'onDestroy'] as const) {
      const info = definition.hooks[hook];

      if (!info) {
        continue;
      }

      for (const parameter of info.parameters) {
        if (this.checkParameter(parameter, `'${hook}' hook of service '${definition.id}'`, definition.scope)) {
          definition.factory && hook === 'onCreate' && (definition.factory.async = true);
          info.async = true;
        }
      }
    }
  }

  private checkParameter(
    parameter: ParameterInfo,
    target: string,
    scope: ServiceScope,
  ): boolean {
    const candidates = parameter.type && this.registry.getByType(parameter.type);

    if (!candidates || !candidates.length) {
      if (parameter.flags & TypeFlag.Optional) {
        return false;
      }

      throw new Error(`Unable to autowire non-optional parameter '${parameter.name}' of ${target}`);
    } else if (candidates.length > 1 && !(parameter.flags & (TypeFlag.Array | TypeFlag.Iterable))) {
      throw new Error(`Multiple services for parameter '${parameter.name}' of ${target} found`);
    }

    let async = false;

    for (const candidate of candidates) {
      this.checkServiceDependencies(candidate);

      if (scope === 'global' && candidate.scope === 'local' && !(parameter.flags & TypeFlag.Accessor)) {
        throw new Error(`Cannot inject locally-scoped service '${candidate.id}' into globally-scoped ${target}`);
      }

      if (candidate.factory?.async && !(parameter.flags & TypeFlag.Async)) {
        if (parameter.flags & (TypeFlag.Accessor | TypeFlag.Iterable)) {
          throw new Error(`Cannot inject async service '${candidate.id}' into synchronous accessor or iterable parameter '${parameter.name}' of ${target}`);
        }

        async = true;
      }
    }

    return async;
  }

  private checkCyclicDependencies(definition: ServiceDefinitionInfo): void {
    this.checkCyclicDependency(definition.id);

    for (const param of definition.factory?.parameters ?? []) {
      this.checkParameterDependencies(param);
    }

    for (const param of definition.hooks?.onCreate?.parameters ?? []) {
      this.checkParameterDependencies(param);
    }

    this.releaseCyclicDependencyCheck(definition.id);
  }

  private checkParameterDependencies(param: ParameterInfo): void {
    if (param.flags & (TypeFlag.Async | TypeFlag.Accessor | TypeFlag.Iterable)) {
      return;
    }

    const candidates = param.type && this.registry.getByType(param.type);

    for (const candidate of candidates ?? []) {
      this.checkCyclicDependencies(candidate);
    }
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
