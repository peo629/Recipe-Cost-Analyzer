// Re-export the generated Zod schemas. Static TypeScript types live in
// `./generated/types` but are intentionally NOT re-exported from the
// barrel because several names (e.g. SignupBody, LoginBody) clash with
// the Zod schema constants of the same name. Consumers that need a
// static type should derive it from the schema with `z.infer<typeof X>`
// or import from `@workspace/api-zod/types` directly.
export * from "./generated/api";
