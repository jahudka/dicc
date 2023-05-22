import { ServiceScope } from 'dicc';
import { Type } from 'ts-morph';

export interface DiccOptions {
  project?: string;
  input: string;
  output: string;
  export?: string;
}

export type ServiceDefinitionInfo = {
  id: string;
  type: Type;
  aliases: Type[];
  object?: boolean;
  factory?: ServiceFactoryInfo;
  hooks: ServiceHooks;
  scope: ServiceScope;
};

export type ServiceFactoryInfo = {
  parameters: ParameterInfo[];
  returnType: Type;
  constructable?: boolean;
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
  None     = 0b00000,
  Optional = 0b00001,
  Array    = 0b00010,
  Iterable = 0b00100,
  Async    = 0b01000,
  Accessor = 0b10000,
}
