import csvWriter from "../common/csvWriter";
import mysql_cli from "../config/mysql_cli";
import { Connection, QueryError, RowDataPacket } from "mysql2";

interface MemberSchema {
  team_member_id: string;
  team_member_team_id: string;
  team_member_email: string;
  team_member_status: number;
  team_member_create_date: Date;
}

type SimpleMember = Pick<MemberSchema, "team_member_id" | "team_member_team_id" | "team_member_email">;

const getDuplicateMembersGroupByTeamIdAndEmail = async (connection: Connection) => {
  return new Promise((resolve, reject) => {
    connection.query(`
    SELECT team_member_id, team_member_team_id, team_member_email, COUNT(*) AS count FROM TEAM_MEMBER
    GROUP BY team_member_team_id, team_member_email
    HAVING count > 1`, (err: QueryError, results: RowDataPacket[]) => {
      if (err) {
        reject(err);
      }
      resolve(results);
    });
  })
};

const getRemoveDuplicateMembers = async (connection: Connection, member: SimpleMember) => {
  const { team_member_id, team_member_email, team_member_team_id } = member;
  return new Promise((resolve, reject) => {
    connection.query(`
    SELECT team_member_id, team_member_team_id, team_member_email, team_member_status, team_member_create_date FROM TEAM_MEMBER
    WHERE team_member_team_id ='${team_member_team_id}' AND team_member_email ='${team_member_email}' AND team_member_id !='${team_member_id}'
  `, (err: QueryError, results: RowDataPacket[]) => {
      if (err) {
        reject(err);
      }
      resolve(results);
    })
  });
};

const removeDuplicateMembers = async (connection: Connection, teamMemberIds: string[]) => {
  console.log('ids', teamMemberIds);
  const ids = teamMemberIds.map((id: string) => {
    return `"${id}"`;
  });

  return new Promise((resolve, reject) => {
    connection.query(
      `DELETE FROM TEAM_MEMBER WHERE team_member_id IN (${ids.join(',')})`,
      (err: QueryError, results: RowDataPacket[]) => {
        if (err) {
          reject(err);
        }
        resolve(results);
      });
  })
}

const writerMemberToCsv = async (members: MemberSchema[], writer: any) => {
  return writer.writeRecords(members);
}

const getWriter = async () => {
  const path = "../exports/removeDuplicateMember.csv";
  const header: { id: string; title: string }[] = [
    { id: "team_member_id", title: "team_member_id" },
    { id: "team_member_team_id", title: "team_member_team_id" },
    { id: "team_member_email", title: "team_member_email" },
    { id: "team_member_status", title: "team_member_status" },
    { id: "team_member_create_date", title: "team_member_create_date" },
  ];
  return csvWriter.getObjectToCsvHandler({ path, header });
};

const removeMembers = async (connection: Connection, members: MemberSchema[]) => {
  const chunkSize = 10;
  for (let i = 0; i < members.length; i += chunkSize) {
    const chunk = members.slice(i, i + chunkSize);
    const teamMemberIds = chunk.map((m: MemberSchema) => m.team_member_id);
    // do whatever
    try {
      await removeDuplicateMembers(connection, teamMemberIds);
    } catch (e: any) {
      console.log('teamMemberIds', teamMemberIds, e);
    }
  }
}

const main = async () => {
  const writer = await getWriter();

  const groupByMembers = await getDuplicateMembersGroupByTeamIdAndEmail(mysql_cli) as SimpleMember[];
  // @ts-ignore
  const list: MemberSchema[][] = await Promise.all(groupByMembers.map(async (member) => {
    try {
      return await getRemoveDuplicateMembers(mysql_cli, member)
    } catch (e: any) {
      return [];
    }
  }));

  console.log("list length: ", list.length);

  const members: MemberSchema[] = list.reduce((f: MemberSchema[], m: MemberSchema[]) => {
    return f.concat(m);
  }, []);

  console.log('members length:', members.length);

  await writerMemberToCsv(members, writer);

  await removeMembers(mysql_cli, members);

  mysql_cli.destroy();
};

main();
