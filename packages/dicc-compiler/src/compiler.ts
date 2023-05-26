import { CodeBlockWriter, SourceFile } from 'ts-morph';
import { Autowiring } from './autowiring';
import { ServiceRegistry } from './serviceRegistry';
import { SourceFiles } from './sourceFiles';
import { DiccOptions, ParameterInfo, ServiceDefinitionInfo, TypeFlag } from './types';

export class Compiler {
  private readonly registry: ServiceRegistry;
  private readonly autowiring: Autowiring;
  private readonly output: SourceFile;
  private readonly options: DiccOptions;

  constructor(
    registry: ServiceRegistry,
    autowiring: Autowiring,
    sourceFiles: SourceFiles,
    options: DiccOptions,
  ) {
    this.registry = registry;
    this.autowiring = autowiring;
    this.output = sourceFiles.getOutput();
    this.options = options;
  }

  compile(): void {
    const definitions = [...this.registry.getDefinitions()].sort((a, b) => a.id < b.id ? -1 : 1);
    const sources = new Map([...this.registry.getSources()].map((s, i) => [s, `defs${i}`]));

    this.output.replaceWithText('');

    this.writeHeader(sources);
    this.writeMap(definitions, sources);
    this.writeDefinitions(definitions, sources);
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
      writer.writeLine(`\nexport interface ${this.options.map} {`);

      const aliasMap: Map<string, string[]> = new Map();

      writer.indent(() => {
        for (const { source, id, type, aliases, factory } of definitions) {
          const serviceType = `ServiceType<typeof ${sources.get(source)}.${id}>`;
          const fullType = factory?.async ? `Promise<${serviceType}>` : serviceType;
          writer.writeLine(`'${id}': ${fullType};`);

          for (const typeAlias of [type, ...aliases]) {
            const alias = this.registry.getTypeId(typeAlias);

            if (alias !== undefined) {
              aliasMap.has(alias) || aliasMap.set(alias, []);
              aliasMap.get(alias)!.push(fullType);
            }
          }
        }

        for (const [alias, ids] of aliasMap) {
          if (ids.length > 1) {
            writer.writeLine(`'${alias}':`);
            writer.indent(() => {
              for (const id of ids) {
                writer.writeLine(`| ${id}`);
              }
            });
          } else {
            writer.writeLine(`'${alias}': ${ids.join('')}`);
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
      writer.writeLine(`\nexport const ${this.options.export} = new Container<${this.options.map}>({`);

      writer.indent(() => {
        for (const definition of definitions) {
          this.compileDefinition(sources.get(definition.source)!, definition, writer);
        }
      });

      writer.writeLine('});\n');
    });
  }

  private compileDefinition(
    source: string,
    { id, type, factory, object, hooks, aliases }: ServiceDefinitionInfo,
    writer: CodeBlockWriter,
  ): void {
    writer.writeLine(`'${id}': {`);

    writer.indent(() => {
      object && writer.writeLine(`...${source}.${id},`);

      const types = [type, ...aliases].map((t) => this.autowiring.getTypeId(t));
      writer.writeLine(`aliases: ['${types.join(`', '`)}'],`);

      if (factory) {
        writer.conditionalWriteLine(factory.async, `async: true,`);

        if (!object && !factory.constructable && !factory.parameters.length) {
          writer.writeLine(`factory: ${source}.${id},`);
        } else if (!object || factory.constructable || factory.parameters.length) {
          const params = this.compileParameters(factory.parameters);
          this.compileFactory(source, id, factory.async, factory.constructable, object, params, writer);
        }
      } else {
        writer.writeLine(`factory: undefined,`);
      }

      for (const hook of ['onCreate', 'onFork', 'onDestroy'] as const) {
        const info = hooks[hook];

        if (info && info.parameters.length) {
          const hookParams = this.compileParameters(info.parameters);
          this.compileHook(source, id, hook, info.async, hookParams, writer);
        }
      }
    });

    writer.writeLine('},');
  }

  private compileFactory(
    source: string,
    id: string,
    async: boolean | undefined,
    constructable: boolean | undefined,
    object: boolean | undefined,
    params: string[],
    writer: CodeBlockWriter,
  ): void {
    writer.write(`factory: `);
    writer.conditionalWrite(async, 'async ');
    writer.write(params.length ? '(di) => ' : '() => ');
    writer.conditionalWrite(constructable, 'new ');
    writer.write(`${source}.${id}${object ? '.factory' : ''}(`);

    if (params.length) {
      writer.indent(() => {
        for (const param of params) {
          writer.writeLine(param);
        }
      });
    }

    writer.write('),\n');
  }

  private compileHook(
    source: string,
    id: string,
    hook: string,
    async: boolean | undefined,
    params: string[],
    writer: CodeBlockWriter,
  ): void {
    writer.write(`${hook}: `);
    writer.conditionalWrite(async, 'async ');
    writer.write(`(service`);
    writer.conditionalWrite(params.length > 0, ', di');
    writer.write(') => ');
    writer.write(`${source}.${id}.${hook}(`);

    writer.indent(() => {
      writer.writeLine('service,');

      for (const param of params) {
        writer.writeLine(param);
      }
    });

    writer.write('),\n');
  }

  private compileParameters(parameters: ParameterInfo[]): string[] {
    const stmts: string[] = [];
    const undefs: string[] = [];

    for (const param of parameters) {
      const stmt = this.compileParameter(param);

      if (stmt === undefined) {
        undefs.push(`undefined,`);
      } else {
        stmts.push(...undefs.splice(0, undefs.length), stmt);
      }
    }

    return stmts;
  }

  private compileParameter(param: ParameterInfo): string | undefined {
    const id = param.type && this.autowiring.getTypeId(param.type);

    if (!param.type || id === undefined) {
      return undefined;
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
      prefix = '() => ';
    } else if (paramWantsIterable) {
      method = 'iterate';
    } else if (!paramWantsPromise && valueIsAsync) {
      prefix = 'await ';
    } else if (paramWantsPromise && !valueIsAsync && !paramWantsArray) {
      prefix = 'Promise.resolve().then(() => ';
      postfix = ')';
    }

    return `${prefix}di.${method}('${id}'${arg})${postfix},`;
  }
}
