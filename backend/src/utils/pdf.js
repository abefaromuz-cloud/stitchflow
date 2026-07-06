const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

async function generateInvoicePdf(invoice, client, company, order) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size:'A4', margin:50 });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.fillColor('#0F1F3D').fontSize(22).text(company?.company_name||'StitchFlow', 50, 50);
      doc.fillColor('#D4AF37').fontSize(18).text(`СЧЁТ № ${invoice.invoice_number}`, 50, 110);
      doc.fillColor('#333').fontSize(9);
      if (company) {
        doc.text(`ИНН: ${company.tax_id||'-'}`, 50, 145);
        doc.text(`Р/с: ${company.bank_account||'-'} (${company.bank_name||'-'})`, 50, 159);
        doc.text(`Тел: ${company.phone||'-'}`, 50, 173);
      }
      doc.fontSize(10).fillColor('#0F1F3D').text('Плательщик:', 50, 200);
      doc.fontSize(9).fillColor('#333').text(`${client?.company_name||'-'}`, 50, 215);
      doc.text(`Дата: ${new Date(invoice.issue_date).toLocaleDateString('ru-RU')}`, 50, 240);
      if (invoice.due_date) doc.text(`Срок: ${new Date(invoice.due_date).toLocaleDateString('ru-RU')}`, 250, 240);
      doc.rect(50,265,495,24).fill('#0F1F3D');
      doc.fillColor('#fff').fontSize(9);
      doc.text('Товар/услуга', 60, 272); doc.text('Кол-во', 320, 272); doc.text('Сумма', 450, 272);
      doc.fillColor('#333').fontSize(9);
      doc.text(order?.product_name||'Производственные услуги', 60, 300, {width:250});
      doc.text(String(order?.quantity||1), 320, 300);
      doc.text(`₽${Number(invoice.amount).toLocaleString()}`, 450, 300);
      doc.fontSize(11).fillColor('#0F1F3D');
      doc.text('Итого к оплате:', 350, 340);
      doc.text(`₽${Number(invoice.total_amount).toLocaleString()}`, 450, 340);
      if (invoice.payment_qr_data) {
        const qrBuf = Buffer.from((await QRCode.toDataURL(invoice.payment_qr_data)).split(',')[1], 'base64');
        doc.image(qrBuf, 50, 370, {width:100});
        doc.fontSize(8).fillColor('#999').text('QR-код для оплаты', 50, 475);
      }
      doc.end();
    } catch (err) { reject(err); }
  });
}

module.exports = { generateInvoicePdf };
