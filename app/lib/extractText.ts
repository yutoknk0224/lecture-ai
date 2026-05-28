import fs from 'fs'
import pdfParse from 'pdf-parse'

export async function extractTextFromFile(
  filePath: string,
  fileType: string
): Promise<string> {
  const buffer = fs.readFileSync(filePath)

  if (fileType === 'application/pdf' || filePath.endsWith('.pdf')) {
    const data = await pdfParse(buffer)
    return data.text
  }

  if (
    fileType === 'text/plain' ||
    filePath.endsWith('.txt') ||
    filePath.endsWith('.md')
  ) {
    return buffer.toString('utf-8')
  }

  return ''
}
