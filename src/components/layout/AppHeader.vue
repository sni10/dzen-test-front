<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <header class="border-b border-line bg-card">
    <div class="mx-auto flex h-14 max-w-4xl items-center px-4">
      <RouterLink to="/" class="text-lg font-bold text-ink hover:text-accent">Comments</RouterLink>
    </div>
  </header>
</template>
