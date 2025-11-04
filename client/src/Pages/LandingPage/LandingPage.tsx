import { Box, Button, Card, CardContent, Typography } from "@mui/material";
import { useSelector } from "react-redux";
import { selectUser } from "../../redux/slices/authSlice/authSlice";
import "./LandingPage.scss";

const LandingPage = () => {
  const user = useSelector(selectUser);

  return (
    <Box className="landing-page">
      <Typography variant="h3" className="landing-page__heading">
        Welcome, {user?.firstName ?? "Playola Admin"}
      </Typography>
      <Typography variant="body1" className="landing-page__subheading">
        Manage stations, users, and content from a single console.
      </Typography>

      <Box className="landing-page__quick-actions">
        <Card>
          <CardContent>
            <Typography variant="h6">User Management</Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Review access, roles, and invitations for team members.
            </Typography>
            <Button variant="contained" color="secondary" href="/admin/users">
              View users
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6">Account</Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Update your profile and connected providers.
            </Typography>
            <Button variant="outlined" color="inherit" href="/account">
              Manage account
            </Button>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default LandingPage;
