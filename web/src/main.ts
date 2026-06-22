import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import { VueQueryPlugin } from "@tanstack/vue-query";
import App from "@/App.vue";
import Chat from "@/views/Chat.vue";
import Catalog from "@/views/Catalog.vue";
import Prompts from "@/views/Prompts.vue";
import Analysis from "@/views/Analysis.vue";
import Article from "@/views/Article.vue";
import "@/style.css";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "chat", component: Chat },
    { path: "/catalog", name: "catalog", component: Catalog },
    { path: "/prompts", name: "prompts", component: Prompts },
    { path: "/analysis", name: "analysis", component: Analysis },
    { path: "/a/:slug", name: "article", component: Article, props: true },
  ],
});

createApp(App)
  .use(router)
  .use(VueQueryPlugin, {
    queryClientConfig: {
      defaultOptions: {
        queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
      },
    },
  })
  .mount("#app");
