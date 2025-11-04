import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import ProtectedRoute from "./ProtectedRoute";
import LoginPage from "../Pages/LoginPage/LoginPage";
import LandingPage from "../Pages/LandingPage/LandingPage";
import AdminUsersPage from "../Pages/AdminUsersPage/AdminUsersPage";
import UserDetailPage from "../Pages/UserDetailPage/UserDetailPage";
import AccountPage from "../Pages/AccountPage/AccountPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        path: "",
        element: (
          <ProtectedRoute>
            <LandingPage />
          </ProtectedRoute>
        ),
      },
      { path: "login", element: <LoginPage /> },
      {
        path: "dashboard",
        element: (
          <ProtectedRoute>
            <LandingPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin/users",
        element: (
          <ProtectedRoute>
            <AdminUsersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin/users/:userId",
        element: (
          <ProtectedRoute>
            <UserDetailPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "account",
        element: (
          <ProtectedRoute>
            <AccountPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
]);
