import { mdsvex } from 'mdsvex';
import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: { 
    experimental: {
      remoteFunctions: true
    },
    adapter: adapter() 
  },
	compilerOptions: {
		experimental: {
			async: true
		}
	},
	preprocess: [mdsvex()],
	extensions: ['.svelte', '.svx']
};

export default config;
