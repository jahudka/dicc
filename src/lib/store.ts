export class Store {
  private readonly services: Map<string, any> = new Map();
  private readonly parent?: Store;

  constructor(parent?: Store) {
    this.parent = parent;
  }

  hasOwn(id: string): boolean {
    return this.services.has(id);
  }

  has(id: string): boolean {
    return this.hasOwn(id) || (this.parent?.has(id) ?? false);
  }

  get(id: string): any {
    return this.services.get(id) ?? this.parent?.get(id);
  }

  set(id: string, service: any): void {
    this.services.set(id, service);
  }

  delete(id: string): void {
    this.services.delete(id);
  }

  [Symbol.iterator](): IterableIterator<[string, any]> {
    return this.services.entries();
  }
}
