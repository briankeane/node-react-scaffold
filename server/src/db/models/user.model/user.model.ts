import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "sequelize";
import sequelize from "../../sequelize";

class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<string>;
  declare firstName: string;
  declare lastName?: string;
  declare deepLink?: string;
  declare email: string;
  declare profileImageUrl?: string;
  declare role: CreationOptional<"admin" | "user" | "guest">;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare assetWorkflowRole?: { role?: string } | null;

  jwtRepr() {
    return {
      id: this.id.toString(),
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      profileImageUrl: this.profileImageUrl,
      role: this.role,
      deepLink: this.deepLink,
      assetWorkflowRole: this.assetWorkflowRole?.role,
    };
  }
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      autoIncrement: false,
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    lastName: DataTypes.STRING,
    deepLink: DataTypes.STRING,
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    profileImageUrl: DataTypes.STRING,
    role: {
      type: DataTypes.ENUM("admin", "user", "guest"),
      allowNull: false,
      defaultValue: "user",
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: "user",
  },
);

export default User;
