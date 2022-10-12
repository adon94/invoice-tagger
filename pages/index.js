import Head from 'next/head'
import { useEffect, useRef, useState } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { read, utils, write } from 'xlsx';
import JSZip from 'jzip';
import styles from '../styles/Home.module.css'

export default function Home() {
  const pdfFiles = useRef(null);
  const workbook = useRef(null);
  const [showDownload, setShowDownload] = useState(false);
  const [showMagic, setShowMagic] = useState(false);
  // useEffect(() => {
  //   fetch('/api/hello')
  //     .then((res) => res.json())
  //     .then((data) => {
  //       console.log(data);
  //     })
  // }, [])

  useEffect(() => {
    console.log(pdfFiles)
    console.log(workbook)
    if (pdfFiles.current && workbook.current) {
      setShowMagic(true);
    } else {
      setShowMagic(false);
    }
  }, [pdfFiles, workbook])

  function handleTagging() {
    if (workbook.current) {
      const wb = workbook.current;
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = utils.sheet_to_json(ws, { header:"A" });
      // console.log("data before:", data);

      data.forEach((row, index) => {
        if (row.I && typeof row.I === "string") {
          const searchFor = row.I.trim();
          pdfFiles.current.forEach((pdf, pdfIndex) => {
            if (searchFor === pdf.fileName.trim()
              || searchFor === pdf.fileName.trim().split(".pdf")[0]) {
                pdfFiles.current[pdfIndex].foundACell = true;
              data[index].J = pdf.id;
              // console.log(`Added ${pdf.id} to ${pdf.fileName} on cell J${index+1}`);
              // console.log(`${pdfIndex + 1} pdfs of ${pdfFiles.current.length} added to excel`)
            }
          })
        }        
      });
      let withoutCells = ""
      pdfFiles.current.forEach((pdf, i) => {
        if (!pdf.foundACell) withoutCells += `\n - ${pdf.fileName}`
      })
      if (withoutCells !== "") {
        alert(`The following invoices did not have a reference in the excel file: ${withoutCells}`)
      }
      const moddedSheet = utils.json_to_sheet(data);
      wb.Sheets[wb.SheetNames[0]] = moddedSheet;
      workbook.current = wb;
  
        // compressFiles();
      setShowDownload(true);
      setShowMagic(false);
    }
  }

  function handleExcel(e) {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      const bstr = event.target.result;
      workbook.current = read(bstr);

      if (pdfFiles.current) {
        setShowMagic(true);
      }
    }
    reader.readAsArrayBuffer(file);
  }

  function handlePdfs(e) {
    const fileArr = [];
    const files = e.currentTarget.files;
    const promise = new Promise((resolve) => {
      Object.keys(files).forEach(i => {
        const file = files[i];
        const reader = new FileReader();
        reader.onload = async (e) => {
          if (e.target.result) {
            const modified = await modifyPdf(e.target.result, i, file.name);
            // console.log(`labelled ${file.name} as ${modified.id}`)
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
      pdfFiles.current = fileArrResult;

      if (workbook.current) {
        setShowMagic(true);
      }
      // compressFiles(fileArrResult)
    });
  };

  async function modifyPdf(existingPdfBytes, i, fileName) {
    const pdfDoc = await PDFDocument.load(existingPdfBytes)
    const font = await pdfDoc.embedFont(StandardFonts.TimesRoman)
    const pages = pdfDoc.getPages()
    const firstPage = pages[0]
    const index = parseInt(i) + 1;
    const id = String(index).padStart(3, '0');
    const { height } = firstPage.getSize()
    const fontSize = 30
    firstPage.drawText(id, {
      font,
      x: 5 + fontSize,
      y: height - fontSize - 5,
      size: 25,
      color: rgb(0, 0, 0),
    });
    const pdfBytes = await pdfDoc.save()
    return {
      id,
      fileName,
      blob: new Blob([pdfBytes], { type: "application/pdf" }),
      binary: pdfBytes,
      foundACell: false,
    };
  }

  function download(blob, fileName) {
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
  }

  function compressFiles() {
    const zip = new JSZip();
    pdfFiles.current.forEach((file) => {
      // console.log("adding to zip files:", file.fileName)
      zip.folder("invoices").file(file.fileName, file.binary, { binary: true })
    });
    const wb = workbook.current;
    const excelFile = write(wb, { type: "binary" });
    // console.log("zipping excel file:", "expenses.xlsx")
    zip.file("expenses.xlsx", excelFile, { binary: true });
    download(zip.generate({type:"blob"}), "taggedInvoices.zip");
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>Invoice Tagger</title>
        <meta name="description" content="Assign IDs to PDFs" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <div className='input-container'>
          <label htmlFor="excel-upload">Excel:&nbsp;</label>
          <input onChange={handleExcel} type="file" id="excel-upload" name="excel-upload"
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" />
        </div>
        <div className='input-container'>
          <label htmlFor="file-upload">PDFs:&nbsp;</label>
          <input onChange={handlePdfs} type="file" id="file-upload" name="file-upload"
           multiple accept=".pdf" />
        </div>
        {showMagic && <div className='input-container'>
          <button onClick={handleTagging} className='magic-button'>Do magic</button>
        </div>}
        {showDownload && <div className='input-container'>
          <button onClick={compressFiles} className='magic-button dl'>Download Zip</button>
        </div>}
      </main>
      <style jsx>{`
        .input-container {
          margin-top: 30px;
        }
        .magic-button {
          background-color: blue;
          color: white;
          outline: none;
          border: 2px solid white;
          padding: 10px 15px;
          font-family: cursive;
          font-size: 36px;
          cursor: pointer;
        }
        .dl {
          background-color: green;
        }
      `}</style>
    </div>
  )
}
