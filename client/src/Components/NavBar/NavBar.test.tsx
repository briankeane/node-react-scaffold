import { render, screen } from "@testing-library/react";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import NavBar from "./NavBar";
import authReducer from "../../redux/slices/authSlice/authSlice";
import type { AuthState } from "../../redux/slices/authSlice/authSlice";
import type { UserProfile } from "../../Models/User";

type PartialAuthState = Pick<
  AuthState,
  | "user"
  | "token"
  | "isAuthenticated"
  | "loading"
  | "error"
  | "connectedProviders"
  | "providerLoading"
>;

const baseAuthState: PartialAuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  loading: false,
  error: null,
  connectedProviders: null,
  providerLoading: false,
};

function renderWithAuthState(state: PartialAuthState) {
  const store = configureStore({
    reducer: { auth: authReducer },
    preloadedState: { auth: state },
  });

  return render(
    <Provider store={store}>
      <MemoryRouter>
        <NavBar />
      </MemoryRouter>
    </Provider>,
  );
}

describe("NavBar", () => {
  it("shows a sign in link when the user is not authenticated", () => {
    renderWithAuthState(baseAuthState);

    expect(
      screen.getByRole("link", {
        name: /sign in/i,
      }),
    ).toBeInTheDocument();
  });

  it("renders navigation links and profile details when authenticated", () => {
    const user: UserProfile = {
      id: "user-123",
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      role: "admin",
      profileImageUrl: undefined,
    };

    renderWithAuthState({
      ...baseAuthState,
      isAuthenticated: true,
      user,
      token: "token-123",
    });

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Users")).toBeInTheDocument();
    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(screen.getByText("Jane")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /sign out/i,
      }),
    ).toBeInTheDocument();
  });
});
