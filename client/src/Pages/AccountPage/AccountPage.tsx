import { Box, Card, CardContent, Typography } from "@mui/material";
import { useSelector } from "react-redux";
import { selectUser } from "../../redux/slices/authSlice/authSlice";
import "./AccountPage.scss";

const AccountPage = () => {
  const user = useSelector(selectUser);

  return (
    <Box className="account-page">
      <Typography variant="h4" className="account-page__heading">
        Account settings
      </Typography>
      <Typography variant="body1" className="account-page__description">
        Manage your personal information and connected providers.
      </Typography>

      <Card className="account-page__card">
        <CardContent>
          <Typography variant="h6">Profile</Typography>
          <Typography variant="body2" color="text.secondary">
            {user
              ? `${user.firstName} ${user.lastName ?? ""} (${user.email})`
              : "Sign in to view your profile details."}
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default AccountPage;
