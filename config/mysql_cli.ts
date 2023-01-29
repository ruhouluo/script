import config from "./config";
const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: config?.MYSQL_HOST,
  user: config?.MYSQL_USER,
  password: config?.MYSQL_PWD,
  database: config?.MYSQL_DATABASE
});
export default connection;