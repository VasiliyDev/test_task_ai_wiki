import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
  type Sequelize,
} from "sequelize";

export type Variant = "raw" | "soft" | "rigid";
export type Side = Variant | "similar";
export interface CriterionVerdict {
  best: Side;
  note: string;
}
// Оценка трёх вариантов: ранжирование лучший→худший + критерии + галлюцinaции.
export interface Verification {
  ranking: Variant[];
  criteria?: Record<string, CriterionVerdict>;
  hallucinations: { side: string; claim: string }[];
  summary: string;
}

// Статья = запрос + три варианта (raw/soft/rigid) + оценка. На вики-странице показываем soft.
export class Article extends Model<InferAttributes<Article>, InferCreationAttributes<Article>> {
  declare id: CreationOptional<number>;
  declare slug: string;
  declare query: string;
  declare queryNorm: string;
  declare title: string;
  declare contentMarkdown: string; // SOFT — основной материал вики-страницы
  declare rawMarkdown: CreationOptional<string | null>; // без промта (голый запрос)
  declare rigidMarkdown: CreationOptional<string | null>; // жёсткая ветка
  declare category: CreationOptional<string | null>; // Товары / Люди
  declare verification: CreationOptional<Verification | null>;
  declare promptId: CreationOptional<number | null>; // версия soft-промта
  declare promptLabel: CreationOptional<string | null>;
  declare rigidLabel: CreationOptional<string | null>;
  declare model: CreationOptional<string | null>;
  declare status: CreationOptional<"published" | "draft">;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initArticle(sequelize: Sequelize): void {
  Article.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      slug: { type: DataTypes.STRING, allowNull: false, unique: true },
      query: { type: DataTypes.TEXT, allowNull: false },
      queryNorm: { type: DataTypes.STRING, allowNull: false, defaultValue: "" },
      title: { type: DataTypes.TEXT, allowNull: false },
      contentMarkdown: { type: DataTypes.TEXT, allowNull: false },
      rawMarkdown: { type: DataTypes.TEXT, allowNull: true },
      rigidMarkdown: { type: DataTypes.TEXT, allowNull: true },
      category: { type: DataTypes.STRING, allowNull: true },
      verification: { type: DataTypes.JSON, allowNull: true },
      promptId: { type: DataTypes.INTEGER, allowNull: true },
      promptLabel: { type: DataTypes.STRING, allowNull: true },
      rigidLabel: { type: DataTypes.STRING, allowNull: true },
      model: { type: DataTypes.STRING, allowNull: true },
      status: {
        type: DataTypes.ENUM("published", "draft"),
        allowNull: false,
        defaultValue: "published",
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    { sequelize, tableName: "articles", indexes: [{ fields: ["queryNorm"] }] }
  );
}
