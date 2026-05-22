import withNuxt from "./.nuxt/eslint.config.mjs";

export default withNuxt({
  ignores: [".nuxt-dev/", ".output/"],
}, {
  files: ["components/ui/**/*.vue"],
  rules: {
    "vue/require-default-prop": "off",
  },
});
