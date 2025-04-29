export class PromiseResolver {
  reject!: (value: any) => void;
  resolve!: (value: any) => void;
  promise: Promise<any>;

  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}
