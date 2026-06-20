import { sequelize, connectWithRetry } from "../config/db";
import { Article, initArticle } from "./article";
import { Comment, initComment } from "./comment";
import { Prompt, initPrompt } from "./prompt";
import { Conversation, initConversation } from "./conversation";
import { Message, initMessage } from "./message";

initArticle(sequelize);
initComment(sequelize);
initPrompt(sequelize);
initConversation(sequelize);
initMessage(sequelize);

// Связи: у статьи много комментариев.
Article.hasMany(Comment, { as: "comments", foreignKey: "articleId", onDelete: "CASCADE" });
Comment.belongsTo(Article, { as: "article", foreignKey: "articleId" });

// У чата много сообщений.
Conversation.hasMany(Message, { as: "messages", foreignKey: "conversationId", onDelete: "CASCADE" });
Message.belongsTo(Conversation, { as: "conversation", foreignKey: "conversationId" });

export { sequelize, connectWithRetry, Article, Comment, Prompt, Conversation, Message };
