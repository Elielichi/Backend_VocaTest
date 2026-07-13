-- CreateTable
CREATE TABLE "UniversidadUser" (
    "userId" INTEGER NOT NULL,
    "universidadId" INTEGER NOT NULL,
    "fechaAgregado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UniversidadUser_pkey" PRIMARY KEY ("userId","universidadId")
);

-- AddForeignKey
ALTER TABLE "UniversidadUser" ADD CONSTRAINT "UniversidadUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UniversidadUser" ADD CONSTRAINT "UniversidadUser_universidadId_fkey" FOREIGN KEY ("universidadId") REFERENCES "Universidad"("id") ON DELETE CASCADE ON UPDATE CASCADE;
