export class PromiseResolver<T = unknown> {
  reject!: (value: T) => void;
  resolve!: (value: T) => void;
  promise: Promise<T>;

  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}
