import { CodeBlockWriter, SourceFile } from 'ts-morph';
import { Autowiring } from './autowiring';
import { ServiceDefinitionInfo, ParameterInfo, TypeFlag } from './types';

export class Compiler {
  private readonly autowiring: Autowiring;
  private importServiceType: () => void = () => {};

  constructor(autowiring: Autowiring) {
    this.autowiring = autowiring;
  }

  compile(
    definitions: Iterable<ServiceDefinitionInfo>,
    input: SourceFile,
    output: SourceFile,
    exportName: string,
  ): void {
    output.replaceWithText('');

    this.writeHeader(input, output);

    output.addStatements((writer) => {
      writer.writeLine(`\nexport const ${exportName} = new Container({`);

      writer.indent(() => {
        for (const definition of [...definitions].sort((a, b) => a.id < b.id ? -1 : 1)) {
          this.compileDefinition(definition, writer);
        }
      });

      writer.writeLine('});\n');
    });
  }

  private writeHeader(input: SourceFile, output: SourceFile): void {
    const diccImport = output.addImportDeclaration({
      moduleSpecifier: 'dicc',
      namedImports: [
        { name: 'Container' },
      ],
    });

    output.addImportDeclaration({
      moduleSpecifier: output.getRelativePathAsModuleSpecifierTo(input),
      namespaceImport: 'defs',
    });

    this.importServiceType = () => {
      this.importServiceType = () => {};
      diccImport.addNamedImport({ name: 'ServiceType' });
    };
  }

  private compileDefinition(
    { id, type, factory, object, hooks, aliases }: ServiceDefinitionInfo,
    writer: CodeBlockWriter,
  ): void {
    writer.writeLine(`'${id}': {`);

    writer.indent(() => {
      object && writer.writeLine(`...defs.${id},`);

      const types = [type, ...aliases].map((t) => this.autowiring.getTypeId(t));
      writer.writeLine(`aliases: ['${types.join(`', '`)}'],`);

      if (factory) {
        writer.conditionalWriteLine(factory.async, `async: true,`);

        const params = this.compileParameters(factory.parameters);

        if (!object || factory.constructable || params.length) {
          this.compileFactory(id, factory.async, factory.constructable, object, params, writer);
        }
      } else {
        writer.writeLine(`factory: null,`);
      }

      for (const hook of ['onCreate', 'onFork', 'onDestroy'] as const) {
        const info = hooks[hook];

        if (!info) {
          continue;
        }

        const hookParams = this.compileParameters(info.parameters);

        if (hookParams.length) {
          this.compileHook(id, hook, info.async, hookParams, writer);
        }
      }
    });

    writer.writeLine('},');
  }

  private compileFactory(
    id: string,
    async: boolean | undefined,
    constructable: boolean | undefined,
    object: boolean | undefined,
    params: string[],
    writer: CodeBlockWriter,
  ): void {
    writer.write(`factory: `);
    writer.conditionalWrite(async, 'async ');
    writer.write(params.length ? '(di: Container) => ' : '() => ');
    writer.conditionalWrite(constructable, 'new ');
    writer.write(`defs.${id}${object ? '.factory' : ''}(`);

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
    id: string,
    hook: string,
    async: boolean | undefined,
    params: string[],
    writer: CodeBlockWriter,
  ): void {
    writer.write(`${hook}: `);
    writer.conditionalWrite(async, 'async ');
    writer.write(`(service: ServiceType<typeof defs.${id}>`);
    writer.write(params.length ? ', di: Container) => ' : ') => ');
    writer.write(`defs.${id}.${hook}(`);

    writer.indent(() => {
      writer.writeLine('service,');

      for (const param of params) {
        writer.writeLine(param);
      }
    });

    writer.write('),\n');

    this.importServiceType();
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
