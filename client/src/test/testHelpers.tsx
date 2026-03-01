import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { createTestStore, RootState } from '../redux/store';

export class PromiseResolver {
  reject!: (value: unknown) => void;
  resolve!: (value: unknown) => void;
  promise: Promise<unknown>;

  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

export function withProviders(
  ui: ReactElement,
  {
    preloadedState,
    route = '/',
    ...renderOptions
  }: {
    preloadedState?: Partial<RootState>;
    route?: string;
  } & Omit<RenderOptions, 'wrapper'> = {}
) {
  const store = createTestStore(preloadedState);

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <Provider store={store}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </Provider>
    );
  }

  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}
