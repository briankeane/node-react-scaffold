import {
  Alert,
  AlertTitle,
  Box,
  createTheme,
  ThemeProvider,
} from "@mui/material";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { Provider } from "react-redux";
import { Outlet } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Navbar from "./Components/NavBar/NavBar";
import { store } from "./redux/store";
import "./App.scss";

const theme = createTheme({
  palette: {
    primary: {
      main: "#1C1C1E",
      light: "#2C2C2E",
      dark: "#000000",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#FF3B30",
      light: "#FF675D",
      dark: "#B2221D",
      contrastText: "#FFFFFF",
    },
    background: {
      default: "#121212",
      paper: "#1C1C1E",
    },
    text: {
      primary: "#FFFFFF",
      secondary: "#A1A1AA",
    },
  },
});

function App() {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  if (!googleClientId) {
    return (
      <ThemeProvider theme={theme}>
        <Box className="app app--config-error">
          <Alert
            severity="error"
            variant="filled"
            className="app__config-alert"
          >
            <AlertTitle>Missing Google OAuth configuration</AlertTitle>
            Add a `VITE_GOOGLE_CLIENT_ID` entry to your client environment file
            (for example, `client/.env.local`) and restart the dev server.
          </Alert>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          <div className="app">
            <Navbar />
            <main className="app__content">
              <Outlet />
            </main>
            <ToastContainer />
          </div>
        </ThemeProvider>
      </Provider>
    </GoogleOAuthProvider>
  );
}

export default App;
