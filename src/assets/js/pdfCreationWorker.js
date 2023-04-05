importScripts('./pdfkit.js');
importScripts('./svgToPdf.js');
importScripts('./blob-stream.js');

let numPages;
let pages;

function onFontLoadingFinished() {
  const doc = new PDFDocument();
  for (let i = 0; i < numPages; i += 1) {
    if (i !== 0) {
      doc.addPage();
    }
    const mainSvg = pages[i];
    SVGtoPDF(doc, mainSvg, 0, 0, { preserveAspectRatio: 'xMinYMinslice' });
  }
  const stream = doc.pipe(blobStream());
  doc.end();
  stream.on('finish', () => {
    const blob = stream.toBlob('application/pdf');
    postMessage(blob);
  });
}

self.onmessage = (e) => {
  if (e.data.type === 'start') {
    numPages = e.data.numPages;
    pages = e.data.pages;

    const oReq = new XMLHttpRequest();
    oReq.open('GET', '../fonts/musicFont.ttf', true);
    oReq.responseType = 'arraybuffer';

    const oReq2 = new XMLHttpRequest();
    oReq2.open('GET', '../fonts/SourceSansPro-Regular.ttf', true);
    oReq2.responseType = 'arraybuffer';

    const oReq3 = new XMLHttpRequest();
    oReq3.open('GET', '../fonts/a1.ttf', true);
    oReq3.responseType = 'arraybuffer';

    let finishedLoading = 3;

    oReq.onload = () => {
      const arrayBuffer = oReq.response;
      if (arrayBuffer) {
        musicFont = arrayBuffer;
        finishedLoading -= 1;
        if (finishedLoading === 0) {
          onFontLoadingFinished();
        }
      }
    };

    oReq2.onload = () => {
      const arrayBuffer2 = oReq2.response;
      if (arrayBuffer2) {
        sansFont = arrayBuffer2;
        finishedLoading -= 1;
        if (finishedLoading === 0) {
          onFontLoadingFinished();
        }
      }
    };

    oReq3.onload = () => {
      const arrayBuffer3 = oReq3.response;
      if (arrayBuffer3) {
        notesFont = arrayBuffer3;
        finishedLoading -= 1;
        if (finishedLoading === 0) {
          onFontLoadingFinished();
        }
      }
    };

    oReq.send(null);
    oReq2.send(null);
    oReq3.send(null);
  }
};
