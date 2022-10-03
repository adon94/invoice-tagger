import Head from 'next/head'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import JSZip from 'jzip';
import styles from '../styles/Home.module.css'

export default function Home() {
  function handleFiles(e) {
    const fileArr = [];
    const files = e.currentTarget.files;
    const promise = new Promise((resolve) => {
      Object.keys(files).forEach(i => {
        const file = files[i];
        const reader = new FileReader();
        reader.onload = async (e) => {
          if (e.target.result) {
            const modified = await modifyPdf(e.target.result, i);
            fileArr.push(modified);
            if (fileArr.length === files.length) {
              resolve(fileArr);
            }
          }
        }
        reader.readAsArrayBuffer(file)
      })
    })
    promise.then(function(fileArrResult){
      compressFiles(fileArrResult)
    });
  };

  async function modifyPdf(existingPdfBytes, i) {
    const pdfDoc = await PDFDocument.load(existingPdfBytes)
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.TimesRoman)
    const pages = pdfDoc.getPages()
    const firstPage = pages[0]
    const index = parseInt(i) + 1;
    const id = String(index).padStart(3, '0');
    const { height } = firstPage.getSize()
    const fontSize = 30
    firstPage.drawText(id, {
      x: 5 + fontSize,
      y: height - fontSize - 5,
      size: 25,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });
    const pdfBytes = await pdfDoc.save()
    return {
      id,
      blob: new Blob([pdfBytes], { type: "application/pdf" }),
      binary: pdfBytes,
    };
  }

  function download(blob, fileName) {
    var link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
  }

  function compressFiles(files) {
    const zip = new JSZip();
    files.forEach((file) => {
      zip.file(file.id + ".pdf", file.binary, {binary: true})
    });
    download(zip.generate({type:"blob"}), "taggedInvoices.zip")
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>Invoice Tagger</title>
        <meta name="description" content="Assign IDs to PDFs" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <div>
          <label htmlFor="file-upload" />
          <input onChange={handleFiles} type="file" id="file-upload" name="file-upload"
           multiple />
        </div>
      </main>
    </div>
  )
}
