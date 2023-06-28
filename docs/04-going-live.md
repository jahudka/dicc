# Going live

In previous chapters we've talked about the code you need to write; now we'll
look into how to compile that code into a working container usable at runtime,
and how to actually use that container.

> This section is outdated! An updated version will be available within 24 hours.


## Compiling a container

Whenever you change service definitions you must re-run the compiler in order
to get a matching container. This is done using the `dicc` executable shipped
with DICC. The executable takes the following options:

- `-i` / `--input`: **required**, the path to the module which exports your
  definitions.
- `-o` / `--output`: **required**, the path to the module which should contain
  the compiled container. This file will be overwritten! Do **not** point this
  to the file containing your definitions.
- `-p` / `--project`: the path to `tsconfig.json`. Defaults to
  `./tsconfig.json`.
- `-e` / `--export`: the name of the variable holding the compiled container
  instance exported from the compiled module. Defaults to `container`.
- `-m` / `--map`: the name of the interface used to give the compiled container
  the appropriate typings. Defaults to `Services`.

Example:

```shell
node_modules/.bin/dicc -i src/di/definitions/index.ts -o src/di/index.ts
```

The compiled container should be a deterministic product of your definitions,
so you can safely exclude it from version control. But versioning it probably
won't hurt anything, either, and at least you'll be able to see changes between
compilations.


## Obtaining services

Ideally, you should write your code so that the only places where you explicitly
touch the container are the entrypoints of your application. For example, your
`app.ts` could look something like this:

```typescript
import { container } from './di';

container.get('application').run();
```

Remember, a key attribute of dependency injection is that code doesn't know
that there _is_ a DI container, and that includes obtaining services from the
container. So the ideal way to write code is to wrap everything in services,
specify inter-service dependencies as constructor parameters and have the DI
inject the dependencies wherever you need them.
