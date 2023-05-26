# DICC

> **_Dependency Injection Container Compiler_**

This is a project to _end_ all current TypeScript DI implementations.
I mean it. **All of them**. With extreme prejudice.

Why? Because they are all based on decorators. (Well, there is _one_ exception,
but that one doesn't - and cannot, properly - support async services, hence
this project.) Don't get me wrong - decorators are awesome! I love decorators.
I've built a pretty big library based _entirely_ on decorators.

But - and I _cannot stress this enough_ - decorator-based dependency injection
breaks one of the most sacred dependency injection principles - **your code
should almost NEVER know or care that dependency injection even exists**, and it
most certainly shouldn't know anything about the specifics of the DI
_implementation_ - in other words, your code _should not depend on your
preferred dependency injection solution_. Because if it does, then it's not
portable, you can't just easily extract parts of it into a shared library,
you cannot test it independently of the DI framework, you're simply locked in,
you're alone in the dark, you're locked in and there are drums in the deep and
they are coming and you cannot get out and you don't have Gandalf to save you
and

&lt;/rant&gt;

&lt;zen&gt;

DICC can't do the pointy hat trick, but it does offer an alternative solution
to dependency injection. You write a simple _definition file_ in plain
TypeScript, that is, a standard `.ts` file with some `export const ... = ...`
statements, and then you point DICC to that file and DICC will produce a
_compiled file_, which exports a fully typed and autowired dependency injection
container.

The only place in your code you will ever `import { anything } from 'dicc'`
will be inside the definition file (or files).

## Highlights
 - type-based autowiring, doesn't care about type or parameter names
 - supports multiple services of the same type
 - supports _async_ services (that is, services which need to be created
   asynchronously)
 - supports _scoped_ services private to a given asynchronous execution
   context, as well as fully private services
 - supports _dynamic_ services which are known to the container, but must be
   registered manually in order to be available as dependencies to other
   services
 - compiles to regular TypeScript which you can easily examine to see what's
   going on under the hood
 - on top of injecting simple dependencies, supports a few other injection
   schemes, based on the declared type of the argument being injected:
   - `Promise<T>` - will inject a Promise for an async service without waiting
     to resolve it
   - `T[]` - will inject an array containing all services of type `T`; can
     be `Promise<T[]>` for async services
   - `() => T` - will inject an _accessor_ for service of type `T`; the accessor
     return type can be `T`, `T[]`, `Promise<T>` or `Promise<T[]>`
   - `Iterable<T>` - will inject an _iterable_ which allows lazy iteration over
     all services of type `T`
   - `AsyncIterable<T>` - same thing for async services

### Note on types

TypeScript is a _structurally-typed_ language, meaning a type is considered
assignable to another type if it has a matching structure. Type resolution in
DICC, however, is strictly referential, and therefore DICC can be said to use
_nominal_ typing for dependency resolution. In practice, it shouldn't limit you
much, but it's something to be aware of.


## Installation

DICC is split into two packages, because the compiler depends on TypeScript
and ts-morph, which are probably both something you want to be able to prune
from your production node modules. The runtime package is tiny and doesn't have
any other dependencies.

```shell
# Compile-time dependency:
npm i --save-dev dicc-compiler

# Runtime dependency:
npm i --save dicc
```

## Usage

### Defining services

Service definitions must all be exported from a single module. That module may
re-export definitions from other modules, if it gets too large and you want to
split it up. A service is defined using a `satisfies` expression. A simple
service definition might look like this:

```typescript
import { ServiceDefinition } from 'dicc';
import { HttpServer } from 'insaner';

export const httpServer = HttpServer satisfies ServiceDefinition<HttpServer>;
```

The value of the `satisfies` expression can be one of the following:
 - a constructable class
 - a factory function
 - `null`
 - an object literal with a `factory` property, which must be either
   a constructable class, a factory function, or `null`; this allows specifying
   other options when defining a service, more on that later

The `ServiceDefinition` type used in the `satisfies` expression tells the DICC
compiler what type or types you want to register your service under. Its first
type argument is the service type; whatever your factory function returns must
be assignable to this type. The second type argument of `ServiceDefinition` is
optional; you can use it to give the service one or more _aliases_ - additional
types the compiler should consider as being provided by the service. Think
interfaces which the service implements. For example:

```typescript
export const httpServer = HttpServer satisfies ServiceDefinition<
  HttpServer,         // the service type
  HttpServerInterface // an alias
>;
```

Multiple aliases can be specified as a tuple using
`satisfies ServiceTypes<T, [A1, A2, A3]>`. Note that the service must actually
conform to all the alias types.

Factory functions can be _async_ - meaning they can return a _Promise_ for an
instance instead of the instance itself. This can be useful for some services
which require asynchronous initialisation.

Public service IDs (meaning IDs you can safely use in your code to get services
from the container) are derived from the path to the service definition in the
exported definition tree. For example:

```typescript
// file: di/definitions/orm.ts
export const repository = {
  user: UserRepository satisfies ServiceDefinition<UserRepository>,
  comment: CommentRepository satisfies ServiceDefinition<CommentRepository>,
};

// file: di/definitions/index.ts
// this is the input file for DICC
export * as orm from './orm';

// the generated container will have these services:
container.get('orm.repository.user');
container.get('orm.repository.comment');
```

Generic services behave the way you'd intuitively expect: `Service<A>` and
`Service<B>` are treated as two completely distinct services, but multiple
definitions with the `Service<A>` type will all be registered as services of the
same type.

You can also register _dynamic_ services using `undefined satisfies ServiceDefinition<T>`.
Such services will be known to the compiler, and therefore it will be able to
include the appropriate code to inject them into other services which may depend
on them, but the container will not be able to create an instance of the service
at runtime - instead, you will need to register it manually before you can fetch
it from the container (and therefore before you can fetch any other service
which depends on it directly). When retrieving collections of services, dynamic
services which haven't been registered yet will be silently ignored.

Service factories can return `undefined`. This can be used to make services
_optional_. By default, all services are _required_ - meaning that whenever you
attempt to obtain a defined service from the container and the service wasn't
manually registered and cannot be created, an error is thrown. But there are
some scenarios where you might want to be able to define a service during
compilation and then decide at runtime that the service shouldn't actually be
created - for example you can have multiple log handlers, and you may want to
only use those for which you have the necessary configuration available at
runtime (e.g. from `.env` or similar). Optional services are optional only in
a couple of contexts: either in a `container.get()` call where you pass `false`
as the second argument (in that case the method will return `T | undefined` for
any optional service), or when retrieving collections of services (in which case
optional services whose factory returned `undefined` will be silently ignored).

When defining a service using an object literal, you can specify some options
for the service's runtime behavior. These options can be used to define hooks
for the service's lifecycle, and to specify a _scope_ in which a service should
be available. There are three options for `scope`:
 - `global`, which is the default - Services in this scope will always be
   instantiated only once, and that instance will be injected into everything
   that depends on the service's type or one of its aliases.
 - `local` - Services in this scope will only be available inside a callback
   passed to a `container.fork()` call and inside any asynchronous execution
   chains started inside such a callback; a new instance of the service will be
   created for each `container.fork()` call. For example, you could fork the
   container for each HTTP request and define a dynamic service in the `local`
   scope for the request object, and then inject an _accessor_ for this service
   into your controllers or resolvers (which can therefore still be `global`,
   because an accessor is not a direct dependency).
 - `private` - This scope is for services which should not be remembered by the
   container - each time such a service is fetched from the container, a new
   instance will be created. There are those who say you should never create new
   instances of objects in application code - in other words, that the `new`
   keyword should only ever appear in the DI container. Private services allow
   you to register something like `Date` as a service and then inject an
   accessor anywhere you might want to call `new Date()`. Personally, I think
   this is perhaps taking it a bit far, but even I can see how it might be
   occasionally useful to be able to inject e.g. a slightly tuned-up `Date`
   constructor into a test case.

The available service hooks you can specify in the definition options are:
 - `onCreate(service: T, ...args: any[]): Promise<void> | void` - This hook will
   be called when the service has been created and registered. Note it works
   with dynamic services as well - the hook will be called when the service is
   registered. An async `onCreate` hook will make itself async as well.
 - `onFork(service: T, ...args: any[]): Promise<T | undefined> | T | undefined` -
   This hook will be called at the start of a `container.fork()` call. The hook
   may return a new instance of the service which will be used inside the forked
   async execution chain, as if the service was defined in the `local` scope.
   MikroORM's `EntityManager` comes to mind here.
 - `onDestroy(service: T, ...args: any[]): void` - This hook will be
   called when a service is being destroyed. This will happen at the end of any
   `container.fork()` call for all services in the `local` scope, as well as for
   any instances returned from an `onFork` hook within the same fork call.

The first argument for each hook callback must always be the service instance,
but you can specify other arguments and these will be injected from
the container as usual.

### Specifying dependencies

DICC facilitates automatic _constructor injection_, that is, it will analyse
the constructors or factory functions of all defined services and generate
a _compiled factory_ for each of them, which will call the original constructor
or factory with the appropriate arguments. The compiler will only inject
arguments whose resolved object type matches one or more of the defined services
or aliases. As I've mentioned before, types are resolved referentially, meaning
that it is not enough that a service has the correct shape matching an
argument's type, it must be explicitly defined using that type, either as the
service's type, or as one of its aliases.

When an argument's type cannot be resolved to something DICC understands, if the
argument is optional, it is ignored, otherwise an error is thrown. Similarly,
if an argument's type is resolved to something that DICC thinks is a service
type, but no such service exists, then either the argument is ignored if it is
optional, or an error is thrown. This all happens during compilation, so it
should never happen that a service cannot be resolved at runtime (except with
dynamic services, if you're not careful).

When a dependency of a service is an async service, meaning that its factory
function returns a Promise, and a resolved instance of the dependency is
requested, the compiled factory for the service will `await` the pertinent
`container.get()` call in order to inject the resolved instance. This in turn
means that the depending service must also be async, since it cannot be created
synchronously. The compiler will take care of this automatically - for you, it
just means that sometimes you'll have to `await` a `container.get()` call; but
since you shouldn't really have many of those, it's not a big deal.

When an argument is typed for a single instance of a given service type and
there are multiple definitions matching that type, an error will be thrown
during compilation. But you can inject multiple services of the same type in
a few different ways:
 - You can ask for an array of the desired service type (`T[]`). The requested
   services will all need to be instantiated immediately to satisfy such a
   dependency.
 - You can ask for an iterable of the desired service type (`Iterable<T>`,
   or `AsyncIterable<T>` if one or more of the requested services is async).
   This has the benefit of creating each of the requested services lazily as you
   iterate over the injected value.

When you need two services to depend on each other - whether directly or
indirectly through another service - you can break the cyclic dependency using
one of the following patterns:
 - Either request an _accessor_ for one of the services to be injected into the
   other one - this is done by typing the dependency as `() => T`. Note that you
   cannot call the accessor from within the service factory or constructor,
   because while the factory / constructor is running, the service isn't fully
   created yet, meaning the other service which depends on this service also
   cannot be created.
 - Or you can request a Promise for one of the services (regardless of whether
   the target service is async or not). Since Promises cannot be awaited in
   constructors, this is a safe way to deal with cyclic dependencies.


### Compiling a container

Whenever you change service definitions you must re-run the compiler in order
to get a matching container. This is done using the `dicc` executable shipped
with DICC. The executable takes the following options:

 - `-i` / `--input`: **required**, the path to the module which exports your
   definitions.
 - `-o` / `--output`: **required**, the path to the module which should contain
   the compiled container. This file will be overwritten!
 - `-p` / `--project`: the path to `tsconfig.json`. Defaults to
   `./tsconfig.json`.
 - `-e` / `--export`: the name of the variable holding the compiled container
   instance exported from the compiled module. Defaults to `container`.

Example:

```shell
node_modules/.bin/dicc -i src/di/definitions/index.ts -o src/di/index.ts
```

The compiled container should be a deterministic product of your definitions,
so you can safely exclude it from version control. But versioning it probably
won't hurt anything, either, and at least you'll be able to see changes between
compilations.


### Obtaining services

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

Another argument against fetching services manually using `container.get()` is
that you'd have to keep track of services _and all their dependencies_ being
async. When injecting autowired dependencies, the compiler will take care of
this automatically, and it's one less thing you have to deal with - if a service
needs async initialisation, then you just deal with that one service, and any
services which depend on it will still work the same as before. But if you have
many calls to `container.get()` interspersed throughout your application code,
and then you make one service async, you'll probably get a lot of compilation
errors at those call sites, because the return value of `container.get()` will
suddenly be a Promise. Not optimal.
