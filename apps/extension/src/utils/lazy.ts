export function lazy<T>(factory: () => T): () => T {
  let instance: T | undefined;
  return () => {
    if (instance === undefined) instance = factory();
    return instance;
  };
}
