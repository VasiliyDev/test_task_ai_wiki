import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
  type Sequelize,
} from "sequelize";

export type PromptKind = "generate" | "baseline" | "classify" | "verify" | "analyze";
// active — боевая версия (одна на вид); test — тест-прогонная; inactive — просто висит.
export type PromptStatus = "active" | "test" | "inactive";

export class Prompt extends Model<InferAttributes<Prompt>, InferCreationAttributes<Prompt>> {
  declare id: CreationOptional<number>;
  declare kind: PromptKind;
  declare label: string; // метка версии, напр. "v1", "v8", "geo-test"
  declare status: CreationOptional<PromptStatus>;
  declare body: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initPrompt(sequelize: Sequelize): void {
  Prompt.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      kind: { type: DataTypes.STRING, allowNull: false },
      label: { type: DataTypes.STRING, allowNull: false, defaultValue: "v1" },
      status: {
        type: DataTypes.ENUM("active", "test", "inactive"),
        allowNull: false,
        defaultValue: "inactive",
      },
      body: { type: DataTypes.TEXT, allowNull: false },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    { sequelize, tableName: "prompts", indexes: [{ fields: ["kind", "status"] }] }
  );
}
