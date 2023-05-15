import { Project, ScriptKind } from 'ts-morph';
import { Autowiring } from './autowiring';
import { Compiler } from './compiler';
import { DefinitionScanner } from './definitionScanner';
import { ServiceRegistry } from './serviceRegistry';
import { TypeHelper } from './typeHelper';
import { DiccOptions } from './types';

export class Dicc {
  private readonly project: Project;
  private readonly helper: TypeHelper;
  private readonly registry: ServiceRegistry;
  private readonly scanner: DefinitionScanner;
  private readonly autowiring: Autowiring;
  private readonly compiler: Compiler;
  private readonly options: DiccOptions;

  constructor(
    project: Project,
    helper: TypeHelper,
    registry: ServiceRegistry,
    scanner: DefinitionScanner,
    autowiring: Autowiring,
    compiler: Compiler,
    options: DiccOptions,
  ) {
    this.project = project;
    this.helper = helper;
    this.registry = registry;
    this.scanner = scanner;
    this.autowiring = autowiring;
    this.compiler = compiler;
    this.options = options;
  }

  async compile(): Promise<void> {
    const input = this.project.getSourceFileOrThrow(this.options.input);

    this.scanner.scan(input);
    this.autowiring.checkDependencies();

    const output = this.project.createSourceFile(this.options.output, '', {
      scriptKind: ScriptKind.TS,
      overwrite: true,
    });

    this.compiler.compile(this.registry.getDefinitions(), input, output);
    this.helper.destroy();
    await output.save();
  }
}
