import { CodeBlockWriter, SourceFile } from 'ts-morph';
import { Autowiring } from './autowiring';
import { TypeHelper } from './typeHelper';
import { ServiceDefinitionInfo, ServiceFactoryParameter, TypeFlag } from './types';

export class Compiler {
  private readonly autowiring: Autowiring;
  private readonly helper: TypeHelper;

  constructor(autowiring: Autowiring, helper: TypeHelper) {
    this.autowiring = autowiring;
    this.helper = helper;
  }

  compile(definitions: Iterable<ServiceDefinitionInfo>, input: SourceFile, output: SourceFile): void {
    this.writeHeader(input, output);

    output.addStatements((writer) => {
      writer.writeLine('export const container = new Container({');

      writer.indent(() => {
        for (const definition of [...definitions].sort((a, b) => a.id < b.id ? -1 : 1)) {
          this.compileDefinition(definition, writer);
        }
      });

      writer.writeLine('});\n');
    });
  }

  private writeHeader(input: SourceFile, output: SourceFile): void {
    output.addImportDeclaration({
      moduleSpecifier: this.helper.getDiccImportSpecifier(output),
      namedImports: [{ name: 'Container' }],
    });

    output.addImportDeclaration({
      moduleSpecifier: output.getRelativePathAsModuleSpecifierTo(input),
      namespaceImport: 'defs',
    });
  }

  private compileDefinition({ id, type, factory, aliases }: ServiceDefinitionInfo, writer: CodeBlockWriter): void {
    writer.writeLine(`'${id}': {`);

    writer.indent(() => {
      writer.writeLine(`...defs.${id},`);

      const types = [type, ...aliases].map((t) => this.autowiring.getTypeId(t));
      writer.writeLine(`aliases: ['${types.join(`', '`)}'],`);

      if (!factory) {
        return;
      }

      const params = this.compileParameters(factory.parameters);

      writer.write(`factory: `);
      writer.conditionalWrite(factory.async, 'async ');
      writer.write(params.length ? '(di: Container) => ' : '() => ');
      writer.conditionalWrite(factory.constructable, 'new ');
      writer.write(`defs.${id}.factory(`);

      if (params.length) {
        writer.indent(() => {
          for (const param of params) {
            writer.writeLine(param);
          }
        });
      }

      writer.write('),\n');
    });

    writer.writeLine('},');
  }

  private compileParameters(parameters: ServiceFactoryParameter[]): string[] {
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

  private compileParameter(param: ServiceFactoryParameter): string | undefined {
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
      if (!(param.flags & TypeFlag.Async) && this.autowiring.isAsync(param.type)) {
        if (param.flags & TypeFlag.Array) {
          prefix = 'await Promise.all(';
          postfix = ')';
        } else {
          prefix = 'await ';
        }
      }

      method = param.flags & TypeFlag.Array ? 'find' : 'get';
    }

    return `${prefix}di.${method}('${id}')${postfix},`;
  }
}
