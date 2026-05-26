-- CreateTable
CREATE TABLE "ExcelTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TemplateCellMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "cellAddress" TEXT NOT NULL,
    CONSTRAINT "TemplateCellMapping_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ExcelTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
