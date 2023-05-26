export function isAsyncIterable(value: any): value is AsyncIterable<any> {
  return Symbol.asyncIterator in value;
}

export function isIterable(value: any): value is Iterable<any> {
  return Symbol.iterator in value;
}

export function isPromiseLike(value: any): value is PromiseLike<any> {
  return 'then' in value && typeof value.then === 'function';
}
