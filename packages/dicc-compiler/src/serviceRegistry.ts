import { SourceFile, Type } from 'ts-morph';
import { ServiceDefinitionInfo } from './types';

export class ServiceRegistry {
  private readonly definitions: Map<string, ServiceDefinitionInfo> = new Map();
  private readonly sources: Set<SourceFile> = new Set();
  private readonly types: Map<Type, string> = new Map();
  private readonly aliases: Map<string, Set<string>> = new Map();
  private readonly ids: Set<string> = new Set();

  register(definition: ServiceDefinitionInfo): void {
    this.definitions.set(definition.id, definition);
    this.sources.add(definition.source);
    this.registerAlias(definition.id, definition.id);
    this.registerAlias(definition.id, this.registerType(definition.type));

    for (const alias of definition.aliases) {
      this.registerAlias(definition.id, this.registerType(alias));
    }
  }

  has(id: string): boolean {
    return this.definitions.has(id);
  }

  get(id: string): ServiceDefinitionInfo {
    return this.definitions.get(id)!;
  }

  getSources(): Iterable<SourceFile> {
    return this.sources;
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

    const name = type.getSymbol()?.getName() ?? '#Anonymous';

    for (let idx = 0; true; ++idx) {
      const id = `${name}.${idx}`;

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
