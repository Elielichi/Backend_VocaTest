import { areasVocacionales, preguntasTest } from "./data/test-config.js";
import { closeDatabase, prisma } from "./src/lib/prisma.js";

async function seed() {
  for (const area of areasVocacionales) {
    await prisma.areaVocacional.upsert({
      where: { codigo: area.codigo },
      update: { carreraRecomendada: area.carreraRecomendada },
      create: area,
    });
  }

  for (const pregunta of preguntasTest) {
    const data = {
      pregunta: pregunta.pregunta,
      bloque: pregunta.bloque,
      opciones: pregunta.opciones,
      activa: true,
    };

    await prisma.preguntaTest.upsert({
      where: { orden: pregunta.id },
      update: data,
      create: { orden: pregunta.id, ...data },
    });
  }

  console.log(
    `Test inicializado: ${preguntasTest.length} preguntas y ${areasVocacionales.length} áreas.`,
  );
}

seed()
  .catch((error) => {
    console.error("No se pudo inicializar el test:", error);
    process.exitCode = 1;
  })
  .finally(closeDatabase);
