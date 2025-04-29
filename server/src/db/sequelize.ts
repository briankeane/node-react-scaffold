import { Sequelize } from 'sequelize';
import config from '../config';
import DBConfig from './config';

const dbConfigForThisEnv = DBConfig[config.NODE_ENV];

// Extract the URL and remove it from the options to avoid duplicate URL in constructor
const { url, ...otherOptions } = dbConfigForThisEnv;

// Create sequelize with fixed typing
// @ts-expect-error- Sequelize constructor type is more restrictive than actual usage
const sequelize = new Sequelize(url, {
  ...otherOptions,
  // // @ts-ignore - logger is not in the Options type but works at runtime
  // logger: logger.log,
});

// For ES Module import
export default sequelize;

module.exports = sequelize;
