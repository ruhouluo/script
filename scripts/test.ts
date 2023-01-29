import { getConnection } from "typeorm";
import mysql_cli from "../config/mysql_cli";
import validator, { Joi } from "koa-context-validator";

validator({
  query: '',
})

mysql_cli.then(async (con) => {
  const res = await getConnection().manager.query("show tables;")
  console.log('res', res);
  con.close();
})
  .catch((e) => console.log(e))
  .finally(()=> {});

