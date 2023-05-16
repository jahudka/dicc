import { Project, ScriptKind, SourceFile } from 'ts-morph';
import { DiccOptions } from './types';

const selfCompiling = !__dirname.includes('/node_modules/');

const emptyOutputSource = `
import { Container } from '${selfCompiling ? '../lib' : 'dicc'}';
export const container = new Container({});
`;

export class SourceFiles {
  private readonly project: Project;
  private readonly input: SourceFile;
  private readonly output: SourceFile;

  constructor(project: Project, options: DiccOptions) {
    this.project = project;
    this.input = project.getSourceFileOrThrow(options.input);
    this.output = project.createSourceFile(options.output, emptyOutputSource, {
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

  getDiccImportSpecifier(dst: SourceFile): string {
    if (!selfCompiling) {
      return 'dicc';
    }

    return dst.getRelativePathAsModuleSpecifierTo(
      dst.getProject().getDirectoryOrThrow('src/lib').getPath(),
    );
  }

  createHelper(source: string): SourceFile {
    const specifier = selfCompiling ? './src/lib' : 'dicc';

    return this.project.createSourceFile('@dicc-helper.d.ts', source.replace('%dicc%', specifier), {
      scriptKind: ScriptKind.TS,
      overwrite: true,
    });
  }
}
