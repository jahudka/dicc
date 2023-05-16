import {
  CallExpression,
  Node,
  Signature,
  SourceFile,
  Symbol,
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
    this.scanModule(input);
  }

  scanUsages(): void {

  }

  private scanModule(module: SourceFile, prefix: string = ''): void {
    for (const [name, declaration] of this.helper.getModuleExports(module)) {
      if (Node.isSourceFile(declaration)) {
        this.scanModule(declaration, `${prefix}${name}.`);
      } else {
        const id = `${prefix}${name}`;

        try {
          const [definition, aliases] = this.helper.extractDefinition(declaration.getInitializer());

          if (definition) {
            this.analyseDefinition(id, definition, aliases);
          }
        } catch (e: any) {
          throw new Error(`Invalid definition '${id}': ${e.message}`);
        }
      }
    }
  }

  private analyseDefinition(id: string, definition: CallExpression, aliasArg?: TypeNode): void {
    const [typeArg] = definition.getTypeArguments();
    const [factoryArg] = definition.getArguments();
    const aliases = this.helper.resolveAliases(aliasArg);
    const [type, factory] = this.resolveFactoryAndType(typeArg, factoryArg);
    this.registry.register({ id, type, aliases, factory });
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
