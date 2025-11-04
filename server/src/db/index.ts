import sequelize from "./sequelize";
import User from "./models/user.model";
import GoogleUser from "./models/googleUser.model";

User.hasOne(GoogleUser, {
  foreignKey: "userId",
  as: "googleProfile",
});

GoogleUser.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

const models = {
  User,
  GoogleUser,
};

export { models, sequelize };

const dbExports = { sequelize, db: sequelize, models };
export default dbExports;
export const db = sequelize;

if (typeof module !== "undefined") {
  module.exports = dbExports;
  module.exports.default = dbExports;
}
