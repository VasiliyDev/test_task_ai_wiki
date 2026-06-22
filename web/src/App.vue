<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
</script>

<template>
  <header class="site-header">
    <div class="bar">
      <RouterLink to="/" class="brand">AI-вики</RouterLink>
      <nav class="nav">
        <RouterLink to="/">Чат</RouterLink>
        <RouterLink to="/catalog">Каталог</RouterLink>
        <RouterLink to="/prompts">Промты</RouterLink>
        <RouterLink to="/analysis">Рецензия</RouterLink>
      </nav>
    </div>
  </header>
  <main class="container">
    <RouterView />
  </main>
</template>
