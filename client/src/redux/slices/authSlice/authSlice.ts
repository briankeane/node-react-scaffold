import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { toast } from "react-toastify";
import { UserProfile, UserRole } from "../../../Models/User";

export interface ConnectedProviders {
  google: boolean;
}

export interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  connectedProviders: ConnectedProviders | null;
  providerLoading: boolean;
}

interface AppJwtPayload {
  id: string;
  firstName: string;
  lastName?: string;
  email: string;
  role: UserRole;
  profileImageUrl?: string;
  iat?: number;
  exp?: number;
  sub?: string;
}

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  loading: false,
  error: null,
  connectedProviders: null,
  providerLoading: false,
};

const loadAuthState = (): Partial<AuthState> => {
  try {
    const token = localStorage.getItem("token");
    const userString = localStorage.getItem("user");

    if (token && userString) {
      const user = JSON.parse(userString) as UserProfile;
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      return {
        user,
        token,
        isAuthenticated: true,
      };
    }
  } catch (error) {
    console.error("Failed to load auth state from localStorage", error);
  }

  return {};
};

export const loginWithToken = createAsyncThunk(
  "auth/loginWithToken",
  async (token: string, { rejectWithValue }) => {
    try {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      localStorage.setItem("token", token);

      const decodedUser = jwtDecode<AppJwtPayload>(token);
      const user: UserProfile = {
        id: decodedUser.id,
        firstName: decodedUser.firstName,
        lastName: decodedUser.lastName,
        email: decodedUser.email,
        role: decodedUser.role,
        profileImageUrl: decodedUser.profileImageUrl,
      };

      localStorage.setItem("user", JSON.stringify(user));

      return { user, token };
    } catch (err: unknown) {
      const error = err as Error;
      return rejectWithValue(error.message || "Failed to login");
    }
  },
);

export const logout = createAsyncThunk(
  "auth/logout",
  async (_, { rejectWithValue }) => {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      delete axios.defaults.headers.common["Authorization"];
      return true;
    } catch (err: unknown) {
      const error = err as Error;
      return rejectWithValue(error.message || "Failed to logout");
    }
  },
);

const baseUrl = import.meta.env.VITE_SERVER_BASE_URL;

export const fetchConnectedProviders = createAsyncThunk(
  "auth/fetchConnectedProviders",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${baseUrl}/v1/auth/providers`);
      return response.data as ConnectedProviders;
    } catch (err: unknown) {
      const error = err as Error;
      return rejectWithValue(
        error.message || "Failed to fetch connected providers",
      );
    }
  },
);

const authSlice = createSlice({
  name: "auth",
  initialState: { ...initialState, ...loadAuthState() },
  reducers: {
    setAuth: (state, action: PayloadAction<Partial<AuthState>>) => ({
      ...state,
      ...action.payload,
    }),
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginWithToken.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginWithToken.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.loading = false;
        state.error = null;
        toast.success("Signed in successfully");
      })
      .addCase(loginWithToken.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        toast.error("Failed to sign in");
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.loading = false;
        state.error = null;
        state.connectedProviders = null;
      })
      .addCase(fetchConnectedProviders.pending, (state) => {
        state.providerLoading = true;
      })
      .addCase(fetchConnectedProviders.fulfilled, (state, action) => {
        state.connectedProviders = action.payload;
        state.providerLoading = false;
      })
      .addCase(fetchConnectedProviders.rejected, (state) => {
        state.providerLoading = false;
      });
  },
});

export const { setAuth } = authSlice.actions;

export const selectAuth = (state: { auth: AuthState }) => state.auth;
export const selectUser = (state: { auth: AuthState }) => state.auth.user;
export const selectIsAuthenticated = (state: { auth: AuthState }) =>
  state.auth.isAuthenticated;
export const selectAuthLoading = (state: { auth: AuthState }) =>
  state.auth.loading;
export const selectConnectedProviders = (state: { auth: AuthState }) =>
  state.auth.connectedProviders;
export const selectProviderLoading = (state: { auth: AuthState }) =>
  state.auth.providerLoading;

export default authSlice.reducer;
