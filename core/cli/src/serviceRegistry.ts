import { Type } from 'ts-morph';
import { ServiceDecoratorInfo, ServiceDefinitionInfo, ServiceRegistrationInfo } from './types';

export class ServiceRegistry {
  private readonly definitions: Map<string, ServiceDefinitionInfo> = new Map();
  private readonly types: Map<Type, string> = new Map();
  private readonly aliases: Map<string, Set<string>> = new Map();
  private readonly ids: Set<string> = new Set();
  private readonly decorators: Map<string, ServiceDecoratorInfo[]> = new Map();

  register({ id, type, ...registration }: ServiceRegistrationInfo): void {
    const typeId = this.registerType(type);
    id ??= typeId;
    const definition = { id, type, ...registration, decorators: [] };
    this.definitions.set(id, definition);
    this.registerAlias(id, id);
    this.registerAlias(id, typeId);

    for (const alias of definition.aliases) {
      this.registerAlias(id, this.registerType(alias));
    }
  }

  decorate(decorator: ServiceDecoratorInfo): void {
    const typeId = this.registerType(decorator.type);
    this.decorators.has(typeId) || this.decorators.set(typeId, []);
    this.decorators.get(typeId)!.push(decorator);
  }

  applyDecorators(): void {
    for (const [id, decorators] of this.decorators) {
      const definitions = [...this.aliases.get(id) ?? []].map((id) => this.get(id));

      for (const definition of definitions) {
        definition.decorators.push(...decorators);
      }
    }
  }

  has(id: string): boolean {
    return this.definitions.has(id);
  }

  get(id: string): ServiceDefinitionInfo {
    return this.definitions.get(id)!;
  }

  getDefinitions(): Iterable<ServiceDefinitionInfo> {
    return this.definitions.values();
  }

  getTypeId(type: Type): string | undefined {
    return this.types.get(type);
  }

  getIdsByType(type: Type): string[] {
    const alias = this.types.get(type);

    if (alias === undefined) {
      return [];
    }

    return [...this.aliases.get(alias) ?? []];
  }

  getByType(type: Type): ServiceDefinitionInfo[] {
    return this.getIdsByType(type).map((id) => this.definitions.get(id)!);
  }

  private registerType(type: Type): string {
    const existing = this.types.get(type);

    if (existing !== undefined) {
      return existing;
    }

    const name = type.getSymbol()?.getName() ?? 'Anonymous';

    for (let idx = 0; true; ++idx) {
      const id = `#${name}.${idx}`;

      if (!this.ids.has(id)) {
        this.types.set(type, id);
        this.ids.add(id);
        return id;
      }
    }
  }

  private registerAlias(id: string, alias: string): void {
    const ids = this.aliases.get(alias) ?? new Set();
    this.aliases.set(alias, ids);
    ids.add(id);
  }
}
