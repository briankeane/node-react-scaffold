export interface UserStationPermissionInput {
  userId: string;
  stationId: string;
}

export function userHasPermissionToEditStation(
  params: UserStationPermissionInput,
): boolean {
  void params;
  return true;
}

export default {
  userHasPermissionToEditStation,
};
