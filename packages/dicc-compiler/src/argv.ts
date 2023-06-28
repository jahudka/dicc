export class Argv {
  readonly configPath: string;

  constructor() {
    [,, this.configPath = 'dicc.yaml'] = process.argv;
  }
}
