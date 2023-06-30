import { ServiceScope } from 'dicc';
import { KindToNodeMappings, SourceFile, SyntaxKind, Type } from 'ts-morph';
import { z } from 'zod';

const resourceSchema = z.strictObject({
  exclude: z.array(z.string()).optional(),
});

export const diccConfigSchema = z.strictObject({
  project: z.string().default('./tsconfig.json'),
  output: z.string(),
  preamble: z.string().optional(),
  name: z.string().regex(/^[a-z$_][a-z0-9$_]*$/i, 'Invalid identifier').default('container'),
  map: z.string().regex(/^[a-z$_][a-z0-9$_]*$/i, 'Invalid identifier').default('Services'),
  resources: z.record(resourceSchema.optional().nullable()),
});

type ResourceConfigSchema = z.infer<typeof resourceSchema>;
type DiccConfigSchema = z.infer<typeof diccConfigSchema>;

export interface ResourceOptions extends ResourceConfigSchema {}
export interface DiccConfig extends DiccConfigSchema {}

export type ServiceRegistrationInfo = {
  source: SourceFile;
  path: string;
  id?: string;
  type: Type;
  aliases: Type[];
  object?: boolean;
  explicit?: boolean;
  factory?: ServiceFactoryInfo;
  hooks: ServiceHooks;
  scope?: ServiceScope;
};

export type ServiceDefinitionInfo = Omit<ServiceRegistrationInfo, 'id'> & {
  id: string;
  async?: boolean;
  decorators: ServiceDecoratorInfo[];
};

export type ServiceDecoratorInfo = {
  source: SourceFile;
  path: string;
  type: Type;
  decorate?: ServiceHookInfo;
  hooks: ServiceHooks;
  scope?: ServiceScope;
};

export type ServiceFactoryInfo = {
  parameters: ParameterInfo[];
  returnType: Type;
  method?: string;
  async?: boolean;
};

export type ServiceHooks = {
  onCreate?: ServiceHookInfo;
  onFork?: ServiceHookInfo;
  onDestroy?: ServiceHookInfo;
};

export type ServiceHookInfo = {
  parameters: ParameterInfo[];
  async?: boolean;
};

export type ParameterInfo = {
  name: string;
  type?: Type;
  flags: TypeFlag;
};

export enum TypeFlag {
  None     = 0b000000,
  Optional = 0b000001,
  Array    = 0b000010,
  Iterable = 0b000100,
  Async    = 0b001000,
  Accessor = 0b010000,
  Injector = 0b100000,
}

export type ReferenceSpecifier<T extends SyntaxKind = any> = {
  module?: string;
  kind: T;
};

export type ReferenceMap = {
  [name: string]: ReferenceSpecifier;
};

export type ResolvedReference<S extends ReferenceSpecifier> =
  S extends ReferenceSpecifier<infer K>
  ? K extends SyntaxKind.TypeAliasDeclaration
  ? Type
  : KindToNodeMappings[K]
  : never;

export type ResolvedReferences<M extends ReferenceMap> = {
  [N in keyof M]: ResolvedReference<M[N]>;
};
