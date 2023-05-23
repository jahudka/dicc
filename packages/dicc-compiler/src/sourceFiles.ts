import { Project, ScriptKind, SourceFile } from 'ts-morph';
import { DiccOptions } from './types';

export class SourceFiles {
  private readonly project: Project;
  private readonly input: SourceFile;
  private readonly output: SourceFile;

  constructor(project: Project, options: DiccOptions) {
    this.project = project;
    this.input = project.getSourceFileOrThrow(options.input);
    this.output = project.createSourceFile(options.output, createEmptyOutput(options.map, options.export), {
      scriptKind: ScriptKind.TS,
      overwrite: true,
    });
  }

  getInput(): SourceFile {
    return this.input;
  }

  getOutput(): SourceFile {
    return this.output;
  }

  createHelper(source: string): SourceFile {
    return this.project.createSourceFile('@dicc-helper.d.ts', source, {
      scriptKind: ScriptKind.TS,
      overwrite: true,
    });
  }
}

function createEmptyOutput(mapName: string, exportName: string): string {
  return `
import { Container } from 'dicc';
export interface ${mapName} {}
export const ${exportName} = new Container<${mapName}>({});
`;
}
