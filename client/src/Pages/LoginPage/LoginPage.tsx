import { Google } from "@mui/icons-material";
import { Box, Button, Container, Grid, Paper, Typography } from "@mui/material";
import { useGoogleLogin, CodeResponse } from "@react-oauth/google";
import axios from "axios";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  loginWithToken,
  selectIsAuthenticated,
  selectUser,
} from "../../redux/slices/authSlice/authSlice";
import { AppDispatch } from "../../redux/store";
import "./LoginPage.scss";

const LoginPage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user = useSelector(selectUser);

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, user, navigate]);

  const loginViaGoogle = useGoogleLogin({
    onSuccess: async (credentials: CodeResponse) => {
      try {
        const response = await axios.post(
          `${import.meta.env.VITE_SERVER_BASE_URL}/v1/auth/google/signin`,
          { code: credentials.code },
        );
        await dispatch(loginWithToken(response.data.token));
      } catch (error) {
        console.error("Google Sign-In Error:", error);
      }
    },
    flow: "auth-code",
  });

  if (isAuthenticated) {
    return null;
  }

  return (
    <Box className="login-page">
      <Container maxWidth="sm">
        <Paper elevation={6} className="login-card">
          <Box className="login-brand">
            <Typography variant="h4" fontWeight="bold">
              Welcome back
            </Typography>
            <Typography variant="body1" color="rgba(255,255,255,0.7)">
              Sign in to access the Playola production console.
            </Typography>
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<Google />}
                onClick={() => loginViaGoogle()}
                className="login-button"
              >
                Sign in with Google
              </Button>
            </Grid>
          </Grid>
        </Paper>
      </Container>
    </Box>
  );
};

export default LoginPage;
