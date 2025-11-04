async function userHasPermissionToEditStation(
  _params: { userId: string; stationId: string },
): Promise<boolean> {
  return true;
}

export default {
  userHasPermissionToEditStation,
};
