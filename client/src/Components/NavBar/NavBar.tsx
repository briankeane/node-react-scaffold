import {
  AppBar,
  Avatar,
  Box,
  Button,
  Toolbar,
  Typography,
} from "@mui/material";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  logout,
  selectIsAuthenticated,
  selectUser,
} from "../../redux/slices/authSlice/authSlice";
import { AppDispatch } from "../../redux/store";
import "./NavBar.scss";

const Navbar = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user = useSelector(selectUser);

  const handleLogout = async () => {
    await dispatch(logout());
    navigate("/login");
  };

  return (
    <AppBar position="static" color="transparent" elevation={0} className="navbar">
      <Toolbar className="navbar__toolbar">
        <Typography
          variant="h6"
          component={RouterLink}
          to="/"
          className="navbar__brand"
        >
          Playola Production
        </Typography>

        {isAuthenticated ? (
          <Box className="navbar__actions">
            <Button component={RouterLink} to="/dashboard" color="inherit">
              Dashboard
            </Button>
            <Button component={RouterLink} to="/admin/users" color="inherit">
              Users
            </Button>
            <Button component={RouterLink} to="/account" color="inherit">
              Account
            </Button>
            <Box className="navbar__profile">
              <Avatar
                src={user?.profileImageUrl}
                alt={user?.firstName}
                sx={{ width: 32, height: 32 }}
              >
                {user?.firstName?.[0]}
              </Avatar>
              <Typography variant="body2" className="navbar__username">
                {user?.firstName}
              </Typography>
            </Box>
            <Button variant="outlined" color="inherit" onClick={handleLogout}>
              Sign Out
            </Button>
          </Box>
        ) : (
          <Button
            component={RouterLink}
            to="/login"
            variant="outlined"
            color="inherit"
          >
            Sign In
          </Button>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
