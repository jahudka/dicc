import { Project, ScriptKind, SourceFile } from 'ts-morph';
import { DiccOptions } from './types';

export class SourceFiles {
  private readonly project: Project;
  private readonly input: SourceFile;
  private readonly output: SourceFile;

  constructor(project: Project, options: DiccOptions) {
    this.project = project;

    project.getSourceFile(options.output)?.forget();

    this.input = project.getSourceFileOrThrow(options.input);
    this.output = project.createSourceFile(options.output, '', {
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
    return this.project.createSourceFile('@@dicc-helper.d.ts', source, {
      scriptKind: ScriptKind.TS,
      overwrite: true,
    });
  }
}
