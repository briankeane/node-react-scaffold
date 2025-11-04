import { Box, Card, CardContent, Typography } from "@mui/material";
import { useParams } from "react-router-dom";
import "./UserDetailPage.scss";

const UserDetailPage = () => {
  const { userId } = useParams();

  return (
    <Box className="user-detail-page">
      <Typography variant="h4" className="user-detail-page__heading">
        User detail
      </Typography>
      <Typography variant="body1" className="user-detail-page__description">
        Detailed information for user <strong>{userId}</strong> will appear
        here once the API integration is complete.
      </Typography>

      <Card className="user-detail-page__placeholder">
        <CardContent>
          <Typography variant="h6">User profile</Typography>
          <Typography variant="body2" color="text.secondary">
            Display personal information, connected providers, and admin tools
            here, mirroring the Playola client.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default UserDetailPage;
