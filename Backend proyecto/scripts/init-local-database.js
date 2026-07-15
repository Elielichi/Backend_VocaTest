import { initializeLocalDatabase } from "../src/lib/local-sqlite-store.js";

const summary = initializeLocalDatabase();

console.log(
  `Base Prisma local lista: ${summary.users} usuarios, ` +
    `${summary.universities} universidades y ${summary.careers} carreras.`,
);

