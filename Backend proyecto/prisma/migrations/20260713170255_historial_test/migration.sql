-- CreateTable
CREATE TABLE "HistorialTest" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "resultado" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistorialTest_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "HistorialTest" ADD CONSTRAINT "HistorialTest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
