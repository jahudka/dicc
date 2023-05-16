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
  factory?: ServiceFactoryInfo;
};

export type ServiceFactoryInfo = {
  parameters: ServiceFactoryParameter[];
  returnType: Type;
  constructable?: boolean;
  async?: boolean;
};

export type ServiceFactoryParameter = {
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
