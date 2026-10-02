// svelte.config.js
import adapter from '@sveltejs/adapter-node';

export default {
  compilerOptions: {
    runes: ({ filename }) =>
      filename.split(/[/\\]/).includes('node_modules') ? undefined : true
  },
  kit: { adapter: adapter() }
};