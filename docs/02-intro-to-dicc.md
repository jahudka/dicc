# Intro to DICC

In [the previous chapter][1] we've talked about dependency injection in general
terms; in this chapter, we'll tackle the basics of how dependency injection
works in DICC.


## DICC is a DI Container _Compiler_

Most existing DI frameworks in TypeScript use metadata about service types
emitted during transpilation and then do most of the heavy lifting at runtime.
DICC is different: it requires an additional step before the actual TypeScript
transpilation, during which it will analyse your service definitions and produce
a _compiled_ DI container, which only has limited information about the actual
dependencies of each service, but which includes factories capable of obtaining
the dependencies required to create the services. It depends on static analysis
of your code in order to achieve this. This approach has some benefits, as well
as some drawbacks: on the one hand in allows your service code to remain almost
entirely agnostic to the DI implementation (e.g. no `@decorators` in service
code, no special types outside service definitions etc.), but on the other hand
it imposes some requirements on how you write code. These, however, shouldn't
be far outside what you'd probably do anyway, so the cost of using DICC should
be relatively small, and far outweighed by the benefits:

 - DICC doesn't require you to enable `experimentalDecorators` and
   `emitDecoratorMetadata`; nor does it require usage of `reflect-metadata`.
 - As mentioned, services don't need to include any kind of special code in
   order to work with DICC (apart from TypeScript types which you'd provide
   anyway). Among other things, this means that you don't even need to use DICC
   in tests - you can still construct services and inject their dependencies
   manually if needed.
 - You can define multiple fully independent containers if needed; each
   container can be independently _forked_, which creates an isolated context
   available during the execution of an asynchronous call chain.
 - DICC supports some features that few, if any, other frameworks currently
   offer, including async services, service accessors, and lists / iterables of
   services.
 - The compiled container is a regular TypeScript file which you can easily
   examine to figure out exactly what DICC is doing.

The main pain point of using DICC is that you must write a separate _service
definition_ for each service. This is typically done in a separate file (or
files) from where the service class is declared. It can look like a lot of extra
work, but in most cases, a service definition is a single line of code - and it
means that all the code which is required to make DI work is kept separate from
the actual service implementation. The hope is that in the future DICC will
evolve to being able to discover most simple services automatically, so that
explicit service definitions will shrink to just a few complex cases, overrides
and similar.


## Dependency injection using DICC

As mentioned in the previous chapter, DICC only supports _constructor
injection_. This is not unintentional - it is the author's opinion that setter
and property injection bring more problems than they solve, and implementing
them correctly in DICC without introducing a lot of issues would be extremely
hard. For example, how would the compiler distinguish between a property
which should be injected and another which shouldn't, unless the service code
is changed to label injected properties somehow?

One thing which DICC does support as a natural extension of the constructor
injection pattern is _service factories_ - functions or static class methods
which create the service instance. Service factories are injected the same way
a class constructor would be, but they allow some powerful stuff which isn't
possible with constructors. For starters, unlike a class constructor, a factory
function can be `async`; this means not only that a factory can e.g. return a
database connection _after_ the connection has already been established, but
also that the factory can properly `await` the resolution of any dependencies
which themselves are `async` - in fact, DICC does this part automatically under
the hood, and most of the time you don't need to know or care whether a
dependency is async or not.

Another thing which service factories allow is defining _non-class_ services -
for example, an object literal can be a service (and still have dependencies).
This is useful e.g. for injecting configuration into services.

Service factories also make it possible for services to be _optional_ - a
factory function can decide, based on e.g. its dependencies, that a particular
service can't or shouldn't be created, and return `undefined` instead. This
can be used to define things like different logger implementations based on
local vs. production environment and similar.


## Service and dependency types

TypeScript is a _structurally_-typed language, meaning that one thing is
assignable to another if its structure matches the structure of the target.
Other languages, for example PHP, employ _nominal_ types, where one thing is
assignable to another if and only if its type corresponds to the same type
declaration as the target - for example, imagine you have declared two
interfaces with the exact same shape, and a class which implements one of them -
then instances of that class will only be assignable to e.g. function arguments
which reference the interface explicitly listed in the class's `implements`
clause, and not to arguments which reference the other interface, even though
the interfaces have the same shape. Nominal typing is therefore stricter than
structural typing.

DICC uses a mixture of the two systems: it obtains a reference to each service
and injectable argument's type from the TypeScript type checker, and it will
inject services into arguments which reference the same type - meaning that the
decision of what to inject doesn't consider the _structure_ of the services, but
rather the _identity_ of the types. But services can be given _aliases_ - extra
types that the actual service type must conform to _structurally_ (but doesn't
need to explicitly list in e.g. `implements` clauses), which are then also
considered when resolving injection.

Currently, DICC doesn't automatically add aliases for interfaces which services
explicitly list in their `implements` clause, and nor does it consider class
inheritance - a service's only type, unless you explicitly add some aliases, is
the type specified in its definition.


## DICC speak

In this section we'll look at some terms used in the rest of the documentation:

 - A **service** can be almost anything that has a type. Due to the way type
   resolution works in the TypeScript compiler and the way that the DICC
   compiler leverages that mechanism, it isn't very useful to register simple
   types such as `string` and `number` as services, because even if you create
   a type alias such as `type DbHost = string`, the compiler will only see
   `string`, and therefore you'd have a bunch of services of type `string` which
   the DICC compiler wouldn't be able to distinguish between. Furthermore, it is
   recommended (but not required) that you use interfaces, rather than type
   aliases, for service aliases - again, due to the way the DICC compiler now
   works, the _name_ of a type alias (unlike an interface's name) is lost during
   the compilation - and the names of service and alias types are used in the
   compiled container code (suffixed with a number to ensure two distinct types
   with the same name don't conflict). Using type aliases would therefore result
   in a lot of `Anonymous.<number>` strings in your compiled container, making
   it much less readable.
 - A **factory** is a callable or constructable which returns a service.
 - A **service ID** is a unique identifier of a service. Service IDs are derived
   from the path to the service definition in the definition tree exported from
   a definition file.
 - An **alias**, as mentioned, is an extra type that you want the DICC compiler
   to consider when resolving injection. Each service can have zero or more
   aliases and the service type must structurally conform to each of them.
   Aliases are specified in the service definition, rather than directly in the
   service code (e.g. in the service class declaration), meaning that you can
   add extra aliases to e.g. 3rd-party services without touching their code or
   needing to extend them to add an `implements` clause.
 - A **service definition** is the mechanism by which you tell DICC about a
   service which exists in your application. Service definitions must be
   exported (or re-exported) from a _definition file_, which serves as the main
   input to the DICC compiler. Each definition corresponds to exactly one
   service (meaning it isn't possible to e.g. define a bunch of services in a
   batch by iterating over an array). The definition itself is any value
   declaration reachable by traversing the exports of the definition file whose
   initializer is a special `satisfies` expression. We'll unpack what this
   somewhat convoluted sentence means later.
 - A **dependency** is any constructor or factory argument of a defined service.
   The DICC compiler doesn't understand everything you can do in TypeScript, not
   by a long shot; the full list of things the compiler _does_ understand will
   be elaborated in a later section. If an argument's type cannot be resolved
   to something that DICC understands, DICC will either inject `undefined` if
   the argument is optional, or throw an error during compilation if it's not.
   Similarly, if DICC does understand an argument's type, but no service of the
   requested type exists, DICC will inject `undefined` if the argument is
   optional, and throw an error during compilation if it's not.
 - A service's **scope** dictates when the container will create a new instance
   of the service and where the instance will be available from. There are three
   options:
   - The _global_ scope is the default; a service defined in this scope will be
     instantiated at most once and the instance will be shared among all other
     services which depend on it.
   - Services in the _private_ scope are the polar opposite: each time such a
     service is requested from the container, a new instance will be created;
     an instance of a private service will never be shared among multiple
     services which depend on it.
   - A _local_ service can only be instantiated inside an isolated asynchronous
     context created by calling the container's `.fork()` method. Each forked
     context gets its own instances of any local services. See the next entry
     for more details about forking the container.
 - An isolated forked context, or **fork**, of a container can be created by
   calling its `.fork()` method. Inside the callback passed to the `.fork()`
   method and the asynchronous call chain spawned from within the callback the
   application can access _locally-scoped_ services. When the async call chain
   terminates (i.e. when the value returned from the callback is not a promise,
   or when the promise is resolved), the local scope and all its services are
   destroyed.
 - A **hook** is one of a few optional callbacks you can specify in service
   definitions; they are executed by the container at important points in a
   service's lifecycle. The available hooks are:
    - `onCreate(service: T, ...args: any[]): Promise<void> | void` - This hook
      will be called when the service has been created and registered. Note it
      works with dynamic services as well - the hook will be called when the
      service is registered. An async `onCreate` hook will make the service
      itself async as well.
    - `onFork(service: T, ...args: any[]): Promise<T | undefined> | T | undefined` -
      This hook will be called at the start of a `container.fork()` call. The
      hook may return a new instance of the service which will be used inside
      the forked async execution chain, as if the service was defined in the
      `local` scope. MikroORM's `EntityManager` comes to mind here.
    - `onDestroy(service: T, ...args: any[]): void` - This hook will be called
      when a service is being destroyed. This will happen at the end of any
      `container.fork()` call for all services in the `local` scope, as well as
      for any instances returned from an `onFork` hook within the same fork
      call.

   The first argument for each hook callback must always be the service instance,
   but you can specify other arguments and these will be injected from
   the container as usual.
 - An **async service** is a service whose factory returns a Promise, or whose
   `onCreate` hook returns a Promise, or which depends on another async service.
   It is impossible to obtain a resolved instance of an async service from the
   container directly; rather, you will always obtain a Promise which you need
   to await. DICC will do it for you automatically when injecting the service as
   a dependency.
 - A **dynamic service** is one which the compiler knows about, but which the
   container cannot create at runtime - such a service must be registered
   manually at runtime in order to be available for injection. This can be
   useful especially in combination with other features - e.g. a locally-scoped
   dynamic service which represents an HTTP request.

Next: [Services and dependencies][2]

[1]: ./01-intro-to-di.md
[2]: ./03-services-and-dependencies.md
