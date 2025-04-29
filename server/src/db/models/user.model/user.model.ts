import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import sequelize from '../../sequelize';

class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<string>;
  declare displayName: string;
  declare email: string;
  declare profileImageUrl?: CreationOptional<string>;
  declare role: 'admin' | 'user' | 'guest';
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Example of Association properties
  // declare stations?: Station[];

  // Example of BelongsToMany mixins for the relationship with Station
  // public getStations!: BelongsToManyGetAssociationsMixin<Station>;
  // public addStation!: BelongsToManyAddAssociationMixin<Station, string>;
  // public setStations!: BelongsToManySetAssociationsMixin<Station, string>;
  // public removeStation!: BelongsToManyRemoveAssociationMixin<Station, string>;

  // Example of HasMany mixin for the relationship with ListeningSession
  // public getListeningSessions!: HasManyGetAssociationsMixin<ListeningSession>;

  // Example of Static associations property (optional but helps TypeScript understand the relationships)
  // public static associations: {
  //   stations: Association<User, Station>;
  //   listeningSessions: Association<User, ListeningSession>;
  // };

  jwtRepr() {
    return {
      id: this.id.toString(),
      displayName: this.displayName,
      email: this.email,
      profileImageUrl: this.profileImageUrl,
      role: this.role,
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
    displayName: DataTypes.STRING,
    profileImageUrl: DataTypes.STRING,
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('admin', 'user', 'guest'),
      allowNull: false,
      defaultValue: 'user',
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'user',
  }
);

export default User;
