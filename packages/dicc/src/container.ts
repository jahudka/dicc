import { AsyncLocalStorage } from 'async_hooks';
import { Store } from './store';
import {
  CompiledAsyncServiceDefinition,
  CompiledServiceDefinition,
  CompiledServiceDefinitionMap,
  CompiledServiceForkHook,
  CompiledSyncServiceDefinition,
  GetService,
  ServiceScope,
} from './types';


export class Container<M extends CompiledServiceDefinitionMap = {}> {
  private readonly definitions: Map<string, CompiledServiceDefinition>;
  private readonly aliases: Map<string, string[]>;
  private readonly globalServices: Store = new Store();
  private readonly localServices: AsyncLocalStorage<Store> = new AsyncLocalStorage();
  private readonly forkHooks: Map<string, CompiledServiceForkHook<any>> = new Map();
  private readonly creating: Set<string> = new Set();

  constructor(definitions: M) {
    this.definitions = new Map(Object.entries(definitions));
    this.aliases = new Map();

    for (const [id, { aliases, onFork }] of this.definitions) {
      this.aliases.set(id, [id]);
      onFork && this.forkHooks.set(id, onFork);

      for (const alias of aliases) {
        this.aliases.has(alias) || this.aliases.set(alias, []);
        this.aliases.get(alias)!.push(id);
      }
    }
  }

  get<K extends keyof M>(id: K): GetService<M, K>;
  get<T>(id: string): T;
  get<T>(id: string): T {
    return this.getOrCreate(this.resolve(id));
  }

  find<T>(alias: string): T[] {
    return this.resolve(alias, false).map((id) => this.getOrCreate(id));
  }

  createAccessor<K extends keyof M>(id: K): () => GetService<M, K>;
  createAccessor<T>(id: string): () => T;
  createAccessor<T>(id: string): () => T {
    return () => this.get(id) as T;
  }

  createListAccessor<T>(id: string): () => T[] {
    return () => this.find(id);
  }

  * createIterator<T>(id: string): Iterable<T> {
    for (const i of this.resolve(id, false)) {
      yield this.get(i) as T;
    }
  }

  async * createAsyncIterator<T>(id: string): AsyncIterable<T> {
    for (const i of this.resolve(id, false)) {
      yield await this.get(i) as T;
    }
  }

  register<K extends keyof M>(id: K, service: GetService<M, K>): Promise<void> | void;
  register<T>(id: string, service: T): Promise<void> | void;
  register<T>(id: string, service: T): Promise<void> | void {
    const definition = this.definitions.get(id);

    if (!definition) {
      throw new Error(`Unknown service '${id}'`);
    } else if (definition.factory !== null) {
      throw new Error(`Static service '${id}' cannot be registered dynamically`);
    }

    const store = this.getStore(definition.scope);

    if (!store) {
      throw new Error(`Cannot register private service '${id}'`);
    } else if (store.hasOwn(id)) {
      throw new Error(`Service '${id}' already exists in the ${definition.scope} scope`);
    }

    store.set(id, service);
    return definition.onCreate && definition.onCreate(service, this);
  }

  async fork<R>(cb: () => Promise<R>): Promise<R> {
    const parent = this.currentStore;
    const store = new Store(parent);

    for (const [id, hook] of this.forkHooks) {
      if (parent.has(id)) {
        const fork = await hook(parent.get(id), this);
        fork && store.set(id, fork);
      }
    }

    try {
      return await this.localServices.run(store, cb);
    } finally {
      for (const [id, service] of store) {
        const definition = this.definitions.get(id);
        definition?.onDestroy && await definition.onDestroy(service, this);
        store.delete(id);
      }
    }
  }

  private resolve(alias: string, single?: true): string;
  private resolve(alias: string, single: false): string[];
  private resolve(alias: string, single: boolean = true): string[] | string {
    const ids = this.aliases.get(alias);

    if (!ids) {
      throw new Error(`Unknown service: '${alias}'`);
    } else if (single && ids.length > 1) {
      throw new Error(`Multiple services matching '${alias}' found`);
    }

    return single ? ids[0] : ids;
  }

  private getOrCreate(id: string): any {
    return this.currentStore.get(id) ?? this.create(id);
  }

  private create(id: string): any {
    const definition = this.definitions.get(id);

    if (!definition) {
      throw new Error(`Unknown service '${id}'`);
    } else if (!definition.factory) {
      throw new Error(`Dynamic service '${id}' has not been registered`);
    } else if (definition.scope === 'local' && !this.localServices.getStore()) {
      throw new Error(`Cannot create local service '${id}' in global scope`);
    } else if (definition.scope !== 'private') {
      if (this.creating.has(id)) {
        throw new Error(`Service '${id}' is already being created, is there perhaps a cyclic dependency?`);
      }

      this.creating.add(id);
    }

    return definition.async
      ? this.createInstanceAsync(id, definition)
      : this.createInstanceSync(id, definition);
  }

  private createInstanceSync<T>(id: string, definition: CompiledSyncServiceDefinition<T>): T {
    const service = definition.factory(this);
    this.getStore(definition.scope)?.set(id, service);
    definition.onCreate && definition.onCreate(service, this);
    this.creating.delete(id);
    return service;
  }

  private createInstanceAsync<T>(id: string, definition: CompiledAsyncServiceDefinition<T>): Promise<T> {
    const servicePromise = Promise.resolve()       // needed so that definition.factory()
      .then(async () => definition.factory(this))  // is never called synchronously
      .then(async (service) => {
        definition.onCreate && await definition.onCreate(service, this);
        this.creating.delete(id);
        return service;
      });

    this.getStore(definition.scope)?.set(id, servicePromise);
    return servicePromise;
  }

  private get currentStore(): Store {
    return this.localServices.getStore() ?? this.globalServices;
  }

  private getStore(scope: ServiceScope = 'global'): Store | undefined {
    if (scope === 'global') {
      return this.globalServices;
    } else if (scope === 'local') {
      const store = this.localServices.getStore();

      if (!store) {
        throw new Error('Cannot access local store in global context');
      }

      return store;
    } else {
      return undefined;
    }
  }
}
