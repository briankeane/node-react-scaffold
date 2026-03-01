import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { withProviders } from '../test/testHelpers';
import ProtectedRoute from './ProtectedRoute';
import { Route, Routes } from 'react-router-dom';

function TestDashboard() {
  return <div>Dashboard Content</div>;
}

function TestLogin() {
  return <div>Login Page</div>;
}

describe('ProtectedRoute', () => {
  it('redirects to login when not authenticated', () => {
    withProviders(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<TestDashboard />} />
        </Route>
        <Route path="/login" element={<TestLogin />} />
      </Routes>,
      {
        route: '/dashboard',
        preloadedState: {
          auth: {
            token: null,
            user: null,
            isAuthenticated: false,
            loading: false,
          },
        },
      }
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('renders child routes when authenticated', () => {
    withProviders(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<TestDashboard />} />
        </Route>
        <Route path="/login" element={<TestLogin />} />
      </Routes>,
      {
        route: '/dashboard',
        preloadedState: {
          auth: {
            token: 'test-token',
            user: {
              id: '1',
              displayName: 'Test User',
              email: 'test@example.com',
              role: 'user',
            },
            isAuthenticated: true,
            loading: false,
          },
        },
      }
    );

    expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
  });
});
