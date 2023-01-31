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

type FunctionEmailTemplatesType = {
  func_id: string;
  template_id: string;
  status: number;
};

type RecordFunctionEmailTemplatesType = FunctionEmailTemplatesType & { success: boolean };



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

const writeFunctionEmailWithTemplates = async (connection: Connection, data: FunctionEmailTemplatesType[]) => {
  if (!data.length) {
    return;
  }

  const insertArr = data.map(({ func_id, template_id, status}) => {
    return `("${func_id}","${template_id}",${status})`;
  });

  return new Promise((resolve, reject) => {
    connection.query('INSERT INTO FUNCTION_EMAIL_TEMPLATES (`func_id`, `template_id`, `status`) VALUES ' + `${insertArr.join(",")}`,
      (err: QueryError, results: RowDataPacket[]) => {
        if (err) {
          reject(err);
        }
        resolve(results);
      })
  });
}

const writerRecordsToCsv = async (records: (RecordFunctionEmailsType | RecordFunctionEmailTemplatesType)[], writer: any) => {
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

const getFunctionWithTemplatesWriter = async () => {
  const path = "./exports/functions_templates_relation.csv";
  const header: { id: string; title: string }[] = [
    { id: "func_id", title: "Func Id" },
    { id: "template_id", title: "Template Id" },
    { id: "status", title: "Status" },
    { id: "success", title: "Success" }
  ];
  return csvWriter.getObjectToCsvHandler({ path, header });
};

const main = async () => {
  const records: RecordFunctionEmailsType[] = [];
  const recordsFunctionWithTemplates: RecordFunctionEmailTemplatesType[] = [];
  const writer = await getWriter();
  const functionWithTemplatesWriter = await getFunctionWithTemplatesWriter();

  try {
    const templates = await getActiveEmailTemplates(mysql_cli);
    const length = templates.length;
    console.log('active templates length = ', length);

    const functions: FunctionEmailsType[] = templates.map(({ template_id, name}) => ({ uuid: template_id, name: name, recipients: '', trigger: '', status: 1 }));

    const size = 50;


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

    const functionWithTemplates = templates.map(({ template_id }) => ({ func_id: template_id, template_id, status: 1 }));

    for (let i = 0; i < Math.ceil(length / size); i++) {
      const chunk = functionWithTemplates.slice(i * size, (i + 1) * size);
      try {
        await writeFunctionEmailWithTemplates(mysql_cli, chunk);
        recordsFunctionWithTemplates.push(...chunk.map((i) => ({ ...i, success: true })));
      } catch (e) {
        console.log('---e', e);
        recordsFunctionWithTemplates.push(...chunk.map((i) => ({ ...i, success: false })))
      }
    }
  } finally {
    mysql_cli.destroy();
  }


  await writerRecordsToCsv(records, writer);
  await writerRecordsToCsv(recordsFunctionWithTemplates, functionWithTemplatesWriter);
}

main();