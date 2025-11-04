import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "sequelize";
import sequelize from "../../sequelize";

class GoogleUser extends Model<
  InferAttributes<GoogleUser>,
  InferCreationAttributes<GoogleUser>
> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare googleUserId: string;
  declare accessToken: string;
  declare refreshToken: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

GoogleUser.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      autoIncrement: false,
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    userId: {
      type: DataTypes.UUID,
      references: {
        model: "users",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    googleUserId: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    accessToken: DataTypes.STRING,
    refreshToken: DataTypes.STRING(512),
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: "googleUser",
  },
);

export default GoogleUser;
