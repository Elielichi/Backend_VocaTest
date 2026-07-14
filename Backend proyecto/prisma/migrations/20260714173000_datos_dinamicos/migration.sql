-- AlterTable
ALTER TABLE "User"
ADD COLUMN "notificacionesEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "recordatorios" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "perfilPublico" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "PreguntaTest" (
    "id" SERIAL NOT NULL,
    "orden" INTEGER NOT NULL,
    "pregunta" TEXT NOT NULL,
    "bloque" TEXT NOT NULL,
    "opciones" JSONB NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PreguntaTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AreaVocacional" (
    "codigo" TEXT NOT NULL,
    "carreraRecomendada" TEXT NOT NULL,

    CONSTRAINT "AreaVocacional_pkey" PRIMARY KEY ("codigo")
);

-- CreateIndex
CREATE UNIQUE INDEX "PreguntaTest_orden_key" ON "PreguntaTest"("orden");
