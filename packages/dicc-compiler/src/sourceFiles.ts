import { Project, ScriptKind, SourceFile } from 'ts-morph';
import { DiccConfig } from './types';

export class SourceFiles {
  private readonly inputs: Map<string, SourceFile[]>;
  private readonly output: SourceFile;
  private readonly helper: SourceFile;

  constructor(project: Project, config: DiccConfig) {
    this.inputs = new Map(Object.entries(config.resources).map(([resource, options]) => [
      resource,
      project.getSourceFiles(createSourceGlobs(resource, options?.exclude ?? [])),
    ]));

    this.output = project.createSourceFile(config.output, createEmptyOutput(config.map, config.name), {
      scriptKind: ScriptKind.TS,
      overwrite: true,
    });

    this.helper = project.createSourceFile('@dicc-helper.d.ts', '', {
      scriptKind: ScriptKind.TS,
      overwrite: true,
    });
  }

  getInputs(resource: string): SourceFile[] {
    return this.inputs.get(resource) ?? [];
  }

  getOutput(): SourceFile {
    return this.output;
  }

  getHelper(): SourceFile {
    return this.helper;
  }
}

function createSourceGlobs(resource: string, exclude: string[]): string[] {
  return [resource].concat(exclude.filter((p) => /(\/|\.tsx?$)/i.test(p)).map((e) => `!${e}`));
}

function createEmptyOutput(mapName: string, exportName: string): string {
  return `
import { Container } from 'dicc';
export interface ${mapName} {}
export const ${exportName} = new Container<${mapName}>({});
`;
}
