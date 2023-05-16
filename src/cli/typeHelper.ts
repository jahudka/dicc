import {
  CallExpression,
  ClassDeclaration,
  Node,
  SourceFile,
  SyntaxKind,
  Symbol,
  Type,
  TypeNode,
  VariableDeclaration,
  Expression,
} from 'ts-morph';
import { SourceFiles } from './sourceFiles';
import { TypeFlag } from './types';

type ReferenceMap = {
  Promise: Type;
  Iterable: Type;
  AsyncIterable: Type;
  Container: ClassDeclaration;
  ServiceTypes: Type;
  createDefinition: Symbol;
};

const helperSource = `
export { Container, ServiceTypes, createDefinition } from '%dicc%';
export type TPromise<T> = Promise<T>;
export type TIterable<T> = Iterable<T>;
export type TAsyncIterable<T> = AsyncIterable<T>;
`;

export class TypeHelper {
  private readonly helper: SourceFile;
  private readonly refs: ReferenceMap;

  constructor(sourceFiles: SourceFiles) {
    this.helper = sourceFiles.createHelper(helperSource);
    this.refs = this.resolveBaseTypes();
  }

  destroy(): void {
    this.helper.forget();
  }

  * getModuleExports(module: SourceFile): Iterable<[string, SourceFile | VariableDeclaration]> {
    for (const [name, declarations] of module.getExportedDeclarations()) {
      for (const declaration of declarations) {
        if (Node.isSourceFile(declaration) || Node.isVariableDeclaration(declaration)) {
          yield [name, declaration];
          break;
        }
      }
    }
  }

  extractDefinition(expression?: Expression): [definition?: CallExpression, aliases?: TypeNode] {
    let aliases: TypeNode | undefined;

    if (Node.isSatisfiesExpression(expression)) {
      const satisfies = expression.getTypeNode();

      if (!satisfies || !Node.isTypeReference(satisfies) || this.resolveRootType(satisfies.getTypeName().getType()) !== this.refs.ServiceTypes) {
        throw new Error(`Invalid "satisfies" expression`);
      }

      [, aliases] = satisfies.getTypeArguments();
      expression = expression.getExpression();
    }

    if (!Node.isCallExpression(expression)) {
      return [];
    }

    const symbol = expression.getExpression().getSymbol()?.getAliasedSymbol();
    return symbol === this.refs.createDefinition ? [expression, aliases] : [];
  }

  resolveType(type: Type): [type: Type, flags: TypeFlag] {
    let flags: TypeFlag = TypeFlag.None;

    const nonNullable = type.getNonNullableType();

    if (nonNullable !== type) {
      flags |= TypeFlag.Optional;
      type = nonNullable;
    }

    const signatures = type.getCallSignatures();

    if (signatures.length > 1) {
      throw new Error('Accessors may only have one overload');
    } else if (signatures.length) {
      if (signatures[0].getParameters().length) {
        throw new Error('Accessors may not accept arguments');
      }

      flags |= TypeFlag.Accessor;
      type = signatures[0].getReturnType();
    }

    const target = this.resolveRootType(type);

    if (target === this.refs.Promise) {
      flags |= TypeFlag.Async;
      type = type.getTypeArguments()[0];
    } else if (target === this.refs.Iterable) {
      flags |= TypeFlag.Iterable;
      type = type.getTypeArguments()[0];
    } else if (target === this.refs.AsyncIterable) {
      flags |= TypeFlag.Async | TypeFlag.Iterable;
      type = type.getTypeArguments()[0];
    }

    if (type.isArray()) {
      flags |= TypeFlag.Array;
      type = type.getArrayElementTypeOrThrow();
    }

    if ((flags & TypeFlag.Iterable) && (flags & (TypeFlag.Accessor | TypeFlag.Array))) {
      throw new Error(`Iterable services are mutually exclusive with accessors and arrays`);
    }

    return [type, flags];
  }

  resolveAliases(aliases?: TypeNode): Type[] {
    if (!aliases) {
      return [];
    } else if (Node.isTupleTypeNode(aliases)) {
      return aliases.getElements().map((el) => el.getType());
    } else {
      return [aliases.getType()];
    }
  }

  * getContainerMethodCalls(methodName: string): Iterable<CallExpression> {
    const method = this.refs.Container.getInstanceMethodOrThrow(methodName);

    for (const r1 of method.findReferences()) {
      for (const r2 of r1.getReferences()) {
        if (!r2.isDefinition()) {
          const call = r2.getNode().getFirstAncestorByKind(SyntaxKind.CallExpression);

          if (call) {
            yield call;
          }
        }
      }
    }
  }

  private resolveBaseTypes(): ReferenceMap {
    const src = this.helper.getExportedDeclarations();

    return {
      Promise: this.resolveRootType(src.get('TPromise')!.find(Node.isTypeAliasDeclaration)!.getType()),
      Iterable: this.resolveRootType(src.get('TIterable')!.find(Node.isTypeAliasDeclaration)!.getType()),
      AsyncIterable: this.resolveRootType(src.get('TAsyncIterable')!.find(Node.isTypeAliasDeclaration)!.getType()),
      Container: src.get('Container')!.find(Node.isClassDeclaration)!,
      ServiceTypes: this.resolveRootType(src.get('ServiceTypes')!.find(Node.isTypeAliasDeclaration)!.getType()),
      createDefinition: src.get('createDefinition')!.find(Node.isFunctionDeclaration)!.getSymbolOrThrow(),
    };
  }

  private resolveRootType(type: Type): Type {
    let target: Type | undefined;

    while ((target = type.getTargetType()) && target !== type) {
      type = target;
    }

    return target ?? type;
  }
}
