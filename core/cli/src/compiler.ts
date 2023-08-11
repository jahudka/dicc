import { ServiceScope } from 'dicc';
import { CodeBlockWriter, SourceFile, Type } from 'ts-morph';
import { Autowiring } from './autowiring';
import { ServiceRegistry } from './serviceRegistry';
import { SourceFiles } from './sourceFiles';
import {
  DiccConfig,
  ParameterInfo,
  ServiceDecoratorInfo,
  ServiceDefinitionInfo,
  ServiceHookInfo,
  TypeFlag,
} from './types';

export class Compiler {
  private readonly registry: ServiceRegistry;
  private readonly autowiring: Autowiring;
  private readonly output: SourceFile;
  private readonly config: DiccConfig;

  constructor(
    registry: ServiceRegistry,
    autowiring: Autowiring,
    sourceFiles: SourceFiles,
    config: DiccConfig,
  ) {
    this.registry = registry;
    this.autowiring = autowiring;
    this.output = sourceFiles.getOutput();
    this.config = config;
  }

  compile(): void {
    const definitions = [...this.registry.getDefinitions()].sort((a, b) => compareIDs(a.id, b.id));
    const sources = extractSources(definitions);

    this.output.replaceWithText('');

    this.writeHeader(sources);
    this.writeMap(definitions, sources);
    this.writeDefinitions(definitions, sources);

    if (this.config.preamble !== undefined) {
      this.output.insertText(0, this.config.preamble.replace(/\s*$/, '\n\n'));
    }
  }

  private writeHeader(sources: Map<SourceFile, string>): void {
    this.output.addImportDeclaration({
      moduleSpecifier: 'dicc',
      namedImports: [
        { name: 'Container' },
        { name: 'ServiceType' },
      ],
    });

    for (const [source, name] of sources) {
      this.output.addImportDeclaration({
        moduleSpecifier: this.output.getRelativePathAsModuleSpecifierTo(source),
        namespaceImport: name,
      });
    }
  }

  private writeMap(definitions: ServiceDefinitionInfo[], sources: Map<SourceFile, string>): void {
    this.output.addStatements((writer) => {
      writer.writeLine(`\nexport interface ${this.config.map} {`);

      const aliasMap: Map<string, Set<string>> = new Map();

      writer.indent(() => {
        for (const { source, id, path, type, aliases, factory, async, explicit } of definitions) {
          const method = !explicit && factory?.method !== 'constructor' && factory?.method;
          const fullPath = join('.', sources.get(source), path, method);
          const serviceType = !explicit && !method && !path.includes('.')
            ? fullPath
            : `ServiceType<typeof ${fullPath}>`;
          const fullType = async ? `Promise<${serviceType}>` : serviceType;
          !/^#/.test(id) && writer.writeLine(`'${id}': ${fullType};`);

          for (const typeAlias of [type, ...aliases]) {
            const alias = this.registry.getTypeId(typeAlias);

            if (alias !== undefined) {
              aliasMap.has(alias) || aliasMap.set(alias, new Set());
              aliasMap.get(alias)!.add(fullType);
            }
          }
        }

        for (const [alias, ids] of [...aliasMap].sort((a, b) => compareIDs(a[0], b[0]))) {
          if (ids.size > 1) {
            writer.writeLine(`'${alias}':`);
            writer.indent(() => {
              let n = ids.size;

              for (const id of ids) {
                writer.writeLine(`| ${id}${--n ? '' : ';'}`);
              }
            });
          } else {
            writer.writeLine(`'${alias}': ${[...ids].join('')};`);
          }
        }
      });

      writer.writeLine('}');
    });
  }

  private writeDefinitions(
    definitions: ServiceDefinitionInfo[],
    sources: Map<SourceFile, string>,
  ): void {
    this.output.addStatements((writer) => {
      writer.writeLine(`\nexport const ${this.config.name} = new Container<${this.config.map}>({`);

      writer.indent(() => {
        for (const definition of definitions) {
          this.compileDefinition(definition, sources, writer);
        }
      });

      writer.writeLine('});\n');
    });
  }

  private compileDefinition(
    { source, id, path, type, factory, scope = 'global', tags, async, object, hooks, aliases, decorators }: ServiceDefinitionInfo,
    sources: Map<SourceFile, string>,
    writer: CodeBlockWriter,
  ): void {
    const decoratorMap = getDecoratorMap(decorators, sources);
    const src = sources.get(source)!;
    writer.writeLine(`'${id}': {`);

    writer.indent(() => {
      object && writer.writeLine(`...${src}.${path},`);

      const types = [!/^#/.test(id) ? type : undefined, ...aliases]
        .filter((v): v is Type => v !== undefined)
        .map((t) => `'${this.autowiring.getTypeId(t)}'`);

      writer.conditionalWriteLine(types.length > 0, `aliases: [${types.join(`, `)}],`);
      writer.conditionalWriteLine(async, `async: true,`);

      if (decoratorMap.scope && decoratorMap.scope !== scope) {
        writer.writeLine(`scope: '${decoratorMap.scope}',`);
      }

      if (decoratorMap.tags.length) {
        writer.writeLine(`tags: {`);
        writer.indent(() => {
          tags && writer.writeLine(`...${src}.${path}.tags,`);

          for (const decTags of decoratorMap.tags) {
            writer.writeLine(`...${decTags},`);
          }
        });
        writer.writeLine(`},`);
      }

      if (factory) {
        if (!object && factory.method !== 'constructor' && !factory.parameters.length && !decoratorMap.decorate.length) {
          writer.writeLine(`factory: ${join('.', src, path, factory.method)},`);
        } else if (!object || factory.method === 'constructor' || factory.parameters.length || decoratorMap.decorate.length) {
          this.compileFactory(
            src,
            path,
            factory.async,
            factory.method,
            object,
            factory.returnType.isNullable(),
            factory.parameters,
            decoratorMap.decorate,
            writer,
          );
        } // else definition is an object with a factory function with zero parameters and no decorators,
          // so it is already included in the compiled definition courtesy of object spread
      } else {
        writer.writeLine(`factory: undefined,`);
      }

      for (const hook of ['onCreate', 'onFork', 'onDestroy'] as const) {
        const info = hooks[hook];

        if (info?.parameters.length || decoratorMap[hook].length) {
          this.compileHook(src, path, hook, info, decoratorMap[hook], writer);
        }
      }
    });

    writer.writeLine('},');
  }

  private compileFactory(
    source: string,
    path: string,
    async: boolean | undefined,
    method: string | undefined,
    object: boolean | undefined,
    optional: boolean,
    parameters: ParameterInfo[],
    decorators: DecoratorInfo[],
    writer: CodeBlockWriter,
  ): void {
    const params = this.compileParameters(parameters);
    const decParams = decorators.map(([,, info]) => this.compileParameters(info.parameters));
    const inject = params.length > 0 || decParams.some((p) => p.length > 0);

    writer.write(`factory: `);
    writer.conditionalWrite(async, 'async ');
    writer.write(inject ? '(di) => ' : '() => ');

    const writeFactoryCall = () => {
      this.compileCall(
        join(
          ' ',
          method === 'constructor' && 'new',
          async && decorators.length && 'await',
          join('.', source, path, object && 'factory', method !== 'constructor' && method),
        ),
        params,
        writer,
      );
    };

    if (!decorators.length) {
      writeFactoryCall();
      writer.write(',\n');
      return;
    }

    writer.write(`{\n`);

    writer.indent(() => {
      writer.write(`${decorators.length > 1 ? 'let' : 'const'} service = `);
      writeFactoryCall();
      writer.write(';\n');

      if (optional) {
        writer.write('\nif (service === undefined) {');
        writer.indent(() => writer.writeLine('return undefined;'));
        writer.write('}\n');
      }

      for (const [i, [source, path, info]] of decorators.entries()) {
        const last = i + 1 >= decorators.length;
        writer.conditionalWrite(optional || (i > 0 ? decParams[i - 1] : params).length > 0 || decParams[i].length > 0, '\n');
        writer.write(last ? 'return ' : 'service = ');
        this.compileCall(join(' ', info.async && !last && 'await', join('.', source, path, 'decorate')), ['service', ...decParams[i]], writer);
        writer.write(';\n');
      }
    });

    writer.write('},\n');
  }

  private compileHook(
    source: string,
    path: string,
    hook: string,
    info: ServiceHookInfo | undefined,
    decorators: DecoratorInfo[],
    writer: CodeBlockWriter,
  ): void {
    const params = this.compileParameters(info?.parameters ?? []);
    const decParams = decorators.map(([,, info]) => this.compileParameters(info.parameters));
    const inject = params.length > 0 || decParams.some((p) => p.length > 0);
    const async = info?.async || decorators.some(([,, info]) => info.async);

    writer.write(`${hook}: `);
    writer.conditionalWrite(async, 'async ');
    writer.write(`(service`);
    writer.conditionalWrite(inject, ', di');
    writer.write(') => ');

    if (!decorators.length) {
      this.compileCall(join('.', source, path, hook), ['service', ...params], writer);
      writer.write(',\n');
      return;
    }

    writer.write('{\n');

    writer.indent(() => {
      let service = 'service';

      if (info) {
        if (hook === 'onFork') {
          writer.write('const fork = ');
          service = 'fork ?? service';
        }

        this.compileCall(join(' ', info?.async && 'await', join('.', source, path, hook)), ['service', ...params], writer);
        writer.write(';\n');
      }

      for (const [i, [source, path, info]] of decorators.entries()) {
        writer.conditionalWrite((i > 0 ? decParams[i - 1] : params).length > 0 || decParams[i].length > 0, '\n');
        this.compileCall(join(' ', info.async && 'await', join('.', source, path, hook)), [service, ...decParams[i]], writer);
        writer.write(';\n');
      }

      if (hook === 'onFork') {
        writer.conditionalWrite(decParams[decParams.length - 1].length > 0, '\n');
        writer.write(`return ${info ? 'fork' : 'undefined'};\n`);
      }
    });

    writer.write('},\n');
  }

  private compileCall(expression: string, params: string[], writer: CodeBlockWriter): void {
    writer.write(expression);
    writer.write('(');

    if (params.length > 1) {
      writer.indent(() => {
        for (const param of params) {
          writer.writeLine(`${param},`);
        }
      });
    } else if (params.length) {
      writer.write(params[0]);
    }

    writer.write(')');
  }

  private compileParameters(parameters: ParameterInfo[]): string[] {
    const stmts: string[] = [];
    const undefs: string[] = [];

    for (const param of parameters) {
      const stmt = this.compileParameter(param);

      if (stmt === undefined) {
        undefs.push(`undefined`);
      } else {
        stmts.push(...undefs.splice(0, undefs.length), stmt);
      }
    }

    return stmts;
  }

  private compileParameter(param: ParameterInfo): string | undefined {
    if (param.flags & TypeFlag.Container) {
      return 'di';
    }

    const id = param.type && this.autowiring.getTypeId(param.type);

    if (!param.type || id === undefined) {
      return undefined;
    } else if (param.flags & TypeFlag.Injector) {
      return `(service) => di.register('${id}', service)`;
    }

    const paramWantsPromise = Boolean(param.flags & TypeFlag.Async);
    const paramWantsArray = Boolean(param.flags & TypeFlag.Array);
    const paramWantsAccessor = Boolean(param.flags & TypeFlag.Accessor);
    const paramWantsIterable = Boolean(param.flags & TypeFlag.Iterable);
    const paramIsOptional = Boolean(param.flags & TypeFlag.Optional);
    const valueIsAsync = this.autowiring.isAsync(param.type);
    let method: string = paramWantsArray ? 'find' : 'get';
    let prefix: string = '';
    let arg: string = '';
    let postfix: string = '';

    if (!paramWantsArray && !paramWantsIterable && paramIsOptional) {
      arg = ', false';
    }

    if (paramWantsAccessor) {
      prefix = `${paramWantsPromise ? 'async ' : ''}() => `;
    } else if (paramWantsIterable) {
      method = 'iterate';
    } else if (!paramWantsPromise && valueIsAsync) {
      prefix = 'await ';
    } else if (paramWantsPromise && !valueIsAsync && !paramWantsArray) {
      prefix = 'Promise.resolve().then(() => ';
      postfix = ')';
    }

    return `${prefix}di.${method}('${id}'${arg})${postfix}`;
  }
}

type DecoratorInfo = [source: string, path: string, info: ServiceHookInfo];

type DecoratorMap = {
  scope?: ServiceScope;
  tags: string[];
  decorate: DecoratorInfo[];
  onCreate: DecoratorInfo[];
  onFork: DecoratorInfo[];
  onDestroy: DecoratorInfo[];
};

function getDecoratorMap(decorators: ServiceDecoratorInfo[], sources: Map<SourceFile, string>): DecoratorMap {
  const map: DecoratorMap = {
    tags: [],
    decorate: [],
    onCreate: [],
    onFork: [],
    onDestroy: [],
  };

  for (const decorator of decorators) {
    const source = sources.get(decorator.source)!;
    decorator.scope && (map.scope = decorator.scope);
    decorator.tags && map.tags.push(join('.', source, decorator.path, 'tags'));
    decorator.decorate && map.decorate.push([source, decorator.path, decorator.decorate]);
    decorator.hooks.onCreate && map.onCreate.push([source, decorator.path, decorator.hooks.onCreate]);
    decorator.hooks.onFork && map.onFork.push([source, decorator.path, decorator.hooks.onFork]);
    decorator.hooks.onDestroy && map.onDestroy.push([source, decorator.path, decorator.hooks.onDestroy]);
  }

  return map;
}

function compareIDs(a: string, b: string): number {
  return (a.indexOf('#') - b.indexOf('#')) || (a < b ? -1 : 1);
}

function extractSources(definitions: ServiceDefinitionInfo[]): Map<SourceFile, string> {
  return new Map([
    ...new Set(definitions.flatMap((d) => [d.source, ...d.decorators.map((o) => o.source)])),
  ].map((s, i) => [s, `defs${i}`]));
}

function join(separator: string, ...tokens: (string | 0 | false | undefined)[]): string {
  return tokens.filter((t) => typeof t === 'string').join(separator);
}
