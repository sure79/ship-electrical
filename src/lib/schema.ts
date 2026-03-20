import { sqliteTable, text } from "drizzle-orm/sqlite-core";

// 프로젝트 테이블
// 장비 데이터는 JSON 문자열로 통째로 저장 (단순, 실용적)
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  data: text("data").notNull(), // Project JSON 전체
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
