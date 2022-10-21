import Head from 'next/head'
import { useRef, useState } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { read, utils, write } from 'xlsx';
import JSZip from 'jzip';
import styles from '../styles/Home.module.css'

export default function Home() {
  const pdfFiles = useRef(null);
  const workbook = useRef(null);
  const [showDownload, setShowDownload] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [starting, setStarting] = useState(1);

  function markExcel(modifiedPdfs) {
    if (workbook.current && modifiedPdfs?.length > 0) {
      const wb = workbook.current;
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = utils.sheet_to_json(ws, { header: "A" });
      // console.log("data before:", data);
      console.log(data)
      data.forEach((row, index) => {
        if (row.I && typeof row.I === "string") {
          const searchFor = row.I.trim();
          modifiedPdfs.forEach((pdf, pdfIndex) => {
            if (searchFor === pdf.name.trim()
              || searchFor === pdf.name.trim().split(".pdf")[0]) {
                modifiedPdfs[pdfIndex].foundACell = true;
              data[index].J = pdf.id;
              // console.log(`Added ${pdf.id} to ${pdf.name} on cell J${index+1}`);
              // console.log(`${pdfIndex + 1} pdfs of ${pdfFiles.current.length} added to excel`)
            }
          })
        }        
      });
      let withoutCells = ""
      modifiedPdfs.forEach((pdf, i) => {
        if (!pdf.foundACell) withoutCells += `\n - ${pdf.name}`
      })
      if (withoutCells !== "") {
        alert(`The following invoices did not have a reference in the excel file: ${withoutCells}`)
      }
      const moddedSheet = utils.json_to_sheet(data);
      wb.Sheets[wb.SheetNames[0]] = moddedSheet;
      workbook.current = wb;
      // compressFiles();
      // setShowDownload(true);
      // setShowMagic(false);
    } else {
      alert("Something went wrong");
    }
  }

  async function modifyPdf({ arrayBuffer, file: { name } }, idNum) {
    const pdfDoc = await PDFDocument.load(arrayBuffer)
    const font = await pdfDoc.embedFont(StandardFonts.TimesRoman)
    const pages = pdfDoc.getPages()
    const firstPage = pages[0]
    // const index = 73; // parseInt(i) + 1;
    const id = String(idNum).padStart(3, '0');
    const { height } = firstPage.getSize()
    const fontSize = 30
    firstPage.drawText(id, {
      font,
      x: 0,
      y: height - fontSize,
      size: 25,
      color: rgb(0, 0, 0),
    });
    const pdfBytes = await pdfDoc.save()
    return {
      id,
      name,
      blob: new Blob([pdfBytes], { type: "application/pdf" }),
      binary: pdfBytes,
      foundACell: false,
    };
  }

  function download(blob) {
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = "taggedInvoices.zip";
    link.click();
  }

  function compressFiles(pdfArray) {
    const zip = new JSZip();
    pdfArray.forEach((file) => {
      // console.log("adding to zip files:", file.name)
      zip.folder("invoices").file(file.name, file.binary, { binary: true })
    });
    const wb = workbook.current;
    if (wb) {
      const excelFile = write(wb, { type: "binary" });
      // console.log("zipping excel file:", "expenses.xlsx")
      zip.file("expenses.xlsx", excelFile, { binary: true });
    }
    setShowLoading(false);
    download(zip.generate({type:"blob"}));
  }

  function handleExcel(e) {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      const bstr = event.target.result;
      workbook.current = read(bstr);
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
            console.log(file)
            fileArr.push({ arrayBuffer: e.target.result, file });
            if (fileArr.length === files.length) {
              resolve(fileArr);
            }
          }
        }
        reader.readAsArrayBuffer(file)
      })
    })
    promise.then(function(fileArrResult){
      const sorted = fileArrResult.sort((a, b) => {
        if (a.file.lastModified < b.file.lastModified) {
          return -1;
        }
        if (a.file.lastModified > b.file.lastModified) {
          return 1;
        }
        return 0;
      })
      pdfFiles.current = sorted;
      setShowDownload(true);
    });
  };
  
  function handleNum(e) {
    if (e.target.value) {
      setStarting(e.target.value);
    }
  }

  async function handleDownload() {
    setShowLoading(true);
    const modifiedPdfs = []
    if (pdfFiles.current) {
      await Promise.all(pdfFiles.current.map(async (currentPdf, index) => {
        const modifiedPdf = await modifyPdf(currentPdf, index + starting);
        modifiedPdfs.push(modifiedPdf);
      }));
    }

    if (workbook.current) {
      markExcel(modifiedPdfs);
    }
    compressFiles(modifiedPdfs);
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>Invoice Tagger</title>
        <meta name="description" content="Assign IDs to PDFs" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        {showLoading && <p className="loading">Doing things...</p>}
        <div className="form">
        <div>
          <label htmlFor="excel-upload">Excel (optional):&nbsp;</label>
          <input onChange={handleExcel} type="file" id="excel-upload" name="excel-upload"
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" />
        </div>
        <div>
          <label htmlFor="file-upload">PDFs:&nbsp;</label>
          <input onChange={handlePdfs} type="file" id="file-upload" name="file-upload"
           multiple accept=".pdf" />
        </div>
        <div>
          <label htmlFor="number-select">Starting ID:&nbsp;</label>
          <input onChange={handleNum} value={starting} type="number" id="number-select" name="number-select" />
        </div>
        {showDownload && <div>
          <button onClick={handleDownload} className='magic-button dl'>Download Zip</button>
        </div>}
        </div>
      </main>
      <style jsx>{`
        .main {
          border: 1px solid white;
          min-height: 100vh;
          padding: 4rem 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }

        @media (prefers-color-scheme: dark) {
          .main {
            border: 1px solid black;
          }
        }
        .form {
          border: 1px solid white;
          padding: 10px;
          display: grid;
          row-gap: 30px;
        }
        .loading {
          position: absolute;
          top: 0;
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
