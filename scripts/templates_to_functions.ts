/**
 * 1. FuncId = templateId
 * 2. Template name = template name
 * 3. Recipients = ''
 * 4. Trigger = ''
 */
import { Connection, QueryError, RowDataPacket } from "mysql2";
import mysql_cli from "../config/mysql_cli";
import csvWriter from "../common/csvWriter";

type FunctionEmailsType = {
  uuid: string;
  name: string;
  recipients: string;
  trigger: string;
  status: number;
};

type RecordFunctionEmailsType = FunctionEmailsType & { success: boolean };

type SendgridEmailTemplatesType = {
  id: string;
  template_id: string;
  name: string;
  subject: string;
  status: number;
  create_date: Date;
  update_date: Date;
};



const getActiveEmailTemplates = async (connection: Connection ): Promise<SendgridEmailTemplatesType[]> => {
  return new Promise((resolve, reject) => {
    connection.query(`SELECT * FROM SENDGRID_EMAIL_TEMPLATES WHERE status = 1`, (err: QueryError, results: SendgridEmailTemplatesType[]) => {
      if (err) {
        reject(err);
      }
      resolve(results);
    })
  })
}

const writeFunctionEmails = async (connection: Connection, data: FunctionEmailsType[]) => {
  if (!data.length) {
    return;
  }

  const insertArr = data.map(({ uuid, name, trigger, recipients, status }) => {
    return `("${uuid}","${name}","${recipients}","${trigger}",${status})`;
  });

  return new Promise((resolve, reject) => {
    connection.query('INSERT INTO FUNCTION_EMAILS (`uuid`, `name`, `recipients`, `trigger`, `status`) VALUES ' + `${insertArr.join(",")}`,
      (err: QueryError, results: RowDataPacket[]) => {
      if (err) {
        reject(err);
      }
      resolve(results);
    })
  });
}

const writerRecordsToCsv = async (records: RecordFunctionEmailsType[], writer: any) => {
  return writer.writeRecords(records);
}

const getWriter = async () => {
  const path = "./exports/templates_to_functions.csv";
  const header: { id: string; title: string }[] = [
    { id: "uuid", title: "Func Id" },
    { id: "name", title: "Name" },
    { id: "recipients", title: "Recipients" },
    { id: "trigger", title: "Trigger" },
    { id: "status", title: "Status" },
    { id: "success", title: "Success" }
  ];
  return csvWriter.getObjectToCsvHandler({ path, header });
};

const main = async () => {
  const templates = await getActiveEmailTemplates(mysql_cli);
  const length = templates.length;
  console.log('active templates length = ', length);

  const writer = await getWriter();

  const functions: FunctionEmailsType[] = templates.map(({ template_id, name}) => ({ uuid: template_id, name: name, recipients: '', trigger: '', status: 1 }));

  const size = 10;

  const records: RecordFunctionEmailsType[] = [];
  for (let i = 0; i < Math.ceil(length / size); i++) {
    const chunk = functions.slice(i * size, (i + 1) * size);
    try {
      await writeFunctionEmails(mysql_cli, chunk);
      records.push(...chunk.map((i) => ({ ...i, success: true })));
    } catch (e) {
      console.log('---e', e);
      records.push(...chunk.map((i) => ({ ...i, success: false })))
    }
  }

  mysql_cli.destroy();

  await writerRecordsToCsv(records, writer);
}

main();