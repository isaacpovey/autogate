export type Cell<T> = {
  get: () => T;
  set: (next: T) => void;
};

export const createCell =
  <T>() =>
  ({ initial }: { initial: T }): Cell<T> => {
    const holder = { value: initial };
    return {
      get: () => holder.value,
      set: (next: T) => {
        holder.value = next;
      },
    };
  };
