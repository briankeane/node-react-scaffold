import sequelize from "./sequelize";
import User from "./models/user.model";

export const models = { User };
export { sequelize };
export default { sequelize, models };
