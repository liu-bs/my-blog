function createLoader<T>(factory: () => Promise<T>) {
  let promise: Promise<T> | null = null;

  let resolved: T | null = null;

  return {
    load(): Promise<T> {
      promise ??= factory().then((value) => {
        resolved = value;
        return value;
      });
      return promise;
    },

    peek(): T | null {
      return resolved;
    },
  };
}

const authValidation = createLoader(() => import("@/shared/validation/auth"));

export const loadAuthValidation = authValidation.load;

export const peekAuthValidation = authValidation.peek;

const postValidation = createLoader(() => import("@/shared/validation/post"));

export const loadPostValidation = postValidation.load;

export const peekPostValidation = postValidation.peek;
