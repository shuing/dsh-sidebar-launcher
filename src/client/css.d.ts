/**
 * The stylesheet import contract.
 *
 * The build inlines a plain `*.css` import as text and injects it as a
 * `<style data-plugin>` tag when the client factory runs, so the import is made
 * for that side effect. Class names are literal and plugin-prefixed (see
 * `launcher.css`), so no class-map type is needed.
 */
declare module '*.css' {
  const text: string
  export default text
}
