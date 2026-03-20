import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";

function createDb() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error(
      "TURSO_DATABASE_URL 환경변수가 설정되지 않았습니다.\n" +
        ".env.local 파일을 만들고 .env.local.example을 참고해 설정하세요."
    );
  }

  const client = createClient({ url, authToken });
  return drizzle(client);
}

export const db = createDb();
