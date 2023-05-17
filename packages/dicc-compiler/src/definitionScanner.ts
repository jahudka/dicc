import { ServiceScope } from 'dicc';
import {
  CallExpression,
  ExportedDeclarations,
  Expression,
  Identifier,
  ModuleDeclaration,
  Node,
  ObjectLiteralExpression,
  Signature,
  SourceFile,
  Symbol,
  SyntaxKind,
  Type,
  TypeNode,
} from 'ts-morph';
import { ServiceRegistry } from './serviceRegistry';
import { TypeHelper } from './typeHelper';
import { ServiceFactoryInfo, ServiceFactoryParameter, TypeFlag } from './types';

export class DefinitionScanner {
  private readonly registry: ServiceRegistry;
  private readonly helper: TypeHelper;

  constructor(registry: ServiceRegistry, helper: TypeHelper) {
    this.registry = registry;
    this.helper = helper;
  }

  scanDefinitions(input: SourceFile): void {
    for (const [id, expression] of this.scanNode(input)) {
      try {
        const [definition, aliases] = this.helper.extractDefinition(expression);

        if (definition) {
          this.analyseDefinition(id, definition, aliases);
        }
      } catch (e: any) {
        throw new Error(`Invalid definition '${id}': ${e.message}`);
      }
    }
  }

  scanUsages(): void {
    for (const method of ['get', 'find', 'createAccessor', 'createListAccessor', 'createIterator', 'createAsyncIterator']) {
      for (const call of this.helper.getContainerMethodCalls(method)) {
        const [id] = call.getArguments();

        if (Node.isStringLiteral(id) && !this.registry.has(id.getLiteralValue())) {
          const sf = id.getSourceFile();
          const ln = id.getStartLineNumber();
          console.log(`Warning: unknown service '${id.getLiteralValue()}' in call to Container.${method}() in ${sf.getFilePath()} on line ${ln}`);
        }
      }
    }

    const registrations: Set<string> = new Set();

    for (const call of this.helper.getContainerMethodCalls('register')) {
      const [id] = call.getArguments();

      if (Node.isStringLiteral(id)) {
        registrations.add(id.getLiteralValue());
      }
    }

    for (const definition of this.registry.getDefinitions()) {
      if (!definition.factory && !registrations.has(definition.id)) {
        console.log(`Warning: no Container.register() call found for dynamic service '${definition.id}'`);
      }
    }
  }

  private * scanNode(node?: Node, path: string = ''): Iterable<[string, Expression]> {
    if (Node.isSourceFile(node)) {
      yield * this.scanModule(node, path);
    } else if (Node.isModuleDeclaration(node) && node.hasNamespaceKeyword()) {
      yield * this.scanModule(node, path);
    } else if (Node.isObjectLiteralExpression(node)) {
      yield * this.scanObject(node, path);
    } else if (Node.isVariableDeclaration(node)) {
      yield * this.scanNode(node.getInitializer(), path);
    } else if (Node.isIdentifier(node)) {
      yield * this.scanIdentifier(node, path);
    } else if (Node.isExpression(node)) {
      yield [path.replace(/\.$/, ''), node];
    }
  }

  private * scanModule(node: SourceFile | ModuleDeclaration, path: string = ''): Iterable<[string, Expression]> {
    for (const [name, declarations] of node.getExportedDeclarations()) {
      yield * this.scanExportedDeclarations(declarations, `${path}${name}.`);
    }
  }

  private * scanExportedDeclarations(declarations?: ExportedDeclarations[], path: string = ''): Iterable<[string, Expression]> {
    for (const declaration of declarations ?? []) {
      yield * this.scanNode(declaration, path);
    }
  }

  private * scanObject(node: ObjectLiteralExpression, path: string = ''): Iterable<[string, Expression]> {
    for (const prop of node.getProperties()) {
      if (Node.isSpreadAssignment(prop)) {
        yield * this.scanNode(prop.getExpression(), path);
      } else if (Node.isShorthandPropertyAssignment(prop)) {
        yield * this.scanNode(prop.getNameNode(), `${path}${prop.getName()}.`);
      } else if (Node.isPropertyAssignment(prop)) {
        const name = this.helper.resolveLiteralPropertyName(prop.getNameNode());

        if (name !== undefined) {
          yield * this.scanNode(prop.getInitializerOrThrow(), `${path}${name}.`);
        }
      }
    }
  }

  private * scanIdentifier(node: Identifier, path: string = ''): Iterable<[string, Expression]> {
    for (const definition of node.getDefinitionNodes()) {
      if (Node.isNamespaceImport(definition)) {
        yield * this.scanModule(
          definition
            .getFirstAncestorByKindOrThrow(SyntaxKind.ImportDeclaration)
            .getModuleSpecifierSourceFileOrThrow(),
          path,
        );
      } else if (Node.isImportClause(definition)) {
        yield * this.scanExportedDeclarations(
          definition
            .getFirstAncestorByKindOrThrow(SyntaxKind.ImportDeclaration)
            .getModuleSpecifierSourceFileOrThrow()
            .getExportedDeclarations()
            .get('default'),
          path,
        );
      } else if (Node.isImportSpecifier(definition)) {
        yield * this.scanExportedDeclarations(
          definition
            .getFirstAncestorByKindOrThrow(SyntaxKind.ImportDeclaration)
            .getModuleSpecifierSourceFileOrThrow()
            .getExportedDeclarations()
            .get(definition.getAliasNode()?.getText() ?? definition.getName()),
          path,
        );
      } else if (Node.isVariableDeclaration(definition)) {
        yield * this.scanNode(definition.getInitializerOrThrow(), path);
      }
    }
  }

  private analyseDefinition(id: string, definition: CallExpression, aliasArg?: TypeNode): void {
    const [typeArg] = definition.getTypeArguments();
    const [factoryArg, optionsArg] = definition.getArguments();
    const aliases = this.helper.resolveAliases(aliasArg);
    const [type, factory] = this.resolveFactoryAndType(typeArg, factoryArg);
    const scope = this.resolveServiceScope(optionsArg);
    this.registry.register({ id, type, aliases, factory, scope });
  }

  private resolveServiceScope(optionsArg?: Node): ServiceScope {
    if (!Node.isObjectLiteralExpression(optionsArg)) {
      return 'global';
    }

    const scopeProp = optionsArg.getProperty('scope');

    if (!scopeProp) {
      return 'global';
    } else if (!Node.isPropertyAssignment(scopeProp)) {
      throw new Error(`The 'scope' option must be a simple property assignment`);
    }

    const initializer = scopeProp.getInitializer();

    if (!Node.isStringLiteral(initializer)) {
      throw new Error(`The 'scope' option must be initialised with a string literal`);
    }

    const scope = initializer.getLiteralValue();

    switch (scope) {
      case 'global':
      case 'local':
      case 'private':
        return scope;
      default:
        throw new Error(`Invalid value for 'scope', must be one of 'global', 'local' or 'private'`);
    }
  }

  private resolveFactoryAndType(typeArg?: TypeNode, factoryArg?: Node): [Type, ServiceFactoryInfo | undefined] {
    if (typeArg) {
      const type = this.validateServiceType(...this.helper.resolveType(typeArg.getType()));
      const info = Node.isNullLiteral(factoryArg) ? undefined : this.resolveFactoryInfo(
        factoryArg ? factoryArg.getType() : type,
      );

      return [type, info];
    } else if (factoryArg) {
      if (Node.isNullLiteral(factoryArg)) {
        throw new Error(`Dynamic services require an explicit type argument`);
      }

      const info = this.resolveFactoryInfo(factoryArg.getType());
      return [info.returnType, info];
    } else {
      throw new Error(`Neither service type nor factory provided`);
    }
  }

  private resolveFactoryInfo(factoryType: Type): ServiceFactoryInfo {
    const ctors = factoryType.getConstructSignatures();
    const constructable = ctors.length > 0;
    const signatures = [...ctors, ...factoryType.getCallSignatures()];

    if (!signatures.length) {
      if (!constructable) {
        throw new Error(`No call or construct signatures found on service factory`);
      }

      return { constructable, parameters: [], returnType: factoryType };
    } else if (signatures.length > 1) {
      throw new Error(`Multiple overloads on service factories aren't supported`);
    }

    const [returnType, async] = this.resolveReturnType(signatures[0]);
    const parameters = signatures[0].getParameters().map((param) => this.resolveParameter(param));
    return { parameters, returnType, constructable, async };
  }

  private resolveParameter(symbol: Symbol): ServiceFactoryParameter {
    const [type, flags] = this.helper.resolveType(symbol.getValueDeclarationOrThrow().getType());
    const name = symbol.getName();
    return type.isClassOrInterface() || type.isObject()
      ? { name, type, flags }
      : { name, flags };
  }

  private resolveReturnType(signature: Signature): [type: Type, async: boolean] {
    const [type, flags] = this.helper.resolveType(signature.getReturnType());
    return [this.validateServiceType(type, flags), Boolean(flags & TypeFlag.Async)];
  }

  private validateServiceType(type: Type, flags: TypeFlag): Type {
    if (!type.isClassOrInterface() && !type.isObject() || (flags & ~TypeFlag.Async) !== TypeFlag.None) {
      throw new Error(`Invalid service type, only classes, interfaces and object types are allowed`);
    }

    return type;
  }
}
