import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
  type ForeignKey,
  type Sequelize,
} from "sequelize";

// Сообщение в чате. Финальный текст ответа бота + ссылка на статью (промежуточный
// «ход мысли» не храним — он эфемерный).
export class Message extends Model<InferAttributes<Message>, InferCreationAttributes<Message>> {
  declare id: CreationOptional<number>;
  declare conversationId: ForeignKey<number>;
  declare sender: "me" | "bot";
  declare content: string;
  declare articleSlug: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initMessage(sequelize: Sequelize): void {
  Message.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      sender: { type: DataTypes.STRING, allowNull: false },
      content: { type: DataTypes.TEXT, allowNull: false },
      articleSlug: { type: DataTypes.STRING, allowNull: true },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    { sequelize, tableName: "messages" }
  );
}
