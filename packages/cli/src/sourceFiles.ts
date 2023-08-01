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
    const inputs = this.inputs.get(resource);

    if (!inputs) {
      throw new Error(`Unknown resource: '${resource}'`);
    } else if (!inputs.length) {
      if (resource.includes('*')) {
        console.log(`Warning: resource '${resource}' didn't match any files`);
      } else {
        throw new Error(`Resource '${resource}' doesn't exist`);
      }
    }

    return inputs;
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
