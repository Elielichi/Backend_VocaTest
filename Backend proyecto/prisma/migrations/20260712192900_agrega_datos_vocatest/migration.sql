/*
  Warnings:

  - You are about to drop the column `creadoEn` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "creadoEn",
ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "carreraRecomendada" TEXT,
ADD COLUMN     "ciudad" TEXT,
ADD COLUMN     "edad" INTEGER,
ADD COLUMN     "especialidad" TEXT,
ADD COLUMN     "gradoAcademico" TEXT,
ADD COLUMN     "sexo" TEXT,
ADD COLUMN     "telefono" TEXT,
ADD COLUMN     "tipoColegio" TEXT,
ADD COLUMN     "ultimoIngreso" TEXT;

-- CreateTable
CREATE TABLE "Universidad" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "ubicacion" TEXT,
    "costoMatricula" TEXT,
    "webOficial" TEXT,

    CONSTRAINT "Universidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Carrera" (
    "id" SERIAL NOT NULL,
    "universidad_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "facultad" TEXT,
    "duracion" TEXT,
    "creditos" INTEGER,
    "descripcion" TEXT,
    "planEstudios" TEXT,

    CONSTRAINT "Carrera_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Escala" (
    "id" SERIAL NOT NULL,
    "universidad_id" INTEGER NOT NULL,
    "escala" TEXT NOT NULL,
    "rango" TEXT,

    CONSTRAINT "Escala_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Logo" (
    "id" SERIAL NOT NULL,
    "universidad_id" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "Logo_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Carrera" ADD CONSTRAINT "Carrera_universidad_id_fkey" FOREIGN KEY ("universidad_id") REFERENCES "Universidad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escala" ADD CONSTRAINT "Escala_universidad_id_fkey" FOREIGN KEY ("universidad_id") REFERENCES "Universidad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Logo" ADD CONSTRAINT "Logo_universidad_id_fkey" FOREIGN KEY ("universidad_id") REFERENCES "Universidad"("id") ON DELETE CASCADE ON UPDATE CASCADE;
