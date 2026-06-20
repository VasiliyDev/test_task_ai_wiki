import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
  type ForeignKey,
  type Sequelize,
} from "sequelize";

// Комментарий к статье. В целевом пайплайне комментарии могут дополнять/менять статью —
// пока храним их и показываем; обработка (обогащение статьи) — следующий шаг.
export class Comment extends Model<InferAttributes<Comment>, InferCreationAttributes<Comment>> {
  declare id: CreationOptional<number>;
  declare author: CreationOptional<string>;
  declare body: string;
  declare articleId: ForeignKey<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initComment(sequelize: Sequelize): void {
  Comment.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      author: { type: DataTypes.STRING, allowNull: false, defaultValue: "Аноним" },
      body: { type: DataTypes.TEXT, allowNull: false },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    { sequelize, tableName: "comments" }
  );
}
