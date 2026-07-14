-- CreateTable
CREATE TABLE "Sala" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerradoEn" TIMESTAMP(3),
    "creadorId" INTEGER NOT NULL,

    CONSTRAINT "Sala_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResultadoSala" (
    "id" SERIAL NOT NULL,
    "salaId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "resultado" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResultadoSala_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sala_codigo_key" ON "Sala"("codigo");
CREATE INDEX "Sala_creadorId_idx" ON "Sala"("creadorId");
CREATE INDEX "Sala_activa_idx" ON "Sala"("activa");
CREATE UNIQUE INDEX "ResultadoSala_salaId_userId_key" ON "ResultadoSala"("salaId", "userId");
CREATE INDEX "ResultadoSala_salaId_idx" ON "ResultadoSala"("salaId");
CREATE INDEX "ResultadoSala_userId_idx" ON "ResultadoSala"("userId");

-- AddForeignKey
ALTER TABLE "Sala" ADD CONSTRAINT "Sala_creadorId_fkey" FOREIGN KEY ("creadorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResultadoSala" ADD CONSTRAINT "ResultadoSala_salaId_fkey" FOREIGN KEY ("salaId") REFERENCES "Sala"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResultadoSala" ADD CONSTRAINT "ResultadoSala_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
