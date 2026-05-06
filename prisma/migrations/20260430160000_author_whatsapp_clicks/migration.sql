-- CreateTable
CREATE TABLE "AuthorWhatsappClick" (
    "id" SERIAL NOT NULL,
    "authorId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthorWhatsappClick_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AuthorWhatsappClick" ADD CONSTRAINT "AuthorWhatsappClick_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON DELETE CASCADE ON UPDATE CASCADE;
