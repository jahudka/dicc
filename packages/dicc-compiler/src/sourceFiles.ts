import { Project, ScriptKind, SourceFile } from 'ts-morph';
import { DiccOptions } from './types';

export class SourceFiles {
  private readonly input: SourceFile;
  private readonly output: SourceFile;
  private readonly helper: SourceFile;

  constructor(project: Project, options: DiccOptions) {
    this.input = project.getSourceFileOrThrow(options.input);
    this.output = project.createSourceFile(options.output, createEmptyOutput(options.map, options.export), {
      scriptKind: ScriptKind.TS,
      overwrite: true,
    });
    this.helper = project.createSourceFile('@dicc-helper.d.ts', '', {
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

  getHelper(): SourceFile {
    return this.helper;
  }
}

function createEmptyOutput(mapName: string, exportName: string): string {
  return `
import { Container } from 'dicc';
export interface ${mapName} {}
export const ${exportName} = new Container<${mapName}>({});
`;
}
