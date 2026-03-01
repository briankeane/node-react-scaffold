import { render } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { createTestStore, RootState } from "../redux/store";

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

interface WithProvidersOptions {
  preloadedState?: Partial<RootState>;
  route?: string;
}

export function withProviders(
  ui: React.ReactElement,
  { preloadedState, route = "/" }: WithProvidersOptions = {},
) {
  const store = createTestStore(preloadedState);
  return (
    <Provider store={store}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </Provider>
  );
}

export function renderWithProviders(
  ui: React.ReactElement,
  options: WithProvidersOptions = {},
) {
  return render(withProviders(ui, options));
}
