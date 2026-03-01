import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { withProviders } from "../test/testHelpers";

describe("ProtectedRoute", () => {
  it("redirects to /login when unauthenticated", () => {
    render(
      withProviders(<div>should not see this</div>, {
        preloadedState: {
          auth: {
            token: null,
            user: null,
            isAuthenticated: false,
            loading: false,
          },
        },
        route: "/dashboard",
      }),
    );

    expect(screen.queryByText("should not see this")).toBeNull();
  });

  it("renders child when authenticated", () => {
    render(
      withProviders(<div>Dashboard Content</div>, {
        preloadedState: {
          auth: {
            token: "test-token",
            user: {
              id: "1",
              displayName: "Test",
              email: "test@test.com",
              role: "user",
            },
            isAuthenticated: true,
            loading: false,
          },
        },
        route: "/dashboard",
      }),
    );

    expect(screen.getByText("Dashboard")).toBeTruthy();
  });
});
