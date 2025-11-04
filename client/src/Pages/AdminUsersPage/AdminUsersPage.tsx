import { Box, Card, CardContent, Typography } from "@mui/material";
import "./AdminUsersPage.scss";

const AdminUsersPage = () => {
  return (
    <Box className="admin-users-page">
      <Typography variant="h4" className="admin-users-page__heading">
        Team members
      </Typography>
      <Typography variant="body1" className="admin-users-page__description">
        This page will list all users in the system once the Google sign-in flow
        is wired to the backend.
      </Typography>

      <Card className="admin-users-page__placeholder">
        <CardContent>
          <Typography variant="h6">Coming soon</Typography>
          <Typography variant="body2" color="text.secondary">
            Mirror the Playola admin user management experience here.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default AdminUsersPage;
