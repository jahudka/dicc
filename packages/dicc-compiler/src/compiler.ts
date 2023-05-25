import { CodeBlockWriter, SourceFile } from 'ts-morph';
import { Autowiring } from './autowiring';
import { ServiceRegistry } from './serviceRegistry';
import { SourceFiles } from './sourceFiles';
import { ServiceDefinitionInfo, ParameterInfo, TypeFlag, DiccOptions } from './types';

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

      writer.indent(() => {
        for (const { id, source } of definitions) {
          writer.writeLine(`'${id}': ServiceType<typeof ${sources.get(source)}.${id}>;`);
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

    let method: string;
    let prefix: string = '';
    let postfix: string = '';

    if (param.flags & TypeFlag.Accessor) {
      method = param.flags & TypeFlag.Array ? 'createListAccessor' : 'createAccessor';
    } else if (param.flags & TypeFlag.Iterable) {
      method = param.flags & TypeFlag.Async ? 'createAsyncIterator' : 'createIterator';
    } else {
      const targetIsAsync = this.autowiring.isAsync(param.type);

      if (!(param.flags & TypeFlag.Async) && targetIsAsync) {
        if (param.flags & TypeFlag.Array) {
          prefix = 'await Promise.all(';
          postfix = ')';
        } else {
          prefix = 'await ';
        }
      } else if (param.flags & TypeFlag.Async && !targetIsAsync) {
        prefix = 'Promise.resolve().then(() => ';
        postfix = ')';
      }

      method = param.flags & TypeFlag.Array ? 'find' : 'get';
    }

    return `${prefix}di.${method}('${id}')${postfix},`;
  }
}
