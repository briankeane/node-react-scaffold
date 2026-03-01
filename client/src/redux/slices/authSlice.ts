import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "../store";
import { UserProfile } from "../../models/User";

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  loading: boolean;
}

const storedToken = localStorage.getItem("token");
const storedUser = localStorage.getItem("user");

const initialState: AuthState = {
  token: storedToken,
  user: storedUser ? JSON.parse(storedUser) : null,
  isAuthenticated: !!storedToken,
  loading: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    login(state, action: PayloadAction<{ token: string; user: UserProfile }>) {
      state.token = action.payload.token;
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.loading = false;
      localStorage.setItem("token", action.payload.token);
      localStorage.setItem("user", JSON.stringify(action.payload.user));
    },
    logout(state) {
      state.token = null;
      state.user = null;
      state.isAuthenticated = false;
      state.loading = false;
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    },
  },
});

export const { login, logout } = authSlice.actions;

export const selectUser = (state: RootState) => state.auth.user;
export const selectIsAuthenticated = (state: RootState) =>
  state.auth.isAuthenticated;
export const selectAuthLoading = (state: RootState) => state.auth.loading;

export default authSlice.reducer;
