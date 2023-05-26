import {
  CallExpression,
  Node,
  SourceFile,
  SyntaxKind,
  Type,
  TypeNode,
  PropertyName, TypeReferenceNode,
} from 'ts-morph';
import { ReferenceResolver } from './referenceResolver';
import { SourceFiles } from './sourceFiles';
import { ReferenceMap, TypeFlag } from './types';

const referenceSpecifiers = {
  Container: { kind: SyntaxKind.ClassDeclaration, module: 'dicc' },
  ServiceDefinition: { kind: SyntaxKind.TypeAliasDeclaration, module: 'dicc' },
  'Promise<T>': { kind: SyntaxKind.TypeAliasDeclaration },
  'Iterable<T>': { kind: SyntaxKind.TypeAliasDeclaration },
  'AsyncIterable<T>': { kind: SyntaxKind.TypeAliasDeclaration },
} as const satisfies ReferenceMap;

export class TypeHelper {
  private readonly helper: SourceFile;
  private readonly refs: ReferenceResolver<typeof referenceSpecifiers>;
  private resolvers: number = 0;

  constructor(sourceFiles: SourceFiles) {
    this.helper = sourceFiles.getHelper();
    this.refs = this.createReferenceResolver(referenceSpecifiers);
  }

  destroy(): void {
    this.helper.forget();
  }

  isServiceDefinition(node?: TypeNode): node is TypeReferenceNode {
    return Node.isTypeReference(node)
      && this.resolveRootType(node.getTypeName().getType()) === this.refs.get('ServiceDefinition');
  }

  resolveLiteralPropertyName(name: PropertyName): string | number | undefined {
    if (Node.isIdentifier(name)) {
      return name.getText();
    } else if (Node.isStringLiteral(name) || Node.isNumericLiteral(name)) {
      return name.getLiteralValue();
    } else {
      return undefined;
    }
  }

  resolveServiceType(type: Type): [type: Type, async: boolean] {
    let async = false;

    const target = this.resolveRootType(type);

    if (target === this.refs.get('Promise<T>')) {
      async = true;
      type = type.getTypeArguments()[0];
    }

    return [type, async];
  }

  resolveType(type: Type): [type: Type, flags: TypeFlag] {
    let flags: TypeFlag = TypeFlag.None;

    [type, flags] = this.resolveNullable(type, flags);

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

    if (target === this.refs.get('Promise<T>')) {
      [type, flags] = this.resolveNullable(type.getTypeArguments()[0], flags | TypeFlag.Async);
    } else if (target === this.refs.get('Iterable<T>')) {
      flags |= TypeFlag.Iterable;
      type = type.getTypeArguments()[0];
    } else if (target === this.refs.get('AsyncIterable<T>')) {
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
    } else if (Node.isUndefinedKeyword(aliases)) {
      return [];
    } else if (Node.isTupleTypeNode(aliases)) {
      return aliases.getElements().map((el) => el.getType());
    } else {
      return [aliases.getType()];
    }
  }

  resolveNullable(type: Type, flags: TypeFlag): [type: Type, flags: TypeFlag] {
    const nonNullable = type.getNonNullableType();
    return nonNullable !== type ? [nonNullable, flags | TypeFlag.Optional] : [type, flags];
  }

  resolveRootType(type: Type): Type {
    let target: Type | undefined;

    while ((target = type.getTargetType()) && target !== type) {
      type = target;
    }

    return target ?? type;
  }

  createReferenceResolver<M extends ReferenceMap>(map: M): ReferenceResolver<M> {
    return new ReferenceResolver(this, this.helper, ++this.resolvers, map);
  }

  * getContainerMethodCalls(methodName: string): Iterable<CallExpression> {
    const method = this.refs.get('Container').getInstanceMethodOrThrow(methodName);

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
}
